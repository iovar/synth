/**
 * Controls for effects in the synthesizer
 */

function setupEffectsControls(synth) {
    // Effect types with their parameters
    const effectTypes = {
        'none': { label: 'None', params: {} },
        'delay': { 
            label: 'Delay', 
            params: { 
                time: { 
                    label: 'Time', 
                    min: 0.1, 
                    max: 1.0, 
                    step: 0.05, 
                    defaultValue: 0.3,
                    unit: 's'
                },
                feedback: { 
                    label: 'Feedback', 
                    min: 0, 
                    max: 0.9, 
                    step: 0.05, 
                    defaultValue: 0.4,
                    unit: ''
                }
            }
        },
        'reverb': { 
            label: 'Reverb', 
            params: { 
                time: { 
                    label: 'Room Size', 
                    min: 0.5, 
                    max: 5.0, 
                    step: 0.1, 
                    defaultValue: 2.0,
                    unit: 's'
                }
            }
        }
    };
    
    let currentEffect = 'none';
    let mixValue = 0.5;
    
    // Get effect controls container
    const effectsSection = document.getElementById('effects-section');
    
    // Create effect selector
    function createEffectSelector() {
        // Create select element
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'effect-selector';
        
        const label = document.createElement('label');
        label.htmlFor = 'effect-type';
        label.textContent = 'Effect:';
        
        const select = document.createElement('select');
        select.id = 'effect-type';
        
        // Add options
        for (const [value, data] of Object.entries(effectTypes)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = data.label;
            select.appendChild(option);
        }
        
        // Event listener for effect selection
        select.addEventListener('change', () => {
            currentEffect = select.value;
            synth.setEffect(currentEffect);
            updateEffectParameters();
        });
        
        selectorContainer.appendChild(label);
        selectorContainer.appendChild(select);
        
        return selectorContainer;
    }
    
    // Create mix control
    function createMixControl() {
        const mixContainer = document.createElement('div');
        mixContainer.className = 'mix-control';
        
        const label = document.createElement('label');
        label.htmlFor = 'effect-mix';
        label.textContent = 'Mix:';
        
        const mixSlider = document.createElement('input');
        mixSlider.type = 'range';
        mixSlider.id = 'effect-mix';
        mixSlider.min = 0;
        mixSlider.max = 1;
        mixSlider.step = 0.01;
        mixSlider.value = mixValue;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'mix-value';
        valueDisplay.textContent = Math.round(mixValue * 100) + '%';
        
        // Update mix on change
        mixSlider.addEventListener('input', () => {
            mixValue = parseFloat(mixSlider.value);
            valueDisplay.textContent = Math.round(mixValue * 100) + '%';
            synth.setEffectMix(mixValue);
        });
        
        mixContainer.appendChild(label);
        mixContainer.appendChild(mixSlider);
        mixContainer.appendChild(valueDisplay);
        
        return mixContainer;
    }
    
    // Create parameter control for a parameter
    function createParameterControl(paramName, paramData) {
        const paramContainer = document.createElement('div');
        paramContainer.className = 'param-control';
        paramContainer.dataset.param = paramName;
        
        const label = document.createElement('label');
        label.htmlFor = `param-${paramName}`;
        label.textContent = `${paramData.label}:`;
        
        let control;
        
        // If this is a select/option parameter
        if (paramData.options) {
            control = document.createElement('select');
            
            // Add options
            for (const option of paramData.options) {
                const optElement = document.createElement('option');
                optElement.value = option;
                optElement.textContent = option;
                control.appendChild(optElement);
            }
            
            // Set default value
            control.value = paramData.defaultValue;
            
            // Event listener
            control.addEventListener('change', () => {
                synth.setEffectParameter(paramName, control.value);
            });
        } 
        // Otherwise, create a slider
        else {
            control = document.createElement('input');
            control.type = 'range';
            control.min = paramData.min;
            control.max = paramData.max;
            control.step = paramData.step;
            control.value = paramData.defaultValue;
            
            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'param-value';
            valueDisplay.textContent = `${paramData.defaultValue}${paramData.unit}`;
            
            // Event listener for value changes
            control.addEventListener('input', () => {
                const value = parseFloat(control.value);
                valueDisplay.textContent = `${value}${paramData.unit}`;
                synth.setEffectParameter(paramName, value);
            });
            
            paramContainer.appendChild(valueDisplay);
        }
        
        control.id = `param-${paramName}`;
        paramContainer.insertBefore(label, paramContainer.firstChild);
        paramContainer.insertBefore(control, paramContainer.firstChild.nextSibling);
        
        return paramContainer;
    }
    
    // Parameters container
    const paramsContainer = document.createElement('div');
    paramsContainer.className = 'effect-params';
    
    // Create and update parameter controls based on current effect
    function updateEffectParameters() {
        // Clear existing controls
        paramsContainer.innerHTML = '';
        
        // If effect has parameters, create controls
        if (currentEffect !== 'none') {
            const effectData = effectTypes[currentEffect];
            
            // Create controls for each parameter
            for (const [paramName, paramData] of Object.entries(effectData.params)) {
                const control = createParameterControl(paramName, paramData);
                paramsContainer.appendChild(control);
            }
            
            // Show mix control
            document.getElementById('effect-mix-container').style.display = 'block';
        } else {
            // Hide mix control for "none" effect
            document.getElementById('effect-mix-container').style.display = 'none';
        }
    }
    
    // Initialize the effects section
    function initEffectsUI() {
        console.log('Initializing effects UI');
        
        // Check if the effects section exists
        if (!effectsSection) {
            console.error('Effects section element not found!');
            return;
        }
        
        // Clear existing content
        effectsSection.innerHTML = '';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Effects';
        effectsSection.appendChild(title);
        
        // Create and add effect selector
        const selector = createEffectSelector();
        effectsSection.appendChild(selector);
        
        // Create mix control container
        const mixControlContainer = document.createElement('div');
        mixControlContainer.id = 'effect-mix-container';
        mixControlContainer.style.display = 'none'; // Hidden initially
        
        // Add mix control
        const mixControl = createMixControl();
        mixControlContainer.appendChild(mixControl);
        effectsSection.appendChild(mixControlContainer);
        
        // Add parameters container
        effectsSection.appendChild(paramsContainer);
        
        // Initialize parameters based on default effect (none)
        updateEffectParameters();
        
        console.log('Effects UI initialized successfully');
    }
    
    return {
        init: initEffectsUI
    };
}

export { setupEffectsControls };