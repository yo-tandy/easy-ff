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

        const { start, end, hCrop, pan = false, hCropEnd = hCrop, panMethod = 'linear', keyframes = [] } = sceneData;
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
                <div id="panFields-${sceneId}" style="display:${pan ? 'flex' : 'none'}; margin-left:8px;" class="grid panFieldsRow">
                    <div><label>End Horiz %</label><input type="number" class="hCropEnd" value="${hCropEnd}" min="0" max="100" data-validate="percentage" data-validate-options='{"validateOnInput": true}'></div>
                    <div>
                        <label>Pan Method</label>
                        <select class="panMethod">
                            <option value="linear" ${panMethod === 'linear' ? 'selected' : ''}>Linear</option>
                            <option value="zoom" ${panMethod === 'zoom' ? 'selected' : ''}>Zoom-like</option>
                        </select>
                    </div>
                    <div class="keyframe-section">
                        <label>Keyframes</label>
                        <button class="keyframe-add-btn" title="Add keyframe at current video time">+ KF</button>
                        <button class="keyframe-clear-btn" title="Clear all keyframes">Clear</button>
                        <button class="auto-track-btn" title="Auto-track subject movement">Auto-Track</button>
                    </div>
                </div>
                <div class="keyframe-timeline-full" style="display:none">
                    <div class="keyframe-timeline" data-scene-id="${sceneId}">
                        <div class="keyframe-bar"></div>
                    </div>
                </div>
            </div>
        `;

        const div = createElementFromHTML(html);

        // Store keyframes data
        if (keyframes && keyframes.length > 0) {
            div.dataset.keyframes = JSON.stringify(keyframes);
        }

        this.setupSceneEventListeners(div, tabId, sceneId);
        this.setupSceneDrag(div, tabId);
        this.renderKeyframeDots(div);

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

        startInput.addEventListener('input', () => this._updateSceneTiming(startInput, endInput, lengthInput, 'start', tabId));
        endInput.addEventListener('input', () => this._updateSceneTiming(startInput, endInput, lengthInput, 'end', tabId));
        lengthInput.addEventListener('input', () => this._updateSceneTiming(startInput, endInput, lengthInput, 'length', tabId));
        clipStartInput.addEventListener('input', () => this.handleClipStartEdit(tabId, sceneEl));

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
            if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select') && !e.target.closest('.keyframe-dot')) {
                this.videoPreview.selectScene(sceneEl);
                // Deselect keyframe dots when clicking scene body
                sceneEl.querySelectorAll('.keyframe-dot.selected').forEach(d => d.classList.remove('selected'));
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

        // Keyframe controls
        this.setupKeyframeListeners(sceneEl, tabId);
    }

    _updateSceneTiming(startInput, endInput, lengthInput, changedField, tabId) {
        try {
            if (changedField === 'length') {
                const startResult = this.inputValidator.validateInput(startInput, 'time');
                const lengthResult = this.inputValidator.validateInput(lengthInput, 'duration');

                if (startResult.valid && lengthResult.valid) {
                    const newEnd = startResult.value + lengthResult.value;
                    endInput.value = newEnd.toFixed(2);
                    this.inputValidator.validateInput(endInput, 'time');
                }
            } else {
                const startResult = this.inputValidator.validateInput(startInput, 'time');
                const endResult = this.inputValidator.validateInput(endInput, 'time');

                if (startResult.valid && endResult.valid) {
                    const newLength = Math.max(0, endResult.value - startResult.value);
                    lengthInput.value = newLength.toFixed(2);
                    this.inputValidator.validateInput(lengthInput, 'duration');
                }
            }

            this.recalcClipStarts(tabId);
            this.commandGenerator.updateCommand(tabId);
            this.validateAllTabs();
        } catch (error) {
            ErrorHandler.showError(`Error updating scene timing: ${error.message}`);
        }
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

    // --- Keyframe management ---

    getKeyframes(sceneEl) {
        const raw = sceneEl.dataset.keyframes;
        if (!raw) return [];
        try {
            const kf = JSON.parse(raw);
            return Array.isArray(kf) ? kf : [];
        } catch { return []; }
    }

    setKeyframes(sceneEl, keyframes, tabId) {
        if (keyframes.length > 0) {
            sceneEl.dataset.keyframes = JSON.stringify(keyframes);
        } else {
            delete sceneEl.dataset.keyframes;
        }
        this.renderKeyframeDots(sceneEl);
        if (tabId) {
            this.commandGenerator.updateCommand(tabId);
        }
    }

    addKeyframe(sceneEl, tabId) {
        const video = document.querySelector('#previewVideo');
        if (!video || !this.videoPreview.videoLoaded) return;

        const sceneStart = parseFloat(sceneEl.querySelector('.start').value) || 0;
        const sceneEnd = parseFloat(sceneEl.querySelector('.end').value) || 0;
        const currentTime = video.currentTime;

        // Clamp to scene bounds
        const t = Math.max(0, Math.min(sceneEnd - sceneStart, currentTime - sceneStart));
        const cropPct = this.videoPreview.cropPercent;

        const keyframes = this.getKeyframes(sceneEl);
        // Don't add duplicate at same time (within 0.05s)
        if (keyframes.some(kf => Math.abs(kf.t - t) < 0.05)) return;

        keyframes.push({ t: parseFloat(t.toFixed(3)), cropPct: parseFloat(cropPct.toFixed(1)) });
        keyframes.sort((a, b) => a.t - b.t);

        this.setKeyframes(sceneEl, keyframes, tabId);

        // Auto-enable pan if we have 2+ keyframes
        const panToggle = sceneEl.querySelector('.panToggle');
        if (keyframes.length >= 2 && !panToggle.checked) {
            panToggle.checked = true;
            panToggle.dispatchEvent(new Event('change'));
        }
    }

    removeKeyframe(sceneEl, index, tabId) {
        const keyframes = this.getKeyframes(sceneEl);
        keyframes.splice(index, 1);
        this.setKeyframes(sceneEl, keyframes, tabId);
    }

    clearKeyframes(sceneEl, tabId) {
        this.setKeyframes(sceneEl, [], tabId);
    }

    updateSelectedKeyframeCrop(cropPercent) {
        const sceneEl = this.videoPreview.selectedScene;
        if (!sceneEl) return;

        const selectedDot = sceneEl.querySelector('.keyframe-dot.selected');
        if (!selectedDot) return;

        const idx = parseInt(selectedDot.dataset.index);
        const keyframes = this.getKeyframes(sceneEl);
        if (!keyframes[idx]) return;

        keyframes[idx].cropPct = parseFloat(cropPercent.toFixed(1));
        const tabId = this._getTabIdForScene(sceneEl);
        this.setKeyframes(sceneEl, keyframes, tabId);

        // Re-apply selection to the dot at the same index (renderKeyframeDots recreates all dots)
        const newDot = sceneEl.querySelectorAll('.keyframe-dot')[idx];
        if (newDot) newDot.classList.add('selected');
    }

    renderKeyframeDots(sceneEl) {
        const timeline = sceneEl.querySelector('.keyframe-timeline');
        if (!timeline) return;

        const fullContainer = sceneEl.querySelector('.keyframe-timeline-full');
        const bar = timeline.querySelector('.keyframe-bar');
        // Remove existing dots
        timeline.querySelectorAll('.keyframe-dot').forEach(d => d.remove());

        const keyframes = this.getKeyframes(sceneEl);
        if (keyframes.length === 0) {
            if (fullContainer) fullContainer.style.display = 'none';
            return;
        }
        if (fullContainer) fullContainer.style.display = 'block';

        const sceneStart = parseFloat(sceneEl.querySelector('.start').value) || 0;
        const sceneEnd = parseFloat(sceneEl.querySelector('.end').value) || 0;
        const duration = sceneEnd - sceneStart;
        if (duration <= 0) return;

        keyframes.forEach((kf, idx) => {
            const dot = document.createElement('div');
            dot.className = 'keyframe-dot';
            dot.dataset.index = idx;
            dot.title = `${kf.t.toFixed(2)}s → ${kf.cropPct.toFixed(1)}%`;
            const pct = (kf.t / duration) * 100;
            dot.style.left = `${Math.max(0, Math.min(100, pct))}%`;

            // Delete on right-click
            dot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const tabId = this._getTabIdForScene(sceneEl);
                this.removeKeyframe(sceneEl, idx, tabId);
            });

            // Select on click — update crop preview
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                timeline.querySelectorAll('.keyframe-dot').forEach(d => d.classList.remove('selected'));
                dot.classList.add('selected');
                if (this.videoPreview) {
                    this.videoPreview.cropPercent = kf.cropPct;
                    this.videoPreview.updateCropWindow();
                    // Jump video to keyframe time
                    const video = document.querySelector('#previewVideo');
                    if (video) {
                        video.currentTime = sceneStart + kf.t;
                        this.videoPreview.updateTimeDisplay();
                    }
                }
            });

            // Drag to reposition in time
            this._setupKeyframeDotDrag(dot, sceneEl, idx);

            timeline.appendChild(dot);
        });
    }

    _setupKeyframeDotDrag(dot, sceneEl, idx) {
        let isDragging = false;
        let hasMoved = false;
        let startClientX = 0;

        dot.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left click only
            isDragging = true;
            hasMoved = false;
            startClientX = e.clientX;
            e.preventDefault();
            e.stopPropagation();
        });

        const handleMove = (e) => {
            if (!isDragging) return;
            hasMoved = true;
            const timeline = sceneEl.querySelector('.keyframe-timeline');
            const rect = timeline.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

            const sceneStart = parseFloat(sceneEl.querySelector('.start').value) || 0;
            const sceneEnd = parseFloat(sceneEl.querySelector('.end').value) || 0;
            const duration = sceneEnd - sceneStart;

            const newT = parseFloat((pct * duration).toFixed(3));
            const keyframes = this.getKeyframes(sceneEl);
            if (keyframes[idx]) {
                keyframes[idx].t = newT;
                dot.style.left = `${pct * 100}%`;
                dot.title = `${newT.toFixed(2)}s → ${keyframes[idx].cropPct.toFixed(1)}%`;
            }
        };

        const handleUp = () => {
            if (!isDragging) return;
            isDragging = false;
            if (hasMoved) {
                const keyframes = this.getKeyframes(sceneEl);
                keyframes.sort((a, b) => a.t - b.t);
                const tabId = this._getTabIdForScene(sceneEl);
                this.setKeyframes(sceneEl, keyframes, tabId);
            }
            hasMoved = false;
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }

    _getTabIdForScene(sceneEl) {
        const tabContent = sceneEl.closest('.tab-content');
        return tabContent ? tabContent.id : null;
    }

    setupKeyframeListeners(sceneEl, tabId) {
        const addBtn = sceneEl.querySelector('.keyframe-add-btn');
        const clearBtn = sceneEl.querySelector('.keyframe-clear-btn');
        const autoTrackBtn = sceneEl.querySelector('.auto-track-btn');

        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addKeyframe(sceneEl, tabId);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearKeyframes(sceneEl, tabId);
            });
        }

        if (autoTrackBtn) {
            autoTrackBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.runAutoTrack(sceneEl, tabId, autoTrackBtn);
            });
        }
    }

    async runAutoTrack(sceneEl, tabId, btn) {
        if (!this.autoTracker) {
            alert('Auto-tracking is not available.');
            return;
        }
        if (!this.videoPreview || !this.videoPreview.videoLoaded) {
            alert('Please load a video first.');
            return;
        }

        const video = document.querySelector('#previewVideo');
        const startTime = parseFloat(sceneEl.querySelector('.start').value) || 0;
        const endTime = parseFloat(sceneEl.querySelector('.end').value) || 0;

        if (endTime <= startTime) {
            alert('Scene must have a valid duration.');
            return;
        }

        // Calculate crop width ratio from output dimensions
        const inDim = document.querySelector('#inDim').value;
        const outDim = document.querySelector('#outDim').value;
        let cropWidthRatio = 0.5;
        try {
            const { parseDimensions } = await import('./utils.js');
            const [inW, inH] = parseDimensions(inDim);
            const [outW, outH] = parseDimensions(outDim);
            const ratio = Math.min(inH / outH, inW / outW);
            cropWidthRatio = (ratio * outW) / inW;
        } catch {}

        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Loading...';

        // Pause video
        video.pause();

        try {
            const keyframes = await this.autoTracker.track(video, startTime, endTime, {
                sampleRate: 3,
                cropWidthRatio,
                onProgress: (pct, msg) => {
                    btn.textContent = msg ? `${msg} ${pct}%` : `${pct}%`;
                }
            });

            if (keyframes.length === 0) {
                alert('No person detected in this scene. Keyframes were not created.');
                return;
            }

            // Set keyframes and enable pan
            this.setKeyframes(sceneEl, keyframes, tabId);
            const panToggle = sceneEl.querySelector('.panToggle');
            if (!panToggle.checked) {
                panToggle.checked = true;
                panToggle.dispatchEvent(new Event('change'));
            }

            // Select the scene to show preview
            this.videoPreview.selectScene(sceneEl);
        } catch (err) {
            alert(`Auto-tracking failed: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = origText;
        }
    }
}