// Controls for the synthesizer

/**
 * Set up the wave type selectors for each oscillator
 * @param {DualSynth} synth - The synthesizer instance
 */
function setupSynthControls(synth) {
    // Wave type selectors
    const waveType1Selector = document.getElementById('wave-type-1');
    const waveType2Selector = document.getElementById('wave-type-2');
    
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
    
    // Initialize wave types
    function init() {
        synth.setWaveType1(waveType1Selector.value);
        synth.setWaveType2(waveType2Selector.value);
    }
    
    // Return public methods
    return {
        init
    };
}

export { setupSynthControls };