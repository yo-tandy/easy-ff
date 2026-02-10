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