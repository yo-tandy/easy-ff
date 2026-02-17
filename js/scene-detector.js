export class SceneDetector {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.aborted = false;
    }

    _ensureCanvas() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
    }

    abort() {
        this.aborted = true;
    }

    /**
     * Detect scene cuts by comparing consecutive frame histograms.
     * @param {HTMLVideoElement} videoEl
     * @param {Object} options
     * @param {number} options.sampleRate - Frames per second to sample (default 4)
     * @param {number} options.sensitivity - Lower = more sensitive (default 0.4)
     * @param {function} options.onProgress - Callback(percent: 0-100)
     * @returns {Promise<Array<{time: number, confidence: number}>>}
     */
    async detect(videoEl, options = {}) {
        const {
            sampleRate = 4,
            sensitivity = 0.4,
            onProgress = () => {}
        } = options;

        this.aborted = false;
        this._ensureCanvas();

        const duration = videoEl.duration;
        if (!duration || !isFinite(duration)) {
            throw new Error('Video has no valid duration');
        }

        // Set canvas to a small analysis size for performance
        const analyzeW = 160;
        const analyzeH = 120;
        this.canvas.width = analyzeW;
        this.canvas.height = analyzeH;

        const interval = 1 / sampleRate;
        const totalFrames = Math.floor(duration / interval);
        const boundaries = [];

        let prevHistogram = null;
        const distances = [];

        for (let i = 0; i <= totalFrames; i++) {
            if (this.aborted) return [];

            const time = Math.min(i * interval, duration - 0.01);
            await this._seekTo(videoEl, time);

            this.ctx.drawImage(videoEl, 0, 0, analyzeW, analyzeH);
            const imageData = this.ctx.getImageData(0, 0, analyzeW, analyzeH);
            const histogram = this._computeHistogram(imageData);

            if (prevHistogram) {
                const distance = this._chiSquaredDistance(prevHistogram, histogram);
                distances.push({ time, distance });
            }

            prevHistogram = histogram;
            onProgress(Math.round((i / totalFrames) * 100));
        }

        if (distances.length === 0) return [];

        // Compute adaptive threshold: mean + sensitivity * stddev
        const mean = distances.reduce((s, d) => s + d.distance, 0) / distances.length;
        const variance = distances.reduce((s, d) => s + (d.distance - mean) ** 2, 0) / distances.length;
        const stddev = Math.sqrt(variance);
        const threshold = mean + (1 / sensitivity) * stddev;

        // Find peaks above threshold
        for (const { time, distance } of distances) {
            if (distance > threshold) {
                // Normalize confidence: how far above threshold (capped at 1.0)
                const confidence = Math.min(1.0, (distance - mean) / (threshold - mean + 0.001));
                // Avoid duplicates within 0.5s
                if (boundaries.length === 0 || time - boundaries[boundaries.length - 1].time > 0.5) {
                    boundaries.push({ time: parseFloat(time.toFixed(3)), confidence: parseFloat(confidence.toFixed(2)) });
                }
            }
        }

        onProgress(100);
        return boundaries;
    }

    _seekTo(videoEl, time) {
        return new Promise((resolve) => {
            if (Math.abs(videoEl.currentTime - time) < 0.01) {
                resolve();
                return;
            }
            const onSeeked = () => {
                videoEl.removeEventListener('seeked', onSeeked);
                resolve();
            };
            videoEl.addEventListener('seeked', onSeeked);
            videoEl.currentTime = time;
        });
    }

    _computeHistogram(imageData) {
        const data = imageData.data;
        const bins = 32; // 32 bins per channel (R, G, B)
        const histogram = new Float32Array(bins * 3);
        const binSize = 256 / bins;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            histogram[Math.floor(data[i] / binSize)] += 1;           // R
            histogram[bins + Math.floor(data[i + 1] / binSize)] += 1; // G
            histogram[bins * 2 + Math.floor(data[i + 2] / binSize)] += 1; // B
        }

        // Normalize
        for (let i = 0; i < histogram.length; i++) {
            histogram[i] /= pixelCount;
        }

        return histogram;
    }

    _chiSquaredDistance(h1, h2) {
        let distance = 0;
        for (let i = 0; i < h1.length; i++) {
            const sum = h1[i] + h2[i];
            if (sum > 0) {
                distance += ((h1[i] - h2[i]) ** 2) / sum;
            }
        }
        return distance;
    }
}
