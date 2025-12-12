// NFT Generator - Procedural Trait Generation System
// Main JavaScript implementation for slider interactions, Canvas-based trait generation, and UI management

// ===== GLOBAL STATE AND CONFIGURATION =====

// Global state object to store all generated traits organized by category
const globalState = {
    background: [],
    body: [],
    eyes: [],
    mouth: [],
    hat: []
};

// Add to global state section - API Management
const apiManager = new APIManager();
const apiKeyStorage = new APIKeyStorage();

// Add to global state section - Style Engine
const styleEngine = new StyleEngine();

// Rarity state object to store trait weights organized by category
const rarityState = {
    background: [],
    body: [],
    eyes: [],
    mouth: [],
    hat: []
};

// Layer stacking order for NFT composition (z-index mapping)
const LAYER_ORDER = {
    'background': 0,
    'body': 1,
    'eyes': 2,
    'mouth': 3,
    'hat': 4
};

// Configuration cache for current slider and input values
const configCache = {
    background: { 
        numTraits: 20, 
        complexity: 5, 
        colorSeed: '',
        generationMode: 'procedural', // NEW: 'procedural', 'ai', or 'hybrid'
        aiOptions: { provider: 'auto', size: '512x512', quality: 'standard', aspectRatio: '1:1', hybridOverlayOpacity: 0.4 } // NEW
    },
    body: { 
        numTraits: 20, 
        complexity: 5, 
        colorSeed: '',
        generationMode: 'procedural', // NEW
        aiOptions: { provider: 'auto', size: '512x512', quality: 'standard', aspectRatio: '1:1', hybridOverlayOpacity: 0.4 } // NEW
    },
    eyes: { 
        numTraits: 20, 
        complexity: 5, 
        colorSeed: '',
        generationMode: 'procedural', // NEW
        aiOptions: { provider: 'auto', size: '512x512', quality: 'standard', aspectRatio: '1:1', hybridOverlayOpacity: 0.4 } // NEW
    },
    mouth: { 
        numTraits: 20, 
        complexity: 5, 
        colorSeed: '',
        generationMode: 'procedural', // NEW
        aiOptions: { provider: 'auto', size: '512x512', quality: 'standard', aspectRatio: '1:1', hybridOverlayOpacity: 0.4 } // NEW
    },
    hat: { 
        numTraits: 20, 
        complexity: 5, 
        colorSeed: '',
        generationMode: 'procedural', // NEW
        aiOptions: { provider: 'auto', size: '512x512', quality: 'standard', aspectRatio: '1:1', hybridOverlayOpacity: 0.4 } // NEW
    },
    
    // Global style configuration
    globalStyle: {
        masterPrompt: '',
        masterIntensity: 1.0,
        globalNegativePrompt: 'blurry, low quality, distorted, malformed',
        activePreset: null,
        colorPaletteLock: false,
        lockedColors: [],
        useMasterSeed: false,
        masterSeed: null,
        consistencyLevel: 'medium',
        useAIGeneration: false, // NEW: global toggle for AI generation
        
        // Per-category style overrides
        categoryStyles: {
            background: { stylePrompt: '', negativePrompt: '' },
            body: { stylePrompt: '', negativePrompt: '' },
            eyes: { stylePrompt: '', negativePrompt: '' },
            mouth: { stylePrompt: '', negativePrompt: '' },
            hat: { stylePrompt: '', negativePrompt: '' }
        }
    }
};

// DOM element references (cached for performance)
let domRefs = {};

// ===== STYLE PRESETS LIBRARY =====

const StylePresets = new Map([
    ['cyberpunk', {
        name: 'Cyberpunk',
        masterStyle: 'cyberpunk, neon, futuristic, digital art, high-tech',
        colorPalette: ['#00ffff', '#ff00ff', '#ffff00', '#ff0080', '#00ff80'],
        textureHints: 'metallic, glowing, holographic, chrome, LED',
        lightingMood: 'neon lighting, dramatic shadows, electric glow'
    }],
    ['medieval', {
        name: 'Medieval Fantasy',
        masterStyle: 'medieval, fantasy, ancient, mystical, enchanted',
        colorPalette: ['#8b4513', '#daa520', '#228b22', '#4b0082', '#dc143c'],
        textureHints: 'stone, wood, leather, metal, fabric',
        lightingMood: 'torch lighting, warm glow, candlelight'
    }],
    ['minimalist', {
        name: 'Minimalist',
        masterStyle: 'minimalist, clean, simple, geometric, modern',
        colorPalette: ['#ffffff', '#000000', '#808080', '#c0c0c0', '#f5f5f5'],
        textureHints: 'smooth, matte, clean lines, flat',
        lightingMood: 'soft, even lighting, natural light'
    }],
    ['retro', {
        name: 'Retro 80s',
        masterStyle: 'retro, 80s, synthwave, vintage, nostalgic',
        colorPalette: ['#ff6b9d', '#4ecdc4', '#45b7d1', '#f9ca24', '#e056fd'],
        textureHints: 'gradient, chrome, plastic, vinyl',
        lightingMood: 'neon glow, sunset colors, vibrant'
    }],
    ['organic', {
        name: 'Organic Nature',
        masterStyle: 'organic, natural, flowing, botanical, earthy',
        colorPalette: ['#2d5016', '#61892f', '#86c232', '#6b6e70', '#8fbc8f'],
        textureHints: 'wood grain, leaf patterns, stone, bark',
        lightingMood: 'natural sunlight, forest shadows, golden hour'
    }],
    ['abstract', {
        name: 'Abstract Art',
        masterStyle: 'abstract, artistic, expressive, creative, painterly',
        colorPalette: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c'],
        textureHints: 'painterly, brushstrokes, textured, artistic',
        lightingMood: 'artistic lighting, color play, dramatic'
    }]
]);

// ===== COLOR PALETTE MANAGER =====

class ColorPaletteManager {
    constructor() {
        this.isLocked = false;
        this.lockedColors = [];
        this.currentPalette = [];
    }
    
    lockPalette(colors) {
        if (!Array.isArray(colors)) {
            throw new Error('Colors must be an array');
        }
        
        // Validate hex colors
        const validColors = colors.filter(color => this.isValidHexColor(color));
        if (validColors.length !== colors.length) {
            console.warn('Some colors were invalid and filtered out');
        }
        
        this.lockedColors = validColors;
        this.isLocked = true;
        this.currentPalette = [...validColors];
        
        // Emit palette locked event
        window.dispatchEvent(new CustomEvent('paletteChanged', {
            detail: { locked: true, colors: this.lockedColors }
        }));
        
        return validColors;
    }
    
    unlockPalette() {
        this.isLocked = false;
        this.lockedColors = [];
        
        // Emit palette unlocked event
        window.dispatchEvent(new CustomEvent('paletteChanged', {
            detail: { locked: false, colors: [] }
        }));
    }
    
    getCurrentPalette() {
        return this.isLocked ? [...this.lockedColors] : [...this.currentPalette];
    }
    
    setCurrentPalette(colors) {
        if (!this.isLocked) {
            const validColors = colors.filter(color => this.isValidHexColor(color));
            this.currentPalette = validColors;
            
            // Emit palette changed event
            window.dispatchEvent(new CustomEvent('paletteChanged', {
                detail: { locked: false, colors: validColors }
            }));
        }
    }
    
    isValidHexColor(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    }
    
    getRandomColorFromPalette() {
        const palette = this.getCurrentPalette();
        if (palette.length === 0) {
            // Fallback to random color if no palette
            return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
        }
        
        return palette[Math.floor(Math.random() * palette.length)];
    }
    
    exportPaletteConfig() {
        return {
            isLocked: this.isLocked,
            lockedColors: [...this.lockedColors],
            currentPalette: [...this.currentPalette]
        };
    }
    
    importPaletteConfig(config) {
        if (config.isLocked && config.lockedColors) {
            this.lockPalette(config.lockedColors);
        } else {
            this.unlockPalette();
            if (config.currentPalette) {
                this.setCurrentPalette(config.currentPalette);
            }
        }
    }
}

// ===== NEGATIVE PROMPT SYSTEM =====

class NegativePromptManager {
    constructor() {
        this.globalNegativePrompt = 'blurry, low quality, distorted, malformed';
        this.categoryNegativePrompts = {
            background: '',
            body: 'extra limbs, deformed',
            eyes: 'missing eyes, extra eyes',
            mouth: 'no mouth, multiple mouths',
            hat: 'floating, disconnected'
        };
    }
    
    setGlobalNegativePrompt(prompt) {
        this.globalNegativePrompt = prompt;
        
        // Emit global negative prompt changed event
        window.dispatchEvent(new CustomEvent('globalNegativePromptChanged', {
            detail: { prompt }
        }));
    }
    
    setCategoryNegativePrompt(category, prompt) {
        if (this.categoryNegativePrompts.hasOwnProperty(category)) {
            this.categoryNegativePrompts[category] = prompt;
            
            // Emit category negative prompt changed event
            window.dispatchEvent(new CustomEvent('categoryNegativePromptChanged', {
                detail: { category, prompt }
            }));
        }
    }
    
    buildNegativePrompt(category) {
        const prompts = [];
        
        // Add global negative prompt
        if (this.globalNegativePrompt) {
            prompts.push(this.globalNegativePrompt);
        }
        
        // Add category-specific negative prompt
        if (category && this.categoryNegativePrompts[category]) {
            prompts.push(this.categoryNegativePrompts[category]);
        }
        
        return prompts.join(', ');
    }
    
    exportNegativePromptConfig() {
        return {
            globalNegativePrompt: this.globalNegativePrompt,
            categoryNegativePrompts: { ...this.categoryNegativePrompts }
        };
    }
    
    importNegativePromptConfig(config) {
        if (config.globalNegativePrompt !== undefined) {
            this.setGlobalNegativePrompt(config.globalNegativePrompt);
        }
        
        if (config.categoryNegativePrompts) {
            Object.entries(config.categoryNegativePrompts).forEach(([category, prompt]) => {
                this.setCategoryNegativePrompt(category, prompt);
            });
        }
    }
}

// ===== STYLE ENGINE =====

