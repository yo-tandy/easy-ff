import { DEFAULTS, DOM_ELEMENTS } from './constants.js';
import { formatTime, parseDimensions, debounce } from './utils.js';
import { ErrorHandler } from './error-handler.js';

export class VideoPreviewManager {
    constructor() {
        this.videoLoaded = false;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.cropPercent = 50;
        this.cropPercentEnd = 50;
        this.panMode = false;
        this.frameRate = DEFAULTS.DEFAULT_FRAME_RATE;
        this.selectedScene = null;
        this.loadedVideoFilename = '';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCropWindowDragging();
    }

    resetVideoState() {
        this.videoLoaded = false;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.loadedVideoFilename = '';
        
        // Hide video elements
        document.querySelector(DOM_ELEMENTS.videoContainer).style.display = 'none';
        document.querySelector(DOM_ELEMENTS.videoSeek).style.display = 'none';
        document.querySelector(DOM_ELEMENTS.videoControls).style.display = 'none';
        document.querySelector(DOM_ELEMENTS.sceneActions).style.display = 'none';
        
        // Clear video info
        document.querySelector(DOM_ELEMENTS.videoInfo).innerHTML = '';
    }

    setupEventListeners() {
        const videoFile = document.querySelector(DOM_ELEMENTS.videoFile);
        const videoSeek = document.querySelector(DOM_ELEMENTS.videoSeek);
        const outDim = document.querySelector(DOM_ELEMENTS.outDim);

        videoFile?.addEventListener('change', (e) => this.loadVideo(e));
        videoSeek?.addEventListener('input', (e) => this.seekVideo(e.target.value));
        outDim?.addEventListener('input', () => this.updateCropWindow());
    }

