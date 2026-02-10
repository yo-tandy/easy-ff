import { DEFAULTS } from './constants.js';
import { parseDimensions, validateNumericInput, createElementFromHTML } from './utils.js';
import { ErrorHandler } from './error-handler.js';
import { InputValidator } from './input-validator.js';

export class SceneManager {
    constructor(commandGenerator, videoPreview) {
        this.sceneCount = 0;
        this.draggedScene = null;
        this.draggedTabId = null;
        this.commandGenerator = commandGenerator;
        this.videoPreview = videoPreview;
        this.inputValidator = new InputValidator();
    }

    createSceneElement(tabId, sceneData) {
        this.sceneCount++;
        const sceneId = this.sceneCount;
        
        const { start, end, hCrop, pan = false, hCropEnd = hCrop, panMethod = 'linear' } = sceneData;
        const length = (end - start).toFixed(2);

        const html = `
            <div class="card scene" id="scene-${sceneId}">
                <div class="drag-handle" title="Drag to reorder"></div>
                <button class="remove-x" title="Remove scene">×</button>
                <button class="scene-copy-btn" title="Copy scene command">📋</button>
                <div class="grid">
                    <div class="clipStartField"><label>Clip Start</label><input type="number" class="clipStart" value="0" step="0.1" data-validate="time" readonly></div>
                    <div><label>Start (s)</label><input type="number" class="start" value="${start}" step="0.1" data-validate="time" data-validate-options='{"validateOnInput": true}'></div>
                    <div><label>Length (s)</label><input type="number" class="length" value="${length}" step="0.1" min="0" data-validate="duration" data-validate-options='{"validateOnInput": true}'></div>
                    <div class="endField"><label>End (s)</label><input type="number" class="end" value="${end}" step="0.1" data-validate="time" data-validate-options='{"validateOnInput": true}'></div>
                    <div><label>Horiz. Crop %</label><input type="number" class="hCrop" value="${hCrop}" min="0" max="100" data-validate="percentage" data-validate-options='{"validateOnInput": true}'></div>
                    <div class="panField"><label>Pan?</label><input type="checkbox" class="panToggle" ${pan ? 'checked' : ''}></div>
                </div>
                <div id="panFields-${sceneId}" style="display:${pan ? 'flex' : 'none'}; margin-left:8px;" class="grid">
                    <div><label>End Horiz %</label><input type="number" class="hCropEnd" value="${hCropEnd}" min="0" max="100" data-validate="percentage" data-validate-options='{"validateOnInput": true}'></div>
                    <div>
                        <label>Pan Method</label>
                        <select class="panMethod">
                            <option value="linear" ${panMethod === 'linear' ? 'selected' : ''}>Linear</option>
                            <option value="zoom" ${panMethod === 'zoom' ? 'selected' : ''}>Zoom-like</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        const div = createElementFromHTML(html);
        this.setupSceneEventListeners(div, tabId, sceneId);
        this.setupSceneDrag(div, tabId);

        return div;
    }

    setupSceneEventListeners(sceneEl, tabId, sceneId) {
        // Remove button
        const removeBtn = sceneEl.querySelector('.remove-x');
        removeBtn.addEventListener('click', () => {
            sceneEl.remove();
            this.commandGenerator.updateCommand(tabId);
            this.validateAllTabs();
            this.recalcClipStarts(tabId);
        });

        // Copy scene command button
        const copyBtn = sceneEl.querySelector('.scene-copy-btn');
        copyBtn.addEventListener('click', () => {
            this.commandGenerator.copySceneCommand(tabId, sceneEl);
        });

        // Setup input validation for all validated inputs
        const validatedInputs = sceneEl.querySelectorAll('[data-validate]');
        validatedInputs.forEach(input => {
            const validateType = input.dataset.validate;
            const options = JSON.parse(input.dataset.validateOptions || '{}');
            this.inputValidator.setupInputValidation(input, validateType, options);
        });

        // Input synchronization with validation
        const startInput = sceneEl.querySelector('.start');
        const lengthInput = sceneEl.querySelector('.length');
        const endInput = sceneEl.querySelector('.end');
        const clipStartInput = sceneEl.querySelector('.clipStart');

        const updateFromStart = () => {
            try {
                const startResult = this.inputValidator.validateInput(startInput, 'time');
                const endResult = this.inputValidator.validateInput(endInput, 'time');
                
                if (startResult.valid && endResult.valid) {
                    const newLength = Math.max(0, endResult.value - startResult.value);
                    lengthInput.value = newLength.toFixed(2);
                    this.inputValidator.validateInput(lengthInput, 'duration');
                }
                
                this.recalcClipStarts(tabId);
                this.commandGenerator.updateCommand(tabId);
                this.validateAllTabs();
            } catch (error) {
                ErrorHandler.showError(`Error updating scene timing: ${error.message}`);
            }
        };

        const updateFromEnd = () => {
            try {
                const startResult = this.inputValidator.validateInput(startInput, 'time');
                const endResult = this.inputValidator.validateInput(endInput, 'time');
                
                if (startResult.valid && endResult.valid) {
                    const newLength = Math.max(0, endResult.value - startResult.value);
                    lengthInput.value = newLength.toFixed(2);
                    this.inputValidator.validateInput(lengthInput, 'duration');
                }
                
                this.recalcClipStarts(tabId);
                this.commandGenerator.updateCommand(tabId);
                this.validateAllTabs();
            } catch (error) {
                ErrorHandler.showError(`Error updating scene timing: ${error.message}`);
            }
        };

        const updateFromLength = () => {
            try {
                const startResult = this.inputValidator.validateInput(startInput, 'time');
                const lengthResult = this.inputValidator.validateInput(lengthInput, 'duration');
                
                if (startResult.valid && lengthResult.valid) {
                    const newEnd = startResult.value + lengthResult.value;
                    endInput.value = newEnd.toFixed(2);
                    this.inputValidator.validateInput(endInput, 'time');
                }
                
                this.recalcClipStarts(tabId);
                this.commandGenerator.updateCommand(tabId);
                this.validateAllTabs();
            } catch (error) {
                ErrorHandler.showError(`Error updating scene timing: ${error.message}`);
            }
        };

        const handleClipStartEdit = () => {
            this.handleClipStartEdit(tabId, sceneEl);
        };

        startInput.addEventListener('input', updateFromStart);
        endInput.addEventListener('input', updateFromEnd);
        lengthInput.addEventListener('input', updateFromLength);
        clipStartInput.addEventListener('input', handleClipStartEdit);

        // Pan toggle
        const panToggle = sceneEl.querySelector('.panToggle');
        panToggle.addEventListener('change', () => {
            this.togglePan(sceneId);
            this.commandGenerator.updateCommand(tabId);
            this.validateAllTabs();
        });

        // Other inputs that trigger command updates
        sceneEl.querySelectorAll('.hCrop, .hCropEnd, .panMethod').forEach(input => {
            input.addEventListener('input', () => {
                this.commandGenerator.updateCommand(tabId);
                this.validateAllTabs();
            });
        });

        // Scene selection
        sceneEl.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
                this.videoPreview.selectScene(sceneEl);
            }
        });

        // End field click to jump to end time
        const endField = sceneEl.querySelector('.endField');
        endField.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                e.stopPropagation();
                this.videoPreview.selectScene(sceneEl);
                if (this.videoPreview.videoLoaded) {
                    const video = document.querySelector('#previewVideo');
                    const endVal = validateNumericInput(sceneEl.querySelector('.end').value);
                    video.currentTime = endVal;
                    this.videoPreview.updateTimeDisplay();
                }
            }
        });

        // Validate scene timing when all three fields are present
        const validateTiming = () => {
            this.inputValidator.validateSceneTiming(startInput, endInput, lengthInput);
        };
        
        startInput.addEventListener('blur', validateTiming);
        endInput.addEventListener('blur', validateTiming);
        lengthInput.addEventListener('blur', validateTiming);
    }

    addScene(tabId, overrideStart = null) {
        const container = document.querySelector(`#${tabId} .scenes`);

        // Defaults: inherit from previous scene in this tab
        const prev = container.querySelector('.scene:last-child');
        let startDefault = overrideStart !== null ? overrideStart : 0;
        let endDefault = startDefault + DEFAULTS.DEFAULT_SCENE_LENGTH;
        let hCropDefault = 50;

        if (prev) {
            const prevEnd = validateNumericInput(prev.querySelector('.end')?.value);
            const prevHCrop = validateNumericInput(prev.querySelector('.hCrop')?.value, 0, 100);
            const prevPan = prev.querySelector('.panToggle')?.checked || false;
            const prevHCropEnd = validateNumericInput(prev.querySelector('.hCropEnd')?.value, 0, 100);
            
            startDefault = prevEnd;
            endDefault = +(prevEnd + DEFAULTS.DEFAULT_SCENE_LENGTH).toFixed(2);
            hCropDefault = prevPan ? prevHCropEnd : prevHCrop;
        }

        const div = this.createSceneElement(tabId, {
            start: startDefault,
            end: endDefault,
            hCrop: hCropDefault
        });
        
        container.appendChild(div);

        this.recalcClipStarts(tabId);
        this.commandGenerator.updateCommand(tabId);
        this.validateAllTabs();
        
        return div;
    }