class StyleEngine {
    constructor() {
        this.masterStylePrompt = '';
        this.categoryTemplates = {
            background: 'A {style} background with {colors}',
            body: 'A {style} character body with {colors}',
            eyes: '{style} eyes with {colors}',
            mouth: 'A {style} mouth with {colors}',
            hat: 'A {style} hat with {colors}'
        };
        this.activePreset = null;
        this.stylePresets = StylePresets;
        this.colorPaletteManager = new ColorPaletteManager();
        this.negativePromptManager = new NegativePromptManager();
    }

    
    buildPrompt(category, basePrompt, options = {}) {
        let prompt = basePrompt;
        
        // Apply category template if available
        if (this.categoryTemplates[category]) {
            const template = this.categoryTemplates[category];
            prompt = template.replace('{style}', this.masterStylePrompt || 'detailed');
            
            // Replace color placeholders
            if (options.colors) {
                prompt = prompt.replace('{colors}', options.colors.join(', '));
            } else {
                prompt = prompt.replace('{colors}', 'vibrant colors');
            }
        }
        
        // Prepend master style prompt
        if (this.masterStylePrompt) {
            prompt = `${this.masterStylePrompt}, ${prompt}`;
        }
        
        // Apply active preset styling
        if (this.activePreset && this.stylePresets.has(this.activePreset)) {
            const preset = this.stylePresets.get(this.activePreset);
            prompt = `${preset.masterStyle}, ${prompt}`;
            
            if (preset.textureHints) {
                prompt += `, ${preset.textureHints}`;
            }
            
            if (preset.lightingMood) {
                prompt += `, ${preset.lightingMood}`;
            }
        }
        
        return prompt;
    }
    
    applyPreset(presetName) {
        if (this.stylePresets.has(presetName)) {
            this.activePreset = presetName;
            const preset = this.stylePresets.get(presetName);
            this.masterStylePrompt = preset.masterStyle;
            
            // Apply preset color palette
            this.colorPaletteManager.setCurrentPalette(preset.colorPalette);
            
            // Emit preset changed event
            window.dispatchEvent(new CustomEvent('stylePresetChanged', {
                detail: { presetName, preset }
            }));
            
            return true;
        }
        return false;
    }
    
    getActivePreset() {
        return this.activePreset ? this.stylePresets.get(this.activePreset) : null;
    }
    
    getAllPresets() {
        return Array.from(this.stylePresets.entries()).map(([key, preset]) => ({
            id: key,
            ...preset
        }));
    }
    
    setMasterStylePrompt(prompt) {
        this.masterStylePrompt = prompt;
        
        // Emit style changed event
        window.dispatchEvent(new CustomEvent('masterStyleChanged', {
            detail: { masterStylePrompt: prompt }
        }));
    }
    
    setGlobalNegativePrompt(prompt) {
        this.negativePromptManager.setGlobalNegativePrompt(prompt);
    }
    
    setCategoryNegativePrompt(category, prompt) {
        this.negativePromptManager.setCategoryNegativePrompt(category, prompt);
    }
    
    buildNegativePrompt(category) {
        return this.negativePromptManager.buildNegativePrompt(category);
    }
    
    lockColorPalette(colors) {
        return this.colorPaletteManager.lockPalette(colors);
    }
    
    unlockColorPalette() {
        this.colorPaletteManager.unlockPalette();
    }
    
    getCurrentColorPalette() {
        return this.colorPaletteManager.getCurrentPalette();
    }
    
    setCategoryTemplate(category, template) {
        this.categoryTemplates[category] = template;
    }
    
    exportStyleConfig() {
        return {
            masterStylePrompt: this.masterStylePrompt,
            categoryTemplates: { ...this.categoryTemplates },
            activePreset: this.activePreset,
            negativePrompts: this.negativePromptManager.exportNegativePromptConfig(),
            colorPalette: this.colorPaletteManager.exportPaletteConfig(),
            customPresets: Array.from(this.stylePresets.entries())
                .filter(([key]) => !['cyberpunk', 'medieval', 'minimalist', 'retro', 'organic', 'abstract'].includes(key))
        };
    }
    
    importStyleConfig(config) {
        if (config.masterStylePrompt !== undefined) {
            this.masterStylePrompt = config.masterStylePrompt;
        }
        
        if (config.categoryTemplates) {
            this.categoryTemplates = { ...this.categoryTemplates, ...config.categoryTemplates };
        }
        
        if (config.activePreset) {
            this.activePreset = config.activePreset;
        }
        
        if (config.negativePrompts) {
            this.negativePromptManager.importNegativePromptConfig(config.negativePrompts);
        }
        
        if (config.colorPalette) {
            this.colorPaletteManager.importPaletteConfig(config.colorPalette);
        }
        
        if (config.customPresets) {
            config.customPresets.forEach(([key, preset]) => {
                this.stylePresets.set(key, preset);
            });
        }
        
        // Emit config imported event
        window.dispatchEvent(new CustomEvent('styleConfigImported', {
            detail: config
        }));
    }
}

// ===== AI GENERATION COORDINATOR =====

class AIGenerationCoordinator {
    constructor() {
        this.cache = new Map(); // Key: `${category}_${complexity}_${colorSeed}_${index}`
        this.cacheEnabled = true;
        this.maxCacheSize = 500;
        this.maxRetries = 3;
        this.isGenerating = false;
        this.currentBatch = null;
    }
    
    getCacheKey(category, complexity, colorSeed, index) {
        return `${category}_${complexity}_${colorSeed}_${index}`;
    }
    
    async generateSingleAITrait(category, complexity, colorSeed, index) {
        const cacheKey = this.getCacheKey(category, complexity, colorSeed, index);
        
        // Check cache first
        if (this.cacheEnabled && this.cache.has(cacheKey)) {
            console.log(`Cache hit for ${cacheKey}`);
            return this.cache.get(cacheKey);
        }
        
        let lastError = null;
        
        // Retry logic
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Build AI prompt using style engine
                const prompt = this.buildAIPromptForTrait(category, complexity, colorSeed, index);
                const negativePrompt = styleEngine.buildNegativePrompt(category);
                
                // Get AI options for category
                const aiOptions = configCache[category].aiOptions;
                const options = {
                    size: aiOptions.size,
                    quality: aiOptions.quality,
                    aspectRatio: aiOptions.aspectRatio,
                    negativePrompt: negativePrompt
                };
                
                // Generate image via API manager
                const result = await apiManager.generateImage(prompt, options);
                
                // Cache the result
                this.cache.set(cacheKey, result);
                this.manageCacheSize();
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.warn(`AI generation attempt ${attempt} failed for ${category}[${index}]:`, error.message);
                
                if (attempt === this.maxRetries) {
                    // Final attempt failed, handle error
                    return this.handleAIGenerationError(error, category, index);
                }
                
                // Wait before retry (exponential backoff)
                await this.delay(1000 * Math.pow(2, attempt - 1));
            }
        }
        
        // Should not reach here, but fallback
        return this.handleAIGenerationError(lastError, category, index);
    }
    
    buildAIPromptForTrait(category, complexity, colorSeed, index) {
        // Use existing parseColorSeed to get color information
        const baseColor = parseColorSeed(colorSeed, category, index);
        const colors = styleEngine.getCurrentColorPalette();
        
        // Build base prompt based on category and complexity
        let basePrompt = '';
        switch (category) {
            case 'background':
                basePrompt = `A detailed ${complexity > 7 ? 'complex' : complexity > 4 ? 'moderate' : 'simple'} background`;
                break;
            case 'body':
                basePrompt = `A ${complexity > 7 ? 'highly detailed' : complexity > 4 ? 'detailed' : 'simple'} character body`;
                break;
            case 'eyes':
                basePrompt = `${complexity > 7 ? 'Intricate' : complexity > 4 ? 'Detailed' : 'Simple'} eyes`;
                break;
            case 'mouth':
                basePrompt = `A ${complexity > 7 ? 'expressive' : complexity > 4 ? 'detailed' : 'simple'} mouth`;
                break;
            case 'hat':
                basePrompt = `A ${complexity > 7 ? 'ornate' : complexity > 4 ? 'decorative' : 'simple'} hat`;
                break;
            default:
                basePrompt = `A ${category} trait`;
        }
        
        // Use style engine to build the complete prompt
        return styleEngine.buildPrompt(category, basePrompt, { colors });
    }
    
    async generateAITraitBatch(category, count, config) {
        this.isGenerating = true;
        this.currentBatch = { category, count, completed: 0, failed: 0 };
        
        // Emit batch started event
        this.emitProgressEvent(0, count, category, 'started');
        
        const results = [];
        
        for (let i = 0; i < count; i++) {
            try {
                const result = await this.generateSingleAITrait(
                    category, 
                    config.complexity, 
                    config.colorSeed, 
                    i
                );
                
                results.push(result);
                this.currentBatch.completed++;
                
                // Emit progress event
                this.emitProgressEvent(this.currentBatch.completed, count, category, 'progress');
                
            } catch (error) {
                console.error(`Failed to generate AI trait ${category}[${i}]:`, error);
                this.currentBatch.failed++;
                
                // Emit error event
                window.dispatchEvent(new CustomEvent('aiGenerationError', {
                    detail: { category, index: i, error: error.message }
                }));
                
                // Add null result to maintain array indexing
                results.push(null);
            }
        }
        
        this.isGenerating = false;
        
        // Emit batch complete event
        window.dispatchEvent(new CustomEvent('aiGenerationComplete', {
            detail: { 
                category, 
                successCount: this.currentBatch.completed, 
                failureCount: this.currentBatch.failed,
                results 
            }
        }));
        
        return results;
    }
    
    handleAIGenerationError(error, category, index) {
        console.warn(`AI generation failed for ${category}[${index}], falling back to procedural`);
        
        // Emit fallback event
        window.dispatchEvent(new CustomEvent('aiGenerationFallback', {
            detail: { category, index, error: error.message }
        }));
        
        // Fallback to procedural generation
        try {
            return generateTraitImage(category, configCache[category].complexity, configCache[category].colorSeed, index);
        } catch (proceduralError) {
            console.error(`Procedural fallback also failed for ${category}[${index}]:`, proceduralError);
            throw new Error(`Both AI and procedural generation failed: ${error.message}`);
        }
    }
    
    emitProgressEvent(current, total, category, status = 'progress') {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        
        window.dispatchEvent(new CustomEvent('aiGenerationProgress', {
            detail: { 
                category, 
                current, 
                total, 
                percentage,
                status
            }
        }));
    }
    
    manageCacheSize() {
        if (this.cache.size > this.maxCacheSize) {
            // Simple LRU: remove oldest entries
            const keysToRemove = Array.from(this.cache.keys()).slice(0, this.cache.size - this.maxCacheSize + 50);
            keysToRemove.forEach(key => this.cache.delete(key));
        }
    }
    
    clearCache() {
        this.cache.clear();
        console.log('AI generation cache cleared');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getStatus() {
        return {
            isGenerating: this.isGenerating,
            currentBatch: this.currentBatch,
            cacheSize: this.cache.size,
            cacheEnabled: this.cacheEnabled
        };
    }
}

