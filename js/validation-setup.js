import { InputValidator } from './input-validator.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Global validation setup and initialization
 */
export class ValidationSetup {
    constructor() {
        this.inputValidator = new InputValidator();
        this.initialized = false;
    }

    /**
     * Initialize validation for all existing form fields
     */
    initialize() {
        try {
            if (this.initialized) return;

            this.setupGlobalValidation();
            this.setupCrossFieldValidation();
            
            this.initialized = true;
            console.log('Input validation system initialized');
        } catch (error) {
            ErrorHandler.showError(`Error initializing validation: ${error.message}`);
        }
    }

    /**
     * Setup validation for global settings
     */
    setupGlobalValidation() {
        // Global settings validation
        const inputName = document.getElementById('inputName');
        const inDim = document.getElementById('inDim');
        const outDim = document.getElementById('outDim');

        if (inputName) {
            this.inputValidator.setupInputValidation(inputName, 'filename');
        }
        
        if (inDim) {
            this.inputValidator.setupInputValidation(inDim, 'dimensions');
        }
        
        if (outDim) {
            this.inputValidator.setupInputValidation(outDim, 'dimensions');
        }

        // Add validation to crop inputs if they exist
        this.setupCropValidation();
    }

    /**
     * Setup validation for crop window inputs
     */
    setupCropValidation() {
        // Crop window validation
        const cropX = document.getElementById('cropX');
        const cropY = document.getElementById('cropY');
        const cropWidth = document.getElementById('cropWidth');
        const cropHeight = document.getElementById('cropHeight');

        if (cropX) {
            this.inputValidator.setupInputValidation(cropX, 'number', {min: 0});
        }
        if (cropY) {
            this.inputValidator.setupInputValidation(cropY, 'number', {min: 0});
        }
        if (cropWidth) {
            this.inputValidator.setupInputValidation(cropWidth, 'number', {min: 1});
        }
        if (cropHeight) {
            this.inputValidator.setupInputValidation(cropHeight, 'number', {min: 1});
        }
    }

    /**
     * Setup cross-field validation rules
     */
    setupCrossFieldValidation() {
        // Add global input listeners for dimension changes
        const inDimInput = document.getElementById('inDim');
        const outDimInput = document.getElementById('outDim');

        if (inDimInput && outDimInput) {
            inDimInput.addEventListener('input', () => {
                this.validateDimensionCompatibility();
            });
            
            outDimInput.addEventListener('input', () => {
                this.validateDimensionCompatibility();
            });
        }
    }

    /**
     * Validate dimension compatibility and aspect ratios
     */
    validateDimensionCompatibility() {
        const inDimInput = document.getElementById('inDim');
        const outDimInput = document.getElementById('outDim');
        
        if (!inDimInput || !outDimInput) return;

        try {
            const inDimResult = this.inputValidator.validateInput(inDimInput, 'dimensions');
            const outDimResult = this.inputValidator.validateInput(outDimInput, 'dimensions');
            
            if (inDimResult.valid && outDimResult.valid) {
                const inAspectRatio = inDimResult.value.width / inDimResult.value.height;
                const outAspectRatio = outDimResult.value.width / outDimResult.value.height;
                
                // Calculate ratio difference for warning
                const ratioDiff = Math.abs(inAspectRatio - outAspectRatio) / Math.max(inAspectRatio, outAspectRatio);
                
                if (ratioDiff > 0.1) { // More than 10% difference
                    this.inputValidator.showValidationMessage(outDimInput, 
                        `Aspect ratio mismatch: Input ${inAspectRatio.toFixed(2)}, Output ${outAspectRatio.toFixed(2)}`, 
                        'warning'
                    );
                } else {
                    this.inputValidator.clearValidationMessage(outDimInput);
                }
            }
        } catch (error) {
            console.warn('Error validating dimension compatibility:', error);
        }
    }

    /**
     * Setup validation for dynamically created elements
     * @param {HTMLElement} container - Container element to search for validatable inputs
     */
    initializeContainerValidation(container) {
        if (!container) return;

        try {
            const validatedInputs = container.querySelectorAll('[data-validate]');
            validatedInputs.forEach(input => {
                const validateType = input.dataset.validate;
                const options = JSON.parse(input.dataset.validateOptions || '{}');
                this.inputValidator.setupInputValidation(input, validateType, options);
            });
        } catch (error) {
            ErrorHandler.showError(`Error setting up container validation: ${error.message}`);
        }
    }

    /**
     * Validate all form fields in the application
     * @returns {boolean} True if all validations pass
     */
    validateAll() {
        let allValid = true;
        
        try {
            const allInputs = document.querySelectorAll('[data-validate]');
            
            allInputs.forEach(input => {
                const validateType = input.dataset.validate;
                const result = this.inputValidator.validateInput(input, validateType);
                
                if (!result.valid) {
                    allValid = false;
                }
            });
            
            return allValid;
        } catch (error) {
            ErrorHandler.showError(`Error validating all fields: ${error.message}`);
            return false;
        }
    }

    /**
     * Get validation summary for all fields
     * @returns {Object} Summary of validation results
     */
    getValidationSummary() {
        const summary = {
            totalFields: 0,
            validFields: 0,
            invalidFields: 0,
            errors: []
        };

        try {
            const allInputs = document.querySelectorAll('[data-validate]');
            summary.totalFields = allInputs.length;
            
            allInputs.forEach(input => {
                const validateType = input.dataset.validate;
                const result = this.inputValidator.validateInput(input, validateType);
                
                if (result.valid) {
                    summary.validFields++;
                } else {
                    summary.invalidFields++;
                    summary.errors.push({
                        field: input.name || input.id || 'Unknown field',
                        error: result.error
                    });
                }
            });
        } catch (error) {
            summary.errors.push({
                field: 'System',
                error: `Validation system error: ${error.message}`
            });
        }

        return summary;
    }

    /**
     * Show validation summary to user
     */
    showValidationSummary() {
        const summary = this.getValidationSummary();
        
        if (summary.errors.length === 0) {
            ErrorHandler.showSuccess(`All ${summary.validFields} fields are valid`);
        } else {
            const errorMsg = `${summary.invalidFields} validation errors found:\n` +
                summary.errors.map(e => `• ${e.field}: ${e.error}`).join('\n');
            ErrorHandler.showError(errorMsg);
        }
    }

    /**
     * Enable or disable all validation in the application
     * @param {boolean} enabled - Whether validation should be enabled
     */
    setValidationEnabled(enabled) {
        try {
            this.inputValidator.setEnabled(enabled);
            console.log(`Input validation ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            ErrorHandler.showError(`Error ${enabled ? 'enabling' : 'disabling'} validation: ${error.message}`);
        }
    }
}