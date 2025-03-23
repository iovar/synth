// Audio context and synth variables
let audioContext;
let oscillator = null;
let gainNode = null;

// Import the effects processor
import { EffectsProcessor } from './effects.js';

// Dual oscillator synthesizer implementation
class DualSynth {
    constructor() {
        // Initialize audio context with fallback
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.activeNotes = {}; // Store active notes with their nodes
        this.waveType1 = 'sine'; // Default wave type for oscillator 1
        this.waveType2 = 'none'; // Default wave type for oscillator 2 (none = disabled)

        // Create master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.7;

        // Create effects processor
        this.effectsProcessor = new EffectsProcessor(this.audioContext);

        // Connect to effects chain
        this.masterGain.connect(this.effectsProcessor.getInput());
        this.effectsProcessor.getOutput().connect(this.audioContext.destination);
    }

    // Start audio context (needed due to autoplay policy)
    start() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Set primary oscillator wave type
    setWaveType1(waveType) {
        this.waveType1 = waveType;

        // Check if we need to disable oscillator 2
        if (waveType === this.waveType2 && this.waveType2 !== 'none') {
            this.waveType2 = 'none';
            // Update UI if needed
            const wave2Selector = document.getElementById('wave-type-2');
            if (wave2Selector) {
                wave2Selector.value = 'none';
            }
        }

        // Update all active oscillators
        Object.values(this.activeNotes).forEach(noteObj => {
            if (noteObj.oscillator1) {
                noteObj.oscillator1.type = waveType;
            }
        });
    }

    // Set secondary oscillator wave type
    setWaveType2(waveType) {
        // Store the new wave type
        this.waveType2 = waveType;

        // Update all active oscillators
        Object.values(this.activeNotes).forEach(noteObj => {
            if (noteObj.oscillator2) {
                // If we're switching to none, immediately disconnect oscillator 2
                if (waveType === 'none') {
                    // Silence immediately to avoid clicks
                    try {
                        noteObj.gainNode2.gain.cancelScheduledValues(this.audioContext.currentTime);
                        noteObj.gainNode2.gain.setValueAtTime(0, this.audioContext.currentTime);
                        noteObj.gainNode2.disconnect();
                    } catch (e) {}

                    // Remove references
                    noteObj.oscillator2 = null;
                    noteObj.gainNode2 = null;
                } else if (noteObj.oscillator2.type !== waveType) {
                    // Otherwise update the type if it changed
                    noteObj.oscillator2.type = waveType;
                }
            } else if (waveType !== 'none') {
                // If oscillator 2 doesn't exist and we're switching to a wave type,
                // we don't add it here anymore - it will be added on next note press
            }
        });

        return true;
    }

    // Method removed as it's now handled directly in playNote

    // Convert note and octave to frequency
    noteToFrequency(note, octave) {
        const notes = {
            'C': 0,
            'C#': 1,
            'D': 2,
            'D#': 3,
            'E': 4,
            'F': 5,
            'F#': 6,
            'G': 7,
            'G#': 8,
            'A': 9,
            'A#': 10,
            'B': 11
        };

        // A4 is 440Hz (note A, octave 4)
        const A4 = 440;
        const A4_NOTE_INDEX = 9;
        const A4_OCTAVE = 4;

        // Calculate semitones from A4
        const noteIndex = notes[note];
        const semitones = (octave - A4_OCTAVE) * 12 + (noteIndex - A4_NOTE_INDEX);

        // Convert semitones to frequency using equal temperament formula: f = 440 * 2^(n/12)
        return A4 * Math.pow(2, semitones / 12);
    }

    // Generate a unique ID for each note
    getNoteId(note, octave) {
        return `${note}-${octave}`;
    }