// Create global AI coordinator instance
const aiCoordinator = new AIGenerationCoordinator();

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async function() {
    initializeDOMReferences();
    initializeSliderListeners();
    initializeGenerateButton();
    initializeCollectionGeneration();
    initializeDownloadButton();
    
    // Initialize API providers and configuration
    await initializeAPIProviders();
    await loadAPIConfiguration();
    
    // Initialize style engine
    initializeStyleEngine();
    
    // Initialize AI Generation Coordinator
    window.aiCoordinator = aiCoordinator;
    
    // Set up event listeners for generation mode changes
    setupGenerationModeListeners();
    
    // Load saved configuration
    loadConfiguration();
    
    console.log('NFT Generator initialized successfully');
});

function initializeDOMReferences() {
    const categories = ['bg', 'body', 'eyes', 'mouth', 'hat'];
    
    domRefs = {
        sliders: {},
        valueSpans: {},
        colorInputs: {},
        previewContainers: {},
        generateBtn: document.getElementById('generateTraitsBtn')
    };

    categories.forEach(category => {
        // Map 'bg' to 'background' for consistency with global state
        const stateKey = category === 'bg' ? 'background' : category;
        
        domRefs.sliders[stateKey] = {
            numTraits: document.getElementById(`${category}-numTraits`),
            complexity: document.getElementById(`${category}-complexity`)
        };
        
        domRefs.valueSpans[stateKey] = {
            numTraits: document.getElementById(`${category}-numTraits-value`),
            complexity: document.getElementById(`${category}-complexity-value`)
        };
        
        domRefs.colorInputs[stateKey] = document.getElementById(`${category}-colorSeed`);
        
        // Find preview container within the trait category
        const traitCategory = document.querySelector(`#${category}-numTraits`).closest('.trait-category');
        domRefs.previewContainers[stateKey] = traitCategory.querySelector('.trait-preview-container');
    });
}

// ===== SLIDER VALUE SYNCHRONIZATION =====

function initializeSliderListeners() {
    const categories = Object.keys(configCache);
    
    categories.forEach(category => {
        // Number of traits slider
        if (domRefs.sliders[category].numTraits) {
            domRefs.sliders[category].numTraits.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                domRefs.valueSpans[category].numTraits.textContent = value;
                configCache[category].numTraits = value;
            });
        }
        
        // Complexity slider
        if (domRefs.sliders[category].complexity) {
            domRefs.sliders[category].complexity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                domRefs.valueSpans[category].complexity.textContent = value;
                configCache[category].complexity = value;
            });
        }
        
        // Color seed input
        if (domRefs.colorInputs[category]) {
            domRefs.colorInputs[category].addEventListener('input', (e) => {
                configCache[category].colorSeed = e.target.value.trim();
            });
        }
    });
}

// ===== UTILITY FUNCTIONS =====

function parseColorSeed(seedInput, category = null, index = 0) {
    // Check if using master seed system
    if (seedManager.useMasterSeed && category) {
        const seededRand = seedManager.getSeededRandom(category, index);
        return {
            h: Math.floor(seededRand * 360),
            s: Math.floor(seededRand * 50) + 50, // 50-100% saturation
            l: Math.floor(seededRand * 40) + 30   // 30-70% lightness
        };
    }
    
    // Check if color palette is locked
    const currentPalette = styleEngine.getCurrentColorPalette();
    if (currentPalette.length > 0) {
        const colorIndex = category && seedManager.useMasterSeed ? 
            Math.floor(seedManager.getSeededRandom(category, index) * currentPalette.length) :
            Math.floor(Math.random() * currentPalette.length);
        
        const hexColor = currentPalette[colorIndex];
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return rgbToHsl(r, g, b);
    }
    
    if (!seedInput || seedInput.toLowerCase() === 'random') {
        // Generate random HSL color
        return {
            h: Math.floor(Math.random() * 360),
            s: Math.floor(Math.random() * 50) + 50, // 50-100% saturation
            l: Math.floor(Math.random() * 40) + 30   // 30-70% lightness
        };
    }
    
    // Validate hex color
    const hexMatch = seedInput.match(/^#?([a-f\d]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return rgbToHsl(r, g, b);
    }
    
    // Fallback to random if invalid
    return parseColorSeed('random', category, index);
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ===== MASTER SEED MANAGEMENT =====

class SeedManager {
    constructor() {
        this.masterSeed = null;
        this.useMasterSeed = false;
        this.categorySeeds = {};
    }
    
    setMasterSeed(seed) {
        this.masterSeed = seed;
        this.regenerateCategorySeeds();
        
        // Emit master seed changed event
        window.dispatchEvent(new CustomEvent('masterSeedChanged', {
            detail: { masterSeed: seed, useMasterSeed: this.useMasterSeed }
        }));
    }
    
    setUseMasterSeed(enabled) {
        this.useMasterSeed = enabled;
        
        if (enabled && this.masterSeed !== null) {
            this.regenerateCategorySeeds();
        }
        
        // Emit master seed usage changed event
        window.dispatchEvent(new CustomEvent('masterSeedUsageChanged', {
            detail: { useMasterSeed: enabled, masterSeed: this.masterSeed }
        }));
    }
    
    regenerateCategorySeeds() {
        if (this.masterSeed !== null) {
            const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
            categories.forEach(category => {
                this.categorySeeds[category] = this.deriveCategorySeed(this.masterSeed, category);
            });
        }
    }
    
    deriveCategorySeed(masterSeed, categoryName) {
        // Create deterministic seed from master seed and category name
        let hash = 0;
        const combined = `${masterSeed}_${categoryName}`;
        
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash);
    }
    
    getCategorySeed(categoryName) {
        if (this.useMasterSeed && this.categorySeeds[categoryName] !== undefined) {
            return this.categorySeeds[categoryName];
        }
        
        // Fallback to random seed if master seed not used
        return Math.floor(Math.random() * 1000000);
    }
    
    getSeededRandom(categoryName, index = 0) {
        const seed = this.getCategorySeed(categoryName) + index;
        return seededRandom(seed);
    }
    
    exportSeedConfig() {
        return {
            masterSeed: this.masterSeed,
            useMasterSeed: this.useMasterSeed,
            categorySeeds: { ...this.categorySeeds }
        };
    }
    
    importSeedConfig(config) {
        if (config.masterSeed !== undefined) {
            this.masterSeed = config.masterSeed;
        }
        
        if (config.useMasterSeed !== undefined) {
            this.useMasterSeed = config.useMasterSeed;
        }
        
        if (config.categorySeeds) {
            this.categorySeeds = { ...config.categorySeeds };
        }
        
        // Regenerate seeds if master seed is set and enabled
        if (this.useMasterSeed && this.masterSeed !== null) {
            this.regenerateCategorySeeds();
        }
    }
}

// Create global seed manager instance
const seedManager = new SeedManager();

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getLayerOrder(category) {
    return LAYER_ORDER[category] || 0;
}

// ===== RARITY STATE MANAGEMENT =====

function initializeRarityState(category) {
    const traits = globalState[category];
    if (!traits || traits.length === 0) return;
    
    const numTraits = traits.length;
    const equalWeight = 100 / numTraits;
    
    rarityState[category] = traits.map((trait, index) => ({
        traitId: trait.id,
        weight: index === numTraits - 1 ? 
            100 - (equalWeight * (numTraits - 1)) : // Adjust last trait for exact 100%
            equalWeight
    }));
}

function getRarityWeights(category) {
    return rarityState[category] || [];
}

function getTraitRarity(traitId, category = null) {
    if (category) {
        // If category is specified, search only in that category
        const weights = rarityState[category];
        if (weights) {
            const found = weights.find(item => item.traitId === traitId);
            if (found) return found.weight;
        }
        return 0;
    } else {
        // If no category specified, search all categories (backward compatibility)
        for (const cat in rarityState) {
            const found = rarityState[cat].find(item => item.traitId === traitId);
            if (found) return found.weight;
        }
        return 0;
    }
}

function setTraitRarity(traitId, weight) {
    for (const category in rarityState) {
        const item = rarityState[category].find(item => item.traitId === traitId);
        if (item) {
            item.weight = weight;
            return true;
        }
    }
    return false;
}

function getRarityTier(weight) {
    if (weight >= 0 && weight < 5) {
        return { tier: "Legendary", className: "legendary" };
    } else if (weight >= 5 && weight < 15) {
        return { tier: "Epic", className: "epic" };
    } else if (weight >= 15 && weight < 40) {
        return { tier: "Rare", className: "rare" };
    } else {
        return { tier: "Common", className: "common" };
    }
}

// ===== RARITY VALIDATION SYSTEM =====

function validateCategoryRarity(category) {
    const weights = rarityState[category];
    if (!weights || weights.length === 0) {
        return { isValid: true, sum: 0 }; // Treat empty categories as valid/neutral
    }
    
    const sum = weights.reduce((total, item) => total + item.weight, 0);
    const isValid = Math.abs(sum - 100) <= 0.1; // Tolerance for floating-point precision
    
    updateValidationUI(category, { isValid, sum });
    
    return { isValid, sum };
}

function updateValidationUI(category, validationResult) {
    const categoryElement = document.querySelector(`[data-category="${category}"]`);
    if (!categoryElement) return;
    
    const badge = categoryElement.querySelector('.validation-badge');
    if (!badge) return;
    
    badge.className = `validation-badge ${validationResult.isValid ? 'valid' : 'invalid'}`;
    badge.textContent = validationResult.isValid ? 
        '✓ 100%' : 
        `✗ ${validationResult.sum.toFixed(1)}%`;
}