    addSceneFromPreview(tabId) {
        if (!this.videoPreview.videoLoaded || !tabId) {
            alert('Please load a video first.');
            return;
        }
        
        const video = document.querySelector('#previewVideo');
        const newScene = this.addScene(tabId, video.currentTime);
        
        // Select the new scene
        if (newScene) {
            this.videoPreview.selectScene(newScene);
        }
        
        this.commandGenerator.updateCommand(tabId);
    }

    setupSceneDrag(sceneEl, tabId) {
        const handle = sceneEl.querySelector('.drag-handle');
        
        handle.addEventListener('mousedown', (e) => {
            sceneEl.draggable = true;
        });
        
        handle.addEventListener('mouseup', (e) => {
            sceneEl.draggable = false;
        });

        sceneEl.addEventListener('dragstart', (e) => {
            this.draggedScene = sceneEl;
            this.draggedTabId = tabId;
            sceneEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        sceneEl.addEventListener('dragend', (e) => {
            sceneEl.classList.remove('dragging');
            sceneEl.draggable = false;
            document.querySelectorAll('.scene.drag-over').forEach(el => el.classList.remove('drag-over'));
            this.draggedScene = null;
            this.draggedTabId = null;
        });

        sceneEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedScene || this.draggedScene === sceneEl || this.draggedTabId !== tabId) return;
            e.dataTransfer.dropEffect = 'move';
            sceneEl.classList.add('drag-over');
        });