    // Play a note - with improved anti-clipping measures
    playNote(note, octave) {
        this.start();

        // Generate note ID
        const noteId = this.getNoteId(note, octave);
        const now = this.audioContext.currentTime;

        // If an existing note is playing, stop it first with a proper release
        if (this.activeNotes[noteId]) {
            const existingNote = this.activeNotes[noteId];

            // Skip if the note is already in release phase to avoid conflicts
            if (existingNote.isReleasing) {
                // Don't interrupt a release that's already in progress
                return;
            }

            // For rapid retriggering, apply a very short release to avoid clicks
            const shortReleaseTime = 0.015; // 15ms release to avoid clicks

            try {
                // Fast fade out for oscillator 1
                if (existingNote.gainNode1) {
                    existingNote.gainNode1.gain.cancelScheduledValues(now);
                    existingNote.gainNode1.gain.setValueAtTime(existingNote.gainNode1.gain.value || 0.5, now);
                    existingNote.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + shortReleaseTime);
                }

                // Fast fade out for oscillator 2 if it exists
                if (existingNote.gainNode2) {
                    existingNote.gainNode2.gain.cancelScheduledValues(now);
                    existingNote.gainNode2.gain.setValueAtTime(existingNote.gainNode2.gain.value || 0.4, now);
                    existingNote.gainNode2.gain.exponentialRampToValueAtTime(0.001, now + shortReleaseTime);
                }

                // Clear any existing timeouts
                if (existingNote.safetyCleanupTimeout) {
                    clearTimeout(existingNote.safetyCleanupTimeout);
                }
                if (existingNote.longCleanupTimeout) {
                    clearTimeout(existingNote.longCleanupTimeout);
                }

                // Mark as releasing so it won't be interrupted
                existingNote.isReleasing = true;

                // Schedule cleanup
                setTimeout(() => {
                    try {
                        // Stop oscillators
                        if (existingNote.oscillator1) {
                            try { existingNote.oscillator1.stop(); } catch(e) {}
                        }
                        if (existingNote.oscillator2) {
                            try { existingNote.oscillator2.stop(); } catch(e) {}
                        }

                        // Disconnect nodes
                        if (existingNote.gainNode1) existingNote.gainNode1.disconnect();
                        if (existingNote.gainNode2) existingNote.gainNode2.disconnect();
                    } catch (e) {}

                    // Remove the old note reference if it hasn't been replaced yet
                    if (this.activeNotes[noteId] === existingNote) {
                        delete this.activeNotes[noteId];
                    }
                }, shortReleaseTime * 1000 + 5); // Add small buffer
            } catch (e) {
                console.error('Error stopping existing note:', e);
                // Safety cleanup in case of error
                delete this.activeNotes[noteId];
            }
        }

