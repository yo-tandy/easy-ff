// Input validation manager with real-time feedback
import { ErrorHandler } from './error-handler.js';
import { DEFAULTS } from './constants.js';

export class InputValidator {
    constructor() {
        this.validators = new Map();
        this.setupGlobalValidators();
    }

    setupGlobalValidators() {
        // Numeric input validator
        this.addValidator('number', (value, options = {}) => {
            const { min = -Infinity, max = Infinity, allowEmpty = false, decimals = null } = options;
            
            if (!value.trim() && allowEmpty) return { valid: true, value: null };
            if (!value.trim()) return { valid: false, error: 'This field is required' };
            
            const num = parseFloat(value);
            if (isNaN(num)) return { valid: false, error: 'Must be a valid number' };
            
            if (num < min) return { valid: false, error: `Must be at least ${min}` };
            if (num > max) return { valid: false, error: `Cannot exceed ${max}` };
            
            if (decimals !== null) {
                const rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
                return { valid: true, value: rounded };
            }
            
            return { valid: true, value: num };
        });

        // Percentage validator
        this.addValidator('percentage', (value, options = {}) => {
            return this.validate('number', value, { min: 0, max: 100, decimals: 1, ...options });
        });

        // Time validator
        this.addValidator('time', (value, options = {}) => {
            const result = this.validate('number', value, { min: 0, decimals: 2, ...options });
            if (!result.valid) return result;
            
            const { maxDuration = Infinity } = options;
            if (result.value > maxDuration) {
                return { valid: false, error: `Cannot exceed video duration (${maxDuration.toFixed(2)}s)` };
            }
            
            return result;
        });

        // Duration validator
        this.addValidator('duration', (value, options = {}) => {
            const result = this.validate('number', value, { min: 0.01, decimals: 2, ...options });
            if (!result.valid) return result;
            
            const { maxDuration = 3600 } = options; // 1 hour max
            if (result.value > maxDuration) {
                return { valid: false, error: `Duration too long (max ${maxDuration}s)` };
            }
            
            return result;
        });

        // Dimensions validator
        this.addValidator('dimensions', (value) => {
            if (!value.trim()) return { valid: false, error: 'Dimensions are required' };
            
            const pattern = /^\s*(\d+)\s*x\s*(\d+)\s*$/i;
            const match = value.match(pattern);
            
            if (!match) {
                return { valid: false, error: 'Format must be WIDTHxHEIGHT (e.g., 1920x1080)' };
            }
            
            const [, widthStr, heightStr] = match;
            const width = parseInt(widthStr);
            const height = parseInt(heightStr);
            
            if (width < 1 || height < 1) {
                return { valid: false, error: 'Dimensions must be positive numbers' };
            }
            
            if (width > 7680 || height > 4320) {
                return { valid: false, error: 'Dimensions too large (max 7680x4320)' };
            }
            
            const standardized = `${width}x${height}`;
            return { valid: true, value: standardized };
        });

        // Filename validator
        this.addValidator('filename', (value) => {
            if (!value.trim()) return { valid: false, error: 'Filename is required' };
            
            const invalidChars = /[<>:"/\\|?*]/;
            if (invalidChars.test(value)) {
                return { valid: false, error: 'Filename contains invalid characters' };
            }
            
            if (value.length > 255) {
                return { valid: false, error: 'Filename too long (max 255 characters)' };
            }
            
            return { valid: true, value: value.trim() };
        });
    }

    addValidator(name, validatorFn) {
        this.validators.set(name, validatorFn);
    }

    validate(type, value, options = {}) {
        const validator = this.validators.get(type);
        if (!validator) {
            throw new Error(`Unknown validator type: ${type}`);
        }
        return validator(value, options);
    }

    validateInput(input, type, options = {}) {
        const result = this.validate(type, input.value, options);
        this.updateInputVisualState(input, result);
        return result;
    }

    updateInputVisualState(input, result) {
        // Preserve continuity warning class
        const hasWarn = input.classList.contains('warn');
        
        // Remove existing validation classes
        input.classList.remove('input-error', 'input-warning', 'input-valid');
        
        // Clear any tooltip data first
        delete input.dataset.validationMessage;
        delete input.dataset.validationType;
        input.removeAttribute('title');

        if (!result.valid) {
            input.classList.add('input-error');
            this.showFieldError(input, result.error);
        } else {
            input.classList.add('input-valid');
            if (result.value !== undefined && result.value !== input.value) {
                input.value = result.value;
            }
        }
        
        // Restore continuity warning class if it was there
        if (hasWarn) {
            input.classList.add('warn');
        }
    }

    showFieldError(input, message) {
        // Store the error message as data attribute for tooltip
        input.dataset.validationMessage = message;
        input.dataset.validationType = 'error';
        input.title = message; // Fallback for basic tooltip
    }

    /**
     * Show validation message with different types (error, warning, success)
     * @param {HTMLInputElement} input
     * @param {string} message
     * @param {string} type - 'error', 'warning', or 'success'
     */
    showValidationMessage(input, message, type = 'error') {
        // Store the message and type as data attributes for tooltip
        input.dataset.validationMessage = message;
        input.dataset.validationType = type;
        input.title = message; // Fallback for basic tooltip
    }

    setupInputValidation(input, type, options = {}) {
        const { validateOnBlur = true, validateOnInput = false, debounceMs = 300 } = options;

        let debounceTimeout;

        const doValidation = () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                this.validateInput(input, type, options);
            }, debounceMs);
        };

        if (validateOnInput) {
            input.addEventListener('input', doValidation);
        }

        if (validateOnBlur) {
            input.addEventListener('blur', () => {
                clearTimeout(debounceTimeout);
                this.validateInput(input, type, options);
            });
        }

        // Initial validation if field has value
        if (input.value.trim()) {
            this.validateInput(input, type, options);
        }
    }

    validateSceneTiming(startInput, endInput, lengthInput) {
        const startResult = this.validateInput(startInput, 'time');
        const endResult = this.validateInput(endInput, 'time');
        const lengthResult = this.validateInput(lengthInput, 'duration');

        if (!startResult.valid || !endResult.valid || !lengthResult.valid) {
            return false;
        }

        const start = startResult.value;
        const end = endResult.value;
        const length = lengthResult.value;

        // Check if end > start
        if (end <= start) {
            this.updateInputVisualState(endInput, { 
                valid: false, 
                error: `End time (${end}s) must be greater than start time (${start}s)` 
            });
            return false;
        }

        // Check if length matches end - start
        const expectedLength = end - start;
        if (Math.abs(length - expectedLength) > 0.01) {
            this.updateInputVisualState(lengthInput, { 
                valid: false, 
                error: `Length should be ${expectedLength.toFixed(2)}s based on start/end times` 
            });
            return false;
        }

        return true;
    }

    validateFormSection(container) {
        const inputs = container.querySelectorAll('input[data-validate], select[data-validate]');
        let allValid = true;

        inputs.forEach(input => {
            const validateType = input.dataset.validate;
            const options = JSON.parse(input.dataset.validateOptions || '{}');
            
            const result = this.validateInput(input, validateType, options);
            if (!result.valid) {
                allValid = false;
            }
        });

        return allValid;
    }

    clearValidation(input) {
        input.classList.remove('input-error', 'input-warning', 'input-valid');
        const existingError = input.parentNode.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
    }

    /**
     * Clear validation message and styling for an input
     * @param {HTMLInputElement} input
     * @param {boolean} preserveContinuityWarning - Whether to preserve 'warn' class for continuity
     */
    clearValidationMessage(input, preserveContinuityWarning = false) {
        // Remove tooltip data
        delete input.dataset.validationMessage;
        delete input.dataset.validationType;
        input.removeAttribute('title');
        
        // Preserve continuity warning class if requested
        const hasWarn = input.classList.contains('warn');
        input.classList.remove('valid', 'invalid', 'warning');
        
        if (preserveContinuityWarning && hasWarn) {
            input.classList.add('warn');
        }
    }

    // Sanitize input values
    sanitizeNumericInput(value, decimals = 2) {
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        return num.toFixed(decimals);
    }

    sanitizeFilename(value) {
        return value
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .substring(0, 255); // Limit length
    }

    // Validation presets for common scenarios
    getValidationPresets() {
        return {
            videoTime: { type: 'time', validateOnInput: true, debounceMs: 500 },
            videoDuration: { type: 'duration', validateOnInput: true, debounceMs: 500 },
            cropPercentage: { type: 'percentage', validateOnInput: true, debounceMs: 200 },
            dimensions: { type: 'dimensions', validateOnBlur: true },
            filename: { type: 'filename', validateOnBlur: true }
        };
    }

    /**
     * Validate scene timing (start, end, length) for consistency
     * @param {HTMLInputElement} startInput - Start time input
     * @param {HTMLInputElement} endInput - End time input
     * @param {HTMLInputElement} lengthInput - Length input
     */
    validateSceneTiming(startInput, endInput, lengthInput) {
        try {
            const startResult = this.validateInput(startInput, 'time');
            const endResult = this.validateInput(endInput, 'time');
            const lengthResult = this.validateInput(lengthInput, 'duration');

            if (startResult.valid && endResult.valid && lengthResult.valid) {
                const startTime = startResult.value;
                const endTime = endResult.value;
                const length = lengthResult.value;
                
                // Check if timing is consistent
                const calculatedLength = endTime - startTime;
                const tolerance = 0.1; // 100ms tolerance
                
                if (endTime <= startTime) {
                    this.showValidationMessage(endInput, 'End time must be after start time', 'error');
                    return false;
                } else if (Math.abs(calculatedLength - length) > tolerance) {
                    this.showValidationMessage(lengthInput, 
                        `Length mismatch: Expected ${calculatedLength.toFixed(2)}s`, 'warning');
                    return false;
                } else {
                    // Clear any timing validation messages
                    this.clearValidationMessage(startInput);
                    this.clearValidationMessage(endInput);
                    this.clearValidationMessage(lengthInput);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn('Error validating scene timing:', error);
            return false;
        }
    }

    /**
     * Enable or disable validation
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        
        // Update visual state of all validated inputs
        const allInputs = document.querySelectorAll('[data-validate]');
        allInputs.forEach(input => {
            if (enabled) {
                input.removeAttribute('disabled');
            } else {
                this.clearValidationMessage(input);
                input.classList.remove('valid', 'invalid', 'warning');
            }
        });
    }
}