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
    },

    // Quality Assurance settings
    qaSettings: {
        previewMode: false,
        previewSamplesPerCategory: 5,
        autoApprove: false,
        consistencyThreshold: 60,
        outlierThreshold: 60,
        enableRealTimeAnalysis: true
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
        
        // Fallback to procedural generation - call generateProceduralTrait directly to prevent recursive AI routing
        try {
            return generateProceduralTrait(category, configCache[category].complexity, configCache[category].colorSeed, index);
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

// ===== SECURITY WARNINGS =====

function initializeSecurityWarnings() {
    // Check HTTPS status and show warning if needed
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        const httpsWarning = document.getElementById('httpsWarning');
        if (httpsWarning) {
            httpsWarning.style.display = 'inline';
        }
    }
    
    // Listen for security context events
    window.addEventListener('security:insecure-context', (event) => {
        const httpsWarning = document.getElementById('httpsWarning');
        if (httpsWarning) {
            httpsWarning.style.display = 'inline';
        }
    });
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async function() {
    initializeDOMReferences();
    initializeSliderListeners();
    
    // Initialize security warnings
    initializeSecurityWarnings();
    
    // Initialize tab navigation
    initializeTabNavigation();
    loadActiveTab();
    
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
    
    // Initialize cost optimization systems
    await initializeCostOptimizationSystems();
    
    // Initialize AI Configuration UI (NEW)
    initializeAIConfigurationUI();
    
    // Initialize Quality Assurance Engine
    window.qualityAssuranceEngine = new QualityAssuranceEngine();
    await window.qualityAssuranceEngine.initialize();

    // Load QA settings from localStorage
    const savedQASettings = localStorage.getItem('qaSettings');
    if (savedQASettings) {
        Object.assign(configCache.qaSettings, JSON.parse(savedQASettings));
    }

    // Initialize QA UI
    initializeQAUI();
    
    // Set up event listeners for generation mode changes
    setupGenerationModeListeners();
    
    // Load saved configuration
    loadConfiguration();
    
    console.log('NFT Generator initialized successfully');
});

// ===== QUALITY ASSURANCE UI FUNCTIONS =====

function initializeQAUI() {
    // QA Config Toggle
    const qaToggle = document.getElementById('qaConfigToggle');
    if (qaToggle) {
        qaToggle.addEventListener('click', () => {
            const content = document.getElementById('qaConfigContent');
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            qaToggle.textContent = isExpanded ? '▼' : '▲';
            qaToggle.setAttribute('aria-expanded', !isExpanded);
        });
    }

    // Preview Mode Toggle
    const previewModeToggle = document.getElementById('qaPreviewMode');
    if (previewModeToggle) {
        previewModeToggle.checked = configCache.qaSettings.previewMode;
        previewModeToggle.addEventListener('change', (e) => {
            configCache.qaSettings.previewMode = e.target.checked;
            localStorage.setItem('qaSettings', JSON.stringify(configCache.qaSettings));
        });
    }

    // Samples Per Category Slider
    const samplesSlider = document.getElementById('qaSamplesPerCategory');
    if (samplesSlider) {
        samplesSlider.value = configCache.qaSettings.previewSamplesPerCategory;
        document.getElementById('qaSamplesValue').textContent = configCache.qaSettings.previewSamplesPerCategory;
        samplesSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('qaSamplesValue').textContent = value;
            configCache.qaSettings.previewSamplesPerCategory = value;
            localStorage.setItem('qaSettings', JSON.stringify(configCache.qaSettings));
        });
    }

    // Consistency Threshold Slider
    const consistencySlider = document.getElementById('qaConsistencyThreshold');
    if (consistencySlider) {
        consistencySlider.value = configCache.qaSettings.consistencyThreshold;
        document.getElementById('qaConsistencyValue').textContent = configCache.qaSettings.consistencyThreshold;
        consistencySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('qaConsistencyValue').textContent = value;
            configCache.qaSettings.consistencyThreshold = value;
            localStorage.setItem('qaSettings', JSON.stringify(configCache.qaSettings));
        });
    }

    // Outlier Threshold Slider
    const outlierSlider = document.getElementById('qaOutlierThreshold');
    if (outlierSlider) {
        outlierSlider.value = configCache.qaSettings.outlierThreshold;
        document.getElementById('qaOutlierValue').textContent = configCache.qaSettings.outlierThreshold;
        outlierSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('qaOutlierValue').textContent = value;
            configCache.qaSettings.outlierThreshold = value;
            localStorage.setItem('qaSettings', JSON.stringify(configCache.qaSettings));
        });
    }

    // Real-time Analysis Toggle
    const realTimeToggle = document.getElementById('qaRealTimeAnalysis');
    if (realTimeToggle) {
        realTimeToggle.checked = configCache.qaSettings.enableRealTimeAnalysis;
        realTimeToggle.addEventListener('change', (e) => {
            configCache.qaSettings.enableRealTimeAnalysis = e.target.checked;
            localStorage.setItem('qaSettings', JSON.stringify(configCache.qaSettings));
        });
    }

    // Process Regeneration Queue
    const processQueueBtn = document.getElementById('qaProcessQueueBtn');
    if (processQueueBtn) {
        processQueueBtn.addEventListener('click', async () => {
            const qaEngine = window.qualityAssuranceEngine;
            showToast('Processing regeneration queue...', 'info');
            const results = await qaEngine.processRegenerationQueue();
            showToast(`Regeneration complete: ${results.success} succeeded, ${results.failed} failed`, 'success');
            updateQueueStatus();
        });
    }

    // Clear Regeneration Queue
    const clearQueueBtn = document.getElementById('qaClearQueueBtn');
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear the regeneration queue?')) {
                const qaEngine = window.qualityAssuranceEngine;
                await qaEngine.clearRegenerationQueue();
                showToast('Regeneration queue cleared', 'success');
                updateQueueStatus();
            }
        });
    }

    // Export Quality Report
    const exportReportBtn = document.getElementById('qaExportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', async () => {
            const qaEngine = window.qualityAssuranceEngine;
            const report = await qaEngine.generateQualityReport();
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quality-report-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Quality report exported', 'success');
        });
    }

    // Listen for QA events
    window.addEventListener('qa:outlierDetected', (event) => {
        const { category, index, scores } = event.detail;
        showToast(`Outlier detected in ${category} (index ${index}): Score ${Math.round(scores.overall)}`, 'warning');
        updateQueueStatus();
    });

    // Initial queue status update
    setTimeout(updateQueueStatus, 1000);
}

// ===== TAB NAVIGATION SYSTEM =====

function initializeTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabNavContainer = document.querySelector('.tab-nav');
    
    // Add click event listeners to tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            switchToTab(e.currentTarget.dataset.tab);
        });
    });
    
    // Add keyboard navigation
    if (tabNavContainer) {
        tabNavContainer.addEventListener('keydown', (e) => {
            const currentTab = document.querySelector('.tab-button[aria-selected="true"]');
            
            // Guard against missing aria-selected tab
            if (!currentTab) {
                return;
            }
            
            const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
            const currentIndex = tabButtons.indexOf(currentTab);
            
            let targetIndex = currentIndex;
            
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    targetIndex = currentIndex > 0 ? currentIndex - 1 : tabButtons.length - 1;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    targetIndex = currentIndex < tabButtons.length - 1 ? currentIndex + 1 : 0;
                    break;
                case 'Home':
                    e.preventDefault();
                    targetIndex = 0;
                    break;
                case 'End':
                    e.preventDefault();
                    targetIndex = tabButtons.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    switchToTab(currentTab.dataset.tab);
                    return;
            }
            
            if (targetIndex !== currentIndex) {
                tabButtons[targetIndex].focus();
                switchToTab(tabButtons[targetIndex].dataset.tab);
            }
        });
    }
}

