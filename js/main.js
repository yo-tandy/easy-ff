import { FFmpegToolApp } from './app.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new FFmpegToolApp();
    
    // Make app available globally for debugging if needed
    window.ffmpegApp = app;
});