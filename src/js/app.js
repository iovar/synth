// Main application code
import { DualSynth } from './synth.js';
import { setupKeyboard } from './keyboard.js';
import { setupSynthControls } from './controls.js';
import { setupEffectsControls } from './effectscontrol.js';
import { AudioRecorder } from './recorder.js';

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

    // Set up keyboard, controls, and effects
    const keyboard = setupKeyboard(synth);
    const controls = setupSynthControls(synth);
    const effectsControls = setupEffectsControls(synth);

    // Create audio recorder - connect it to the synth's output
    const recorder = new AudioRecorder(synth.audioContext, synth.masterGain);

    // Initialize components
    keyboard.init();
    controls.init();
    effectsControls.init();

    // Set up stop all sounds button
    const stopAllButton = document.getElementById('stop-all-button');
    if (stopAllButton) {
        // Final emergency audio cutoff flag (for double-clicks)
        let emergencyStopActivated = false;

        stopAllButton.addEventListener('click', () => {
            console.log('Stop button clicked - emergency stop activated');

            // Show immediate visual feedback
            stopAllButton.classList.add('active');
            setTimeout(() => {
                stopAllButton.classList.remove('active');
            }, 300);

            // Reset UI state - remove active states from all keys
            document.querySelectorAll('.white-key.active, .black-key.active').forEach(key => {
                key.classList.remove('active');
            });

            // First attempt - use the built-in stopAllNotes method
            synth.stopAllNotes();

            // If this is a second click within 1 second (double-click), try more extreme measures
            if (emergencyStopActivated) {
                console.log('Double-click detected - performing nuclear option');

                try {
                    // Suspend and resume the audio context (more extreme)
                    synth.audioContext.suspend().then(() => {
                        // Create a completely new master gain node
                        const newMasterGain = synth.audioContext.createGain();
                        newMasterGain.gain.value = 0;

                        // Clear all active notes object
                        synth.activeNotes = {};

                        // Replace master gain with completely new one
                        try {
                            synth.masterGain.disconnect();
                        } catch (e) {}

                        synth.masterGain = newMasterGain;
                        newMasterGain.connect(synth.effectsProcessor.getInput());

                        // Resume after a short pause to ensure all audio has stopped
                        setTimeout(() => {
                            synth.audioContext.resume().then(() => {
                                // Restore volume gradually
                                setTimeout(() => {
                                    newMasterGain.gain.linearRampToValueAtTime(0.7, synth.audioContext.currentTime + 0.3);
                                }, 200);
                            });
                        }, 200);
                    });
                } catch (e) {
                    console.error('Error in nuclear audio stop option:', e);
                }
            }

            // Set flag to enable double-click detection
            emergencyStopActivated = true;
            setTimeout(() => {
                emergencyStopActivated = false;
            }, 1000);
        });

        // Also respond to keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key for normal stop
            if (e.key === 'Escape') {
                stopAllButton.click();
            }

            // Shift+Escape for double-click nuclear option
            if (e.key === 'Escape' && e.shiftKey) {
                emergencyStopActivated = true;
                stopAllButton.click();
            }
        });
    }

    // Set up record button
    const recordButton = document.getElementById('record-button');
    if (recordButton) {
        let isRecording = false;

        // Initialize recorder when user clicks the button for the first time
        recordButton.addEventListener('click', async () => {
            try {
                // Toggle recording state
                if (!isRecording) {
                    // Start recording
                    await recorder.startRecording();
                    isRecording = true;
                    recordButton.classList.add('recording');
                    recordButton.textContent = 'STOP';

                    // Show notification
                    console.log('Recording started');
                } else {
                    // Stop recording
                    recorder.stopRecording();
                    isRecording = false;
                    recordButton.classList.remove('recording');
                    recordButton.textContent = 'REC';

                    // Show notification
                    console.log('Recording stopped, saving file...');
                }
            } catch (error) {
                console.error('Recording error:', error);
                alert('Recording error: ' + error.message);

                // Reset UI if there was an error
                isRecording = false;
                recordButton.classList.remove('recording');
                recordButton.textContent = 'REC';
            }
        });

        // Space key as shortcut for record toggle (when not playing notes)
        document.addEventListener('keydown', (e) => {
            // Toggle recording with space bar when not used for playing
            if (e.key === ' ' && e.target === document.body) {
                recordButton.click();
            }
        });
    }

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

function clearServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
    }
}
window.clearServiceWorker = clearServiceWorker;

