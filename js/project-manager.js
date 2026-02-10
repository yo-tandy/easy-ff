import { DOM_ELEMENTS, DEFAULTS } from './constants.js';
import { ErrorHandler } from './error-handler.js';

export class ProjectManager {
    constructor(tabManager, videoPreview, commandGenerator) {
        this.tabManager = tabManager;
        this.videoPreview = videoPreview;
        this.commandGenerator = commandGenerator;
        this.projectFileHandle = null;
    }

    async saveProject() {
        try {
            const data = {
                inputName: document.querySelector(DOM_ELEMENTS.inputName).value,
                inDim: document.querySelector(DOM_ELEMENTS.inDim).value,
                outDim: document.querySelector(DOM_ELEMENTS.outDim).value,
                videoFile: this.videoPreview.loadedVideoFilename,
                clips: []
            };

            // Validate project data
            if (!data.inputName.trim()) {
                throw new Error('Input filename is required');
            }

            try {
                ErrorHandler.validateDimensions(data.inDim);
                ErrorHandler.validateDimensions(data.outDim);
            } catch (error) {
                throw new Error(`Invalid dimensions: ${error.message}`);
            }

            const tabButtons = document.querySelectorAll('.tab-button');
            
            if (tabButtons.length === 0) {
                throw new Error('No clips to save');
            }

            tabButtons.forEach(btn => {
                const tabId = btn.id.replace('tabbtn-', '');
                const clipName = btn.querySelector('span')?.textContent || tabId;
                const scenes = document.querySelectorAll(`#${tabId} .scene`);
                const clipData = { name: clipName, scenes: [] };

                scenes.forEach(scene => {
                    try {
                        const sceneData = {
                            start: ErrorHandler.validateNumericInput(scene.querySelector('.start')?.value, 'Start time'),
                            end: ErrorHandler.validateNumericInput(scene.querySelector('.end')?.value, 'End time'),
                            hCrop: ErrorHandler.validateNumericInput(scene.querySelector('.hCrop')?.value, 'Horizontal crop', { min: 0, max: 100 }),
                            pan: scene.querySelector('.panToggle')?.checked || false,
                            hCropEnd: ErrorHandler.validateNumericInput(scene.querySelector('.hCropEnd')?.value, 'End horizontal crop', { min: 0, max: 100 }),
                            panMethod: scene.querySelector('.panMethod')?.value || 'linear'
                        };
                        
                        if (sceneData.end <= sceneData.start) {
                            throw new Error(`Invalid scene: end time (${sceneData.end}) must be greater than start time (${sceneData.start})`);
                        }
                        
                        clipData.scenes.push(sceneData);
                    } catch (error) {
                        throw new Error(`Error in clip "${clipName}": ${error.message}`);
                    }
                });
                
                if (clipData.scenes.length === 0) {
                    throw new Error(`Clip "${clipName}" has no scenes`);
                }
                
                data.clips.push(clipData);
            });

            const jsonContent = JSON.stringify(data, null, 2);

            // Try to use File System Access API if available
            if (window.showSaveFilePicker) {
                try {
                    const suggestedName = this.projectFileHandle ? this.projectFileHandle.name : 'ffmpeg-project.json';
                    
                    const handle = await window.showSaveFilePicker({
                        suggestedName: suggestedName,
                        types: [{
                            description: 'JSON Files',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });
                    
                    this.projectFileHandle = handle;
                    const writable = await handle.createWritable();
                    await writable.write(jsonContent);
                    await writable.close();
                    
                    ErrorHandler.showSuccess(`Project saved successfully as ${handle.name}`);
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') {
                        return; // User cancelled
                    }
                    console.warn('File System Access API failed, falling back to download:', err);
                }
            }

            // Fallback to traditional download
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ffmpeg-project.json';
            a.click();
            URL.revokeObjectURL(url);
            
            ErrorHandler.showSuccess('Project downloaded successfully');
            
        } catch (error) {
            ErrorHandler.showError(`Failed to save project: ${error.message}`);
        }
    }

    async loadProject() {
        // Try to use File System Access API if available
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                this.projectFileHandle = handle;
                const file = await handle.getFile();
                this.processProjectFile(file);
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return; // User cancelled
                }
                console.warn('File System Access API failed, falling back to file input:', err);
            }
        }

        // Fallback: use traditional file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.projectFileHandle = null; // Can't save to same location with file input
                this.processProjectFile(file);
            }
        };
        input.click();
    }

    processProjectFile(file) {
        const reader = new FileReader();
        
        reader.onerror = () => {
            ErrorHandler.showError('Failed to read project file');
        };
        
        reader.onload = (e) => {
            try {
                let data;
                try {
                    data = JSON.parse(e.target.result);
                } catch (parseError) {
                    throw new Error('Invalid JSON format. Please check the project file.');
                }

                // Validate required fields
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid project file format');
                }

                // Set global settings with validation
                const inputName = data.inputName || DEFAULTS.INPUT_FILE;
                const inDim = data.inDim || DEFAULTS.INPUT_DIMENSIONS;
                const outDim = data.outDim || DEFAULTS.OUTPUT_DIMENSIONS;
                
                try {
                    ErrorHandler.validateDimensions(inDim);
                    ErrorHandler.validateDimensions(outDim);
                } catch (error) {
                    throw new Error(`Invalid dimensions in project file: ${error.message}`);
                }

                document.querySelector(DOM_ELEMENTS.inputName).value = inputName;
                document.querySelector(DOM_ELEMENTS.inDim).value = inDim;
                document.querySelector(DOM_ELEMENTS.outDim).value = outDim;
                
                // Display message if video file needs to be loaded
                if (data.videoFile && !this.videoPreview.videoLoaded) {
                    const videoInfo = document.querySelector(DOM_ELEMENTS.videoInfo);
                    videoInfo.innerHTML = `<strong style="color: #dc3545;">⚠️ Please load video file: ${data.videoFile}</strong>`;
                    document.querySelector(DOM_ELEMENTS.videoFile).style.border = '2px solid #dc3545';
                }

                // Validate clips data
                if (!Array.isArray(data.clips)) {
                    throw new Error('Project file must contain a clips array');
                }

                if (data.clips.length === 0) {
                    throw new Error('Project file contains no clips');
                }

                // Validate each clip and scene
                data.clips.forEach((clip, clipIndex) => {
                    if (!clip.name || typeof clip.name !== 'string') {
                        throw new Error(`Clip ${clipIndex + 1} has invalid name`);
                    }
                    
                    if (!Array.isArray(clip.scenes)) {
                        throw new Error(`Clip "${clip.name}" has invalid scenes data`);
                    }
                    
                    if (clip.scenes.length === 0) {
                        throw new Error(`Clip "${clip.name}" has no scenes`);
                    }
                    
                    clip.scenes.forEach((scene, sceneIndex) => {
                        try {
                            ErrorHandler.validateNumericInput(scene.start, 'Start time');
                            ErrorHandler.validateNumericInput(scene.end, 'End time');
                            ErrorHandler.validateNumericInput(scene.hCrop, 'Horizontal crop', { min: 0, max: 100 });
                            ErrorHandler.validateNumericInput(scene.hCropEnd, 'End horizontal crop', { min: 0, max: 100 });
                            
                            if (scene.end <= scene.start) {
                                throw new Error(`End time must be greater than start time`);
                            }
                        } catch (error) {
                            throw new Error(`Scene ${sceneIndex + 1} in clip "${clip.name}": ${error.message}`);
                        }
                    });
                });

                // Load tabs and scenes from data
                this.tabManager.loadTabsFromData(data.clips);
                
                ErrorHandler.showSuccess(`Project loaded successfully: ${data.clips.length} clips`);

            } catch (err) {
                ErrorHandler.showError(`Failed to load project: ${err.message}`);
            }
        };
        
        reader.readAsText(file);
    }
}