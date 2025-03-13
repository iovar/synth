// Main application code
import { DualSynth } from './synth.js';
import { setupKeyboard } from './keyboard.js';
import { setupSynthControls } from './controls.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Synth initialized');
    
    // Prevent browser default actions that might cause scrolling
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // Initialize application
    initApp();
});

// Initialize the synthesizer application
function initApp() {
    // Create the synthesizer
    const synth = new DualSynth();
    
    // Set up keyboard and controls
    const keyboard = setupKeyboard(synth);
    const controls = setupSynthControls(synth);
    
    // Initialize components
    keyboard.init();
    controls.init();
    
    // Check online status
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

// Update UI based on network status
function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    console.log(`App is ${isOnline ? 'online' : 'offline'}`);
}