        sceneEl.addEventListener('dragleave', (e) => {
            sceneEl.classList.remove('drag-over');
        });

        sceneEl.addEventListener('drop', (e) => {
            e.preventDefault();
            sceneEl.classList.remove('drag-over');
            if (!this.draggedScene || this.draggedScene === sceneEl || this.draggedTabId !== tabId) return;

            const container = sceneEl.parentNode;
            const scenes = Array.from(container.querySelectorAll('.scene'));
            const fromIndex = scenes.indexOf(this.draggedScene);
            const toIndex = scenes.indexOf(sceneEl);

            if (fromIndex < toIndex) {
                container.insertBefore(this.draggedScene, sceneEl.nextSibling);
            } else {
                container.insertBefore(this.draggedScene, sceneEl);
            }

            this.recalcClipStarts(tabId);
            this.commandGenerator.updateCommand(tabId);
            this.validateAllTabs();
        });
    }

    recalcClipStarts(tabId) {
        const scenes = Array.from(document.querySelectorAll(`#${tabId} .scene`));
        let cumulative = 0;
        
        scenes.forEach((scene, idx) => {
            const clipStartInput = scene.querySelector('.clipStart');
            const lengthInput = scene.querySelector('.length');
            const duration = validateNumericInput(lengthInput.value);
            
            clipStartInput.value = cumulative.toFixed(2);
            clipStartInput.readOnly = (idx === 0);
            
            cumulative += duration;
        });
    }

    handleClipStartEdit(tabId, currentScene) {
        const scenes = Array.from(document.querySelectorAll(`#${tabId} .scene`));
        const idx = scenes.indexOf(currentScene);
        if (idx <= 0) return; // First scene cannot be edited

        const prevScene = scenes[idx - 1];
        const currentClipStart = validateNumericInput(currentScene.querySelector('.clipStart').value);
        const prevClipStart = validateNumericInput(prevScene.querySelector('.clipStart').value);
        
        // New duration for previous scene = currentClipStart - prevClipStart
        const newPrevDuration = Math.max(0, currentClipStart - prevClipStart);
        const prevStartInput = prevScene.querySelector('.start');
        const prevLengthInput = prevScene.querySelector('.length');
        const prevEndInput = prevScene.querySelector('.end');
        const prevStart = validateNumericInput(prevStartInput.value);
        
        prevLengthInput.value = newPrevDuration.toFixed(2);
        prevEndInput.value = (prevStart + newPrevDuration).toFixed(2);
        
        this.recalcClipStarts(tabId);
        this.commandGenerator.updateCommand(tabId);
        this.validateAllTabs();
    }

    validateContinuity(tabId) {
        try {
            const scenes = document.querySelectorAll(`#${tabId} .scene`);
            const eps = DEFAULTS.CONTINUITY_EPSILON;
            
            scenes.forEach((scene, idx) => {
                const startInput = scene.querySelector('.start');
                if (!startInput) return;
                
                const startVal = validateNumericInput(startInput.value);
                let hasGap = false;
                let gapMessage = '';
                
                if (idx === 0) {
                    // First scene in this clip: check against previous clip's last scene
                    const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
                    const currentTabIndex = tabButtons.findIndex(btn => btn.id === `tabbtn-${tabId}`);
                    if (currentTabIndex > 0) {
                        const prevTabId = tabButtons[currentTabIndex - 1].id.replace('tabbtn-', '');
                        const prevClipScenes = document.querySelectorAll(`#${prevTabId} .scene`);
                        if (prevClipScenes.length > 0) {
                            const lastSceneOfPrevClip = prevClipScenes[prevClipScenes.length - 1];
                            const prevEnd = validateNumericInput(lastSceneOfPrevClip.querySelector('.end')?.value);
                            const gap = Math.abs(startVal - prevEnd);
                            if (gap > eps) {
                                hasGap = true;
                                gapMessage = `Gap from previous clip: ${gap.toFixed(2)}s (expected ${prevEnd.toFixed(2)}s)`;
                            }
                        }
                    }
                } else {
                    const prevEnd = validateNumericInput(scenes[idx - 1].querySelector('.end')?.value);
                    const gap = Math.abs(startVal - prevEnd);
                    if (gap > eps) {
                        hasGap = true;
                        gapMessage = `Gap from previous scene: ${gap.toFixed(2)}s (expected ${prevEnd.toFixed(2)}s)`;
                    }
                }
                
                // Apply or remove continuity warning
                if (hasGap) {
                    startInput.classList.add('warn');
                    // Add warning message if input validator is available
                    if (this.inputValidator) {
                        this.inputValidator.showValidationMessage(startInput, gapMessage, 'warning');
                    }
                } else {
                    startInput.classList.remove('warn');
                    // Clear continuity warning message but preserve other validation messages
                    if (this.inputValidator) {
                        const messageEl = startInput.parentNode.querySelector('.validation-message');
                        if (messageEl && messageEl.textContent.includes('Gap from')) {
                            messageEl.remove();
                        }
                    }
                }
            });

            // The end time > start time validation is now handled by the InputValidator
            // in the validateSceneTiming method, so we don't need to duplicate it here
            
        } catch (error) {
            ErrorHandler.showError(`Error validating scene continuity: ${error.message}`);
        }
    }

    validateAllTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            const tabId = btn.id.replace('tabbtn-', '');
            this.validateContinuity(tabId);
        });
    }

    togglePan(sceneId) {
        const panFields = document.getElementById(`panFields-${sceneId}`);
        const scene = document.getElementById(`scene-${sceneId}`);
        const isChecked = scene.querySelector('.panToggle').checked;
        panFields.style.display = isChecked ? 'flex' : 'none';
    }
}