function checkAllCategoriesValid() {
    // Only consider categories that have traits/weights
    const categoriesWithTraits = Object.keys(rarityState).filter(category => 
        rarityState[category] && rarityState[category].length > 0
    );
    
    let allValid = true;
    
    for (const category of categoriesWithTraits) {
        const result = validateCategoryRarity(category);
        if (!result.isValid) {
            allValid = false;
            break;
        }
    }
    
    const summaryElement = document.getElementById('rarityValidationSummary');
    if (!summaryElement) return;
    
    // Only show summary if there are categories with traits
    if (categoriesWithTraits.length === 0) {
        summaryElement.className = 'rarity-validation-summary';
        summaryElement.style.display = 'none';
        return;
    }
    
    summaryElement.style.display = 'block';
    summaryElement.className = `rarity-validation-summary ${allValid ? 'success' : 'warning'}`;
    summaryElement.textContent = allValid ? 
        '✓ All categories configured correctly' : 
        '⚠ Some categories don\'t sum to 100%';
}

function updateRarityTierBadge(traitId, weight) {
    const tierInfo = getRarityTier(weight);
    const badge = document.querySelector(`[data-trait-id="${traitId}"] .rarity-tier`);
    
    if (badge) {
        badge.className = `rarity-tier ${tierInfo.className}`;
        badge.textContent = tierInfo.tier;
    }
}

// ===== WEIGHTED RANDOM SELECTION ALGORITHM =====

function selectTraitByRarity(category) {
    const validation = validateCategoryRarity(category);
    if (!validation.isValid) {
        throw new Error(`Cannot select trait: rarity weights invalid for ${category}`);
    }
    
    const weights = rarityState[category];
    const traits = globalState[category];
    
    if (!weights || !traits || weights.length === 0) {
        throw new Error(`No traits or weights available for category: ${category}`);
    }
    
    // Build cumulative distribution
    const cumulative = [];
    let sum = 0;
    
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i].weight;
        cumulative.push(sum);
    }
    
    // Generate random number and find corresponding trait
    const rand = Math.random() * 100;
    
    for (let i = 0; i < cumulative.length; i++) {
        if (rand < cumulative[i]) {
            // Get traitId from weights array and find matching trait
            const selectedTraitId = weights[i].traitId;
            const selectedTrait = traits.find(trait => trait.id === selectedTraitId);
            
            if (selectedTrait) {
                return selectedTrait;
            }
        }
    }
    
    // Fallback: find trait by last weight entry's traitId
    if (weights.length > 0) {
        const fallbackTraitId = weights[weights.length - 1].traitId;
        const fallbackTrait = traits.find(trait => trait.id === fallbackTraitId);
        if (fallbackTrait) {
            return fallbackTrait;
        }
    }
    
    // Final fallback to last trait (should not happen with valid data)
    return traits[traits.length - 1];
}

// ===== RARITY UI POPULATION =====

function populateRarityControls() {
    const container = document.querySelector('.rarity-controls-container');
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    const categories = Object.keys(globalState);
    
    categories.forEach(category => {
        const traits = globalState[category];
        const weights = rarityState[category];
        
        if (!traits || traits.length === 0) return;
        
        // Create category container
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'rarity-category';
        categoryDiv.setAttribute('data-category', category);
        
        // Create header
        const header = document.createElement('div');
        header.className = 'rarity-category-header';
        
        const title = document.createElement('h4');
        title.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        
        const badge = document.createElement('span');
        badge.className = 'validation-badge valid';
        badge.textContent = '✓ 100%';
        
        header.appendChild(title);
        header.appendChild(badge);
        categoryDiv.appendChild(header);
        
        // Create trait items
        traits.forEach((trait, index) => {
            // Find weight by traitId instead of assuming index alignment
            const weightEntry = weights.find(w => w.traitId === trait.id);
            const weight = weightEntry?.weight || 0;
            
            // If no weight entry found, initialize one with equal weight
            if (!weightEntry && weights.length > 0) {
                const equalWeight = 100 / traits.length;
                const newWeightEntry = {
                    traitId: trait.id,
                    weight: equalWeight
                };
                weights.push(newWeightEntry);
            }
            
            const tierInfo = getRarityTier(weight);
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'rarity-trait-item';
            itemDiv.setAttribute('data-trait-id', trait.id);
            
            // Thumbnail
            const thumbnail = document.createElement('img');
            thumbnail.src = trait.dataURL;
            thumbnail.alt = `${category} trait ${index + 1}`;
            thumbnail.className = 'rarity-trait-thumbnail';
            
            // Label
            const label = document.createElement('span');
            label.className = 'rarity-trait-label';
            label.textContent = `Trait #${index + 1}`;
            
            // Slider container
            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'rarity-slider-container';
            
            // Slider
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'rarity-slider';
            slider.min = '0';
            slider.max = '100';
            slider.step = '0.1';
            slider.value = weight.toFixed(1);
            slider.setAttribute('aria-label', `Rarity weight for ${category} trait ${index + 1}`);
            
            // Percentage display
            const percentage = document.createElement('span');
            percentage.className = 'rarity-percentage';
            percentage.textContent = `${weight.toFixed(1)}%`;
            
            // Tier badge
            const tierBadge = document.createElement('span');
            tierBadge.className = `rarity-tier ${tierInfo.className}`;
            tierBadge.textContent = tierInfo.tier;
            
            // Add slider event listener
            let debounceTimer;
            slider.addEventListener('input', (e) => {
                const newWeight = parseFloat(e.target.value);
                percentage.textContent = `${newWeight.toFixed(1)}%`;
                
                // Update rarity state
                setTraitRarity(trait.id, newWeight);
                updateRarityTierBadge(trait.id, newWeight);
                
                // Debounced validation
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    validateCategoryRarity(category);
                    checkAllCategoriesValid();
                }, 100);
            });
            
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(percentage);
            
            itemDiv.appendChild(thumbnail);
            itemDiv.appendChild(label);
            itemDiv.appendChild(sliderContainer);
            itemDiv.appendChild(tierBadge);
            
            categoryDiv.appendChild(itemDiv);
        });
        
        container.appendChild(categoryDiv);
    });
    
    // Update status message
    const statusElement = document.getElementById('rarityStatus');
    if (statusElement) {
        statusElement.textContent = 'Adjust weights below (must sum to 100% per category)';
    }
    
    // Show reset button
    const resetBtn = document.getElementById('resetRarityBtn');
    if (resetBtn) {
        resetBtn.style.display = 'block';
    }
    
    // Initial validation check
    checkAllCategoriesValid();
}

// ===== RESET FUNCTIONALITY =====

function resetRarityToEqual() {
    const categories = Object.keys(rarityState);
    
    categories.forEach(category => {
        const traits = globalState[category];
        if (!traits || traits.length === 0) return;
        
        const numTraits = traits.length;
        const equalWeight = 100 / numTraits;
        
        // Check if rarityState needs initialization or is out of sync
        if (!rarityState[category] || rarityState[category].length !== numTraits) {
            initializeRarityState(category);
        }
        
        // Update rarity state
        rarityState[category].forEach((item, index) => {
            item.weight = index === numTraits - 1 ? 
                100 - (equalWeight * (numTraits - 1)) : // Adjust last trait for exact 100%
                equalWeight;
        });
        
        // Update UI sliders and displays
        const categoryElement = document.querySelector(`[data-category="${category}"]`);
        if (categoryElement) {
            const sliders = categoryElement.querySelectorAll('.rarity-slider');
            const percentages = categoryElement.querySelectorAll('.rarity-percentage');
            const tierBadges = categoryElement.querySelectorAll('.rarity-tier');
            
            rarityState[category].forEach((item, index) => {
                if (sliders[index]) {
                    sliders[index].value = item.weight.toFixed(1);
                }
                if (percentages[index]) {
                    percentages[index].textContent = `${item.weight.toFixed(1)}%`;
                }
                if (tierBadges[index]) {
                    const tierInfo = getRarityTier(item.weight);
                    tierBadges[index].className = `rarity-tier ${tierInfo.className}`;
                    tierBadges[index].textContent = tierInfo.tier;
                }
            });
        }
        
        // Validate category
        validateCategoryRarity(category);
    });
    
    // Check global validation after all categories are reset
    checkAllCategoriesValid();
}

// ===== PROCEDURAL TRAIT GENERATION ENGINE =====

function generateTraitImage(category, complexity, colorSeed, index) {
    // Check generation mode and route accordingly
    const generationMode = configCache[category].generationMode;
    
    // For AI and Hybrid modes, return a promise wrapper for backward compatibility
    if (generationMode === 'ai' || generationMode === 'hybrid') {
        // Return a promise that resolves to the image data URL
        return generateTraitImageAsync(category, complexity, colorSeed, index);
    }
    
    // Procedural mode (existing synchronous logic)
    return generateProceduralTrait(category, complexity, colorSeed, index);
}

async function generateTraitImageAsync(category, complexity, colorSeed, index) {
    const generationMode = configCache[category].generationMode;
    
    try {
        if (generationMode === 'ai') {
            // Pure AI generation
            return await aiCoordinator.generateSingleAITrait(category, complexity, colorSeed, index);
        } else if (generationMode === 'hybrid') {
            // Hybrid: AI base + procedural overlay
            const aiBaseDataURL = await aiCoordinator.generateSingleAITrait(category, complexity, colorSeed, index);
            return await applyProceduralOverlay(aiBaseDataURL, category, complexity, colorSeed, index);
        }
    } catch (error) {
        console.warn(`Async generation failed for ${category}[${index}], falling back to procedural:`, error);
        return generateProceduralTrait(category, complexity, colorSeed, index);
    }
}

function generateProceduralTrait(category, complexity, colorSeed, index) {
    try {
        // Create off-screen canvas
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        // Parse color seed with category and index for master seed support
        const baseColor = parseColorSeed(colorSeed, category, index);
        const seed = seedManager.useMasterSeed ? 
            seedManager.getCategorySeed(category) + index :
            (baseColor.h + baseColor.s + baseColor.l + index) * 1000;
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Generate category-specific shapes
        switch (category) {
            case 'background':
                generateBackgroundTrait(ctx, complexity, baseColor, seed);
                break;
            case 'body':
                generateBodyTrait(ctx, complexity, baseColor, seed);
                break;
            case 'eyes':
                generateEyesTrait(ctx, complexity, baseColor, seed);
                break;
            case 'mouth':
                generateMouthTrait(ctx, complexity, baseColor, seed);
                break;
            case 'hat':
                generateHatTrait(ctx, complexity, baseColor, seed);
                break;
            default:
                throw new Error(`Unknown category: ${category}`);
        }
        
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error(`Error generating procedural trait for ${category}:`, error);
        return null;
    }
}

