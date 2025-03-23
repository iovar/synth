/**
 * Audio recorder for the synthesizer
 * Records audio output and saves as WAV file
 */
class AudioRecorder {
    constructor(audioContext, sourceNode) {
        this.audioContext = audioContext;
        this.sourceNode = sourceNode;
        this.recording = false;
        this.chunks = [];
        this.mediaRecorder = null;
        this.recordingStartTime = 0;
        this.setupComplete = false;
    }
    
    /**
     * Initialize the recorder by creating a MediaStream from the audio context
     */
    async setup() {
        if (this.setupComplete) return;
        
        try {
            // Create a MediaStreamDestination node
            this.destination = this.audioContext.createMediaStreamDestination();
            
            // Connect the source to the destination
            this.sourceNode.connect(this.destination);
            
            // Create a MediaRecorder that will record the stream
            this.mediaRecorder = new MediaRecorder(this.destination.stream);
            
            // Set up event handlers for recording
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };
            
            this.setupComplete = true;
            console.log('Audio recorder setup complete');
        } catch (error) {
            console.error('Error setting up recorder:', error);
            throw error;
        }
    }
    
    /**
     * Start recording audio
     */
    async startRecording() {
        if (this.recording) return;
        
        // Make sure the recorder is set up
        if (!this.setupComplete) {
            await this.setup();
        }
        
        // Reset chunks array
        this.chunks = [];
        
        // Start recording
        try {
            this.mediaRecorder.start();
            this.recording = true;
            this.recordingStartTime = Date.now();
            console.log('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    }
    
    /**
     * Stop recording audio
     */
    stopRecording() {
        if (!this.recording) return;
        
        try {
            this.mediaRecorder.stop();
            this.recording = false;
            console.log('Recording stopped');
        } catch (error) {
            console.error('Error stopping recording:', error);
            throw error;
        }
    }
    
    /**
     * Save the recording as a WAV file
     */
    saveRecording() {
        // Create a blob from the recorded chunks
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        
        // Create a unique file name based on date
        const fileName = `synth-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
        
        // Create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        
        // Add the link to the body and click it
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Recording saved as', fileName);
    }
    
    /**
     * Check if recording is in progress
     */
    isRecording() {
        return this.recording;
    }
    
    /**
     * Get the current recording duration in seconds
     */
    getRecordingTime() {
        if (!this.recording) return 0;
        return (Date.now() - this.recordingStartTime) / 1000;
    }
}

export { AudioRecorder };