import { DEFAULTS, DOM_ELEMENTS } from './constants.js';
import { formatTime } from './utils.js';
import { VideoPreviewManager } from './video-preview.js';
import { SceneManager } from './scene-manager.js';
import { TabManager } from './tab-manager.js';
import { CommandGenerator } from './command-generator.js';
import { ProjectManager } from './project-manager.js';
import { ErrorHandler } from './error-handler.js';
import { ValidationSetup } from './validation-setup.js';
import { SceneDetector } from './scene-detector.js';
import { AutoTracker } from './auto-tracker.js';

export class FFmpegToolApp {
    constructor() {
        this.validationSetup = new ValidationSetup();
        this.commandGenerator = new CommandGenerator();
        this.videoPreview = new VideoPreviewManager();
        this.sceneManager = new SceneManager(this.commandGenerator, this.videoPreview, this.validationSetup.inputValidator);
        this.tabManager = new TabManager(this.sceneManager, this.commandGenerator, this.validationSetup);
        this.projectManager = new ProjectManager(this.tabManager, this.videoPreview, this.commandGenerator);
        this.sceneDetector = new SceneDetector();
        this.autoTracker = new AutoTracker();

        // Make autoTracker available to sceneManager
        this.sceneManager.autoTracker = this.autoTracker;

        // Wire crop drag callback: update selected keyframe when crop window is dragged
        this.videoPreview.onCropDragEnd = (cropPct, isEnd) => {
            if (!isEnd) this.sceneManager.updateSelectedKeyframeCrop(cropPct);
        };

        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.initializeDefaults();
        this.validationSetup.initialize();
        this.tabManager.initializeFirstTab();
    }

    setupGlobalEventListeners() {
        try {
            // Save/Load project buttons
            document.querySelector('[data-action="save-project"]')?.addEventListener('click', () => {
                ErrorHandler.safeAsync(() => this.projectManager.saveProject(), 'Failed to save project');
            });

            document.querySelector('[data-action="load-project"]')?.addEventListener('click', () => {
                ErrorHandler.safeAsync(() => this.projectManager.loadProject(), 'Failed to load project');
            });

            document.querySelector('[data-action="download-script"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.commandGenerator.downloadScript(), 'Failed to download script');
            });

            // Add tab button
            document.querySelector('[data-action="add-tab"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.tabManager.addTab(), 'Failed to add new clip');
            });