async function applyProceduralOverlay(aiBaseDataURL, category, complexity, colorSeed, index) {
    try {
        // Create canvas for compositing
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        // Load AI base image
        const baseImage = new Image();
        await new Promise((resolve, reject) => {
            baseImage.onload = resolve;
            baseImage.onerror = reject;
            baseImage.src = aiBaseDataURL;
        });
        
        // Draw AI base image
        ctx.drawImage(baseImage, 0, 0, 500, 500);
        
        // Create overlay canvas
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = 500;
        overlayCanvas.height = 500;
        const overlayCtx = overlayCanvas.getContext('2d');
        
        // Generate procedural overlay
        const baseColor = parseColorSeed(colorSeed, category, index);
        const seed = seedManager.useMasterSeed ? 
            seedManager.getCategorySeed(category) + index :
            (baseColor.h + baseColor.s + baseColor.l + index) * 1000;
        
        // Generate procedural overlay based on category
        switch (category) {
            case 'background':
                generateBackgroundTrait(overlayCtx, Math.max(1, complexity - 2), baseColor, seed);
                break;
            case 'body':
                generateBodyTrait(overlayCtx, Math.max(1, complexity - 2), baseColor, seed);
                break;
            case 'eyes':
                generateEyesTrait(overlayCtx, Math.max(1, complexity - 2), baseColor, seed);
                break;
            case 'mouth':
                generateMouthTrait(overlayCtx, Math.max(1, complexity - 2), baseColor, seed);
                break;
            case 'hat':
                generateHatTrait(overlayCtx, Math.max(1, complexity - 2), baseColor, seed);
                break;
        }
        
        // Apply overlay with reduced opacity
        const overlayOpacity = configCache[category].aiOptions.hybridOverlayOpacity || 0.4;
        ctx.globalAlpha = overlayOpacity;
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(overlayCanvas, 0, 0);
        
        // Reset composite operation
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        
        return canvas.toDataURL('image/png');
        
    } catch (error) {
        console.error(`Error applying procedural overlay for ${category}:`, error);
        // Return original AI image if overlay fails
        return aiBaseDataURL;
    }
}

