// Audio context and synth variables
let audioContext;
let oscillator = null;
let gainNode = null;

// Dual oscillator synthesizer implementation
class DualSynth {
    constructor() {
        // Initialize audio context with fallback
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.activeNotes = {}; // Store active notes with their nodes
        this.waveType1 = 'sine'; // Default wave type for oscillator 1
        this.waveType2 = 'none'; // Default wave type for oscillator 2 (none = disabled)
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.audioContext.destination);
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
        // No conflict check needed here as it's handled in the UI
        this.waveType2 = waveType;
        
        // Update all active oscillators
        Object.values(this.activeNotes).forEach(noteObj => {
            if (noteObj.oscillator2) {
                // If we're switching to none, stop and disconnect oscillator 2
                if (waveType === 'none') {
                    noteObj.oscillator2.stop();
                    noteObj.gainNode2.disconnect();
                    noteObj.oscillator2 = null;
                    noteObj.gainNode2 = null;
                } else {
                    // Otherwise update the type
                    noteObj.oscillator2.type = waveType;
                }
            } else if (waveType !== 'none') {
                // If oscillator 2 doesn't exist and we're switching to a wave type, add it
                this.addSecondOscillator(noteObj);
            }
        });
        
        return true;
    }
    
    // Add second oscillator to an existing note
    addSecondOscillator(noteObj) {
        if (this.waveType2 === 'none' || !noteObj) return;
        
        // Create second oscillator and gain node
        const oscillator2 = this.audioContext.createOscillator();
        const gainNode2 = this.audioContext.createGain();
        
        // Set up the oscillator
        oscillator2.type = this.waveType2;
        // Calculate the frequency using the note and octave from noteObj
        const frequency = this.noteToFrequency(noteObj.note, noteObj.octave);
        oscillator2.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // Connect nodes
        oscillator2.connect(gainNode2);
        gainNode2.connect(this.masterGain);
        
        // Apply envelope
        gainNode2.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.05);
        
        // Start oscillator
        oscillator2.start();
        
        // Add to note object
        noteObj.oscillator2 = oscillator2;
        noteObj.gainNode2 = gainNode2;
    }
    
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
    
    // Play a note
    playNote(note, octave) {
        this.start();
        
        // Generate note ID
        const noteId = this.getNoteId(note, octave);
        
        // Check if this note is already playing
        if (this.activeNotes[noteId]) {
            return; // Note is already playing, do nothing
        }
        
        // Create nodes for oscillator 1 (always active)
        const oscillator1 = this.audioContext.createOscillator();
        const gainNode1 = this.audioContext.createGain();
        
        // Set oscillator type and frequency
        oscillator1.type = this.waveType1;
        const frequency = this.noteToFrequency(note, octave);
        oscillator1.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // Connect nodes
        oscillator1.connect(gainNode1);
        gainNode1.connect(this.masterGain);
        
        // Apply attack envelope
        gainNode1.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode1.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.05);
        
        // Start oscillator
        oscillator1.start();
        
        // Store note information
        const noteObj = {
            oscillator1,
            gainNode1,
            note,
            octave
        };
        
        this.activeNotes[noteId] = noteObj;
        
        // Add second oscillator if enabled
        if (this.waveType2 !== 'none') {
            this.addSecondOscillator(noteObj);
        }
    }
    
    // Stop a specific note
    stopNote(note, octave) {
        const noteId = this.getNoteId(note, octave);
        const noteObj = this.activeNotes[noteId];
        
        if (noteObj) {
            // Apply release envelope to oscillator 1
            noteObj.gainNode1.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
            const releaseTime = this.audioContext.currentTime + 0.06;
            noteObj.oscillator1.stop(releaseTime);
            
            // Apply release envelope to oscillator 2 if it exists
            if (noteObj.oscillator2 && noteObj.gainNode2) {
                noteObj.gainNode2.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
                noteObj.oscillator2.stop(releaseTime);
            }
            
            // Schedule removal from active notes
            setTimeout(() => {
                delete this.activeNotes[noteId];
            }, 70); // Slightly longer than the release time
        }
    }
    
    // Stop all notes
    stopAllNotes() {
        Object.entries(this.activeNotes).forEach(([noteId, noteObj]) => {
            // Stop oscillator 1
            noteObj.gainNode1.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
            const releaseTime = this.audioContext.currentTime + 0.06;
            noteObj.oscillator1.stop(releaseTime);
            
            // Stop oscillator 2 if it exists
            if (noteObj.oscillator2 && noteObj.gainNode2) {
                noteObj.gainNode2.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
                noteObj.oscillator2.stop(releaseTime);
            }
            
            // Schedule removal
            setTimeout(() => {
                delete this.activeNotes[noteId];
            }, 70);
        });
    }
}

// Export the DualSynth class
export { DualSynth };