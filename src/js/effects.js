/**
 * Audio effects processor for the synthesizer
 * Implements delay and reverb effects
 */
class EffectsProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // Create effect nodes
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Initialize mix levels
        this.dryGain.gain.value = 1.0;
        this.wetGain.gain.value = 0.0;
        
        // Connect dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Connect wet path (without an effect yet)
        this.wetGain.connect(this.output);
        
        // Set up initial state
        this.currentEffect = 'none';
        this.effectNodes = {};
        this.bypass = true;
        
        console.log('Effects processor initialized');
        console.log('Audio routing: input -> [dry/wet paths] -> output');
        
        // Create all effect nodes so they are ready to use
        this.createDelayEffect();
        this.createReverbEffect();
    }
    
    // Create a delay effect
    createDelayEffect() {
        const delay = this.audioContext.createDelay(5.0); // Max 5 seconds delay
        const feedback = this.audioContext.createGain();
        
        // Set initial values
        delay.delayTime.value = 0.3; // 300ms delay
        feedback.gain.value = 0.4; // 40% feedback
        
        // Connect nodes in the delay network
        delay.connect(feedback);
        feedback.connect(delay);
        
        console.log('Created delay effect with feedback loop');
        
        // Store nodes for later parameter adjustment
        this.effectNodes.delay = {
            delay: delay,
            feedback: feedback,
            input: delay,   // Entry point for this effect
            output: delay,  // Exit point from this effect
            params: {
                time: 0.3,
                feedback: 0.4
            }
        };
    }
    
    // Create a reverb effect using convolver
    createReverbEffect() {
        const convolver = this.audioContext.createConvolver();
        
        // Generate an impulse response or load one
        const reverbTime = 2; // 2 seconds reverb time
        const impulseResponse = this.generateImpulseResponse(reverbTime);
        convolver.buffer = impulseResponse;
        
        // Store nodes for later parameter adjustment
        this.effectNodes.reverb = {
            convolver: convolver,
            input: convolver,
            output: convolver,
            params: {
                time: reverbTime
            }
        };
    }
    
    // Generate an impulse response for reverb
    generateImpulseResponse(duration) {
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        
        // Generate a simple impulse response
        for (let i = 0; i < length; i++) {
            const decay = Math.exp(-i / (sampleRate * duration / 10));
            impulseL[i] = (Math.random() * 2 - 1) * decay;
            impulseR[i] = (Math.random() * 2 - 1) * decay;
        }
        
        return impulse;
    }
    
    // Set the current effect
    setEffect(effectType) {
        console.log('Setting effect to:', effectType);
        
        // If already on this effect, do nothing
        if (this.currentEffect === effectType) {
            return;
        }
        
        // Disconnect current effect if it exists
        if (this.effectNodes[this.currentEffect]) {
            try {
                this.input.disconnect(this.effectNodes[this.currentEffect].input);
                this.effectNodes[this.currentEffect].output.disconnect(this.wetGain);
                console.log('Disconnected previous effect:', this.currentEffect);
            } catch (err) {
                console.warn('Error disconnecting previous effect:', err);
            }
        }
        
        // Change to new effect
        this.currentEffect = effectType;
        
        // If none, set dry only
        if (effectType === 'none') {
            this.wetGain.gain.value = 0.0;
            this.dryGain.gain.value = 1.0;
            this.bypass = true;
            console.log('Bypassing effects - dry signal only');
            return;
        }
        
        // Connect new effect
        if (this.effectNodes[effectType]) {
            try {
                this.input.connect(this.effectNodes[effectType].input);
                this.effectNodes[effectType].output.connect(this.wetGain);
                this.wetGain.gain.value = 0.5; // 50% wet
                this.dryGain.gain.value = 0.5; // 50% dry
                this.bypass = false;
                console.log('Connected effect:', effectType, 'with 50% wet/dry mix');
            } catch (err) {
                console.warn('Error connecting new effect:', err);
            }
        }
    }
    
    // Set the wet/dry mix ratio
    setMix(wetAmount) {
        if (this.bypass) return;
        
        this.wetGain.gain.value = Math.min(1.0, Math.max(0, wetAmount));
        this.dryGain.gain.value = 1.0 - wetAmount;
    }
    
    // Set a parameter for the current effect
    setParameter(paramName, value) {
        if (this.bypass || !this.effectNodes[this.currentEffect]) return;
        
        const effect = this.effectNodes[this.currentEffect];
        
        // Store the parameter for future reference
        if (effect.params && effect.params.hasOwnProperty(paramName)) {
            effect.params[paramName] = value;
        }
        
        // Update the appropriate node parameter
        switch (this.currentEffect) {
            case 'delay':
                if (paramName === 'time') {
                    effect.delay.delayTime.setValueAtTime(value, this.audioContext.currentTime);
                } else if (paramName === 'feedback') {
                    effect.feedback.gain.setValueAtTime(value, this.audioContext.currentTime);
                }
                break;
                
            case 'reverb':
                if (paramName === 'time') {
                    // Generate a new impulse response
                    const impulseResponse = this.generateImpulseResponse(value);
                    effect.convolver.buffer = impulseResponse;
                }
                break;
                
        }
    }
    
    // Get available parameters for current effect
    getParameters() {
        if (this.bypass || !this.effectNodes[this.currentEffect]) return {};
        
        return this.effectNodes[this.currentEffect].params;
    }
    
    // Get input node to connect audio source
    getInput() {
        return this.input;
    }
    
    // Get output node to connect to destination
    getOutput() {
        return this.output;
    }
}

export { EffectsProcessor };