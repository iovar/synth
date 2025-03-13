/**
 * Audio effects processor for the synthesizer
 * Implements delay, reverb, echo, distortion and filter effects
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
        this.createEchoEffect();
        this.createDistortionEffect();
        this.createFilterEffect();
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
    
    // Create echo effect (multiple delays)
    createEchoEffect() {
        // Create three delays for a more complex echo
        const delay1 = this.audioContext.createDelay(5.0);
        const delay2 = this.audioContext.createDelay(5.0);
        const delay3 = this.audioContext.createDelay(5.0);
        
        const feedback1 = this.audioContext.createGain();
        const feedback2 = this.audioContext.createGain();
        const feedback3 = this.audioContext.createGain();
        
        // Set initial values - different delay times for a more natural echo
        delay1.delayTime.value = 0.2; // 200ms
        delay2.delayTime.value = 0.4; // 400ms
        delay3.delayTime.value = 0.6; // 600ms
        
        feedback1.gain.value = 0.4; // 40% feedback
        feedback2.gain.value = 0.3; // 30% feedback
        feedback3.gain.value = 0.2; // 20% feedback
        
        // Create a gain to combine all outputs
        const echoOutput = this.audioContext.createGain();
        
        // Connect delay network with feedback loops
        delay1.connect(feedback1);
        feedback1.connect(delay1);
        delay1.connect(echoOutput); // Connect delay1 output to final output
        
        delay1.connect(delay2);
        delay2.connect(feedback2);
        feedback2.connect(delay2);
        delay2.connect(echoOutput); // Connect delay2 output to final output
        
        delay2.connect(delay3);
        delay3.connect(feedback3);
        feedback3.connect(delay3);
        delay3.connect(echoOutput); // Connect delay3 output to final output
        
        console.log('Created echo effect with 3 delay lines');
        
        // Store the nodes
        this.effectNodes.echo = {
            delay1: delay1,
            delay2: delay2,
            delay3: delay3,
            feedback1: feedback1,
            feedback2: feedback2,
            feedback3: feedback3,
            input: delay1,
            output: echoOutput,
            params: {
                feedback: 0.4,
                time: 0.2
            }
        };
    }
    
    // Create distortion effect using waveshaper
    createDistortionEffect() {
        const distortion = this.audioContext.createWaveShaper();
        
        // Default distortion setting
        const amount = 20;
        distortion.curve = this.makeDistortionCurve(amount);
        distortion.oversample = '4x'; // Reduce aliasing
        
        console.log('Created distortion effect with amount:', amount);
        
        // Store the node
        this.effectNodes.distortion = {
            distortion: distortion,
            input: distortion,
            output: distortion,
            params: {
                amount: amount
            }
        };
    }
    
    // Generate a distortion curve
    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        
        // Different distortion algorithm that's more pronounced
        for (let i = 0; i < n_samples; i++) {
            const x = i * 2 / n_samples - 1;
            
            // Use a stronger distortion formula
            const y = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
            curve[i] = y;
        }
        
        return curve;
    }
    
    // Create filter effect
    createFilterEffect() {
        const filter = this.audioContext.createBiquadFilter();
        
        // Default to a low-pass filter
        filter.type = 'lowpass';
        filter.frequency.value = 800; // 800Hz cutoff
        filter.Q.value = 1; // Moderate resonance
        
        // Store the node
        this.effectNodes.filter = {
            filter: filter,
            input: filter,
            output: filter,
            params: {
                frequency: 800,
                resonance: 1,
                type: 'lowpass'
            }
        };
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
                
            case 'echo':
                if (paramName === 'time') {
                    // Scale all delay times proportionally
                    effect.delay1.delayTime.setValueAtTime(value, this.audioContext.currentTime);
                    effect.delay2.delayTime.setValueAtTime(value * 2, this.audioContext.currentTime);
                    effect.delay3.delayTime.setValueAtTime(value * 3, this.audioContext.currentTime);
                } else if (paramName === 'feedback') {
                    // Set feedback for all delay lines
                    effect.feedback1.gain.setValueAtTime(value, this.audioContext.currentTime);
                    effect.feedback2.gain.setValueAtTime(value * 0.75, this.audioContext.currentTime);
                    effect.feedback3.gain.setValueAtTime(value * 0.5, this.audioContext.currentTime);
                }
                break;
                
            case 'distortion':
                if (paramName === 'amount') {
                    effect.distortion.curve = this.makeDistortionCurve(value);
                }
                break;
                
            case 'filter':
                if (paramName === 'frequency') {
                    effect.filter.frequency.setValueAtTime(value, this.audioContext.currentTime);
                } else if (paramName === 'resonance') {
                    effect.filter.Q.setValueAtTime(value, this.audioContext.currentTime);
                } else if (paramName === 'type') {
                    effect.filter.type = value;
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