        // Wait a tiny bit for the release envelope to start before creating new oscillators
        // For rapid playing, this slight delay helps prevent clipping/popping
        setTimeout(() => {
            try {
                // Create nodes for oscillator 1 (always active)
                const oscillator1 = this.audioContext.createOscillator();
                const gainNode1 = this.audioContext.createGain();

                const currentTime = this.audioContext.currentTime;

                // Set oscillator type and frequency
                oscillator1.type = this.waveType1;
                const frequency = this.noteToFrequency(note, octave);
                oscillator1.frequency.setValueAtTime(frequency, currentTime);

                // Important: Start with gain at 0
                gainNode1.gain.value = 0;

                // Connect nodes
                oscillator1.connect(gainNode1);
                gainNode1.connect(this.masterGain);

                // Apply gentle attack envelope to avoid clicks
                gainNode1.gain.setValueAtTime(0, currentTime);
                gainNode1.gain.linearRampToValueAtTime(0.5, currentTime + 0.01);

                // Start oscillator
                oscillator1.start();

                // Create second oscillator if needed
                let oscillator2 = null;
                let gainNode2 = null;

                if (this.waveType2 !== 'none') {
                    // Create second oscillator
                    oscillator2 = this.audioContext.createOscillator();
                    gainNode2 = this.audioContext.createGain();

                    // Set up oscillator
                    oscillator2.type = this.waveType2;
                    oscillator2.frequency.setValueAtTime(frequency, currentTime);

                    // Set gain to 0 initially
                    gainNode2.gain.value = 0;

                    // Connect
                    oscillator2.connect(gainNode2);
                    gainNode2.connect(this.masterGain);

                    // Apply envelope
                    gainNode2.gain.setValueAtTime(0, currentTime);
                    gainNode2.gain.linearRampToValueAtTime(0.4, currentTime + 0.01);

                    // Start oscillator
                    oscillator2.start();
                }

                // Store note information with safety timeout
                const noteObj = {
                    oscillator1,
                    gainNode1,
                    oscillator2,
                    gainNode2,
                    note,
                    octave,
                    startTime: currentTime,
                    // Add TWO safety timeouts - one short for quick notes, one long for held notes
                    // Short safety timeout (1 second) - helps with rapid playing
                    safetyCleanupTimeout: setTimeout(() => {
                        // If note is still in activeNotes after 1 second, mark it as "old"
                        if (this.activeNotes[noteId] === noteObj) {
                            noteObj.isOld = true;
                        }
                    }, 1000),
                    // Long safety timeout (5 seconds) - stops any held notes
                    longCleanupTimeout: setTimeout(() => {
                        if (this.activeNotes[noteId] === noteObj) {
                            console.log('Long safety cleanup for note:', noteId);
                            this.stopNote(note, octave);
                        }
                    }, 5000)
                };

                // Store in active notes
                this.activeNotes[noteId] = noteObj;
            } catch (e) {
                console.error('Error creating new note:', e);
            }
        }, 1); // 1ms delay - just enough to help with scheduling but not noticeable
    }

    // Stop a specific note with proper release to prevent clipping
    stopNote(note, octave) {
        const noteId = this.getNoteId(note, octave);
        const noteObj = this.activeNotes[noteId];

        if (noteObj) {
            try {
                // Clear any pending timeouts
                if (noteObj.safetyCleanupTimeout) {
                    clearTimeout(noteObj.safetyCleanupTimeout);
                }
                if (noteObj.longCleanupTimeout) {
                    clearTimeout(noteObj.longCleanupTimeout);
                }

                const now = this.audioContext.currentTime;

                // PROPER RELEASE ENVELOPE: Always apply a release envelope to prevent clicking
                // Just vary the length based on whether it's a quick note or held note
                const isRapidPlaying = !noteObj.isOld;

                // Shorter release for rapid playing, longer for held notes
                const releaseTime = isRapidPlaying ? 0.03 : 0.08;

                // IMPORTANT: Never disconnect immediately - always ramp gain down first
                if (noteObj.gainNode1) {
                    noteObj.gainNode1.gain.cancelScheduledValues(now);
                    noteObj.gainNode1.gain.setValueAtTime(noteObj.gainNode1.gain.value || 0.5, now);
                    noteObj.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
                }

                if (noteObj.gainNode2) {
                    noteObj.gainNode2.gain.cancelScheduledValues(now);
                    noteObj.gainNode2.gain.setValueAtTime(noteObj.gainNode2.gain.value || 0.4, now);
                    noteObj.gainNode2.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
                }

                // Schedule stop and disconnection AFTER the envelope completes
                setTimeout(() => {
                    try {
                        if (noteObj.oscillator1) {
                            try { noteObj.oscillator1.stop(); } catch(e) {}
                        }
                        if (noteObj.oscillator2) {
                            try { noteObj.oscillator2.stop(); } catch(e) {}
                        }

                        // Disconnect the gain nodes after ensuring they're at zero
                        // A brief additional delay ensures the ramped gain has fully reached zero
                        if (noteObj.gainNode1) noteObj.gainNode1.disconnect();
                        if (noteObj.gainNode2) noteObj.gainNode2.disconnect();

                        // Remove from active notes
                        delete this.activeNotes[noteId];
                    } catch (e) {
                        console.error('Error in release envelope cleanup:', e);
                        // Force delete if any errors in cleanup
                        delete this.activeNotes[noteId];
                    }
                }, (releaseTime + 0.005) * 1000);

                // Mark note as releasing to prevent any other operations on it
                noteObj.isReleasing = true;

            } catch (e) {
                console.error('Error in stopNote:', e);
                // Fallback with a minimal release
                try {
                    if (noteObj.gainNode1) {
                        noteObj.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
                    }
                    if (noteObj.gainNode2) {
                        noteObj.gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
                    }
                    setTimeout(() => {
                        try {
                            if (noteObj.gainNode1) noteObj.gainNode1.disconnect();
                            if (noteObj.gainNode2) noteObj.gainNode2.disconnect();
                        } catch (e) {}
                        delete this.activeNotes[noteId];
                    }, 30);
                } catch(e2) {
                    // Last resort, force delete
                    delete this.activeNotes[noteId];
                }
            }
        }
    }

    // Stop all notes with proper release envelopes
    stopAllNotes() {
        console.log('Stop all sounds activated');
        const now = this.audioContext.currentTime;

        // Apply a fade-out to all active notes
        try {
            // Copy the active notes to avoid modification during iteration
            const activeNotesCopy = {...this.activeNotes};

            // Apply a release envelope to all active notes first
            Object.entries(activeNotesCopy).forEach(([noteId, noteObj]) => {
                try {
                    // Skip notes already releasing
                    if (noteObj.isReleasing) return;

                    // Mark the note as releasing
                    noteObj.isReleasing = true;

                    // Apply a short release envelope to all notes
                    const releaseTime = 0.05; // Slightly longer for emergency stop

                    // Apply to oscillator 1
                    if (noteObj.gainNode1) {
                        noteObj.gainNode1.gain.cancelScheduledValues(now);
                        noteObj.gainNode1.gain.setValueAtTime(noteObj.gainNode1.gain.value || 0.5, now);
                        noteObj.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
                    }

                    // Apply to oscillator 2 if it exists
                    if (noteObj.gainNode2) {
                        noteObj.gainNode2.gain.cancelScheduledValues(now);
                        noteObj.gainNode2.gain.setValueAtTime(noteObj.gainNode2.gain.value || 0.4, now);
                        noteObj.gainNode2.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
                    }

                    // Clear any safety timeouts
                    if (noteObj.safetyCleanupTimeout) clearTimeout(noteObj.safetyCleanupTimeout);
                    if (noteObj.longCleanupTimeout) clearTimeout(noteObj.longCleanupTimeout);
                } catch (e) {
                    console.error('Error applying release to note:', noteId, e);
                }
            });

            // After a slight delay to allow release envelopes to take effect, do cleanup
            setTimeout(() => {
                try {
                    // Stop and disconnect all oscillators
                    Object.values(activeNotesCopy).forEach(noteObj => {
                        try {
                            // Disconnect all nodes
                            if (noteObj.gainNode1) noteObj.gainNode1.disconnect();
                            if (noteObj.gainNode2) noteObj.gainNode2.disconnect();

                            // Stop oscillators
                            if (noteObj.oscillator1) {
                                try { noteObj.oscillator1.stop(); } catch(e) {}
                            }
                            if (noteObj.oscillator2) {
                                try { noteObj.oscillator2.stop(); } catch(e) {}
                            }
                        } catch (e) {}
                    });

                    // Reset the master gain to ensure a fresh audio path
                    try {
                        // Create a new master gain node (leave old one connected but silent)
                        const newMasterGain = this.audioContext.createGain();
                        // Start with no sound
                        newMasterGain.gain.value = 0;
                        // Connect to the effects processor
                        newMasterGain.connect(this.effectsProcessor.getInput());

                        // Replace the master gain
                        this.masterGain = newMasterGain;

                        // Fade in gently after a moment
                        setTimeout(() => {
                            this.masterGain.gain.linearRampToValueAtTime(0.7, this.audioContext.currentTime + 0.2);
                        }, 50);
                    } catch (e) {
                        console.error('Error resetting master gain:', e);
                    }

                    // Clear active notes
                    this.activeNotes = {};
                } catch (e) {
                    console.error('Error in stopAllNotes cleanup:', e);
                    // Force clear active notes as last resort
                    this.activeNotes = {};
                }
            }, 60); // Allow enough time for release envelopes to take effect
        } catch (e) {
            console.error('Critical error in stopAllNotes:', e);
            // Emergency reset if all else fails
            this.activeNotes = {};

            try {
                // Force reset the master gain
                const newMasterGain = this.audioContext.createGain();
                newMasterGain.gain.value = 0;
                newMasterGain.connect(this.effectsProcessor.getInput());
                this.masterGain = newMasterGain;

                setTimeout(() => {
                    newMasterGain.gain.linearRampToValueAtTime(0.7, this.audioContext.currentTime + 0.2);
                }, 100);
            } catch (e) {}
        }
    }

    // Set the current effect
    setEffect(effectType) {
        this.effectsProcessor.setEffect(effectType);
    }

    // Set effect parameter
    setEffectParameter(paramName, value) {
        this.effectsProcessor.setParameter(paramName, value);
    }

    // Set the effect mix (0 = dry, 1 = wet)
    setEffectMix(wetAmount) {
        this.effectsProcessor.setMix(wetAmount);
    }

    // Get the current effect parameters
    getEffectParameters() {
        return this.effectsProcessor.getParameters();
    }
}

// Export the DualSynth class

export { DualSynth };
