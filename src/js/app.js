// Main application code
document.addEventListener('DOMContentLoaded', () => {
    console.log('Synth initialized');
    
    // Prevent browser default actions that might cause scrolling
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // Initialize synth keyboard
    initSynthKeyboard();
});

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

// Initialize synth keyboard application
function initSynthKeyboard() {
    // Initialize dual oscillator synthesizer
    const synth = new DualSynth();
    
    // Current octave management
    let currentOctave = 4; // Default octave
    const octaveDisplay = document.getElementById('current-octave');
    const octaveUpButton = document.getElementById('octave-up');
    const octaveDownButton = document.getElementById('octave-down');
    
    // Start note selection
    let startNote = 'C'; // Default start note
    const startNoteSelector = document.getElementById('start-note');
    
    // Wave type selectors
    const waveType1Selector = document.getElementById('wave-type-1');
    const waveType2Selector = document.getElementById('wave-type-2');
    
    // Keyboard keys
    const synthKeys = document.querySelectorAll('.white-key, .black-key');
    
    // Add event listeners to octave buttons
    octaveUpButton.addEventListener('click', () => {
        if (currentOctave < 8) {
            currentOctave++;
            updateOctaveDisplay();
        }
    });
    
    octaveDownButton.addEventListener('click', () => {
        if (currentOctave > 0) {
            currentOctave--;
            updateOctaveDisplay();
        }
    });
    
    // Add event listeners to wave type selectors
    waveType1Selector.addEventListener('change', () => {
        const newType = waveType1Selector.value;
        synth.setWaveType1(newType);
        
        // If this matches synth 2's waveform, update the UI to show "none" and update synth
        if (newType === waveType2Selector.value) {
            waveType2Selector.value = 'none';
            synth.setWaveType2('none');
        }
    });
    
    waveType2Selector.addEventListener('change', () => {
        const newType = waveType2Selector.value;
        
        // Check if this is the same as synth 1
        if (newType !== 'none' && newType === waveType1Selector.value) {
            // Set synth1 to the new type and synth2 to none
            waveType1Selector.value = newType;
            synth.setWaveType1(newType);
            
            waveType2Selector.value = 'none';
            synth.setWaveType2('none');
            return;
        }
        
        synth.setWaveType2(newType);
    });
    
    // Update octave display
    function updateOctaveDisplay() {
        octaveDisplay.textContent = currentOctave;
    }
    
    // Add event listeners to synth keys
    synthKeys.forEach(key => {
        // Mouse events
        key.addEventListener('mousedown', () => {
            // Get the octave offset (if any)
            const octaveOffset = key.dataset.octaveOffset ? parseInt(key.dataset.octaveOffset) : 0;
            synth.playNote(key.dataset.note, currentOctave + octaveOffset);
            key.classList.add('active');
        });
        
        key.addEventListener('mouseup', () => {
            const octaveOffset = key.dataset.octaveOffset ? parseInt(key.dataset.octaveOffset) : 0;
            synth.stopNote(key.dataset.note, currentOctave + octaveOffset);
            key.classList.remove('active');
        });
        
        key.addEventListener('mouseleave', () => {
            if (key.classList.contains('active')) {
                const octaveOffset = key.dataset.octaveOffset ? parseInt(key.dataset.octaveOffset) : 0;
                synth.stopNote(key.dataset.note, currentOctave + octaveOffset);
                key.classList.remove('active');
            }
        });
        
        // Touch events for mobile
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const octaveOffset = key.dataset.octaveOffset ? parseInt(key.dataset.octaveOffset) : 0;
            synth.playNote(key.dataset.note, currentOctave + octaveOffset);
            key.classList.add('active');
        });
        
        key.addEventListener('touchend', () => {
            const octaveOffset = key.dataset.octaveOffset ? parseInt(key.dataset.octaveOffset) : 0;
            synth.stopNote(key.dataset.note, currentOctave + octaveOffset);
            key.classList.remove('active');
        });
    });
    
    // Add keyboard event support (optional feature)
    document.addEventListener('keydown', (e) => {
        // Prevent repeated triggers when key is held down
        if (e.repeat) return;
        
        // Map computer keyboard to keyboard positions (not specific notes)
        const keyboardMap = {
            // Bottom row for white keys
            'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6,
            // Top row for higher octave white keys
            'k': 7, 'l': 8, ';': 9, '\'': 10,
            // Middle row for black keys
            'w': 'C#', 'e': 'D#', 't': 'F#', 'y': 'G#', 'u': 'A#',
            'o': 'C#_hi', 'p': 'D#_hi'
        };
        
        // Handle white keys by position rather than fixed note values
        if (keyboardMap[e.key] !== undefined && typeof keyboardMap[e.key] === 'number') {
            const keyIndex = keyboardMap[e.key];
            const whiteKeys = document.querySelectorAll('.white-key');
            
            if (keyIndex < whiteKeys.length && !whiteKeys[keyIndex].classList.contains('active')) {
                const note = whiteKeys[keyIndex].dataset.note;
                const octaveOffset = whiteKeys[keyIndex].dataset.octaveOffset ? 
                    parseInt(whiteKeys[keyIndex].dataset.octaveOffset) : 0;
                
                synth.playNote(note, currentOctave + octaveOffset);
                whiteKeys[keyIndex].classList.add('active');
            }
        }
        // Handle black keys - this is more complex as they appear in different patterns
        else if (keyboardMap[e.key]) {
            const blackKeyValue = keyboardMap[e.key];
            // First five keys are in the base octave, last two are in higher octave
            const isHigherOctave = blackKeyValue.includes('_hi');
            const noteName = isHigherOctave ? blackKeyValue.split('_')[0] : blackKeyValue;
            
            // Find visible black keys with the corresponding note name
            const blackKeys = Array.from(document.querySelectorAll('.black-key'))
                .filter(key => key.style.visibility !== 'hidden');
            
            // Get appropriate black key based on position
            let keyElement;
            if (isHigherOctave) {
                // Find black keys in higher octave
                keyElement = blackKeys.find(key => 
                    key.dataset.note === noteName && 
                    key.hasAttribute('data-octave-offset'));
            } else {
                // Find base octave black keys
                keyElement = blackKeys.find(key => 
                    key.dataset.note === noteName && 
                    !key.hasAttribute('data-octave-offset'));
            }
            
            if (keyElement && !keyElement.classList.contains('active')) {
                const note = keyElement.dataset.note;
                const octaveOffset = keyElement.dataset.octaveOffset ? 
                    parseInt(keyElement.dataset.octaveOffset) : 0;
                
                synth.playNote(note, currentOctave + octaveOffset);
                keyElement.classList.add('active');
            }
        }
        
        // Handle octave changes with keyboard
        if (e.key === 'z' && currentOctave > 0) {
            currentOctave--;
            updateOctaveDisplay();
        } else if (e.key === 'x' && currentOctave < 8) {
            currentOctave++;
            updateOctaveDisplay();
        }
        
        // Stop all notes with space bar
        if (e.key === ' ') {
            synth.stopAllNotes();
            // Remove active class from all keys
            document.querySelectorAll('.white-key.active, .black-key.active').forEach(key => {
                key.classList.remove('active');
            });
        }
    });
    
    document.addEventListener('keyup', (e) => {
        // Map computer keyboard to keyboard positions (not specific notes)
        const keyboardMap = {
            // Bottom row for white keys
            'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6,
            // Top row for higher octave white keys
            'k': 7, 'l': 8, ';': 9, '\'': 10,
            // Middle row for black keys
            'w': 'C#', 'e': 'D#', 't': 'F#', 'y': 'G#', 'u': 'A#',
            'o': 'C#_hi', 'p': 'D#_hi'
        };
        
        // Handle white keys by position rather than fixed note values
        if (keyboardMap[e.key] !== undefined && typeof keyboardMap[e.key] === 'number') {
            const keyIndex = keyboardMap[e.key];
            const whiteKeys = document.querySelectorAll('.white-key');
            
            if (keyIndex < whiteKeys.length) {
                const keyElement = whiteKeys[keyIndex];
                const note = keyElement.dataset.note;
                const octaveOffset = keyElement.dataset.octaveOffset ? 
                    parseInt(keyElement.dataset.octaveOffset) : 0;
                
                synth.stopNote(note, currentOctave + octaveOffset);
                keyElement.classList.remove('active');
            }
        }
        // Handle black keys
        else if (keyboardMap[e.key]) {
            const blackKeyValue = keyboardMap[e.key];
            const isHigherOctave = blackKeyValue.includes('_hi');
            const noteName = isHigherOctave ? blackKeyValue.split('_')[0] : blackKeyValue;
            
            // Find visible black keys
            const blackKeys = Array.from(document.querySelectorAll('.black-key'))
                .filter(key => key.style.visibility !== 'hidden');
            
            // Get appropriate black key based on position
            let keyElement;
            if (isHigherOctave) {
                keyElement = blackKeys.find(key => 
                    key.dataset.note === noteName && 
                    key.hasAttribute('data-octave-offset'));
            } else {
                keyElement = blackKeys.find(key => 
                    key.dataset.note === noteName && 
                    !key.hasAttribute('data-octave-offset'));
            }
            
            if (keyElement) {
                const note = keyElement.dataset.note;
                const octaveOffset = keyElement.dataset.octaveOffset ? 
                    parseInt(keyElement.dataset.octaveOffset) : 0;
                
                synth.stopNote(note, currentOctave + octaveOffset);
                keyElement.classList.remove('active');
            }
        }
    });
    
    // Add a reset button to stop all sounds
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        synth.stopAllNotes();
        document.querySelectorAll('.white-key.active, .black-key.active').forEach(key => {
            key.classList.remove('active');
        });
        return false;
    });
    
    // Add event listener to start note selector
    startNoteSelector.addEventListener('change', () => {
        startNote = startNoteSelector.value;
        updateKeyboardNotes();
    });
    
    // Function to update the keyboard based on start note
    function updateKeyboardNotes() {
        // Array of white notes in order
        const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
        
        // Find the index of the start note
        const startIndex = whiteNotes.indexOf(startNote);
        
        // Update white keys
        const whiteKeys = document.querySelectorAll('.white-key');
        for (let i = 0; i < whiteKeys.length; i++) {
            // Calculate the new note (with wrapping around the array)
            const noteIndex = (startIndex + i) % 7;
            const octaveOffset = Math.floor((startIndex + i) / 7);
            const newNote = whiteNotes[noteIndex];
            
            // Update attributes and display text
            whiteKeys[i].setAttribute('data-note', newNote);
            if (octaveOffset > 0) {
                whiteKeys[i].setAttribute('data-octave-offset', octaveOffset);
                whiteKeys[i].textContent = newNote;
            } else {
                // Remove octave offset if it exists
                whiteKeys[i].removeAttribute('data-octave-offset');
                whiteKeys[i].textContent = newNote;
            }
        }
        
        // Update black keys (more complex due to irregular pattern)
        const blackKeys = document.querySelectorAll('.black-key');
        // Calculate if we need to show/hide black keys based on the pattern
        
        // Determine if black keys should be visible based on the start note
        const hasBlackKeyAfter = (note) => {
            return note !== 'E' && note !== 'B';
        };
        
        // Hide all black keys first
        blackKeys.forEach(key => {
            key.style.visibility = 'hidden';
        });
        
        // Then show only the appropriate ones
        let blackKeyCount = 0;
        for (let i = 0; i < whiteKeys.length - 1; i++) { // Last white key won't have a black key after
            const currentNote = whiteKeys[i].getAttribute('data-note');
            if (hasBlackKeyAfter(currentNote) && blackKeyCount < blackKeys.length) {
                const blackKey = blackKeys[blackKeyCount];
                const nextWhiteNote = whiteKeys[i + 1].getAttribute('data-note');
                const blackNoteName = currentNote + '#';
                
                // Update position based on white key positions
                const whiteKeyWidth = 100 / whiteKeys.length;
                const leftPos = (i * whiteKeyWidth) + (whiteKeyWidth * 0.65);
                blackKey.style.left = leftPos + '%';
                
                // Update data attributes
                blackKey.setAttribute('data-note', blackNoteName);
                // Copy octave offset from the white key
                if (whiteKeys[i].hasAttribute('data-octave-offset')) {
                    blackKey.setAttribute('data-octave-offset', whiteKeys[i].getAttribute('data-octave-offset'));
                } else {
                    blackKey.removeAttribute('data-octave-offset');
                }
                
                blackKey.textContent = blackNoteName;
                blackKey.style.visibility = 'visible';
                blackKeyCount++;
            }
        }
    }
    
    // Initial setup
    synth.setWaveType1(waveType1Selector.value);
    synth.setWaveType2(waveType2Selector.value);
    updateKeyboardNotes(); // Set up initial keyboard
    
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