    loadVideo(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Validate the video file
            ErrorHandler.validateFile(file, {
                maxSize: 2 * 1024 * 1024 * 1024, // 2GB for video files
                allowedTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/mkv', 'video/quicktime'],
                requiredExtensions: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv']
            });

            const video = document.querySelector(DOM_ELEMENTS.previewVideo);
            const url = URL.createObjectURL(file);
            
            // Clear any previous error states
            document.querySelector(DOM_ELEMENTS.videoFile).classList.remove('input-error');
            
            video.src = url;

            video.onloadedmetadata = () => {
                try {
                    this.videoWidth = video.videoWidth;
                    this.videoHeight = video.videoHeight;

                    if (this.videoWidth === 0 || this.videoHeight === 0) {
                        throw new Error('Invalid video dimensions. The file may be corrupted.');
                    }

                    // Update input dimensions
                    document.querySelector(DOM_ELEMENTS.inDim).value = `${this.videoWidth}x${this.videoHeight}`;
                    
                    // Update input filename
                    document.querySelector(DOM_ELEMENTS.inputName).value = file.name;
                    this.loadedVideoFilename = file.name;

                    // Show video elements
                    document.querySelector(DOM_ELEMENTS.videoContainer).style.display = 'inline-block';
                    document.querySelector(DOM_ELEMENTS.videoSeek).style.display = 'block';
                    document.querySelector(DOM_ELEMENTS.videoControls).style.display = 'flex';
                    document.querySelector(DOM_ELEMENTS.sceneActions).style.display = 'flex';

                    // Set up seek bar
                    const seekBar = document.querySelector(DOM_ELEMENTS.videoSeek);
                    seekBar.max = video.duration;

                    // Calculate display size
                    const scale = Math.min(1, DEFAULTS.MAX_VIDEO_WIDTH / this.videoWidth);
                    this.displayWidth = this.videoWidth * scale;
                    this.displayHeight = this.videoHeight * scale;
                    video.style.width = this.displayWidth + 'px';
                    video.style.height = this.displayHeight + 'px';

                    // Set up overlay canvas
                    const overlay = document.querySelector(DOM_ELEMENTS.cropOverlay);
                    overlay.width = this.displayWidth;
                    overlay.height = this.displayHeight;
                    overlay.style.width = this.displayWidth + 'px';
                    overlay.style.height = this.displayHeight + 'px';

                    document.querySelector(DOM_ELEMENTS.videoInfo).innerHTML = 
                        `${this.videoWidth}×${this.videoHeight}, ${formatTime(video.duration)}`;
                    document.querySelector(DOM_ELEMENTS.videoFile).style.border = '';

                    this.videoLoaded = true;
                    this.updateCropWindow();
                    this.updateTimeDisplay();

                    ErrorHandler.showSuccess(`Video loaded successfully: ${file.name}`);
                } catch (error) {
                    ErrorHandler.showError(`Failed to process video: ${error.message}`);
                    this.resetVideoState();
                }
            };

            video.onerror = (e) => {
                ErrorHandler.showError('Failed to load video. The file may be corrupted or in an unsupported format.');
                this.resetVideoState();
            };

            video.ontimeupdate = () => {
                if (!video.seeking) {
                    document.querySelector(DOM_ELEMENTS.videoSeek).value = video.currentTime;
                    this.updateTimeDisplay();
                }
            };

        } catch (error) {
            document.querySelector(DOM_ELEMENTS.videoFile).classList.add('input-error');
            ErrorHandler.showError(`Video upload failed: ${error.message}`);
        }
    }

    updateCropWindow() {
        if (!this.videoLoaded) return;

        try {
            const video = document.querySelector(DOM_ELEMENTS.previewVideo);
            const cropWindow = document.querySelector(DOM_ELEMENTS.cropWindow);
            const cropWindowEnd = document.querySelector(DOM_ELEMENTS.cropWindowEnd);
            
            const outDimValue = document.querySelector(DOM_ELEMENTS.outDim).value;
            const [outW, outH] = parseDimensions(outDimValue);

            if (outW <= 0 || outH <= 0) {
                throw new Error('Invalid output dimensions');
            }

            // Calculate crop dimensions in video space
            const ratio = Math.min(this.videoHeight/outH, this.videoWidth/outW);
            const cropH = ratio * outH;
            const cropW = ratio * outW;

            // Scale to display size
            const scale = this.displayWidth / this.videoWidth;
            const dispCropW = cropW * scale;
            const dispCropH = cropH * scale;

            // Position start crop based on cropPercent
            const maxX = this.displayWidth - dispCropW;
            const x = Math.max(0, Math.min(maxX, maxX * (this.cropPercent / 100)));
            const y = (this.displayHeight - dispCropH) / 2;

            cropWindow.style.width = dispCropW + 'px';
            cropWindow.style.height = dispCropH + 'px';
            cropWindow.style.left = x + 'px';
            cropWindow.style.top = y + 'px';

            document.querySelector(DOM_ELEMENTS.cropDisplay).textContent = `Crop: ${this.cropPercent.toFixed(1)}%`;

            // Draw darkened overlay on canvas with holes for crop windows
            const overlay = document.querySelector(DOM_ELEMENTS.cropOverlay);
            const ctx = overlay.getContext('2d');
            
            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }
            
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            
            // Cut out holes for crop windows using destination-out blend mode
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            ctx.fillRect(x, y, dispCropW, dispCropH);

            // Update end crop window if pan mode is on
            if (this.panMode) {
                const xEnd = Math.max(0, Math.min(maxX, maxX * (this.cropPercentEnd / 100)));
                cropWindowEnd.style.width = dispCropW + 'px';
                cropWindowEnd.style.height = dispCropH + 'px';
                cropWindowEnd.style.left = xEnd + 'px';
                cropWindowEnd.style.top = y + 'px';
                cropWindowEnd.style.display = 'block';
                
                // Cut out hole for end crop window
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                ctx.fillRect(xEnd, y, dispCropW, dispCropH);
                
                document.querySelector(DOM_ELEMENTS.cropDisplayEnd).textContent = `End: ${this.cropPercentEnd.toFixed(1)}%`;
                document.querySelector(DOM_ELEMENTS.cropDisplayEnd).style.display = 'inline';
            } else {
                cropWindowEnd.style.display = 'none';
                document.querySelector(DOM_ELEMENTS.cropDisplayEnd).style.display = 'none';
            }
            
            // Reset blend mode
            ctx.globalCompositeOperation = 'source-over';
        } catch (error) {
            console.error('Error updating crop window:', error);
            ErrorHandler.showError(`Failed to update crop preview: ${error.message}`);
        }
    }

    setupCropWindowDragging() {
        const cropWindow = document.querySelector(DOM_ELEMENTS.cropWindow);
        const cropWindowEnd = document.querySelector(DOM_ELEMENTS.cropWindowEnd);
        let isDragging = false;
        let isDraggingEnd = false;
        let startX, startCropPercent;

        const startDrag = (e, isEnd = false) => {
            if (isEnd) {
                isDraggingEnd = true;
                startCropPercent = this.cropPercentEnd;
            } else {
                isDragging = true;
                startCropPercent = this.cropPercent;
            }
            startX = e.clientX;
            e.preventDefault();
        };

        const handleDrag = (e) => {
            if ((!isDragging && !isDraggingEnd) || !this.videoLoaded) return;

            const [outW, outH] = parseDimensions(document.querySelector(DOM_ELEMENTS.outDim).value);
            const ratio = Math.min(this.videoHeight/outH, this.videoWidth/outW);
            const cropW = ratio * outW;
            const scale = this.displayWidth / this.videoWidth;
            const dispCropW = cropW * scale;
            const maxX = this.displayWidth - dispCropW;

            const dx = e.clientX - startX;
            const deltaPercent = (dx / maxX) * 100;
            
            if (isDragging) {
                this.cropPercent = Math.max(0, Math.min(100, startCropPercent + deltaPercent));
            } else if (isDraggingEnd) {
                this.cropPercentEnd = Math.max(0, Math.min(100, startCropPercent + deltaPercent));
            }

            this.updateCropWindow();
        };

        const endDrag = () => {
            isDragging = false;
            isDraggingEnd = false;
        };

        cropWindow?.addEventListener('mousedown', (e) => startDrag(e, false));
        cropWindowEnd?.addEventListener('mousedown', (e) => startDrag(e, true));
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', endDrag);
    }

    seekVideo(value) {
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        video.currentTime = parseFloat(value);
        this.updateTimeDisplay();
    }

    stepFrame(frames) {
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const frameDuration = 1 / this.frameRate;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + frames * frameDuration));
        this.updateTimeDisplay();
    }

    togglePlay() {
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const btn = document.querySelector(DOM_ELEMENTS.playPauseBtn);
        if (video.paused) {
            video.play();
            btn.textContent = '⏸ Pause';
        } else {
            video.pause();
            btn.textContent = '▶ Play';
        }
    }

    updateTimeDisplay() {
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const currentSeconds = video.currentTime.toFixed(2);
        const durationSeconds = video.duration.toFixed(2);
        document.querySelector(DOM_ELEMENTS.timeDisplay).textContent = 
            `${formatTime(video.currentTime)} (${currentSeconds}s) / ${formatTime(video.duration)} (${durationSeconds}s)`;
    }

    togglePanMode(manual = true) {
        this.panMode = !this.panMode;
        const btn = document.querySelector(DOM_ELEMENTS.panToggleBtn);
        const setEndBtn = document.querySelector(DOM_ELEMENTS.setEndCropBtn);
        
        if (this.panMode) {
            btn.textContent = 'Pan: ON';
            btn.style.background = '#28a745';
            setEndBtn.style.display = 'inline-block';
            
            if (manual) {
                this.cropPercentEnd = this.cropPercent;
            }
            
            if (manual && this.selectedScene) {
                const panToggle = this.selectedScene.querySelector('.panToggle');
                if (!panToggle.checked) {
                    panToggle.checked = true;
                    // Trigger scene update
                    panToggle.dispatchEvent(new Event('change'));
                }
            }
        } else {
            btn.textContent = 'Pan: OFF';
            btn.style.background = '#007bff';
            setEndBtn.style.display = 'none';
            
            if (manual && this.selectedScene) {
                const panToggle = this.selectedScene.querySelector('.panToggle');
                if (panToggle.checked) {
                    panToggle.checked = false;
                    // Trigger scene update
                    panToggle.dispatchEvent(new Event('change'));
                }
            }
        }
        
        if (manual) {
            this.updateCropWindow();
        }
    }

    selectScene(sceneEl) {
        // Deselect previous
        document.querySelectorAll('.scene.selected').forEach(s => s.classList.remove('selected'));
        
        if (sceneEl) {
            sceneEl.classList.add('selected');
            this.selectedScene = sceneEl;
            
            // Jump video to scene start time
            if (this.videoLoaded) {
                const video = document.querySelector(DOM_ELEMENTS.previewVideo);
                const start = parseFloat(sceneEl.querySelector('.start').value) || 0;
                video.currentTime = start;
                
                // Set crop position from scene
                const hCrop = parseFloat(sceneEl.querySelector('.hCrop').value) || 50;
                this.cropPercent = hCrop;
                
                // Set end crop position from scene
                const hCropEnd = parseFloat(sceneEl.querySelector('.hCropEnd').value) || hCrop;
                this.cropPercentEnd = hCropEnd;
                
                // Check if scene has pan enabled and update preview accordingly
                const isPan = sceneEl.querySelector('.panToggle').checked;
                if (isPan !== this.panMode) {
                    this.togglePanMode(false);
                }
                
                this.updateCropWindow();
            }
        } else {
            this.selectedScene = null;
        }
    }

    setSceneStart() {
        if (!this.videoLoaded || !this.selectedScene) {
            alert('Please load a video and click on a scene to select it first.');
            return;
        }
        
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const startInput = this.selectedScene.querySelector('.start');
        const lengthInput = this.selectedScene.querySelector('.length');
        const endInput = this.selectedScene.querySelector('.end');
        
        startInput.value = video.currentTime.toFixed(2);
        const end = parseFloat(endInput.value) || 0;
        lengthInput.value = (end - video.currentTime).toFixed(2);
        
        // Trigger update events
        startInput.dispatchEvent(new Event('input'));
    }

    setSceneEnd() {
        if (!this.videoLoaded || !this.selectedScene) {
            alert('Please load a video and click on a scene to select it first.');
            return;
        }
        
        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const startInput = this.selectedScene.querySelector('.start');
        const lengthInput = this.selectedScene.querySelector('.length');
        const endInput = this.selectedScene.querySelector('.end');
        
        endInput.value = video.currentTime.toFixed(2);
        const start = parseFloat(startInput.value) || 0;
        lengthInput.value = (video.currentTime - start).toFixed(2);
        
        // Trigger update events
        endInput.dispatchEvent(new Event('input'));
    }

    setSceneCrop() {
        if (!this.videoLoaded || !this.selectedScene) {
            alert('Please load a video and click on a scene to select it first.');
            return;
        }
        
        const hCropInput = this.selectedScene.querySelector('.hCrop');
        hCropInput.value = this.cropPercent.toFixed(1);
        
        // Trigger update event
        hCropInput.dispatchEvent(new Event('input'));
    }

    setSceneCropEnd() {
        if (!this.videoLoaded || !this.selectedScene) {
            alert('Please load a video and click on a scene to select it first.');
            return;
        }
        
        const hCropEndInput = this.selectedScene.querySelector('.hCropEnd');
        hCropEndInput.value = this.cropPercentEnd.toFixed(1);
        
        // Trigger update event
        hCropEndInput.dispatchEvent(new Event('input'));
    }
}