export class AutoTracker {
    constructor() {
        this.detector = null;
        this.loading = false;
        this.loaded = false;
        this._canvas = null;
        this._ctx = null;
    }

    /**
     * Lazy-load MediaPipe ObjectDetector.
     * Dynamically imports the vision WASM module and loads the model.
     */
    async initialize() {
        if (this.loaded && this.detector) return;
        if (this.loading) {
            // Wait for ongoing load
            while (this.loading) {
                await new Promise(r => setTimeout(r, 100));
            }
            return;
        }

        this.loading = true;
        const CDN_VERSION = '0.10.18';
        const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}`;

        try {
            console.log(`[AutoTracker] Loading MediaPipe vision@${CDN_VERSION}...`);
            const vision = await import(`${CDN_BASE}/vision_bundle.mjs`);
            const { ObjectDetector, FilesetResolver } = vision;

            const fileset = await FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);

            this.detector = await ObjectDetector.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite',
                    delegate: 'GPU'
                },
                runningMode: 'IMAGE',
                maxResults: 10,
                scoreThreshold: 0.2
            });

            console.log('[AutoTracker] MediaPipe model loaded successfully (GPU delegate, float16)');
            this.loaded = true;
        } catch (err) {
            console.warn('[AutoTracker] GPU delegate failed, falling back to CPU:', err.message);
            // Fallback: try CPU delegate
            try {
                const vision = await import(`${CDN_BASE}/vision_bundle.mjs`);
                const { ObjectDetector, FilesetResolver } = vision;

                const fileset = await FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);

                this.detector = await ObjectDetector.createFromOptions(fileset, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite',
                        delegate: 'CPU'
                    },
                    runningMode: 'IMAGE',
                    maxResults: 10,
                    scoreThreshold: 0.2
                });

                console.log('[AutoTracker] MediaPipe model loaded successfully (CPU fallback, float16)');
                this.loaded = true;
            } catch (fallbackErr) {
                this.loading = false;
                console.error('[AutoTracker] Failed to load model on both GPU and CPU:', fallbackErr);
                throw new Error(`Failed to load tracking model: ${fallbackErr.message}`);
            }
        }
        this.loading = false;
    }

    /**
     * Draw the current video frame to an offscreen canvas for detection.
     * This guarantees pixel data is available regardless of video element state.
     */
    _drawToCanvas(videoEl) {
        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
            this._ctx = this._canvas.getContext('2d');
        }
        // Use native resolution — MediaPipe resizes internally to model input size
        this._canvas.width = w;
        this._canvas.height = h;
        this._ctx.drawImage(videoEl, 0, 0, w, h);
        return this._canvas;
    }

    /**
     * Track subjects through a scene and return keyframes.
     * @param {HTMLVideoElement} videoEl
     * @param {number} startTime - Scene start in seconds
     * @param {number} endTime - Scene end in seconds
     * @param {Object} options
     * @param {number} options.sampleRate - Frames per second to sample (default 3)
     * @param {number} options.cropWidthRatio - Crop width as ratio of video width (for crop% calc)
     * @param {function} options.onProgress - Callback(percent: 0-100, message: string)
     * @returns {Promise<Array<{t: number, cropPct: number}>>}
     */
    async track(videoEl, startTime, endTime, options = {}) {
        const {
            sampleRate = 3,
            cropWidthRatio = 0.5, // Default: crop is 50% of video width
            onProgress = () => {}
        } = options;

        if (!this.loaded) {
            onProgress(0, 'Loading tracking model...');
            await this.initialize();
        }

        const duration = endTime - startTime;
        if (duration <= 0) throw new Error('Invalid scene duration');

        const interval = 1 / sampleRate;
        const totalFrames = Math.floor(duration / interval);
        const rawPoints = [];
        const allCategoryNames = new Set();

        console.log(`[AutoTracker] Starting track: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s, ${totalFrames + 1} frames at ${sampleRate}fps, video ${videoEl.videoWidth}x${videoEl.videoHeight}`);

        for (let i = 0; i <= totalFrames; i++) {
            const time = Math.min(startTime + i * interval, endTime - 0.01);
            await this._seekTo(videoEl, time);

            onProgress(Math.round((i / totalFrames) * 90), 'Tracking...');

            let result;
            try {
                const canvas = this._drawToCanvas(videoEl);
                result = this.detector.detect(canvas);
            } catch (detectErr) {
                console.error(`[AutoTracker] detect() error at frame ${i} (t=${time.toFixed(2)}s):`, detectErr);
                continue;
            }

            // Log first 3 frames for diagnostics
            if (i < 3) {
                console.log(`[AutoTracker] Frame ${i} (t=${time.toFixed(2)}s) detections:`, JSON.stringify(result.detections.map(d => ({
                    categories: d.categories.map(c => ({ name: c.categoryName, score: c.score.toFixed(3) })),
                    bbox: d.boundingBox
                }))));
            }

            // Collect all category names for diagnostics
            for (const det of result.detections) {
                for (const cat of det.categories) {
                    allCategoryNames.add(cat.categoryName);
                }
            }

            const person = this._pickBestPerson(result.detections);

            if (person) {
                const videoWidth = videoEl.videoWidth;
                const cropW = videoWidth * cropWidthRatio;
                const centerX = person.boundingBox.originX + person.boundingBox.width / 2;

                // Convert to crop percentage: where should the crop window be placed?
                // cropPct = (centerX - cropW/2) / (videoWidth - cropW) * 100
                const maxOffset = videoWidth - cropW;
                let cropPct = 0;
                if (maxOffset > 0) {
                    cropPct = ((centerX - cropW / 2) / maxOffset) * 100;
                }
                cropPct = Math.max(0, Math.min(100, cropPct));

                rawPoints.push({
                    t: parseFloat((time - startTime).toFixed(3)),
                    cropPct: parseFloat(cropPct.toFixed(1))
                });
            }
        }

        console.log(`[AutoTracker] Tracking complete: ${rawPoints.length}/${totalFrames + 1} frames had person detections`);

        if (rawPoints.length === 0) {
            console.warn('[AutoTracker] No person detected. Categories seen across all frames:', [...allCategoryNames].join(', ') || '(none)');
            onProgress(100, 'No person detected');
            return [];
        }

        onProgress(95, 'Smoothing...');

        // Smooth with moving average
        const smoothed = this._smooth(rawPoints, 3);

        // Decimate to significant keyframes
        const keyframes = this._decimate(smoothed, 2.0);

        console.log(`[AutoTracker] Generated ${keyframes.length} keyframes from ${rawPoints.length} raw points`);
        onProgress(100, 'Done');
        return keyframes;
    }

    _seekTo(videoEl, time) {
        return new Promise((resolve) => {
            if (Math.abs(videoEl.currentTime - time) < 0.01) {
                // Even if time matches, ensure frame data is ready
                if (videoEl.readyState >= 2) {
                    resolve();
                    return;
                }
                const onReady = () => {
                    videoEl.removeEventListener('canplay', onReady);
                    resolve();
                };
                videoEl.addEventListener('canplay', onReady);
                return;
            }
            const onSeeked = () => {
                videoEl.removeEventListener('seeked', onSeeked);
                // Ensure pixel data is actually available (readyState >= 2 = HAVE_CURRENT_DATA)
                if (videoEl.readyState >= 2) {
                    resolve();
                } else {
                    const onReady = () => {
                        videoEl.removeEventListener('canplay', onReady);
                        resolve();
                    };
                    videoEl.addEventListener('canplay', onReady);
                }
            };
            videoEl.addEventListener('seeked', onSeeked);
            videoEl.currentTime = time;
        });
    }

    _pickBestPerson(detections) {
        // Find the "person" class detection with highest confidence * area
        // Case-insensitive match — COCO labels vary by model export (person vs Person)
        let best = null;
        let bestScore = 0;

        for (const det of detections) {
            for (const cat of det.categories) {
                if (cat.categoryName.toLowerCase() === 'person') {
                    const area = det.boundingBox.width * det.boundingBox.height;
                    const score = cat.score * area;
                    if (score > bestScore) {
                        bestScore = score;
                        best = det;
                    }
                }
            }
        }

        return best;
    }

    /**
     * Moving average smoothing on cropPct values.
     */
    _smooth(points, windowSize) {
        if (points.length <= windowSize) return [...points];
        const half = Math.floor(windowSize / 2);
        return points.map((p, i) => {
            const start = Math.max(0, i - half);
            const end = Math.min(points.length - 1, i + half);
            let sum = 0;
            let count = 0;
            for (let j = start; j <= end; j++) {
                sum += points[j].cropPct;
                count++;
            }
            return { t: p.t, cropPct: parseFloat((sum / count).toFixed(1)) };
        });
    }

    /**
     * Reduce points to significant keyframes using threshold-based decimation.
     * Keep a point if it deviates more than `threshold` from linear interpolation
     * between the previous kept point and the next.
     */
    _decimate(points, threshold) {
        if (points.length <= 2) return [...points];

        // Always keep first and last
        const result = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const prev = result[result.length - 1];
            const next = points[i + 1];
            const current = points[i];

            // Interpolated value at current.t between prev and next
            const segDuration = next.t - prev.t;
            const progress = segDuration > 0 ? (current.t - prev.t) / segDuration : 0;
            const interpolated = prev.cropPct + (next.cropPct - prev.cropPct) * progress;
            const deviation = Math.abs(current.cropPct - interpolated);

            if (deviation > threshold) {
                result.push(current);
            }
        }

        result.push(points[points.length - 1]);
        return result;
    }
}
