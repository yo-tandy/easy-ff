import { DEFAULTS, DOM_ELEMENTS } from './constants.js';
import { VideoPreviewManager } from './video-preview.js';
import { SceneManager } from './scene-manager.js';
import { TabManager } from './tab-manager.js';
import { CommandGenerator } from './command-generator.js';
import { ProjectManager } from './project-manager.js';
import { ErrorHandler } from './error-handler.js';
import { ValidationSetup } from './validation-setup.js';

export class FFmpegToolApp {
    constructor() {
        this.validationSetup = new ValidationSetup();
        this.commandGenerator = new CommandGenerator();
        this.videoPreview = new VideoPreviewManager();
        this.sceneManager = new SceneManager(this.commandGenerator, this.videoPreview, this.validationSetup.inputValidator);
        this.tabManager = new TabManager(this.sceneManager, this.commandGenerator);
        this.projectManager = new ProjectManager(this.tabManager, this.videoPreview, this.commandGenerator);

        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.initializeDefaults();
        
        // Initialize validation system after DOM is ready
        setTimeout(() => {
            this.validationSetup.initialize();
        }, 100);
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
}