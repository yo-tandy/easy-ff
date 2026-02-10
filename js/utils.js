// Utility functions
export function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00.000';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
}

export function parseDimensions(dimString) {
    if (!dimString || typeof dimString !== 'string') {
        throw new Error('Dimensions are required');
    }

    const parts = dimString.split('x');
    if (parts.length !== 2) {
        throw new Error('Dimensions must be in format "WIDTHxHEIGHT" (e.g., "1920x1080")');
    }

    const [width, height] = parts.map(p => {
        const num = parseInt(p.trim());
        if (isNaN(num) || num <= 0) {
            throw new Error('Dimensions must be positive numbers');
        }
        return num;
    });
    
    if (width > 7680 || height > 4320) {
        throw new Error('Dimensions too large (maximum 7680x4320)');
    }

    return [width, height];
}

export function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function validateNumericInput(value, min = 0, max = Infinity) {
    if (value === '' || value === null || value === undefined) {
        return min;
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return min;
    }
    
    return Math.max(min, Math.min(max, num));
}

export function validateNumericInputStrict(value, fieldName, options = {}) {
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

export function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback for older browsers
        return fallbackCopyToClipboard(text);
    }
    
    return navigator.clipboard.writeText(text).catch(error => {
        console.warn('Clipboard API failed, using fallback:', error);
        return fallbackCopyToClipboard(text);
    });
}

function fallbackCopyToClipboard(text) {
    return new Promise((resolve, reject) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                resolve();
            } else {
                reject(new Error('Copy command failed'));
            }
        } catch (err) {
            reject(err);
        }
    });
}

export function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}