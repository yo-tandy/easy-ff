// Error handling utilities and centralized error management
export class ErrorHandler {
    static showError(message, title = 'Error', duration = 5000) {
        console.error(`${title}: ${message}`);
        
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <strong>${title}</strong>
                <p>${message}</p>
                <button class="error-close">×</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(errorDiv);

        // Auto-remove after duration
        const timeoutId = setTimeout(() => {
            this.removeError(errorDiv);
        }, duration);

        // Manual close
        errorDiv.querySelector('.error-close').addEventListener('click', () => {
            clearTimeout(timeoutId);
            this.removeError(errorDiv);
        });
    }

    static removeError(errorDiv) {
        if (errorDiv && errorDiv.parentNode) {
            errorDiv.style.opacity = '0';
            setTimeout(() => {
                errorDiv.remove();
            }, 300);
        }
    }

    static showSuccess(message, duration = 3000) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div class="success-content">
                <strong>Success</strong>
                <p>${message}</p>
            </div>
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            if (successDiv && successDiv.parentNode) {
                successDiv.style.opacity = '0';
                setTimeout(() => successDiv.remove(), 300);
            }
        }, duration);
    }

    static validateFile(file, options = {}) {
        const { 
            maxSize = 500 * 1024 * 1024, // 500MB default
            allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/mkv'],
            requiredExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv']
        } = options;

        if (!file) {
            throw new Error('No file selected');
        }

        if (file.size > maxSize) {
            throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (${(maxSize / (1024 * 1024)).toFixed(1)}MB)`);
        }

        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!requiredExtensions.includes(fileExtension)) {
            throw new Error(`Unsupported file type. Please use one of: ${requiredExtensions.join(', ')}`);
        }

        // Additional MIME type check if available
        if (file.type && !allowedTypes.includes(file.type)) {
            throw new Error(`Unsupported MIME type: ${file.type}`);
        }

        return true;
    }

    static validateNumericInput(value, fieldName, options = {}) {
        const { min = 0, max = Infinity, allowNegative = false, allowZero = true } = options;
        
        if (value === '' || value === null || value === undefined) {
            throw new Error(`${fieldName} is required`);
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            throw new Error(`${fieldName} must be a valid number`);
        }

        if (!allowNegative && num < 0) {
            throw new Error(`${fieldName} cannot be negative`);
        }

        if (!allowZero && num === 0) {
            throw new Error(`${fieldName} cannot be zero`);
        }

        if (num < min) {
            throw new Error(`${fieldName} must be at least ${min}`);
        }

        if (num > max) {
            throw new Error(`${fieldName} cannot exceed ${max}`);
        }

        return num;
    }

    static validateDimensions(dimString) {
        if (!dimString || typeof dimString !== 'string') {
            throw new Error('Dimensions are required');
        }

        const parts = dimString.split('x');
        if (parts.length !== 2) {
            throw new Error('Dimensions must be in format "WIDTHxHEIGHT" (e.g., "1920x1080")');
        }

        const [width, height] = parts.map(p => parseInt(p.trim()));
        
        if (isNaN(width) || isNaN(height)) {
            throw new Error('Dimensions must be valid numbers');
        }

        if (width <= 0 || height <= 0) {
            throw new Error('Dimensions must be positive numbers');
        }

        if (width > 7680 || height > 4320) {
            throw new Error('Dimensions too large (maximum 7680x4320)');
        }

        return [width, height];
    }

    static async safeAsync(asyncFn, errorMessage = 'An error occurred') {
        try {
            return await asyncFn();
        } catch (error) {
            console.error(error);
            this.showError(`${errorMessage}: ${error.message}`);
            throw error;
        }
    }

    static safe(fn, errorMessage = 'An error occurred') {
        try {
            return fn();
        } catch (error) {
            console.error(error);
            this.showError(`${errorMessage}: ${error.message}`);
            throw error;
        }
    }
}