function switchToTab(tabId) {
    // Remove active state from all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-selected', 'false');
    });
    
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Activate clicked tab
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}-content`);
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeButton.setAttribute('aria-selected', 'true');
        activeContent.style.display = 'block';
        
        // Store active tab in localStorage
        localStorage.setItem('activeTab', tabId);
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('tab:changed', {
            detail: { tabId }
        }));
    }
}

function loadActiveTab() {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && document.querySelector(`[data-tab="${savedTab}"]`)) {
        switchToTab(savedTab);
    } else {
        // Default to first tab (Configuration)
        switchToTab('config');
    }
}

async function updateQueueStatus() {
    if (!window.qualityAssuranceEngine) return;
    
    try {
        const qaEngine = window.qualityAssuranceEngine;
        const queue = await qaEngine.getRegenerationQueue();
        const pending = queue.filter(item => item.status === 'pending').length;
        const processing = queue.filter(item => item.status === 'processing').length;
        const completed = queue.filter(item => item.status === 'completed').length;

        const pendingEl = document.getElementById('qaPendingCount');
        const processingEl = document.getElementById('qaProcessingCount');
        const completedEl = document.getElementById('qaCompletedCount');

        if (pendingEl) pendingEl.textContent = pending;
        if (processingEl) processingEl.textContent = processing;
        if (completedEl) completedEl.textContent = completed;
    } catch (error) {
        console.error('Failed to update queue status:', error);
    }
}

function showPreviewModal(previewResults, callback) {
    const modal = document.getElementById('qaPreviewModal');
    const gridContainer = document.getElementById('previewGridContainer');
    const categoryTabs = document.getElementById('previewCategoryTabs');
    const scoresContainer = document.getElementById('consistencyScores');

    // Clear previous content
    gridContainer.innerHTML = '';
    categoryTabs.innerHTML = '';
    scoresContainer.innerHTML = '';

    // Calculate summary stats
    let totalSamples = 0;
    let totalScore = 0;
    let outlierCount = 0;
    const categories = Object.keys(previewResults);

    // Create category tabs
    categories.forEach((category, index) => {
        const button = document.createElement('button');
        button.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        button.className = index === 0 ? 'active' : '';
        button.setAttribute('role', 'tab');
        button.onclick = () => switchPreviewCategory(category);
        categoryTabs.appendChild(button);
    });

    // Populate grids for each category
    categories.forEach((category, index) => {
        const data = previewResults[category];
        const categoryGrid = document.createElement('div');
        categoryGrid.className = 'preview-category-grid';
        categoryGrid.id = `preview-${category}`;
        categoryGrid.style.display = index === 0 ? 'grid' : 'none';

        data.samples.forEach((sample, sampleIndex) => {
            const item = document.createElement('div');
            item.className = 'preview-grid-item';
            if (data.scores.outliers.includes(sampleIndex)) {
                item.classList.add('outlier');
                outlierCount++;
            }

            const img = document.createElement('img');
            img.src = sample.imageData;
            img.alt = `${category} sample ${sampleIndex}`;

            const badge = document.createElement('div');
            badge.className = 'preview-score-badge';
            badge.textContent = Math.round(data.scores.overall || 0);

            item.appendChild(img);
            item.appendChild(badge);
            categoryGrid.appendChild(item);

            totalSamples++;
            totalScore += data.scores.overall || 0;
        });

        gridContainer.appendChild(categoryGrid);

        // Create score card
        const scoreCard = document.createElement('div');
        scoreCard.className = 'consistency-score-card';
        scoreCard.innerHTML = `
            <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            <div class="score-value">${Math.round(data.scores.overall)}</div>
            <div class="score-breakdown-mini">
                <span>Color: ${Math.round(data.scores.breakdown.color)}</span>
                <span>Edge: ${Math.round(data.scores.breakdown.edge)}</span>
                <span>Brightness: ${Math.round(data.scores.breakdown.brightness)}</span>
            </div>
        `;
        scoresContainer.appendChild(scoreCard);
    });

    // Update summary stats
    const totalSamplesEl = document.getElementById('previewTotalSamples');
    const avgScoreEl = document.getElementById('previewAvgScore');
    const outlierCountEl = document.getElementById('previewOutlierCount');

    if (totalSamplesEl) totalSamplesEl.textContent = totalSamples;
    if (avgScoreEl) avgScoreEl.textContent = Math.round(totalScore / Math.max(1, totalSamples));
    if (outlierCountEl) outlierCountEl.textContent = outlierCount;

    // Show modal
    modal.style.display = 'flex';

    // Event listeners
    const approveBtn = document.getElementById('qaPreviewApproveBtn');
    const rejectBtn = document.getElementById('qaPreviewRejectBtn');
    const closeBtn = document.getElementById('qaPreviewCloseBtn');

    const handleApprove = () => {
        modal.style.display = 'none';
        callback(true);
        cleanup();
    };

    const handleReject = () => {
        modal.style.display = 'none';
        callback(false);
        cleanup();
    };

    const handleClose = () => {
        modal.style.display = 'none';
        callback(false);
        cleanup();
    };

    const cleanup = () => {
        if (approveBtn) approveBtn.removeEventListener('click', handleApprove);
        if (rejectBtn) rejectBtn.removeEventListener('click', handleReject);
        if (closeBtn) closeBtn.removeEventListener('click', handleClose);
    };

    if (approveBtn) approveBtn.addEventListener('click', handleApprove);
    if (rejectBtn) rejectBtn.addEventListener('click', handleReject);
    if (closeBtn) closeBtn.addEventListener('click', handleClose);
}

function switchPreviewCategory(category) {
    // Hide all grids
    document.querySelectorAll('.preview-category-grid').forEach(grid => {
        grid.style.display = 'none';
    });

    // Show selected grid
    const targetGrid = document.getElementById(`preview-${category}`);
    if (targetGrid) {
        targetGrid.style.display = 'grid';
    }

    // Update active tab
    document.querySelectorAll('.preview-category-tabs button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the clicked tab
    const tabs = document.querySelectorAll('.preview-category-tabs button');
    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase() === category) {
            tab.classList.add('active');
        }
    });
}

function showToast(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    if (type === 'success') {
        toast.style.borderColor = '#10b981';
        toast.style.background = '#065f46';
    } else if (type === 'warning') {
        toast.style.borderColor = '#f59e0b';
        toast.style.background = '#92400e';
    } else if (type === 'error') {
        toast.style.borderColor = '#ef4444';
        toast.style.background = '#991b1b';
    }

    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

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

async function generateTraitImage(category, complexity, colorSeed, index) {
    // Check generation mode and route accordingly
    const generationMode = configCache[category].generationMode;
    
    // Enforce global useAIGeneration toggle
    if ((generationMode === 'ai' || generationMode === 'hybrid') && configCache.globalStyle.useAIGeneration) {
        // AI/Hybrid modes when globally enabled
        return await generateTraitImageAsync(category, complexity, colorSeed, index);
    }
    
    // Procedural mode (always return as resolved promise for consistent API)
    return generateProceduralTrait(category, complexity, colorSeed, index);
}

async function generateTraitImageAsync(category, complexity, colorSeed, index) {
    const generationMode = configCache[category].generationMode;
    let imageData;
    
    try {
        if (generationMode === 'ai') {
            // Pure AI generation
            imageData = await aiCoordinator.generateSingleAITrait(category, complexity, colorSeed, index);
        } else if (generationMode === 'hybrid') {
            // Hybrid: AI base + procedural overlay
            const aiBaseDataURL = await aiCoordinator.generateSingleAITrait(category, complexity, colorSeed, index);
            imageData = await applyProceduralOverlay(aiBaseDataURL, category, complexity, colorSeed, index);
        }
    } catch (error) {
        console.warn(`Async generation failed for ${category}[${index}], falling back to procedural:`, error);
        imageData = generateProceduralTrait(category, complexity, colorSeed, index);
    }

    // Real-time QA analysis if enabled
    if (configCache.qaSettings.enableRealTimeAnalysis && generationMode !== 'procedural' && window.qualityAssuranceEngine) {
        const qaEngine = window.qualityAssuranceEngine;
        const cacheKey = window.imageCacheManager ? window.imageCacheManager.generateCacheKey(category, complexity, colorSeed, index) : `${category}_${complexity}_${colorSeed}_${index}`;

        // Analyze image in background (non-blocking)
        qaEngine.analyzeImage(imageData, category, cacheKey).then(qaData => {
            // Store QA metadata
            if (window.imageCacheManager) {
                window.imageCacheManager.storeQAMetadata(cacheKey, qaData);
            }

            // Check if outlier
            if (qaData.outlier) {
                window.dispatchEvent(new CustomEvent('qa:outlierDetected', {
                    detail: { category, index, cacheKey, scores: qaData.scores }
                }));

                // Auto-queue for regeneration if score too low
                if (qaData.scores.overall < configCache.qaSettings.outlierThreshold) {
                    qaEngine.addToRegenerationQueue({
                        cacheKey,
                        category,
                        originalMetadata: { complexity, colorSeed, index },
                        reason: 'outlier'
                    });
                }
            }
        }).catch(error => {
            console.error('QA analysis failed:', error);
        });
    }

    return imageData;
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

// ===== PREVIEW GENERATION FUNCTIONS =====

async function generatePreviewSamples() {
    const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
    const samplesPerCategory = configCache.qaSettings.previewSamplesPerCategory;
    const previewResults = {};

    for (const category of categories) {
        const mode = configCache[category].generationMode;
        if (mode === 'procedural') {
            // Skip QA for procedural (deterministic)
            continue;
        }

        const samples = [];
        const config = configCache[category];

        // Generate random sample indices
        const sampleIndices = Array.from({ length: samplesPerCategory }, (_, i) => Math.floor(Math.random() * config.numTraits));

        for (const index of sampleIndices) {
            const imageData = await generateTraitImageAsync(category, config.complexity, config.colorSeed, index);
            samples.push({
                imageData,
                index,
                category,
                config: { ...config }
            });
        }

        previewResults[category] = samples;
    }

    // Analyze preview samples
    const qaEngine = window.qualityAssuranceEngine;
    const analysisResults = {};

    for (const [category, samples] of Object.entries(previewResults)) {
        const images = samples.map(s => s.imageData);
        const scores = await qaEngine.calculateConsistencyScore(images, category);
        analysisResults[category] = {
            samples,
            scores,
            approved: null // Pending user approval
        };
    }

    // Emit event for UI to display preview modal
    window.dispatchEvent(new CustomEvent('qa:previewReady', {
        detail: { previewResults: analysisResults }
    }));

    return analysisResults;
}

function waitForPreviewApproval(previewResults) {
    return new Promise((resolve) => {
        // Show preview modal (implemented in Step 4)
        showPreviewModal(previewResults, (approved) => {
            resolve(approved);
        });
    });
}

// ===== TRAIT GENERATION AND MANAGEMENT =====

async function generateAllTraits() {
    // Preview mode check
    if (configCache.qaSettings.previewMode && !window.previewApproved) {
        const previewResults = await generatePreviewSamples();
        // Wait for user approval via modal
        const approved = await waitForPreviewApproval(previewResults);
        if (!approved) {
            showToast('Preview generation cancelled', 'info');
            return;
        }
        window.previewApproved = true;
    }

    const categories = Object.keys(configCache).filter(key => key !== 'globalStyle' && key !== 'qaSettings');
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
        
        // Enforce global useAIGeneration toggle - bypass AI modes when disabled
        if (config.generationMode === 'procedural' || !configCache.globalStyle.useAIGeneration) {
            // Synchronous procedural generation
            await generateProceduralTraits(category, config);
        } else {
            // Async AI/Hybrid generation (only when global AI generation is enabled)
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
        console.log('Generate Traits button clicked');
        
        // Check if traits already exist and show confirmation
        const hasExistingTraits = Object.values(globalState).some(category => category.length > 0);
        
        if (hasExistingTraits) {
            const confirmed = confirm('Regenerating will reset all rarity configurations. Continue?');
            if (!confirmed) return;
        }
        
        // Enhanced preflight checks for AI generation
        const hasAICategories = Object.keys(configCache)
            .filter(key => key !== 'globalStyle')
            .some(category => configCache[category].generationMode !== 'procedural');
        
        if (hasAICategories && configCache.globalStyle.useAIGeneration) {
            // Check if any valid provider is configured
            const availableProviders = apiManager.getProviderStatus().filter(p => p.isHealthy);
            const activeProvider = apiManager.getActiveProviderName();
            
            if (availableProviders.length === 0 || !activeProvider) {
                showErrorMessage('No valid AI providers configured. Please configure at least one API provider or disable AI generation.');
                return;
            }
            
            // Check cost estimation and quota if available
            try {
                updateCostEstimation();
                const estimatedCostElement = document.getElementById('estimatedCost');
                if (estimatedCostElement) {
                    const costText = estimatedCostElement.textContent.replace('$', '');
                    const estimatedCost = parseFloat(costText) || 0;
                    
                    // Soft threshold warning for high costs
                    if (estimatedCost > 10) {
                        const costConfirmed = confirm(
                            `Estimated cost: $${estimatedCost.toFixed(2)} exceeds $10. This may consume significant API quota. Continue?`
                        );
                        if (!costConfirmed) return;
                    }
                }
            } catch (error) {
                console.warn('Cost estimation check failed:', error);
            }
            
            // Final fallback check for unhealthy providers
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
            console.log('Starting trait generation...');
            // Call async generateAllTraits with force flag for manual generation
            await generateAllTraits(true);
            console.log('Trait generation completed successfully');
            
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
        
        // Collection-level budget guard (Comment 6)
        if (window.budgetManager && configCache.globalStyle.useAIGeneration) {
            // Estimate total cost for the collection
            const aiCategories = categories.filter(category => 
                configCache[category].generationMode === 'ai' || 
                configCache[category].generationMode === 'hybrid'
            );
            
            if (aiCategories.length > 0) {
                // Get current active provider and estimate cost per image
                const activeProvider = window.apiManager ? window.apiManager.getActiveProvider() : null;
                if (activeProvider) {
                    const providerName = activeProvider.name || 'gemini';
                    const estimatedCostPerImage = 0.05; // Default estimate, could be refined
                    const totalEstimatedCost = collectionSize * aiCategories.length * estimatedCostPerImage;
                    
                    // Check if collection generation would exceed budget
                    const budgetCheck = await window.budgetManager.canMakeRequest(providerName, totalEstimatedCost);
                    if (!budgetCheck.allowed) {
                        return { 
                            success: false, 
                            error: `Collection generation would exceed budget: ${budgetCheck.message}` 
                        };
                    }
                    
                    console.log(`Collection budget check passed: ${totalEstimatedCost.toFixed(2)} estimated cost for ${collectionSize} NFTs`);
                }
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
            
            // Enhanced AI preflight checks for collection generation
            const hasAITraits = Object.values(globalState).some(categoryTraits => 
                categoryTraits.some(trait => 
                    trait.metadata && (trait.metadata.generationMode === 'ai' || trait.metadata.generationMode === 'hybrid')
                )
            );
            
            if (hasAITraits || configCache.globalStyle.useAIGeneration) {
                const availableProviders = apiManager.getProviderStatus().filter(p => p.isHealthy);
                const activeProvider = apiManager.getActiveProviderName();
                
                if (availableProviders.length === 0 || !activeProvider) {
                    showErrorMessage('No valid AI providers available for collection generation with AI traits.');
                    return;
                }
                
                // Check cost estimation for collection generation
                try {
                    updateCostEstimation();
                    const estimatedCostElement = document.getElementById('estimatedCost');
                    if (estimatedCostElement) {
                        const costText = estimatedCostElement.textContent.replace('$', '');
                        const estimatedCost = parseFloat(costText) || 0;
                        
                        if (estimatedCost > 20) {
                            const costConfirmed = confirm(
                                `Collection generation estimated cost: $${estimatedCost.toFixed(2)} is very high. This may exceed API quotas. Continue?`
                            );
                            if (!costConfirmed) return;
                        }
                    }
                } catch (error) {
                    console.warn('Cost estimation check failed for collection generation:', error);
                }
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
        
        // Build array of image data URLs for compression
        const imageDataURLs = generatedCollection.map(nft => nft.imageDataURL);
        
        // Compress images if compression manager is available and enabled
        let processedImages = imageDataURLs;
        if (compressionManager && compressionManager.currentSettings.enableCompression) {
            try {
                console.log('Compressing images for ZIP export...');
                const compressionResults = await compressionManager.prepareForExport(imageDataURLs, {
                    quality: 'high',
                    resolution: 'standard',
                    format: 'webp',
                    enableCompression: true
                });
                
                // Extract compressed images from results
                processedImages = compressionResults.map(result => 
                    result.success ? result.compressed : result.original
                );
                
                const successCount = compressionResults.filter(r => r.success).length;
                console.log(`Compressed ${successCount}/${imageDataURLs.length} images for export`);
            } catch (error) {
                console.warn('Image compression failed, using original images:', error);
                processedImages = imageDataURLs;
            }
        }
        
        // Add each NFT to the ZIP using processed (potentially compressed) images
        for (let i = 0; i < generatedCollection.length; i++) {
            const nft = generatedCollection[i];
            const imageDataURL = processedImages[i];
            
            try {
                // Add image (convert data URL to base64)
                const base64Data = imageDataURL.split(',')[1];
                imagesFolder.file(`${nft.id}.png`, base64Data, { base64: true });
                
                // Add metadata JSON (unchanged)
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
                    case 'stablediffusion':
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
                    // Fall back to default if restoration fails
                    const availableProviders = apiManager.getAvailableProviders();
                    if (availableProviders.length > 0) {
                        apiManager.setActiveProvider(availableProviders[0].getName());
                    }
                }
            }
            
            // Restore failover order from saved config
            if (lastConfig.providers) {
                const sortedProviders = Object.entries(lastConfig.providers)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([name]) => name);
                
                // Add procedural to failover order if missing, but respect user positioning
                if (!sortedProviders.includes('procedural')) {
                    // Add procedural as second priority (after current active provider if it exists)
                    const activeProvider = lastConfig.settings?.activeProvider;
                    if (activeProvider && sortedProviders.includes(activeProvider)) {
                        const activeIndex = sortedProviders.indexOf(activeProvider);
                        sortedProviders.splice(activeIndex + 1, 0, 'procedural');
                    } else {
                        // If no active provider or active not in list, add procedural first
                        sortedProviders.unshift('procedural');
                    }
                }
                
                apiManager.setFailoverOrder(sortedProviders);
            }
        }
        
        // Initialize request logging settings
        const settings = configManager.loadSettings();
        if (settings.logVerbosity !== undefined && window.apiLogger) {
            window.apiLogger.setVerbosity(settings.logVerbosity);
        }
        
        // Ensure a provider is selected (default to procedural if none set)
        if (!apiManager.getActiveProviderName()) {
            const availableProviders = apiManager.getAvailableProviders();
            const proceduralProvider = availableProviders.find(p => p.getName() === 'procedural');
            if (proceduralProvider) {
                apiManager.setActiveProvider('procedural');
                console.log('Set procedural as default active provider');
            }
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

// ===== AI CONFIGURATION UI CONTROLLERS =====

// Global references for UI controllers
let uiControllers = {
    apiProviders: {},
    styleConfig: {},
    generationModes: {},
    costEstimator: {}
};

// ===== API PROVIDER UI INITIALIZATION =====

function initializeAPIProviderUI() {
    console.log('Initializing API Provider UI...');
    
    // Initialize provider cards
    const providers = ['gemini', 'openai', 'stablediffusion', 'procedural'];
    
    providers.forEach(async (providerName) => {
        await initializeProviderCard(providerName);
    });
    
    // Initialize active provider selector
    initializeActiveProviderSelector();
    
    // Initialize export/import buttons
    initializeConfigActions();
    
    // Start quota update interval
    startQuotaUpdateInterval();
    
    console.log('API Provider UI initialized');
}

async function initializeProviderCard(providerName) {
    // Handle procedural provider specially
    if (providerName === 'procedural') {
        const statusIndicator = document.getElementById(`${providerName}Status`);
        if (statusIndicator) {
            statusIndicator.textContent = '✓ Ready';
            statusIndicator.className = 'status-indicator valid';
        }
        
        // Disable/hide API key related controls
        const keyInput = document.getElementById(`${providerName}ApiKey`);
        const validateBtn = document.getElementById(`${providerName}ValidateBtn`);
        const removeBtn = document.getElementById(`${providerName}RemoveBtn`);
        const quotaDisplay = document.getElementById(`${providerName}Quota`);
        
        if (keyInput) keyInput.disabled = true;
        if (validateBtn) validateBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        
        // Show unlimited quota if quota display exists
        if (quotaDisplay) {
            quotaDisplay.style.display = 'block';
            const quotaText = quotaDisplay.querySelector('.quota-text');
            const quotaBar = quotaDisplay.querySelector('.quota-progress-fill');
            if (quotaText) quotaText.textContent = 'Unlimited';
            if (quotaBar) quotaBar.style.width = '100%';
        }
        
        return;
    }
    
    const keyInput = document.getElementById(`${providerName}ApiKey`);
    const validateBtn = document.getElementById(`${providerName}ValidateBtn`);
    const removeBtn = document.getElementById(`${providerName}RemoveBtn`);
    const statusIndicator = document.getElementById(`${providerName}Status`);
    
    if (!keyInput || !validateBtn || !statusIndicator) {
        console.warn(`Provider card elements not found for ${providerName}`);
        return;
    }
    
    // Load stored API key
    try {
        const storedKey = await apiKeyStorage.getAPIKey(providerName);
        if (storedKey) {
            // Mask the key for display
            keyInput.value = `••••••••${storedKey.slice(-4)}`;
            keyInput.dataset.hasKey = 'true';
            statusIndicator.textContent = '✓ Configured';
            statusIndicator.className = 'status-indicator valid';
            removeBtn.style.display = 'block';
            
            // Load and display quota
            await updateProviderQuota(providerName);
        }
    } catch (error) {
        console.warn(`Failed to load stored key for ${providerName}:`, error);
    }
    
    // Attach event listeners
    validateBtn.addEventListener('click', () => validateProviderKey(providerName));
    removeBtn.addEventListener('click', () => removeProviderKey(providerName));
    
    // Clear validation status when key changes
    keyInput.addEventListener('input', () => {
        if (keyInput.dataset.hasKey === 'true') {
            keyInput.dataset.hasKey = 'false';
            keyInput.value = '';
        }
        statusIndicator.textContent = 'Not configured';
        statusIndicator.className = 'status-indicator not-configured';
        removeBtn.style.display = 'none';
        hideQuotaDisplay(providerName);
    });
}

async function validateProviderKey(providerName) {
    const keyInput = document.getElementById(`${providerName}ApiKey`);
    const validateBtn = document.getElementById(`${providerName}ValidateBtn`);
    const statusIndicator = document.getElementById(`${providerName}Status`);
    const removeBtn = document.getElementById(`${providerName}RemoveBtn`);
    
    const apiKey = keyInput.value.trim();
    
    if (!apiKey) {
        showErrorMessage('Please enter an API key');
        return;
    }
    
    // Validate key format
    const formatValidation = validateAPIKeyFormat(providerName, apiKey);
    if (!formatValidation.valid) {
        showErrorMessage(`Invalid ${providerName} API key format: ${formatValidation.error}`);
        statusIndicator.textContent = '✗ Invalid format';
        statusIndicator.className = 'status-indicator invalid';
        return;
    }
    
    // Show loading state
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    statusIndicator.textContent = '⏳ Validating...';
    statusIndicator.className = 'status-indicator validating';
    
    try {
        // Save API key
        await apiKeyStorage.saveAPIKey(providerName, apiKey);
        
        // Get provider instance and validate
        const provider = apiManager.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }
        
        const isValid = await provider.validateKey();
        
        if (isValid) {
            // Success
            statusIndicator.textContent = '✓ Valid';
            statusIndicator.className = 'status-indicator valid';
            
            // Mask the key for display
            keyInput.value = `••••••••${apiKey.slice(-4)}`;
            keyInput.dataset.hasKey = 'true';
            removeBtn.style.display = 'block';
            
            // Update quota display
            await updateProviderQuota(providerName);
            
            showSuccessMessage(`${providerName} API key validated successfully`);
        } else {
            throw new Error('API key validation failed');
        }
        
    } catch (error) {
        console.error(`Validation failed for ${providerName}:`, error);
        statusIndicator.textContent = '✗ Invalid';
        statusIndicator.className = 'status-indicator invalid';
        
        // Remove the invalid key
        await apiKeyStorage.removeAPIKey(providerName);
        
        showErrorMessage(`${providerName} API key validation failed: ${error.message}`);
    } finally {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate';
    }
}

async function removeProviderKey(providerName) {
    const confirmed = confirm(`Remove API key for ${providerName}?`);
    if (!confirmed) return;
    
    try {
        await apiKeyStorage.removeAPIKey(providerName);
        
        // Reset UI
        const keyInput = document.getElementById(`${providerName}ApiKey`);
        const statusIndicator = document.getElementById(`${providerName}Status`);
        const removeBtn = document.getElementById(`${providerName}RemoveBtn`);
        
        keyInput.value = '';
        keyInput.dataset.hasKey = 'false';
        statusIndicator.textContent = 'Not configured';
        statusIndicator.className = 'status-indicator not-configured';
        removeBtn.style.display = 'none';
        
        // Hide quota display
        hideQuotaDisplay(providerName);
        
        // Disable provider in active selector if it was selected
        const activeRadio = document.getElementById(`activeProvider${providerName.charAt(0).toUpperCase() + providerName.slice(1)}`);
        if (activeRadio && activeRadio.checked) {
            activeRadio.checked = false;
        }
        
        showSuccessMessage(`${providerName} API key removed`);
        
    } catch (error) {
        console.error(`Failed to remove key for ${providerName}:`, error);
        showErrorMessage(`Failed to remove ${providerName} API key`);
    }
}

async function updateProviderQuota(providerName) {
    try {
        const provider = apiManager.getProvider(providerName);
        if (!provider) return;
        
        const quota = await provider.getQuota();
        if (quota) {
            displayQuotaInfo(providerName, quota);
        }
    } catch (error) {
        console.warn(`Failed to update quota for ${providerName}:`, error);
    }
}

function displayQuotaInfo(providerName, quota) {
    const quotaDisplay = document.getElementById(`${providerName}Quota`);
    if (!quotaDisplay) return;
    
    const remainingSpan = quotaDisplay.querySelector('.quota-remaining');
    const limitSpan = quotaDisplay.querySelector('.quota-limit');
    const progressFill = quotaDisplay.querySelector('.quota-progress-fill');
    
    if (remainingSpan && limitSpan && progressFill) {
        remainingSpan.textContent = quota.remaining || 0;
        limitSpan.textContent = quota.limit || 0;
        
        const percentage = quota.limit > 0 ? (quota.remaining / quota.limit) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
        
        // Show warning if quota is low
        if (percentage < 10) {
            quotaDisplay.classList.add('quota-warning');
        } else {
            quotaDisplay.classList.remove('quota-warning');
        }
        
        quotaDisplay.style.display = 'block';
    }
}

function hideQuotaDisplay(providerName) {
    const quotaDisplay = document.getElementById(`${providerName}Quota`);
    if (quotaDisplay) {
        quotaDisplay.style.display = 'none';
    }
}

function initializeActiveProviderSelector() {
    const radioButtons = document.querySelectorAll('input[name="activeProvider"]');
    
    // Load current active provider
    const activeProvider = apiManager.getActiveProviderName();
    if (activeProvider) {
        const activeRadio = document.getElementById(`activeProvider${activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1)}`);
        if (activeRadio) {
            activeRadio.checked = true;
        }
    }
    
    // Attach event listeners
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const providerName = e.target.value;
                apiManager.setActiveProvider(providerName);
                updateCostEstimation();
                showSuccessMessage(`Active provider set to ${providerName}`);
            }
        });
    });
}

function initializeConfigActions() {
    const exportBtn = document.getElementById('exportConfigBtn');
    const importBtn = document.getElementById('importConfigBtn');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            try {
                apiConfigManager.downloadConfiguration();
                showSuccessMessage('Configuration exported successfully');
            } catch (error) {
                console.error('Export failed:', error);
                showErrorMessage('Failed to export configuration');
            }
        });
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            try {
                apiConfigManager.createImportFileInput();
            } catch (error) {
                console.error('Import failed:', error);
                showErrorMessage('Failed to import configuration');
            }
        });
    }
}

function startQuotaUpdateInterval() {
    // Update quotas every 5 minutes
    setInterval(async () => {
        const providers = ['gemini', 'openai', 'stablediffusion', 'procedural'];
        for (const providerName of providers) {
            // Skip quota updates for procedural provider (unlimited quota)
            if (providerName === 'procedural') continue;
            
            const keyInput = document.getElementById(`${providerName}ApiKey`);
            if (keyInput && keyInput.dataset.hasKey === 'true') {
                await updateProviderQuota(providerName);
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// ===== STYLE CONFIGURATION UI =====

function initializeStyleConfigUI() {
    console.log('Initializing Style Configuration UI...');
    
    // Initialize preset dropdown
    initializeStylePresetDropdown();
    
    // Initialize master style prompt
    initializeMasterStylePrompt();
    
    // Initialize inheritance level
    initializeInheritanceLevel();
    
    // Initialize negative prompts
    initializeNegativePrompts();
    
    // Initialize color palette
    initializeColorPalette();
    
    // Initialize preview button
    initializeStylePreview();
    
    // Load current configuration
    loadStyleConfigurationUI();
    
    console.log('Style Configuration UI initialized');
}

function initializeStylePresetDropdown() {
    const dropdown = document.getElementById('stylePresetDropdown');
    if (!dropdown) return;
    
    // Load current preset
    const activePreset = styleEngine.getActivePreset();
    if (activePreset) {
        dropdown.value = styleEngine.activePreset;
    }
    
    dropdown.addEventListener('change', (e) => {
        const presetName = e.target.value;
        if (presetName) {
            applyStylePreset(presetName);
        } else {
            // Custom preset selected
            styleEngine.activePreset = null;
            syncStyleConfigToCache();
        }
    });
}

function initializeMasterStylePrompt() {
    const textarea = document.getElementById('masterStylePrompt');
    const charCounter = document.getElementById('promptCharCount');
    
    if (!textarea) return;
    
    // Load current prompt
    textarea.value = configCache.globalStyle.masterPrompt || '';
    updateCharCounter(textarea, charCounter);
    
    textarea.addEventListener('input', (e) => {
        updateCharCounter(textarea, charCounter);
        updateMasterStylePrompt();
    });
}

function initializeInheritanceLevel() {
    const radioButtons = document.querySelectorAll('input[name="inheritanceLevel"]');
    
    // Load current level
    const currentLevel = configCache.globalStyle.consistencyLevel || 'moderate';
    const currentRadio = document.querySelector(`input[name="inheritanceLevel"][value="${currentLevel}"]`);
    if (currentRadio) {
        currentRadio.checked = true;
    }
    
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                updateInheritanceLevel();
            }
        });
    });
}

function initializeNegativePrompts() {
    const textarea = document.getElementById('globalNegativePrompts');
    if (!textarea) return;
    
    // Load current prompts
    textarea.value = configCache.globalStyle.globalNegativePrompt || '';
    
    textarea.addEventListener('input', () => {
        updateNegativePrompts();
    });
}

function initializeColorPalette() {
    const lockCheckbox = document.getElementById('colorPaletteLock');
    const colorPickers = document.querySelectorAll('.color-picker-item');
    
    if (!lockCheckbox) return;
    
    // Load current palette lock state
    lockCheckbox.checked = configCache.globalStyle.colorPaletteLock || false;
    
    // Load current colors
    const lockedColors = configCache.globalStyle.lockedColors || [];
    colorPickers.forEach((picker, index) => {
        if (lockedColors[index]) {
            picker.value = lockedColors[index];
        }
        picker.disabled = !lockCheckbox.checked;
    });
    
    // Attach event listeners
    lockCheckbox.addEventListener('change', () => {
        toggleColorPaletteLock();
    });
    
    colorPickers.forEach((picker, index) => {
        picker.addEventListener('change', (e) => {
            updateColorPalette(index, e.target.value);
        });
    });
}

function initializeStylePreview() {
    const previewBtn = document.getElementById('previewStyleBtn');
    if (!previewBtn) return;
    
    previewBtn.addEventListener('click', () => {
        previewStylePrompt('background');
    });
}

function loadStyleConfigurationUI() {
    // This function loads the current style configuration into the UI
    // Most of the loading is already done in individual init functions
    console.log('Style configuration UI loaded');
}

function applyStylePreset(presetName) {
    try {
        const success = styleEngine.applyPreset(presetName);
        if (success) {
            const preset = styleEngine.getActivePreset();
            
            // Update UI fields
            const masterPrompt = document.getElementById('masterStylePrompt');
            if (masterPrompt && preset) {
                masterPrompt.value = preset.masterStyle || '';
                updateCharCounter(masterPrompt, document.getElementById('promptCharCount'));
            }
            
            // Update color palette
            const colorPickers = document.querySelectorAll('.color-picker-item');
            if (preset && preset.colorPalette) {
                colorPickers.forEach((picker, index) => {
                    if (preset.colorPalette[index]) {
                        picker.value = preset.colorPalette[index];
                    }
                });
            }
            
            // Sync to cache and save
            syncStyleConfigToCache();
            saveStyleConfiguration();
            
            showSuccessMessage(`Preset applied: ${presetName}`);
        } else {
            showErrorMessage(`Failed to apply preset: ${presetName}`);
        }
    } catch (error) {
        console.error('Error applying preset:', error);
        showErrorMessage(`Error applying preset: ${error.message}`);
    }
}

function updateMasterStylePrompt() {
    const textarea = document.getElementById('masterStylePrompt');
    if (!textarea) return;
    
    const prompt = textarea.value.trim();
    
    // Validate
    if (prompt.length > 500) {
        showErrorMessage('Master style prompt must be 500 characters or less');
        return;
    }
    
    // Update style engine
    styleEngine.setMasterStylePrompt(prompt);
    
    // Sync to cache
    configCache.globalStyle.masterPrompt = prompt;
    
    // Save to localStorage
    saveStyleConfiguration();
}

function updateInheritanceLevel() {
    const selectedRadio = document.querySelector('input[name="inheritanceLevel"]:checked');
    if (!selectedRadio) return;
    
    const level = selectedRadio.value;
    
    // Update cache
    configCache.globalStyle.consistencyLevel = level;
    
    // Save to localStorage
    saveStyleConfiguration();
}

function updateNegativePrompts() {
    const textarea = document.getElementById('globalNegativePrompts');
    if (!textarea) return;
    
    const prompts = textarea.value.trim();
    
    // Update style engine
    styleEngine.setGlobalNegativePrompt(prompts);
    
    // Sync to cache
    configCache.globalStyle.globalNegativePrompt = prompts;
    
    // Save to localStorage
    saveStyleConfiguration();
}

function toggleColorPaletteLock() {
    const lockCheckbox = document.getElementById('colorPaletteLock');
    const colorPickers = document.querySelectorAll('.color-picker-item');
    
    if (!lockCheckbox) return;
    
    const isLocked = lockCheckbox.checked;
    
    // Enable/disable color pickers
    colorPickers.forEach(picker => {
        picker.disabled = !isLocked;
    });
    
    if (isLocked) {
        // Lock the current palette
        const colors = Array.from(colorPickers).map(picker => picker.value);
        styleEngine.lockColorPalette(colors);
        configCache.globalStyle.lockedColors = colors;
    } else {
        // Unlock palette
        styleEngine.unlockColorPalette();
        configCache.globalStyle.lockedColors = [];
    }
    
    // Update cache
    configCache.globalStyle.colorPaletteLock = isLocked;
    
    // Save to localStorage
    saveStyleConfiguration();
}

function updateColorPalette(index, color) {
    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        showErrorMessage('Invalid color format');
        return;
    }
    
    // Update locked colors array
    if (!configCache.globalStyle.lockedColors) {
        configCache.globalStyle.lockedColors = [];
    }
    
    configCache.globalStyle.lockedColors[index] = color;
    
    // Update style engine if palette is locked
    if (configCache.globalStyle.colorPaletteLock) {
        styleEngine.lockColorPalette(configCache.globalStyle.lockedColors);
    }
    
    // Save to localStorage
    saveStyleConfiguration();
}

function previewStylePrompt(category) {
    try {
        const prompt = styleEngine.buildPrompt(category, 'A sample trait', { complexity: 5 });
        const negativePrompt = styleEngine.buildNegativePrompt(category);
        
        const message = `${category.charAt(0).toUpperCase() + category.slice(1)} Prompt:\n\n${prompt}\n\nNegative Prompt:\n${negativePrompt}`;
        
        alert(message);
    } catch (error) {
        console.error('Error previewing style prompt:', error);
        showErrorMessage('Failed to preview style prompt');
    }
}

function updateCharCounter(textarea, counterElement) {
    if (counterElement) {
        counterElement.textContent = textarea.value.length;
    }
}

function syncStyleConfigToCache() {
    // This function syncs the style engine state to configCache
    // Most syncing is already done in individual update functions
    console.log('Style config synced to cache');
}

// ===== GENERATION MODE CONFIGURATION UI =====

function initializeGenerationModeUI() {
    console.log('Initializing Generation Mode UI...');
    
    // Initialize global AI toggle
    initializeGlobalAIToggle();
    
    // Initialize per-category mode selectors
    initializeCategoryModeSelectors();
    
    // Initialize hybrid opacity slider
    initializeHybridOpacitySlider();
    
    // Load current configuration
    loadGenerationModeConfiguration();
    
    console.log('Generation Mode UI initialized');
}

function initializeGlobalAIToggle() {
    const globalToggle = document.getElementById('globalAiToggle');
    if (!globalToggle) return;
    
    // Load current state
    globalToggle.checked = configCache.globalStyle.useAIGeneration || false;
    
    globalToggle.addEventListener('change', () => {
        toggleGlobalAI();
    });
}

function initializeCategoryModeSelectors() {
    const categories = ['bg', 'body', 'eyes', 'mouth', 'hat'];
    
    categories.forEach(category => {
        const categoryKey = category === 'bg' ? 'background' : category;
        const radioButtons = document.querySelectorAll(`input[name="${category}Mode"]`);
        
        // Load current mode
        const currentMode = configCache[categoryKey].generationMode || 'procedural';
        const currentRadio = document.querySelector(`input[name="${category}Mode"][value="${currentMode}"]`);
        if (currentRadio) {
            currentRadio.checked = true;
        }
        
        // Attach event listeners
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    updateGenerationMode(categoryKey, e.target.value);
                }
            });
        });
    });
}

function initializeHybridOpacitySlider() {
    const slider = document.getElementById('hybridOpacity');
    const valueSpan = document.getElementById('hybridOpacityValue');
    
    if (!slider || !valueSpan) return;
    
    // Load current value
    const currentOpacity = (configCache.background.aiOptions.hybridOverlayOpacity || 0.4) * 100;
    slider.value = currentOpacity;
    valueSpan.textContent = Math.round(currentOpacity);
    
    slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        valueSpan.textContent = value;
        updateHybridOpacity();
    });
}

function loadGenerationModeConfiguration() {
    // Update UI based on global AI toggle state
    updateCategoryModeStates();
}

function toggleGlobalAI() {
    const globalToggle = document.getElementById('globalAiToggle');
    if (!globalToggle) return;
    
    const isEnabled = globalToggle.checked;
    
    // Update cache
    configCache.globalStyle.useAIGeneration = isEnabled;
    
    if (!isEnabled) {
        // Reset all categories to procedural
        const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
        categories.forEach(category => {
            configCache[category].generationMode = 'procedural';
            
            // Update UI radio buttons
            const categoryPrefix = category === 'background' ? 'bg' : category;
            const proceduralRadio = document.querySelector(`input[name="${categoryPrefix}Mode"][value="procedural"]`);
            if (proceduralRadio) {
                proceduralRadio.checked = true;
            }
        });
    }
    
    // Update category mode states (enable/disable)
    updateCategoryModeStates();
    
    // Update cost estimation
    updateCostEstimation();
    
    // Save configuration
    saveConfiguration();
    
    const message = isEnabled ? 'AI generation enabled' : 'AI generation disabled - all categories reset to procedural';
    showSuccessMessage(message);
}

function updateGenerationMode(category, mode) {
    // Validate mode
    if (!['procedural', 'ai', 'hybrid'].includes(mode)) {
        showErrorMessage('Invalid generation mode');
        return;
    }
    
    // Update cache
    configCache[category].generationMode = mode;
    
    // Update cost estimation
    updateCostEstimation();
    
    // Save configuration
    saveConfiguration();
    
    showSuccessMessage(`${category} generation mode set to ${mode}`);
}

function updateHybridOpacity() {
    const slider = document.getElementById('hybridOpacity');
    if (!slider) return;
    
    const opacity = parseInt(slider.value) / 100;
    
    // Update all categories
    const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
    categories.forEach(category => {
        configCache[category].aiOptions.hybridOverlayOpacity = opacity;
    });
    
    // Save configuration
    saveConfiguration();
}

function updateCategoryModeStates() {
    const globalToggle = document.getElementById('globalAiToggle');
    const isGlobalEnabled = globalToggle ? globalToggle.checked : false;
    
    const categories = ['bg', 'body', 'eyes', 'mouth', 'hat'];
    
    categories.forEach(category => {
        const aiRadio = document.querySelector(`input[name="${category}Mode"][value="ai"]`);
        const hybridRadio = document.querySelector(`input[name="${category}Mode"][value="hybrid"]`);
        const aiLabel = aiRadio ? aiRadio.closest('.mode-radio-label') : null;
        const hybridLabel = hybridRadio ? hybridRadio.closest('.mode-radio-label') : null;
        
        if (aiRadio && hybridRadio) {
            aiRadio.disabled = !isGlobalEnabled;
            hybridRadio.disabled = !isGlobalEnabled;
            
            if (aiLabel && hybridLabel) {
                if (isGlobalEnabled) {
                    aiLabel.classList.remove('disabled');
                    hybridLabel.classList.remove('disabled');
                } else {
                    aiLabel.classList.add('disabled');
                    hybridLabel.classList.add('disabled');
                }
            }
        }
    });
}

// ===== COST ESTIMATION =====

function initializeCostEstimator() {
    console.log('Initializing Cost Estimator...');
    
    const collectionSizeInput = document.getElementById('costCollectionSize');
    
    if (collectionSizeInput) {
        // Sync with main collection size input if it exists
        const mainCollectionSize = document.getElementById('collectionSize');
        if (mainCollectionSize) {
            collectionSizeInput.value = mainCollectionSize.value;
            
            // Sync both ways
            collectionSizeInput.addEventListener('input', (e) => {
                mainCollectionSize.value = e.target.value;
                updateCostEstimation();
            });
            
            mainCollectionSize.addEventListener('input', (e) => {
                collectionSizeInput.value = e.target.value;
                updateCostEstimation();
            });
        } else {
            collectionSizeInput.addEventListener('input', () => {
                updateCostEstimation();
            });
        }
    }
    
    // Initial calculation
    updateCostEstimation();
    
    console.log('Cost Estimator initialized');
}

function updateCostEstimation() {
    const collectionSizeInput = document.getElementById('costCollectionSize');
    const estimatedCostElement = document.getElementById('estimatedCost');
    const costWarning = document.getElementById('costWarning');
    
    if (!collectionSizeInput || !estimatedCostElement) return;
    
    const collectionSize = parseInt(collectionSizeInput.value) || 100;
    
    // Count AI-enabled categories - reset to 0 when AI generation is globally disabled
    const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
    let aiEnabledCount = 0;
    
    if (configCache.globalStyle.useAIGeneration) {
        aiEnabledCount = categories.filter(category => {
            const mode = configCache[category].generationMode;
            return (mode === 'ai' || mode === 'hybrid');
        }).length;
    }
    
    // Provider costs per image
    const providerCosts = {
        gemini: 0.039,
        openai: 0.080,
        stablediffusion: 0.050,
        procedural: 0.00
    };
    
    // Update table rows
    Object.entries(providerCosts).forEach(([provider, costPerImage]) => {
        const row = document.querySelector(`.cost-row[data-provider="${provider}"]`);
        if (row) {
            const aiCategoriesCell = row.querySelector('.ai-categories-count');
            const collectionSizeCell = row.querySelector('.collection-size-display');
            const providerCostCell = row.querySelector('.provider-cost');
            
            if (aiCategoriesCell && collectionSizeCell && providerCostCell) {
                aiCategoriesCell.textContent = aiEnabledCount;
                collectionSizeCell.textContent = collectionSize;
                
                const totalCost = collectionSize * aiEnabledCount * costPerImage;
                providerCostCell.textContent = `$${totalCost.toFixed(2)}`;
            }
        }
    });
    
    // Calculate total cost for active provider - normalize and validate provider name
    let activeProvider = apiManager.getActiveProviderName();
    
    // Validate activeProvider against known keys in providerCosts and map to safe default
    if (!activeProvider || !providerCosts.hasOwnProperty(activeProvider)) {
        activeProvider = 'gemini'; // Safe default
    }
    
    const activeProviderCost = providerCosts[activeProvider];
    const totalCost = collectionSize * aiEnabledCount * activeProviderCost;
    
    // Update total cost display
    estimatedCostElement.textContent = `$${totalCost.toFixed(2)}`;
    
    // Highlight active provider row
    document.querySelectorAll('.cost-row').forEach(row => {
        row.classList.remove('active');
    });
    const activeRow = document.querySelector(`.cost-row[data-provider="${activeProvider}"]`);
    if (activeRow) {
        activeRow.classList.add('active');
    }
    
    // Show/hide warning
    if (costWarning) {
        if (totalCost > 10) {
            costWarning.style.display = 'block';
            costWarning.textContent = `⚠️ Estimated cost: $${totalCost.toFixed(2)} exceeds $10. Consider reducing collection size or disabling AI for some categories.`;
        } else {
            costWarning.style.display = 'none';
        }
    }
}

// ===== REAL-TIME VALIDATION =====

function validateAPIKeyFormat(providerName, apiKey) {
    // Relaxed validation - only check broad, stable characteristics
    // Final validity is determined by provider.validateKey(), not format heuristics
    
    switch (providerName.toLowerCase()) {
        case 'gemini':
            if (!apiKey.startsWith('AIza')) {
                return { valid: false, error: 'Gemini API keys should start with "AIza". Final validity will be confirmed by provider validation.' };
            }
            break;
        case 'openai':
            if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
                return { valid: false, error: 'OpenAI API keys should start with "sk-" and be reasonably long. Final validity will be confirmed by provider validation.' };
            }
            break;
        case 'stablediffusion':
            if (!apiKey.startsWith('sk-')) {
                return { valid: false, error: 'Stable Diffusion API keys should start with "sk-". Final validity will be confirmed by provider validation.' };
            }
            break;
        default:
            return { valid: false, error: 'Unknown provider' };
    }
    
    return { valid: true, error: null };
}

function showValidationMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.validation-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = `validation-message ${type}`;
    messageElement.textContent = message;
    messageElement.setAttribute('role', 'alert');
    
    // Add to page
    document.body.appendChild(messageElement);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.remove();
        }
    }, 3000);
}

function showErrorMessage(message) {
    showValidationMessage(message, 'error');
}

function showSuccessMessage(message) {
    showValidationMessage(message, 'success');
}

function showInfoMessage(message) {
    showValidationMessage(message, 'info');
}

// ===== COLLAPSIBLE SECTION TOGGLE =====

function initializeCollapsibleSections() {
    const toggleBtn = document.getElementById('aiConfigToggle');
    const content = document.getElementById('aiConfigContent');
    
    if (!toggleBtn || !content) return;
    
    // Load saved state
    const isCollapsed = localStorage.getItem('aiConfigCollapsed') === 'true';
    if (isCollapsed) {
        content.classList.add('collapsed');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = '▶';
    }
    
    toggleBtn.addEventListener('click', () => {
        const isCurrentlyCollapsed = content.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            content.classList.remove('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = '▶';
        }
        
        // Save state
        localStorage.setItem('aiConfigCollapsed', !isCurrentlyCollapsed);
    });
}

// ===== EVENT LISTENERS FOR BACKEND EVENTS =====

function initializeBackendEventListeners() {
    // API Manager events
    window.addEventListener('apiManager:imageGenerated', (e) => {
        // Update quota displays after image generation
        const providerName = e.detail.provider;
        if (providerName) {
            setTimeout(() => updateProviderQuota(providerName), 1000);
        }
    });
    
    window.addEventListener('apiManager:failoverOccurred', (e) => {
        const { fromProvider, toProvider, reason } = e.detail;
        showInfoMessage(`Failover: ${fromProvider} → ${toProvider} (${reason})`);
    });
    
    window.addEventListener('apiManager:providerDisabled', (e) => {
        const { provider, reason } = e.detail;
        showErrorMessage(`Provider ${provider} disabled: ${reason}`);
        
        // Update UI to reflect disabled state
        const providerCard = document.querySelector(`.provider-card[data-provider="${provider}"]`);
        if (providerCard) {
            providerCard.classList.add('disabled');
        }
    });
    
    // Style Engine events
    window.addEventListener('styleEngine:configChanged', (e) => {
        // Sync UI fields when style config changes programmatically
        loadStyleConfigurationUI();
    });
    
    // AI Generation events
    window.addEventListener('aiGenerationProgress', (e) => {
        const { category, current, total, percentage } = e.detail;
        showInfoMessage(`Generating ${category}: ${current}/${total} (${percentage}%)`);
    });
    
    window.addEventListener('aiGenerationComplete', (e) => {
        const { category, successCount, failureCount } = e.detail;
        showSuccessMessage(`${category} generation complete: ${successCount} success, ${failureCount} failed`);
    });
    
    window.addEventListener('aiGenerationFallback', (e) => {
        const { category, index, error } = e.detail;
        showInfoMessage(`${category}[${index}] fell back to procedural: ${error}`);
    });
}

// ===== INTEGRATION WITH EXISTING INITIALIZATION =====

// Update the main DOMContentLoaded listener to include AI UI initialization
function initializeAIConfigurationUI() {
    console.log('Initializing AI Configuration UI...');
    
    try {
        // Initialize all UI components
        initializeCollapsibleSections();
        initializeAPIProviderUI();
        initializeStyleConfigUI();
        initializeGenerationModeUI();
        initializeCostEstimator();
        initializeBackendEventListeners();
        
        console.log('AI Configuration UI initialized successfully');
    } catch (error) {
        console.error('Failed to initialize AI Configuration UI:', error);
        showErrorMessage('Failed to initialize AI configuration interface');
    }
}
// ===== COST OPTIMIZATION SYSTEMS INITIALIZATION =====

// Global instances for cost optimization
let imageCacheManager = null;
let budgetManager = null;
let costAnalytics = null;
let batchOptimizer = null;
let smartRegenerator = null;
let compressionManager = null;

async function initializeCostOptimizationSystems() {
    console.log('Initializing cost optimization systems...');
    
    try {
        // Initialize IndexedDB Cache Manager
        imageCacheManager = new ImageCacheManager();
        const cacheInitialized = await imageCacheManager.initialize();
        window.imageCacheManager = imageCacheManager;
        
        // Initialize Budget Manager
        budgetManager = new BudgetManager();
        const budgetInitialized = await budgetManager.initialize();
        window.budgetManager = budgetManager;
        
        // Initialize Cost Analytics
        costAnalytics = new CostAnalytics(budgetManager);
        const analyticsInitialized = await costAnalytics.initialize();
        window.costAnalytics = costAnalytics;
        
        // Initialize Batch Optimizer
        batchOptimizer = new BatchOptimizer();
        batchOptimizer.initialize({
            maxConcurrency: 5
        });
        window.batchOptimizer = batchOptimizer;
        
        // Initialize Smart Regenerator
        smartRegenerator = new SmartRegenerator(imageCacheManager);
        const regenInitialized = await smartRegenerator.initialize();
        window.smartRegenerator = smartRegenerator;
        
        // Initialize Compression Manager
        compressionManager = new CompressionManager();
        const compressionInitialized = await compressionManager.initialize();
        window.compressionManager = compressionManager;
        
        // Set up batch optimizer request executor
        batchOptimizer.setRequestExecutor(async (request, batchId, index) => {
            return await aiCoordinator.generateSingleAITrait(
                request.category,
                request.complexity,
                request.colorSeed,
                request.index
            );
        });
        
        // Initialize UI components
        initializeBudgetControlsUI();
        initializeCostAnalyticsDashboard();
        
        console.log('Cost optimization systems initialized successfully');
        
        return {
            cache: cacheInitialized,
            budget: budgetInitialized,
            analytics: analyticsInitialized,
            compression: compressionInitialized,
            regeneration: regenInitialized
        };
        
    } catch (error) {
        console.error('Failed to initialize cost optimization systems:', error);
        return false;
    }
}

// ===== BUDGET CONTROLS UI =====

function initializeBudgetControlsUI() {
    console.log('Initializing Budget Controls UI...');
    
    // Initialize provider budget inputs
    const providers = ['gemini', 'openai', 'stablediffusion'];
    
    providers.forEach(provider => {
        initializeProviderBudgetControls(provider);
    });
    
    // Initialize global budget controls
    initializeGlobalBudgetControls();
    
    // Initialize warning threshold selector
    initializeWarningThresholdSelector();
    
    // Start budget status updates
    startBudgetStatusUpdates();
    
    console.log('Budget Controls UI initialized');
}

function initializeProviderBudgetControls(provider) {
    const dailyInput = document.getElementById(`${provider}DailyBudget`);
    const monthlyInput = document.getElementById(`${provider}MonthlyBudget`);
    
    if (!dailyInput || !monthlyInput) return;
    
    // Load current budget limits
    const currentBudgets = budgetManager.currentBudgets[provider] || {};
    dailyInput.value = currentBudgets.daily || 0;
    monthlyInput.value = currentBudgets.monthly || 0;
    
    // Add event listeners
    dailyInput.addEventListener('change', async (e) => {
        const amount = parseFloat(e.target.value) || 0;
        await budgetManager.setBudgetLimit(provider, 'daily', amount);
        updateBudgetStatus(provider);
        showSuccessMessage(`${provider} daily budget updated to $${amount.toFixed(2)}`);
    });
    
    monthlyInput.addEventListener('change', async (e) => {
        const amount = parseFloat(e.target.value) || 0;
        await budgetManager.setBudgetLimit(provider, 'monthly', amount);
        updateBudgetStatus(provider);
        showSuccessMessage(`${provider} monthly budget updated to $${amount.toFixed(2)}`);
    });
}

function initializeGlobalBudgetControls() {
    const globalInput = document.getElementById('globalMonthlyBudget');
    if (!globalInput) return;
    
    // Load current global budget
    globalInput.value = budgetManager.currentBudgets.global.monthly || 0;
    
    globalInput.addEventListener('change', async (e) => {
        const amount = parseFloat(e.target.value) || 0;
        await budgetManager.setBudgetLimit('global', 'monthly', amount);
        updateGlobalBudgetStatus();
        showSuccessMessage(`Global monthly budget updated to $${amount.toFixed(2)}`);
    });
}

function initializeWarningThresholdSelector() {
    const thresholdSelect = document.getElementById('budgetWarningThreshold');
    if (!thresholdSelect) return;
    
    // Load current threshold
    thresholdSelect.value = budgetManager.currentBudgets.warningThreshold || 75;
    
    thresholdSelect.addEventListener('change', (e) => {
        const threshold = parseInt(e.target.value);
        budgetManager.currentBudgets.warningThreshold = threshold;
        budgetManager.saveBudgetsToLocalStorage();
        showSuccessMessage(`Warning threshold set to ${threshold}%`);
    });
}

async function updateBudgetStatus(provider) {
    const remaining = await budgetManager.getRemainingBudget(provider);
    
    // Update remaining amount display
    const remainingElement = document.getElementById(`${provider}DailyRemaining`);
    if (remainingElement) {
        remainingElement.textContent = `$${remaining.daily.remaining.toFixed(2)}`;
    }
    
    // Update progress bar
    const progressElement = document.getElementById(`${provider}DailyProgress`);
    const percentageElement = document.getElementById(`${provider}DailyPercentage`);
    
    if (progressElement && percentageElement) {
        const percentage = remaining.daily.percentage;
        progressElement.style.width = `${Math.min(100, percentage)}%`;
        percentageElement.textContent = `${percentage.toFixed(1)}%`;
        
        // Update color based on usage
        progressElement.className = 'budget-progress-fill';
        if (percentage >= 90) {
            progressElement.classList.add('high');
        } else if (percentage >= 75) {
            progressElement.classList.add('medium');
        } else {
            progressElement.classList.add('low');
        }
    }
}

async function updateGlobalBudgetStatus() {
    const globalSpend = await budgetManager.getGlobalSpend('monthly');
    const globalLimit = budgetManager.currentBudgets.global.monthly;
    const remaining = Math.max(0, globalLimit - globalSpend);
    
    const remainingElement = document.getElementById('globalMonthlyRemaining');
    if (remainingElement) {
        remainingElement.textContent = `$${remaining.toFixed(2)}`;
    }
}

function startBudgetStatusUpdates() {
    // Update budget status every 30 seconds
    setInterval(async () => {
        const providers = ['gemini', 'openai', 'stablediffusion'];
        for (const provider of providers) {
            await updateBudgetStatus(provider);
        }
        await updateGlobalBudgetStatus();
    }, 30000);
    
    // Initial update
    setTimeout(async () => {
        const providers = ['gemini', 'openai', 'stablediffusion'];
        for (const provider of providers) {
            await updateBudgetStatus(provider);
        }
        await updateGlobalBudgetStatus();
    }, 1000);
}

// ===== COST ANALYTICS DASHBOARD UI =====

function initializeCostAnalyticsDashboard() {
    console.log('Initializing Cost Analytics Dashboard...');
    
    // Initialize export functionality
    initializeAnalyticsExport();
    
    // Initialize clear data functionality
    initializeAnalyticsClear();
    
    // The dashboard will be updated automatically by CostAnalytics class
    console.log('Cost Analytics Dashboard initialized');
}

function initializeAnalyticsExport() {
    const exportBtn = document.getElementById('exportAnalyticsBtn');
    if (!exportBtn) return;
    
    exportBtn.addEventListener('click', async () => {
        try {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting...';
            
            const report = await costAnalytics.exportReport('csv');
            
            // Create and download file
            const blob = new Blob([report], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nft-generator-analytics-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccessMessage('Analytics report exported successfully');
            
        } catch (error) {
            console.error('Export failed:', error);
            showErrorMessage('Failed to export analytics report');
        } finally {
            exportBtn.disabled = false;
            exportBtn.textContent = 'Export Report';
        }
    });
}

function initializeAnalyticsClear() {
    const clearBtn = document.getElementById('clearAnalyticsBtn');
    if (!clearBtn) return;
    
    clearBtn.addEventListener('click', async () => {
        const confirmed = confirm('Clear all analytics data? This action cannot be undone.');
        if (!confirmed) return;
        
        try {
            // Clear budget history (this would need to be implemented in BudgetManager)
            // For now, just reset the analytics stats
            if (costAnalytics) {
                costAnalytics.resetStats();
            }
            
            if (imageCacheManager) {
                await imageCacheManager.clear();
            }
            
            showSuccessMessage('Analytics data cleared successfully');
            
            // Refresh dashboard
            setTimeout(() => {
                if (costAnalytics) {
                    costAnalytics.updateDashboard();
                }
            }, 500);
            
        } catch (error) {
            console.error('Clear failed:', error);
            showErrorMessage('Failed to clear analytics data');
        }
    });
}

// ===== ENHANCED AI GENERATION WITH COST OPTIMIZATION =====

// Modify AIGenerationCoordinator.generateSingleAITrait to integrate with new systems
const originalGenerateSingleAITrait = aiCoordinator.generateSingleAITrait;
aiCoordinator.generateSingleAITrait = async function(category, complexity, colorSeed, index) {
    const cacheKey = imageCacheManager ? imageCacheManager.generateCacheKey(category, complexity, colorSeed, index) : null;
    
    // Define providerCosts in outer scope for all blocks to use
    const providerCosts = { gemini: 0.039, openai: 0.080, stablediffusion: 0.050, procedural: 0.00 };
    const activeProvider = apiManager.getActiveProviderName();
    const costPerImage = providerCosts[activeProvider] || 0;
    
    // Check IndexedDB cache first
    if (imageCacheManager && cacheKey) {
        const cached = await imageCacheManager.get(cacheKey);
        if (cached) {
            console.log(`Cache hit for ${cacheKey}`);
            return cached.imageData;
        }
    }
    
    // Check budget before making API call
    if (budgetManager) {
        const canMakeRequest = await budgetManager.canMakeRequest(activeProvider, costPerImage);
        if (!canMakeRequest.allowed) {
            throw new Error(`Budget limit exceeded: ${canMakeRequest.message}`);
        }
    }
    
    // Generate using original method
    const result = await originalGenerateSingleAITrait.call(this, category, complexity, colorSeed, index);
    
    // Record spend
    if (budgetManager && result) {
        await budgetManager.recordSpend(activeProvider, costPerImage, {
            category,
            traitIndex: index,
            success: true
        });
    }
    
    // Compress and cache result
    if (result && imageCacheManager && compressionManager && cacheKey) {
        try {
            const compressedResult = await compressionManager.compressImage(result);
            await imageCacheManager.set(cacheKey, compressedResult, {
                category,
                provider: activeProvider,
                cost: costPerImage,
                complexity,
                colorSeed,
                index
            });
        } catch (error) {
            console.warn('Failed to cache result:', error);
        }
    }
    
    return result;
};

// ===== ENHANCED TRAIT GENERATION WITH SMART REGENERATION =====

// Modify generateAllTraits to use smart regeneration
const originalGenerateAllTraits = generateAllTraits;
generateAllTraits = async function(forceGeneration = false) {
    if (!smartRegenerator || !smartRegenerator.isSmartRegenerationEnabled() || forceGeneration) {
        return await originalGenerateAllTraits();
    }
    
    try {
        // Detect changes
        const diffReport = await smartRegenerator.generateDiffReport();
        
        if (!diffReport.hasChanges) {
            // Check if this is the first generation (no existing traits)
            const hasExistingTraits = Object.values(globalState).some(category => category.length > 0);
            if (hasExistingTraits) {
                showInfoMessage('No configuration changes detected. Skipping regeneration.');
                return;
            }
            // If no existing traits, proceed with full generation
            console.log('First generation detected, proceeding with full trait generation');
            return await originalGenerateAllTraits();
        }
        
        // Show diff to user
        const shouldContinue = await showRegenerationDiff(diffReport);
        if (!shouldContinue) {
            return;
        }
        
        // Regenerate only changed categories
        const regenerationResult = await smartRegenerator.regenerateChanged();
        
        if (regenerationResult.regenerated.length === 0) {
            showInfoMessage('No categories need regeneration.');
            return;
        }
        
        // Generate traits only for changed categories
        await generateTraitsForCategories(regenerationResult.regenerated);
        
        // Update stored hashes for regenerated categories
        for (const category of regenerationResult.regenerated) {
            const newHash = smartRegenerator.generateConfigHash(category);
            await smartRegenerator.updateStoredHash(category, newHash);
        }
        
        // Populate rarity controls after regeneration
        populateRarityControls();
        
        // Scroll to rarity section
        setTimeout(() => {
            document.getElementById('rarityConfig').scrollIntoView({behavior: 'smooth'});
        }, 500);
        
        showSuccessMessage(`Smart regeneration completed: ${regenerationResult.regenerated.length} categories updated, ${regenerationResult.skipped.length} categories reused from cache.`);
        
    } catch (error) {
        console.error('Smart regeneration failed:', error);
        showErrorMessage('Smart regeneration failed, falling back to full regeneration');
        await originalGenerateAllTraits();
    }
};

// Helper function to generate traits for specific categories only
async function generateTraitsForCategories(categoriesToGenerate) {
    const allCategories = ['background', 'body', 'eyes', 'mouth', 'hat'];
    
    // Clear AI generation cache for changed categories only
    if (aiCoordinator && aiCoordinator.clearCache) {
        aiCoordinator.clearCache();
    }
    
    // Generate traits for specified categories only
    for (const category of categoriesToGenerate) {
        if (!allCategories.includes(category)) continue;
        
        const config = configCache[category];
        if (!config) continue;
        
        // Clear existing traits for this category
        globalState[category] = [];
        rarityState[category] = [];
        
        if (config.generationMode === 'procedural' || !configCache.globalStyle.useAIGeneration) {
            // Synchronous procedural generation
            await generateProceduralTraits(category, config);
        } else {
            // Async AI/Hybrid generation
            await generateAITraits(category, config);
        }
    }
    
    console.log(`Generated traits for ${categoriesToGenerate.length} changed categories: ${categoriesToGenerate.join(', ')}`);
}

async function showRegenerationDiff(diffReport) {
    const message = `Configuration changes detected:\n\n` +
        `Categories to regenerate: ${diffReport.categories.filter(c => c.status === 'changed').map(c => c.category).join(', ')}\n` +
        `Estimated cost: $${diffReport.estimatedCost.total.toFixed(2)}\n` +
        `Estimated time: ${diffReport.estimatedTime.totalFormatted}\n\n` +
        `Continue with smart regeneration?`;
    
    return confirm(message);
}

// ===== ENHANCED COLLECTION GENERATION WITH BATCH OPTIMIZATION =====

// Modify generateNFTCollection to use batch optimization
const originalGenerateNFTCollection = generateNFTCollection;
generateNFTCollection = async function(collectionSize, collectionName) {
    if (!batchOptimizer) {
        return await originalGenerateNFTCollection(collectionSize, collectionName);
    }
    
    try {
        // Check if AI categories exist and AI generation is enabled
        const categories = Object.keys(configCache).filter(key => key !== 'globalStyle');
        const aiCategories = categories.filter(category => 
            configCache[category].generationMode !== 'procedural' && configCache.globalStyle.useAIGeneration
        );
        
        if (aiCategories.length === 0) {
            // No AI categories, use original method
            return await originalGenerateNFTCollection(collectionSize, collectionName);
        }
        
        console.log(`Using batch optimization for collection generation with ${aiCategories.length} AI categories`);
        
        // Build array of AI trait requests for batch processing
        const aiRequests = [];
        for (const category of aiCategories) {
            const config = configCache[category];
            for (let i = 0; i < config.numTraits; i++) {
                aiRequests.push({
                    category,
                    complexity: config.complexity,
                    colorSeed: config.colorSeed,
                    index: i,
                    provider: apiManager.getActiveProviderName(),
                    prompt: styleEngine.buildPrompt(category, `A ${category} trait`, { complexity: config.complexity })
                });
            }
        }
        
        // Process AI requests in batches
        console.log(`Processing ${aiRequests.length} AI trait requests in batches`);
        const batchResults = await batchOptimizer.generateBatch(aiRequests, {
            maxConcurrency: 5,
            priority: 'medium'
        });
        
        // Map batch results back to trait positions
        let resultIndex = 0;
        for (const category of aiCategories) {
            const config = configCache[category];
            const categoryTraits = [];
            
            for (let i = 0; i < config.numTraits; i++) {
                const result = batchResults[resultIndex++];
                if (result && result.success !== false) {
                    const trait = {
                        id: generateUniqueId(),
                        category: category,
                        dataURL: result,
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
                    categoryTraits.push(trait);
                }
            }
            
            // Store traits in global state
            globalState[category] = categoryTraits;
            displayTraits(category, categoryTraits);
            initializeRarityState(category);
        }
        
        // Generate procedural traits for non-AI categories
        const proceduralCategories = categories.filter(category => 
            configCache[category].generationMode === 'procedural' || !configCache.globalStyle.useAIGeneration
        );
        
        for (const category of proceduralCategories) {
            await generateProceduralTraits(category, configCache[category]);
        }
        
        // Continue with original collection generation logic using the populated globalState
        return await originalGenerateNFTCollection(collectionSize, collectionName);
        
    } catch (error) {
        console.error('Batch optimized collection generation failed:', error);
        return await originalGenerateNFTCollection(collectionSize, collectionName);
    }
};

// ===== CONFIGURATION PERSISTENCE FOR NEW SYSTEMS =====

// Extend saveConfiguration to include new settings
const originalSaveConfiguration = saveConfiguration;
saveConfiguration = function() {
    try {
        // Call original save
        originalSaveConfiguration();
        
        // Save additional cost optimization settings
        const costOptimizationConfig = {
            budgets: budgetManager ? budgetManager.currentBudgets : {},
            compression: compressionManager ? compressionManager.getSettings() : {},
            batchOptimizer: batchOptimizer ? batchOptimizer.getConfiguration() : {},
            smartRegeneration: smartRegenerator ? {
                enabled: smartRegenerator.isSmartRegenerationEnabled()
            } : {}
        };
        
        localStorage.setItem('nft_generator_cost_optimization', JSON.stringify(costOptimizationConfig));
        
    } catch (error) {
        console.error('Failed to save cost optimization configuration:', error);
    }
};

// Extend loadConfiguration to include new settings
const originalLoadConfiguration = loadConfiguration;
loadConfiguration = function() {
    try {
        // Call original load
        originalLoadConfiguration();
        
        // Load cost optimization settings
        const saved = localStorage.getItem('nft_generator_cost_optimization');
        if (saved) {
            const config = JSON.parse(saved);
            
            if (budgetManager && config.budgets) {
                Object.assign(budgetManager.currentBudgets, config.budgets);
            }
            
            if (compressionManager && config.compression) {
                compressionManager.updateSettings(config.compression);
            }
            
            if (batchOptimizer && config.batchOptimizer && config.batchOptimizer.maxConcurrency) {
                batchOptimizer.setMaxConcurrency(config.batchOptimizer.maxConcurrency);
            }
            
            if (smartRegenerator && config.smartRegeneration) {
                smartRegenerator.setEnabled(config.smartRegeneration.enabled !== false);
            }
        }
        
    } catch (error) {
        console.error('Failed to load cost optimization configuration:', error);
    }
};

// ===== EVENT LISTENERS FOR COST OPTIMIZATION =====

function setupCostOptimizationEventListeners() {
    // Budget warning events
    window.addEventListener('budget:warning', (event) => {
        const { provider, type, percentage, remaining } = event.detail;
        showBudgetWarningNotification(provider, type, percentage, remaining);
    });
    
    window.addEventListener('budget:exceeded', (event) => {
        const { provider, type, limit, spent } = event.detail;
        showBudgetExceededModal(provider, type, limit, spent);
    });
    
    // Cache events
    window.addEventListener('cacheManager:stored', (event) => {
        console.log('Image cached:', event.detail);
    });
    
    // Compression events
    window.addEventListener('compression:completed', (event) => {
        const { originalSize, compressedSize, compressionRatio } = event.detail;
        console.log(`Compression: ${originalSize} → ${compressedSize} bytes (${(compressionRatio * 100).toFixed(1)}%)`);
    });
    
    // Batch optimization events
    window.addEventListener('batch:progress', (event) => {
        const { batchId, completed, total } = event.detail;
        console.log(`Batch ${batchId}: ${completed}/${total} completed`);
    });
}

function showBudgetWarningNotification(provider, type, percentage, remaining) {
    const message = `⚠️ ${provider} ${type} budget at ${percentage.toFixed(1)}% ($${remaining.toFixed(2)} remaining)`;
    showValidationMessage(message, 'warning');
}

function showBudgetExceededModal(provider, type, limit, spent) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'budget-warning-modal';
    modal.innerHTML = `
        <div class="budget-warning-content">
            <div class="budget-warning-header">
                <div class="budget-warning-icon">⚠️</div>
                <div class="budget-warning-title">Budget Exceeded</div>
            </div>
            <div class="budget-warning-message">
                Your ${provider} ${type} budget limit of $${limit.toFixed(2)} has been exceeded. 
                Current spend: $${spent.toFixed(2)}.
                <br><br>
                Please adjust your budget limits or reduce API usage to continue.
            </div>
            <div class="budget-warning-actions">
                <button class="btn-cancel" onclick="this.closest('.budget-warning-modal').remove()">Close</button>
                <button class="btn-primary" onclick="this.closest('.budget-warning-modal').remove(); document.getElementById('${provider}${type.charAt(0).toUpperCase() + type.slice(1)}Budget').focus()">Adjust Budget</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 10000);
}

// Initialize event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupCostOptimizationEventListeners, 2000);
});