            // Video control buttons
            document.querySelector('[data-action="step-frame-back-10"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.stepFrame(-10), 'Failed to step video back');
            });

            document.querySelector('[data-action="step-frame-back-1"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.stepFrame(-1), 'Failed to step video back');
            });

            document.querySelector('[data-action="toggle-play"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.togglePlay(), 'Failed to toggle video playback');
            });

            document.querySelector('[data-action="step-frame-forward-1"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.stepFrame(1), 'Failed to step video forward');
            });

            document.querySelector('[data-action="step-frame-forward-10"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.stepFrame(10), 'Failed to step video forward');
            });

            // Scene action buttons
            document.querySelector('[data-action="set-scene-start"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.setSceneStart(), 'Failed to set scene start time');
            });

            document.querySelector('[data-action="set-scene-end"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.setSceneEnd(), 'Failed to set scene end time');
            });

            document.querySelector('[data-action="set-scene-crop"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.setSceneCrop(), 'Failed to set scene crop position');
            });

            document.querySelector('[data-action="toggle-pan-mode"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.togglePanMode(), 'Failed to toggle pan mode');
            });

            document.querySelector('[data-action="set-scene-crop-end"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.videoPreview.setSceneCropEnd(), 'Failed to set scene end crop position');
            });

            document.querySelector('[data-action="add-scene-from-preview"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.sceneManager.addSceneFromPreview(this.tabManager.getActiveTab()), 'Failed to add scene from preview');
            });

            // Scene detection
            document.querySelector('[data-action="detect-scenes"]')?.addEventListener('click', () => {
                ErrorHandler.safeAsync(() => this.runSceneDetection(), 'Failed to detect scenes');
            });

            document.querySelector('[data-action="create-detected-scenes"]')?.addEventListener('click', () => {
                ErrorHandler.safe(() => this.createScenesFromDetection(), 'Failed to create scenes');
            });

            document.querySelector('[data-action="dismiss-detect-results"]')?.addEventListener('click', () => {
                document.getElementById('sceneDetectResults').style.display = 'none';
                document.getElementById('sceneDetectProgress').style.display = 'none';
            });

            // Global error handler for unhandled errors
            window.addEventListener('error', (event) => {
                console.error('Unhandled error:', event.error);
                ErrorHandler.showError(`Unexpected error: ${event.error?.message || 'Unknown error'}`);
            });

            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                console.error('Unhandled promise rejection:', event.reason);
                ErrorHandler.showError(`Unexpected error: ${event.reason?.message || 'Promise rejection'}`);
                event.preventDefault();
            });

        } catch (error) {
            console.error('Failed to setup event listeners:', error);
            ErrorHandler.showError('Failed to initialize application controls');
        }
    }

    initializeDefaults() {
        document.querySelector(DOM_ELEMENTS.inputName).value = DEFAULTS.INPUT_FILE;
        document.querySelector(DOM_ELEMENTS.inDim).value = DEFAULTS.INPUT_DIMENSIONS;
        document.querySelector(DOM_ELEMENTS.outDim).value = DEFAULTS.OUTPUT_DIMENSIONS;
    }

    // Public API methods for external access
    getVideoPreview() {
        return this.videoPreview;
    }

    getSceneManager() {
        return this.sceneManager;
    }

    getTabManager() {
        return this.tabManager;
    }

    getCommandGenerator() {
        return this.commandGenerator;
    }

    getProjectManager() {
        return this.projectManager;
    }

    async runSceneDetection() {
        if (!this.videoPreview.videoLoaded) {
            alert('Please load a video first.');
            return;
        }

        const video = document.querySelector(DOM_ELEMENTS.previewVideo);
        const progressEl = document.getElementById('sceneDetectProgress');
        const fillEl = document.getElementById('sceneDetectFill');
        const resultsEl = document.getElementById('sceneDetectResults');

        progressEl.style.display = 'block';
        resultsEl.style.display = 'none';

        // Pause video during detection
        video.pause();

        const boundaries = await this.sceneDetector.detect(video, {
            sampleRate: 4,
            sensitivity: 0.4,
            onProgress: (pct) => {
                fillEl.style.width = pct + '%';
                fillEl.textContent = pct + '%';
            }
        });

        if (boundaries.length === 0) {
            progressEl.style.display = 'none';
            ErrorHandler.showSuccess('No scene cuts detected. Try adjusting sensitivity.');
            return;
        }

        // Compute scene segments (ranges between boundaries)
        const videoDuration = video.duration;
        const cutTimes = boundaries.map(b => b.time);
        const segments = [];
        const allTimes = [0, ...cutTimes, videoDuration];
        for (let i = 0; i < allTimes.length - 1; i++) {
            segments.push({
                start: parseFloat(allTimes[i].toFixed(2)),
                end: parseFloat(allTimes[i + 1].toFixed(2)),
                duration: parseFloat((allTimes[i + 1] - allTimes[i]).toFixed(2))
            });
        }

        this._lastDetectedSegments = segments;
        this._lastShiftClickIdx = null;

        // Build results list showing scenes (segments), not boundaries
        const listEl = document.getElementById('sceneDetectList');
        listEl.innerHTML = '';

        const fmtTime = (s) => `${formatTime(s)} (${s.toFixed(2)}s)`;

        segments.forEach((seg, idx) => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <input type="checkbox" data-segment-idx="${idx}">
                <span class="segment-label">Scene ${idx + 1}:</span>
                <span class="segment-times">${fmtTime(seg.start)} → ${fmtTime(seg.end)}</span>
                <span class="segment-duration">${fmtTime(seg.duration)}</span>
            `;

            // Click row to seek; shift+click for range selection
            item.addEventListener('click', (e) => {
                // Ignore if clicking directly on the checkbox input
                if (e.target.tagName === 'INPUT') {
                    this._lastShiftClickIdx = idx;
                    return;
                }

                const checkbox = item.querySelector('input[type="checkbox"]');

                if (e.shiftKey && this._lastShiftClickIdx != null) {
                    // Range select: check all between last click and this one (inclusive)
                    const from = Math.min(this._lastShiftClickIdx, idx);
                    const to = Math.max(this._lastShiftClickIdx, idx);
                    const allItems = listEl.querySelectorAll('input[type="checkbox"]');
                    for (let i = from; i <= to; i++) {
                        allItems[i].checked = true;
                    }
                } else {
                    // Single click: toggle checkbox and seek
                    checkbox.checked = !checkbox.checked;
                    video.currentTime = seg.start;
                    this.videoPreview.updateTimeDisplay();
                }
                this._lastShiftClickIdx = idx;
            });

            listEl.appendChild(item);
        });

        resultsEl.style.display = 'block';
        ErrorHandler.showSuccess(`Detected ${segments.length} scenes.`);
    }

    createScenesFromDetection() {
        const segments = this._lastDetectedSegments;
        if (!segments || segments.length === 0) return;

        const tabId = this.tabManager.getActiveTab();
        if (!tabId) return;

        // Collect checked segments
        const listEl = document.getElementById('sceneDetectList');
        const checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
        const selectedSegments = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const idx = parseInt(cb.dataset.segmentIdx);
                selectedSegments.push(segments[idx]);
            }
        });

        if (selectedSegments.length === 0) {
            alert('Please select at least one scene.');
            return;
        }

        // Append selected segments to existing scenes (don't clear)
        const container = document.querySelector(`#${tabId} .scenes`);

        for (const seg of selectedSegments) {
            const sceneData = {
                start: seg.start,
                end: seg.end,
                hCrop: 50
            };
            const div = this.sceneManager.createSceneElement(tabId, sceneData);
            container.appendChild(div);
        }

        this.sceneManager.recalcClipStarts(tabId);
        this.commandGenerator.updateCommand(tabId);
        this.sceneManager.validateAllTabs();

        // Hide results
        document.getElementById('sceneDetectResults').style.display = 'none';
        document.getElementById('sceneDetectProgress').style.display = 'none';

        ErrorHandler.showSuccess(`Added ${selectedSegments.length} scenes to clip.`);
    }
}