function generateBackgroundTrait(ctx, complexity, baseColor, seed) {
    const [r, g, b] = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
    
    if (complexity <= 3) {
        // Simple solid color or basic gradient
        const gradient = ctx.createLinearGradient(0, 0, 500, 500);
        gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(1, `rgb(${Math.max(0, r-50)}, ${Math.max(0, g-50)}, ${Math.max(0, b-50)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 500, 500);
    } else if (complexity <= 7) {
        // Radial gradient with noise
        const gradient = ctx.createRadialGradient(250, 250, 0, 250, 250, 350);
        gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(1, `rgb(${Math.max(0, r-80)}, ${Math.max(0, g-80)}, ${Math.max(0, b-80)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 500, 500);
        
        // Add noise pattern
        for (let i = 0; i < complexity * 20; i++) {
            const x = seededRandom(seed + i) * 500;
            const y = seededRandom(seed + i + 1000) * 500;
            const size = seededRandom(seed + i + 2000) * 10 + 5;
            ctx.fillStyle = `rgba(${r + (seededRandom(seed + i + 3000) - 0.5) * 100}, ${g + (seededRandom(seed + i + 4000) - 0.5) * 100}, ${b + (seededRandom(seed + i + 5000) - 0.5) * 100}, 0.3)`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Complex multi-layer pattern
        const gradient = ctx.createLinearGradient(0, 0, 500, 500);
        for (let i = 0; i <= complexity; i++) {
            const stop = i / complexity;
            const hue = (baseColor.h + i * 30) % 360;
            const [nr, ng, nb] = hslToRgb(hue, baseColor.s, baseColor.l);
            gradient.addColorStop(stop, `rgb(${nr}, ${ng}, ${nb})`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 500, 500);
    }
}

function generateBodyTrait(ctx, complexity, baseColor, seed) {
    const [r, g, b] = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
    const centerX = 250;
    const centerY = 280;
    
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.strokeStyle = `rgb(${Math.max(0, r-30)}, ${Math.max(0, g-30)}, ${Math.max(0, b-30)})`;
    ctx.lineWidth = 3;
    
    if (complexity <= 3) {
        // Simple circle or oval
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 80, 100, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (complexity <= 7) {
        // Rounded rectangle with details
        const width = 120;
        const height = 150;
        const radius = 20;
        
        ctx.beginPath();
        ctx.roundRect(centerX - width/2, centerY - height/2, width, height, radius);
        ctx.fill();
        ctx.stroke();
        
        // Add details based on complexity
        for (let i = 0; i < complexity - 3; i++) {
            const detailY = centerY - 50 + i * 25;
            ctx.beginPath();
            ctx.arc(centerX, detailY, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${Math.min(255, r+50)}, ${Math.min(255, g+50)}, ${Math.min(255, b+50)})`;
            ctx.fill();
        }
    } else {
        // Complex multi-part body
        const parts = Math.min(complexity, 8);
        for (let i = 0; i < parts; i++) {
            const partY = centerY - 60 + i * 15;
            const partSize = 90 - i * 5;
            const hue = (baseColor.h + i * 20) % 360;
            const [pr, pg, pb] = hslToRgb(hue, baseColor.s, Math.max(20, baseColor.l - i * 5));
            
            ctx.fillStyle = `rgb(${pr}, ${pg}, ${pb})`;
            ctx.beginPath();
            ctx.ellipse(centerX, partY, partSize, partSize * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}

function generateEyesTrait(ctx, complexity, baseColor, seed) {
    const [r, g, b] = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
    const leftEyeX = 200;
    const rightEyeX = 300;
    const eyeY = 200;
    
    // Draw both eyes
    [leftEyeX, rightEyeX].forEach((eyeX, index) => {
        if (complexity <= 3) {
            // Simple circles
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (complexity <= 7) {
            // Detailed eyes with pupils
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(eyeX, eyeY, 30, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(eyeX + 3, eyeY - 2, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(eyeX + 5, eyeY - 4, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Complex eyes with multiple layers
            const layers = Math.min(complexity - 4, 4);
            for (let i = layers; i >= 0; i--) {
                const size = 35 - i * 5;
                const hue = (baseColor.h + i * 30) % 360;
                const [er, eg, eb] = hslToRgb(hue, baseColor.s, baseColor.l + i * 10);
                
                ctx.fillStyle = i === layers ? 'white' : `rgb(${er}, ${eg}, ${eb})`;
                ctx.beginPath();
                ctx.arc(eyeX, eyeY, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
}

function generateMouthTrait(ctx, complexity, baseColor, seed) {
    const [r, g, b] = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
    const centerX = 250;
    const mouthY = 320;
    
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = complexity + 2;
    ctx.lineCap = 'round';
    
    if (complexity <= 3) {
        // Simple line or small arc
        ctx.beginPath();
        ctx.arc(centerX, mouthY, 20, 0, Math.PI);
        ctx.stroke();
    } else if (complexity <= 7) {
        // Curved smile with details
        ctx.beginPath();
        ctx.arc(centerX, mouthY - 10, 30, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        
        // Add corners
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(centerX - 25, mouthY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 25, mouthY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Complex mouth with multiple curves
        const curves = Math.min(complexity - 5, 3);
        for (let i = 0; i <= curves; i++) {
            const offset = i * 8;
            const hue = (baseColor.h + i * 40) % 360;
            const [mr, mg, mb] = hslToRgb(hue, baseColor.s, baseColor.l);
            
            ctx.strokeStyle = `rgb(${mr}, ${mg}, ${mb})`;
            ctx.lineWidth = complexity - i;
            ctx.beginPath();
            ctx.arc(centerX, mouthY - offset, 25 + offset, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
        }
    }
}

function generateHatTrait(ctx, complexity, baseColor, seed) {
    const [r, g, b] = hslToRgb(baseColor.h, baseColor.s, baseColor.l);
    const centerX = 250;
    const hatY = 120;
    
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.strokeStyle = `rgb(${Math.max(0, r-40)}, ${Math.max(0, g-40)}, ${Math.max(0, b-40)})`;
    ctx.lineWidth = 2;
    
    if (complexity <= 3) {
        // Simple cap
        ctx.beginPath();
        ctx.arc(centerX, hatY + 20, 60, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
    } else if (complexity <= 7) {
        // Top hat or wizard hat
        const hatType = seededRandom(seed) > 0.5 ? 'top' : 'wizard';
        
        if (hatType === 'top') {
            // Top hat
            ctx.fillRect(centerX - 40, hatY, 80, 60);
            ctx.strokeRect(centerX - 40, hatY, 80, 60);
            
            // Brim
            ctx.fillRect(centerX - 50, hatY + 55, 100, 10);
            ctx.strokeRect(centerX - 50, hatY + 55, 100, 10);
        } else {
            // Wizard hat
            ctx.beginPath();
            ctx.moveTo(centerX, hatY - 20);
            ctx.lineTo(centerX - 30, hatY + 40);
            ctx.lineTo(centerX + 30, hatY + 40);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    } else {
        // Complex decorative hat
        const decorations = Math.min(complexity - 5, 4);
        
        // Base hat (crown-like)
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 50 + (i % 2) * 15;
            const x = centerX + Math.cos(angle) * radius;
            const y = hatY + 30 + Math.sin(angle) * radius * 0.3;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Add decorations
        for (let i = 0; i < decorations; i++) {
            const angle = (i / decorations) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * 35;
            const y = hatY + 20 + Math.sin(angle) * 10;
            const hue = (baseColor.h + i * 60) % 360;
            const [dr, dg, db] = hslToRgb(hue, baseColor.s, Math.min(90, baseColor.l + 20));
            
            ctx.fillStyle = `rgb(${dr}, ${dg}, ${db})`;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ===== TRAIT GENERATION AND MANAGEMENT =====

async function generateAllTraits() {
    const categories = Object.keys(configCache).filter(key => key !== 'globalStyle');
    let totalTraits = 0;
    let generatedTraits = 0;
    
    // Calculate total for progress tracking
    categories.forEach(category => {
        totalTraits += configCache[category].numTraits;
    });
    
    // Clear existing traits and rarity state
    categories.forEach(category => {
        globalState[category] = [];
        rarityState[category] = [];
    });
    
    // Clear AI generation cache
    aiCoordinator.clearCache();
    
    // Generate traits for each category (mixed mode support)
    for (const category of categories) {
        const config = configCache[category];
        
        if (config.generationMode === 'procedural') {
            // Synchronous procedural generation
            await generateProceduralTraits(category, config);
        } else {
            // Async AI/Hybrid generation
            await generateAITraits(category, config);
        }
    }
    
    // Populate rarity controls after all traits are generated
    populateRarityControls();
    
    // Scroll to rarity section
    setTimeout(() => {
        document.getElementById('rarityConfig').scrollIntoView({behavior: 'smooth'});
    }, 500);
    
    console.log(`Generated ${generatedTraits} traits across ${categories.length} categories`);
}

async function generateProceduralTraits(category, config) {
    const traits = [];
    
    for (let i = 0; i < config.numTraits; i++) {
        const dataURL = generateProceduralTrait(category, config.complexity, config.colorSeed, i);
        
        if (dataURL) {
            const trait = {
                id: generateUniqueId(),
                category: category,
                dataURL: dataURL,
                complexity: config.complexity,
                colorSeed: config.colorSeed,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    index: i,
                    layerOrder: getLayerOrder(category),
                    generationMode: 'procedural'
                }
            };
            
            traits.push(trait);
        }
    }
    
    globalState[category] = traits;
    displayTraits(category, traits);
    initializeRarityState(category);
}

async function generateAITraits(category, config) {
    // Update UI to show AI generation in progress
    updateGenerationProgress(category, 0, config.numTraits, 'starting');
    
    try {
        const results = await aiCoordinator.generateAITraitBatch(category, config.numTraits, config);
        const traits = [];
        
        for (let i = 0; i < results.length; i++) {
            const dataURL = results[i];
            
            if (dataURL) {
                const trait = {
                    id: generateUniqueId(),
                    category: category,
                    dataURL: dataURL,
                    complexity: config.complexity,
                    colorSeed: config.colorSeed,
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        index: i,
                        layerOrder: getLayerOrder(category),
                        generationMode: config.generationMode,
                        aiProvider: apiManager.getActiveProviderName()
                    }
                };
                
                traits.push(trait);
            }
        }
        
        globalState[category] = traits;
        displayTraits(category, traits);
        initializeRarityState(category);
        
        updateGenerationProgress(category, config.numTraits, config.numTraits, 'completed');
        
    } catch (error) {
        console.error(`AI generation failed for ${category}:`, error);
        
        // Fallback to procedural generation
        console.log(`Falling back to procedural generation for ${category}`);
        configCache[category].generationMode = 'procedural';
        await generateProceduralTraits(category, config);
        
        // Show user notification
        window.dispatchEvent(new CustomEvent('aiGenerationFallback', {
            detail: { category, error: error.message }
        }));
    }
}

function updateGenerationProgress(category, current, total, status) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    
    // Update button text
    if (domRefs.generateBtn) {
        switch (status) {
            case 'starting':
                domRefs.generateBtn.textContent = `Generating... (${category}: Starting)`;
                break;
            case 'progress':
                domRefs.generateBtn.textContent = `Generating... (${category}: ${current}/${total})`;
                break;
            case 'completed':
                domRefs.generateBtn.textContent = `Generating... (${category}: Complete)`;
                break;
        }
    }
    
    // Update progress bar if available
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }
}

function displayTraits(category, traitsArray) {
    const container = domRefs.previewContainers[category];
    if (!container) {
        console.error(`Preview container not found for category: ${category}`);
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create and append image elements
    traitsArray.forEach((trait, index) => {
        const img = document.createElement('img');
        img.src = trait.dataURL;
        img.alt = `${category} trait ${index + 1}`;
        img.setAttribute('data-trait-id', trait.id);
        img.title = `Complexity: ${trait.complexity}, Seed: ${trait.colorSeed || 'random'}`;
        
        container.appendChild(img);
    });
}

// ===== GENERATE BUTTON EVENT HANDLER =====

function initializeGenerateButton() {
    if (!domRefs.generateBtn) {
        console.error('Generate button not found');
        return;
    }
    
    domRefs.generateBtn.addEventListener('click', async function() {
        // Check if traits already exist and show confirmation
        const hasExistingTraits = Object.values(globalState).some(category => category.length > 0);
        
        if (hasExistingTraits) {
            const confirmed = confirm('Regenerating will reset all rarity configurations. Continue?');
            if (!confirmed) return;
        }
        
        // Check if AI generation is enabled and API providers are available
        const hasAICategories = Object.keys(configCache)
            .filter(key => key !== 'globalStyle')
            .some(category => configCache[category].generationMode !== 'procedural');
        
        if (hasAICategories && configCache.globalStyle.useAIGeneration) {
            const availableProviders = apiManager.getProviderStatus().filter(p => p.isHealthy);
            if (availableProviders.length === 0) {
                const fallbackConfirmed = confirm(
                    'No healthy AI providers available. All categories will use procedural generation. Continue?'
                );
                if (!fallbackConfirmed) return;
                
                // Temporarily set all categories to procedural
                Object.keys(configCache).forEach(category => {
                    if (category !== 'globalStyle') {
                        configCache[category].generationMode = 'procedural';
                    }
                });
            }
        }
        
        // Disable button and show loading state
        domRefs.generateBtn.disabled = true;
        domRefs.generateBtn.textContent = 'Generating Traits...';
        
        try {
            // Call async generateAllTraits
            await generateAllTraits();
            
            // Re-enable button and update text
            domRefs.generateBtn.disabled = false;
            domRefs.generateBtn.textContent = 'Regenerate Traits';
            
        } catch (error) {
            console.error('Error generating traits:', error);
            alert('An error occurred while generating traits. Please try again.');
            
            // Re-enable button on error
            domRefs.generateBtn.disabled = false;
            domRefs.generateBtn.textContent = 'Generate Traits';
        }
    });
    
    // Initialize reset rarity button
    const resetRarityBtn = document.getElementById('resetRarityBtn');
    if (resetRarityBtn) {
        resetRarityBtn.addEventListener('click', function() {
            const confirmed = confirm('Reset all rarity weights to equal distribution?');
            if (confirmed) {
                resetRarityToEqual();
            }
        });
    }
}

// ===== PUBLIC API FOR DOWNSTREAM PHASES =====

function getTraitsByCategory(category) {
    return globalState[category] || [];
}

function getAllTraits() {
    return { ...globalState };
}

// Export functions for potential module usage
window.NFTGenerator = {
    getTraitsByCategory,
    getAllTraits,
    getLayerOrder,
    generateAllTraits,
    selectTraitByRarity,
    getRarityWeights,
    getTraitRarity,
    setTraitRarity,
    validateCategoryRarity,
    resetRarityToEqual,
    initializeRarityState,
    compositeNFT,
    generateNFTCollection,
    downloadCollectionAsZip
};

// ===== CANVAS COMPOSITING SYSTEM =====

function compositeNFT(traitSelections) {
    return new Promise((resolve, reject) => {
        try {
            // Create temporary canvas for compositing
            const canvas = document.createElement('canvas');
            canvas.width = 500;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas with transparent background
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Sort traits by layer order (Background=0 → Hat=4)
            const sortedTraits = Object.entries(traitSelections)
                .filter(([category, trait]) => trait && trait.dataURL)
                .sort(([categoryA], [categoryB]) => {
                    return getLayerOrder(categoryA) - getLayerOrder(categoryB);
                });
            
            let loadedCount = 0;
            const totalTraits = sortedTraits.length;
            
            if (totalTraits === 0) {
                resolve(canvas.toDataURL('image/png'));
                return;
            }
            
            // Load and composite each trait
            sortedTraits.forEach(([category, trait], index) => {
                const img = new Image();
                
                img.onload = () => {
                    try {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        loadedCount++;
                        
                        if (loadedCount === totalTraits) {
                            resolve(canvas.toDataURL('image/png'));
                        }
                    } catch (error) {
                        console.warn(`Failed to draw ${category} trait:`, error);
                        loadedCount++;
                        
                        if (loadedCount === totalTraits) {
                            resolve(canvas.toDataURL('image/png'));
                        }
                    }
                };
                
                img.onerror = () => {
                    console.warn(`Failed to load ${category} trait image`);
                    loadedCount++;
                    
                    if (loadedCount === totalTraits) {
                        resolve(canvas.toDataURL('image/png'));
                    }
                };
                
                img.src = trait.dataURL;
            });
            
        } catch (error) {
            console.error('Error in compositeNFT:', error);
            reject(error);
        }
    });
}

// ===== BATCH NFT GENERATION ENGINE =====

async function generateNFTCollection(collectionSize, collectionName) {
    try {
        // Validation
        if (collectionSize < 1 || collectionSize > 10000) {
            return { success: false, error: 'Collection size must be between 1 and 10000' };
        }
        
        // Check if traits exist
        const categories = Object.keys(globalState);
        for (const category of categories) {
            if (!globalState[category] || globalState[category].length === 0) {
                return { success: false, error: `No traits available for category: ${category}` };
            }
        }
        
        // Validate rarity state
        const categoriesWithTraits = categories.filter(category => 
            rarityState[category] && rarityState[category].length > 0
        );
        
        for (const category of categoriesWithTraits) {
            const validation = validateCategoryRarity(category);
            if (!validation.isValid) {
                return { success: false, error: `Invalid rarity weights for category: ${category}` };
            }
        }
        
        // Initialize generation
        const nftCollection = [];
        const usedCombinations = new Set();
        let duplicateCount = 0;
        
        // Get preview canvas for real-time updates
        const previewCanvas = document.getElementById('previewCanvas');
        const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
        
        // Generation loop
        for (let i = 0; i < collectionSize; i++) {
            let attempts = 0;
            let traitSelections = {};
            let combinationHash = '';
            
            // Select traits with duplicate checking
            do {
                traitSelections = {};
                
                // Select one trait from each category using rarity weights
                for (const category of categories) {
                    try {
                        const selectedTrait = selectTraitByRarity(category);
                        traitSelections[category] = selectedTrait;
                    } catch (error) {
                        console.error(`Failed to select trait for ${category}:`, error);
                        return { success: false, error: `Failed to select trait for ${category}` };
                    }
                }
                
                // Create combination hash
                const traitIds = categories
                    .map(category => `${category}_${traitSelections[category]?.id || 'none'}`)
                    .sort()
                    .join('|');
                combinationHash = traitIds;
                
                attempts++;
                
                if (attempts >= 1000) {
                    console.warn(`Max attempts reached for NFT #${i + 1}, allowing duplicate`);
                    duplicateCount++;
                    break;
                }
                
            } while (usedCombinations.has(combinationHash));
            
            usedCombinations.add(combinationHash);
            
            // Composite the NFT
            let imageDataURL;
            try {
                imageDataURL = await compositeNFT(traitSelections);
            } catch (error) {
                console.error(`Failed to composite NFT #${i + 1}:`, error);
                return { success: false, error: `Failed to composite NFT #${i + 1}` };
            }
            
            // Update preview canvas
            if (previewCtx && imageDataURL) {
                const previewImg = new Image();
                previewImg.onload = () => {
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.drawImage(previewImg, 0, 0, previewCanvas.width, previewCanvas.height);
                };
                previewImg.src = imageDataURL;
            }
            
            // Build metadata
            const attributes = categories.map(category => {
                const trait = traitSelections[category];
                const rarity = getTraitRarity(trait?.id || '', category);
                return {
                    trait_type: category.charAt(0).toUpperCase() + category.slice(1),
                    value: trait?.id || 'none',
                    rarity: rarity
                };
            });
            
            const rarityScore = attributes.reduce((sum, attr) => sum + (attr.rarity || 0), 0);
            
            const metadata = {
                name: `${collectionName || 'NFT Collection'} #${i + 1}`,
                tokenId: i + 1,
                image: `images/${i + 1}.png`,
                attributes: attributes,
                rarityScore: rarityScore
            };
            
            // Store NFT
            nftCollection.push({
                id: i + 1,
                imageDataURL: imageDataURL,
                metadata: metadata
            });
            
            // Update progress
            const progress = ((i + 1) / collectionSize) * 100;
            updateProgress(progress);
            
            // Yield to browser every 10 iterations to prevent UI blocking
            if ((i + 1) % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return {
            success: true,
            collection: nftCollection,
            duplicateCount: duplicateCount
        };
        
    } catch (error) {
        console.error('Error in generateNFTCollection:', error);
        return { success: false, error: error.message };
    }
}

function updateProgress(percentage) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }
}

// ===== COLLECTION GENERATION UI CONTROLLER =====

let generatedCollection = null;
let generatedDuplicateCount = 0;

function initializeCollectionGeneration() {
    const generateBtn = document.getElementById('generateBtn');
    const collectionSizeInput = document.getElementById('collectionSize');
    const collectionNameInput = document.getElementById('collectionName');
    const progressContainer = document.querySelector('.progress-container');
    const collectionGrid = document.querySelector('.collection-grid');
    const outputArea = document.getElementById('outputArea');
    
    if (!generateBtn) {
        console.error('Generate collection button not found');
        return;
    }
    
    generateBtn.addEventListener('click', async function() {
        try {
            // Pre-checks
            const hasTraits = Object.values(globalState).some(category => category.length > 0);
            if (!hasTraits) {
                alert('Generate traits first before creating collection');
                return;
            }
            
            // Validate rarity configuration
            const categoriesWithTraits = Object.keys(rarityState).filter(category => 
                rarityState[category] && rarityState[category].length > 0
            );
            
            let hasInvalidRarity = false;
            for (const category of categoriesWithTraits) {
                const validation = validateCategoryRarity(category);
                if (!validation.isValid) {
                    hasInvalidRarity = true;
                    break;
                }
            }
            
            if (hasInvalidRarity) {
                alert('Please fix rarity configuration - all categories must sum to 100%');
                return;
            }
            
            // Get input values
            const collectionSize = parseInt(collectionSizeInput?.value || '100');
            const collectionName = collectionNameInput?.value?.trim() || 'NFT Collection';
            
            // Clamp collection size
            const clampedSize = Math.max(1, Math.min(10000, collectionSize));
            if (clampedSize !== collectionSize) {
                console.warn(`Collection size clamped to ${clampedSize}`);
            }
            
            // UI state changes
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating Collection...';
            
            // Reset duplicate count for new generation
            generatedDuplicateCount = 0;
            
            if (progressContainer) {
                progressContainer.classList.add('active');
            }
            
            updateProgress(0);
            
            // Execute generation
            const result = await generateNFTCollection(clampedSize, collectionName);
            
            if (!result.success) {
                alert(`Generation failed: ${result.error}`);
                return;
            }
            
            // Store generated collection
            generatedCollection = result.collection;
            generatedDuplicateCount = result.duplicateCount || 0;
            
            // Display results
            if (collectionGrid) {
                collectionGrid.innerHTML = '';
                
                result.collection.forEach(nft => {
                    const img = document.createElement('img');
                    img.src = nft.imageDataURL;
                    img.alt = nft.metadata.name;
                    img.setAttribute('data-nft-id', nft.id);
                    img.title = `${nft.metadata.name} - Rarity Score: ${nft.metadata.rarityScore.toFixed(2)}`;
                    
                    collectionGrid.appendChild(img);
                });
            }
            
            // Show output area
            if (outputArea) {
                outputArea.classList.add('visible');
                setTimeout(() => {
                    outputArea.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
            
            // Show success message
            if (result.duplicateCount > 0) {
                console.warn(`Generated collection with ${result.duplicateCount} duplicates`);
            }
            
        } catch (error) {
            console.error('Error generating collection:', error);
            alert('An error occurred while generating the collection. Please try again.');
            
        } finally {
            // Finalize UI state
            generateBtn.disabled = false;
            generateBtn.textContent = 'Regenerate Collection';
            
            if (progressContainer) {
                progressContainer.classList.remove('active');
            }
        }
    });
}

// ===== ZIP DOWNLOAD FUNCTIONALITY =====

async function downloadCollectionAsZip() {
    try {
        // Validation
        if (!generatedCollection || generatedCollection.length === 0) {
            alert('No collection to download. Generate a collection first.');
            return;
        }
        
        if (typeof JSZip === 'undefined') {
            alert('Download functionality not available. Please refresh the page and try again.');
            return;
        }
        
        // Initialize JSZip
        const zip = new JSZip();
        const imagesFolder = zip.folder('images');
        const metadataFolder = zip.folder('metadata');
        
        // Add each NFT to the ZIP
        for (const nft of generatedCollection) {
            try {
                // Add image (convert data URL to base64)
                const base64Data = nft.imageDataURL.split(',')[1];
                imagesFolder.file(`${nft.id}.png`, base64Data, { base64: true });
                
                // Add metadata JSON
                metadataFolder.file(`${nft.id}.json`, JSON.stringify(nft.metadata, null, 2));
                
            } catch (error) {
                console.error(`Failed to add NFT #${nft.id} to ZIP:`, error);
            }
        }
        
        // Add collection manifest
        const collectionManifest = {
            name: generatedCollection[0]?.metadata?.name?.split(' #')[0] || 'NFT Collection',
            size: generatedCollection.length,
            generatedAt: new Date().toISOString(),
            duplicates: generatedDuplicateCount || 0,
            totalRarityScore: generatedCollection.reduce((sum, nft) => sum + nft.metadata.rarityScore, 0)
        };
        
        zip.file('collection.json', JSON.stringify(collectionManifest, null, 2));
        
        // Generate and download ZIP
        const blob = await zip.generateAsync({ type: 'blob' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collectionManifest.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
        
    } catch (error) {
        console.error('Error creating ZIP download:', error);
        alert('Failed to create download. Please try again.');
        return false;
    }
}

function initializeDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (!downloadBtn) {
        console.error('Download button not found');
        return;
    }
    
    downloadBtn.addEventListener('click', async function() {
        const originalText = downloadBtn.textContent;
        
        try {
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Preparing Download...';
            
            const success = await downloadCollectionAsZip();
            
            if (success) {
                // Optional: Show temporary success message
                downloadBtn.textContent = 'Downloaded!';
                setTimeout(() => {
                    downloadBtn.textContent = originalText;
                }, 2000);
            }
            
        } catch (error) {
            console.error('Download error:', error);
            
        } finally {
            downloadBtn.disabled = false;
            if (downloadBtn.textContent === 'Preparing Download...') {
                downloadBtn.textContent = originalText;
            }
        }
    });
}

// ===== API PROVIDER INITIALIZATION =====

async function initializeAPIProviders() {
    try {
        // Load stored API keys from apiKeyStorage
        const storedProviders = await apiKeyStorage.getAllProviders();
        
        for (const providerInfo of storedProviders) {
            const apiKey = await apiKeyStorage.getAPIKey(providerInfo.name);
            
            if (apiKey) {
                let provider;
                
                // Instantiate provider objects for each stored key
                switch (providerInfo.name) {
                    case 'gemini':
                        provider = new GeminiProvider(apiKey);
                        break;
                    case 'openai':
                        provider = new OpenAIProvider(apiKey);
                        break;
                    case 'stable_diffusion':
                        provider = new StableDiffusionProvider(apiKey);
                        break;
                    default:
                        console.warn(`Unknown provider: ${providerInfo.name}`);
                        continue;
                }
                
                // Register providers with apiManager
                apiManager.registerProvider(provider);
                console.log(`Initialized provider: ${providerInfo.name}`);
            }
        }
        
        // Set default active provider (first available)
        const availableProviders = apiManager.getProviderStatus();
        if (availableProviders.length > 0) {
            const firstHealthy = availableProviders.find(p => p.isHealthy);
            if (firstHealthy) {
                apiManager.setActiveProvider(firstHealthy.name);
            }
        }
        
        // Validate all providers asynchronously
        setTimeout(async () => {
            try {
                const validationResults = await apiManager.validateAllProviders();
                console.log('Provider validation results:', validationResults);
                
                // Update UI with provider status indicators (placeholder for Phase 4)
                updateProviderStatusUI(validationResults);
            } catch (error) {
                console.warn('Provider validation failed:', error);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize API providers:', error);
    }
}

async function loadAPIConfiguration() {
    try {
        // Check localStorage for saved provider preferences
        const configManager = new APIConfigManager();
        const lastConfig = configManager.getLastAppliedConfiguration();
        
        if (lastConfig) {
            // Load last used provider as active
            if (lastConfig.settings && lastConfig.settings.activeProvider) {
                try {
                    apiManager.setActiveProvider(lastConfig.settings.activeProvider);
                } catch (error) {
                    console.warn('Could not restore active provider:', error);
                }
            }
            
            // Restore failover order from saved config
            if (lastConfig.providers) {
                const sortedProviders = Object.entries(lastConfig.providers)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([name]) => name);
                
                apiManager.setFailoverOrder(sortedProviders);
            }
        }
        
        // Initialize request logging settings
        const settings = configManager.loadSettings();
        if (settings.logVerbosity !== undefined && window.apiLogger) {
            window.apiLogger.setVerbosity(settings.logVerbosity);
        }
        
        console.log('API configuration loaded successfully');
        
    } catch (error) {
        console.error('Failed to load API configuration:', error);
    }
}

function updateProviderStatusUI(validationResults) {
    // Placeholder for UI updates - will be implemented in Phase 4
    console.log('Provider status update:', validationResults);
    
    // Emit event for potential UI listeners
    window.dispatchEvent(new CustomEvent('providerStatusUpdated', {
        detail: validationResults
    }));
}

// ===== GENERATION MODE EVENT LISTENERS =====

function setupGenerationModeListeners() {
    // Listen for AI generation progress events
    window.addEventListener('aiGenerationProgress', (event) => {
        const { category, current, total, percentage, status } = event.detail;
        updateGenerationProgress(category, current, total, status);
    });
    
    // Listen for AI generation completion events
    window.addEventListener('aiGenerationComplete', (event) => {
        const { category, successCount, failureCount } = event.detail;
        console.log(`AI generation complete for ${category}: ${successCount} success, ${failureCount} failures`);
    });
    
    // Listen for AI generation errors
    window.addEventListener('aiGenerationError', (event) => {
        const { category, index, error } = event.detail;
        console.warn(`AI generation error for ${category}[${index}]: ${error}`);
    });
    
    // Listen for AI generation fallbacks
    window.addEventListener('aiGenerationFallback', (event) => {
        const { category, index, error } = event.detail;
        console.log(`AI generation fallback for ${category}${index !== undefined ? `[${index}]` : ''}: ${error}`);
        
        // Show user notification (placeholder for Phase 4)
        if (index === undefined) {
            // Category-level fallback
            console.log(`Entire category ${category} fell back to procedural generation`);
        }
    });
    
    // Listen for generation mode changes
    window.addEventListener('generationModeChanged', (event) => {
        const { category, mode } = event.detail;
        configCache[category].generationMode = mode;
        saveConfiguration();
        console.log(`Generation mode changed for ${category}: ${mode}`);
    });
}

// ===== CONFIGURATION PERSISTENCE =====

function saveConfiguration() {
    try {
        const config = {
            categories: {},
            globalStyle: configCache.globalStyle
        };
        
        Object.keys(configCache).forEach(category => {
            if (category !== 'globalStyle') {
                config.categories[category] = {
                    numTraits: configCache[category].numTraits,
                    complexity: configCache[category].complexity,
                    colorSeed: configCache[category].colorSeed,
                    generationMode: configCache[category].generationMode, // NEW
                    aiOptions: configCache[category].aiOptions // NEW
                };
            }
        });
        
        localStorage.setItem('nft_generator_config', JSON.stringify(config));
        console.log('Configuration saved successfully');
        
    } catch (error) {
        console.error('Failed to save configuration:', error);
    }
}

function loadConfiguration() {
    try {
        const saved = localStorage.getItem('nft_generator_config');
        if (!saved) return;
        
        const config = JSON.parse(saved);
        
        // Load category configurations
        if (config.categories) {
            Object.entries(config.categories).forEach(([category, categoryConfig]) => {
                if (configCache[category]) {
                    Object.assign(configCache[category], categoryConfig);
                }
            });
        }
        
        // Load global style configuration
        if (config.globalStyle) {
            Object.assign(configCache.globalStyle, config.globalStyle);
        }
        
        console.log('Configuration loaded successfully');
        
    } catch (error) {
        console.error('Failed to load configuration:', error);
    }
}

// ===== UTILITY FUNCTIONS FOR GENERATION MODES =====

function setGenerationMode(category, mode) {
    if (!configCache[category]) {
        console.error(`Invalid category: ${category}`);
        return false;
    }
    
    if (!['procedural', 'ai', 'hybrid'].includes(mode)) {
        console.error(`Invalid generation mode: ${mode}`);
        return false;
    }
    
    configCache[category].generationMode = mode;
    
    // Emit generation mode changed event
    window.dispatchEvent(new CustomEvent('generationModeChanged', {
        detail: { category, mode }
    }));
    
    return true;
}

function getGenerationMode(category) {
    return configCache[category]?.generationMode || 'procedural';
}

function setAIOptions(category, options) {
    if (!configCache[category]) {
        console.error(`Invalid category: ${category}`);
        return false;
    }
    
    Object.assign(configCache[category].aiOptions, options);
    saveConfiguration();
    return true;
}

function getAIOptions(category) {
    return configCache[category]?.aiOptions || {};
}

// Export utility functions for external use
window.NFTGenerator = {
    ...window.NFTGenerator,
    setGenerationMode,
    getGenerationMode,
    setAIOptions,
    getAIOptions,
    aiCoordinator
};

// ===== STYLE ENGINE INITIALIZATION =====

function initializeStyleEngine() {
    try {
        // Load saved style configuration if available
        const savedStyleConfig = localStorage.getItem('nft_generator_style_config');
        if (savedStyleConfig) {
            const config = JSON.parse(savedStyleConfig);
            styleEngine.importStyleConfig(config);
        }
        
        // Sync style engine to global configuration
        syncStyleToGlobalConfig();
        
        // Set up event listeners for style changes
        window.addEventListener('stylePresetChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('masterStyleChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('globalNegativePromptChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('categoryNegativePromptChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('paletteChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('masterSeedChanged', (event) => {
            saveStyleConfiguration();
        });
        
        window.addEventListener('masterSeedUsageChanged', (event) => {
            saveStyleConfiguration();
        });
        
        console.log('Style engine initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize style engine:', error);
    }
}

function saveStyleConfiguration() {
    try {
        const config = styleEngine.exportStyleConfig();
        localStorage.setItem('nft_generator_style_config', JSON.stringify(config));
        
        // Sync to global configuration
        syncStyleToGlobalConfig();
    } catch (error) {
        console.error('Failed to save style configuration:', error);
    }
}

// ===== STYLE CONFIGURATION SYNC =====

function syncStyleToGlobalConfig() {
    try {
        // Sync style engine state to configCache.globalStyle
        configCache.globalStyle.masterPrompt = styleEngine.masterStylePrompt;
        configCache.globalStyle.activePreset = styleEngine.activePreset;
        
        // Sync negative prompts
        const negativeConfig = styleEngine.negativePromptManager.exportNegativePromptConfig();
        configCache.globalStyle.globalNegativePrompt = negativeConfig.globalNegativePrompt;
        
        // Sync category negative prompts
        Object.entries(negativeConfig.categoryNegativePrompts).forEach(([category, prompt]) => {
            if (configCache.globalStyle.categoryStyles[category]) {
                configCache.globalStyle.categoryStyles[category].negativePrompt = prompt;
            }
        });
        
        // Sync color palette
        const paletteConfig = styleEngine.colorPaletteManager.exportPaletteConfig();
        configCache.globalStyle.colorPaletteLock = paletteConfig.isLocked;
        configCache.globalStyle.lockedColors = paletteConfig.lockedColors;
        
        // Sync seed configuration
        const seedConfig = seedManager.exportSeedConfig();
        configCache.globalStyle.useMasterSeed = seedConfig.useMasterSeed;
        configCache.globalStyle.masterSeed = seedConfig.masterSeed;
        
        // Emit sync completed event
        window.dispatchEvent(new CustomEvent('styleConfigSynced', {
            detail: { globalStyle: configCache.globalStyle }
        }));
        
    } catch (error) {
        console.error('Failed to sync style configuration:', error);
    }
}

function syncGlobalConfigToStyle() {
    try {
        const globalStyle = configCache.globalStyle;
        
        // Sync master prompt
        if (globalStyle.masterPrompt) {
            styleEngine.setMasterStylePrompt(globalStyle.masterPrompt);
        }
        
        // Sync active preset
        if (globalStyle.activePreset) {
            styleEngine.applyPreset(globalStyle.activePreset);
        }
        
        // Sync negative prompts
        styleEngine.negativePromptManager.setGlobalNegativePrompt(globalStyle.globalNegativePrompt);
        
        Object.entries(globalStyle.categoryStyles).forEach(([category, style]) => {
            if (style.negativePrompt) {
                styleEngine.negativePromptManager.setCategoryNegativePrompt(category, style.negativePrompt);
            }
        });
        
        // Sync color palette
        if (globalStyle.colorPaletteLock && globalStyle.lockedColors.length > 0) {
            styleEngine.colorPaletteManager.lockPalette(globalStyle.lockedColors);
        }
        
        // Sync seed configuration
        if (globalStyle.masterSeed !== null) {
            seedManager.setMasterSeed(globalStyle.masterSeed);
        }
        seedManager.setUseMasterSeed(globalStyle.useMasterSeed);
        
    } catch (error) {
        console.error('Failed to sync global config to style:', error);
    }
}

function getGlobalStyleConfiguration() {
    // Ensure configuration is synced before returning
    syncStyleToGlobalConfig();
    return { ...configCache.globalStyle };
}

function updateGlobalStyleConfiguration(updates) {
    try {
        // Update configCache
        Object.assign(configCache.globalStyle, updates);
        
        // Sync changes back to style engine
        syncGlobalConfigToStyle();
        
        // Save to localStorage
        saveStyleConfiguration();
        
        return true;
    } catch (error) {
        console.error('Failed to update global style configuration:', error);
        return false;
    }
}