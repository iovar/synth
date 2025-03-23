// Functions for keyboard UI and events

/**
 * Set up the keyboard UI with support for changing the octave and start note
 * @param {DualSynth} synth - The synthesizer instance
 */
function setupKeyboard(synth) {
    // Current octave management
    let currentOctave = 4; // Default octave
    const octaveDisplay = document.getElementById('current-octave');
    const octaveUpButton = document.getElementById('octave-up');
    const octaveDownButton = document.getElementById('octave-down');

    // Start note selection
    let startNote = 'C'; // Default start note
    const startNoteSelector = document.getElementById('start-note');

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

    // Add event listener to start note selector
    startNoteSelector.addEventListener('change', () => {
        startNote = startNoteSelector.value;
        updateKeyboardNotes();
    });

    // Update octave display
    function updateOctaveDisplay() {
        octaveDisplay.textContent = currentOctave;
    }

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

    // Add key event handlers for mouse/touch
    function setupKeyHandlers() {
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
    }

    // Set up computer keyboard controls
    function setupComputerKeyboard() {
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
    }

    // Initialize all keyboard functionality
    function init() {
        updateOctaveDisplay();
        updateKeyboardNotes();
        setupKeyHandlers();
        setupComputerKeyboard();

        // Add a reset button to stop all sounds
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            synth.stopAllNotes();
            document.querySelectorAll('.white-key.active, .black-key.active').forEach(key => {
                key.classList.remove('active');
            });
            return false;
        });
    }

    // Return an object with public methods
    return {
        init,
        updateKeyboardNotes,
        getCurrentOctave: () => currentOctave
    };
}

export { setupKeyboard };
