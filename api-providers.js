// API Provider Implementations
// Abstract provider interface and concrete implementations for AI services

// ===== CANVAS CONTEXT VALIDATION UTILITY =====

// Canvas context validation utility
function validateCanvasContext(canvas, contextType = '2d') {
    if (!canvas) {
        throw new Error('Canvas element is null or undefined');
    }
    
    const ctx = canvas.getContext(contextType);
    if (!ctx) {
        throw new Error(`Failed to get ${contextType} context from canvas. This may indicate browser limitations or WebGL context loss.`);
    }
    
    return ctx;
}

// ===== BASE PROVIDER INTERFACE =====

class BaseAPIProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.errorCount = 0;
        this.healthScore = 100;
        this.rateLimits = this.getRateLimits();
    }
    
    // Abstract methods - must be implemented by subclasses
    async generateImage(prompt, options) {
        throw new Error('generateImage method must be implemented by subclass');
    }
    
    async validateKey() {
        throw new Error('validateKey method must be implemented by subclass');
    }
    
    async getQuota() {
        throw new Error('getQuota method must be implemented by subclass');
    }
    
    getRateLimits() {
        throw new Error('getRateLimits method must be implemented by subclass');
    }
    
    getName() {
        throw new Error('getName method must be implemented by subclass');
    }
    
    getCostPerImage() {
        throw new Error('getCostPerImage method must be implemented by subclass');
    }
    
    // Common functionality
    updateHealthScore(success) {
        if (success) {
            this.healthScore = Math.min(100, this.healthScore + 5);
        } else {
            this.healthScore = Math.max(0, this.healthScore - 10);
            this.errorCount++;
        }
    }
    
    isHealthy() {
        return this.healthScore >= 20;
    }
    
    recordRequest() {
        this.lastRequestTime = Date.now();
        this.requestCount++;
    }
    
    getStatus() {
        return {
            name: this.getName(),
            healthScore: this.healthScore,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            lastRequestTime: this.lastRequestTime,
            isHealthy: this.isHealthy()
        };
    }
}

// ===== GEMINI PROVIDER IMPLEMENTATION =====

class GeminiProvider extends BaseAPIProvider {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.model = 'gemini-2.5-flash';
    }
    
    getName() {
        return 'gemini';
    }
    
    getRateLimits() {
        return {
            requestsPerMinute: 60,
            requestsPerDay: 1500
        };
    }
    
    getCostPerImage() {
        return 0.039; // $0.039 per image
    }
    
    async generateImage(prompt, options = {}) {
        this.recordRequest();
        
        // STUB: Gemini does not currently have a production-ready image generation endpoint
        // This is a placeholder implementation that generates a canvas-based image
        // TODO: Replace with actual Gemini image generation API when available
        
        // Gemini image generation is not yet supported
        this.updateHealthScore(false);
        throw new ProviderError(this.getName(), 'NOT_IMPLEMENTED', 
            'Gemini image generation is not yet available. Please use OpenAI, Stable Diffusion, or Procedural providers.');
    }
    
    async generatePlaceholderImage(prompt, options = {}) {
        // PLACEHOLDER: Generate a canvas-based image with prompt text
        // This is clearly marked as a stub implementation
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = validateCanvasContext(canvas);
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#e3f2fd');
        gradient.addColorStop(1, '#bbdefb');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add border
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 508);
        
        // Add "STUB" watermark
        ctx.fillStyle = 'rgba(25, 118, 210, 0.1)';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('STUB', 256, 100);
        
        // Add provider name
        ctx.fillStyle = '#1976d2';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Gemini Provider', 256, 150);
        ctx.font = '16px Arial';
        ctx.fillText('(Placeholder Implementation)', 256, 175);
        
        // Add prompt text (wrapped)
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        const words = prompt.split(' ');
        let line = '';
        let y = 220;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > 450 && i > 0) {
                ctx.fillText(line, 256, y);
                line = words[i] + ' ';
                y += 20;
                if (y > 450) break; // Prevent overflow
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 256, y);
        
        // Add timestamp
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`Generated: ${new Date().toISOString()}`, 256, 480);
        
        return canvas.toDataURL('image/png');
    }
    
    async validateKey() {
        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'test' }]
                    }]
                })
            });
            
            return response.ok || response.status === 400; // 400 might be valid key with bad request
        } catch (error) {
            return false;
        }
    }
    
    async getQuota() {
        // Gemini doesn't have a direct quota endpoint
        // Return estimated values based on rate limits
        return {
            remaining: this.rateLimits.requestsPerDay - (this.requestCount % this.rateLimits.requestsPerDay),
            limit: this.rateLimits.requestsPerDay,
            resetTime: this.getNextResetTime()
        };
    }
    
    async handleErrorResponse(response) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
            case 401:
            case 403:
                throw new APIKeyInvalidError(this.getName(), errorData.error?.message || 'Invalid API key');
            case 429:
                const retryAfter = response.headers.get('retry-after') || 60;
                throw new RateLimitError(this.getName(), parseInt(retryAfter), errorData.error?.message);
            case 402:
                throw new QuotaExceededError(this.getName(), null, errorData.error?.message);
            default:
                throw new ProviderError(this.getName(), `HTTP_${response.status}`, errorData.error?.message || 'Unknown error');
        }
    }
    
    getNextResetTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }
}

// ===== OPENAI PROVIDER IMPLEMENTATION =====

class OpenAIProvider extends BaseAPIProvider {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://api.openai.com/v1/images/generations';
        this.model = 'dall-e-3';
    }
    
    getName() {
        return 'openai';
    }
    
    getRateLimits() {
        return {
            requestsPerMinute: 15, // Tier 5 default
            requestsPerDay: 500
        };
    }
    
    getCostPerImage() {
        return 0.08; // $0.08 per image for DALL-E 3
    }
    
    async generateImage(prompt, options = {}) {
        this.recordRequest();
        
        const requestBody = {
            model: options.model || this.model,
            prompt: prompt,
            n: 1,
            size: options.size || '1024x1024',
            quality: options.quality || 'standard',
            response_format: 'url'
        };
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw await this.handleErrorResponse(response);
            }
            
            const data = await response.json();
            const imageUrl = data.data[0].url;
            
            // Convert URL to base64 data URL
            const imageDataURL = await this.urlToDataURL(imageUrl);
            
            this.updateHealthScore(true);
            return imageDataURL;
            
        } catch (error) {
            this.updateHealthScore(false);
            throw error;
        }
    }
    
    async urlToDataURL(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            throw new Error('Failed to convert image URL to data URL');
        }
    }
    
    async validateKey() {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    async getQuota() {
        // OpenAI doesn't provide quota info via API
        // Return estimated values
        return {
            remaining: this.rateLimits.requestsPerDay - (this.requestCount % this.rateLimits.requestsPerDay),
            limit: this.rateLimits.requestsPerDay,
            resetTime: this.getNextResetTime()
        };
    }
    
    async handleErrorResponse(response) {
        const errorData = await response.json().catch(() => ({}));
        const error = errorData.error || {};
        
        switch (response.status) {
            case 401:
                throw new APIKeyInvalidError(this.getName(), error.message || 'Invalid API key');
            case 429:
                throw new RateLimitError(this.getName(), 60, error.message || 'Rate limit exceeded');
            case 402:
                throw new QuotaExceededError(this.getName(), null, error.message || 'Quota exceeded');
            default:
                throw new ProviderError(this.getName(), error.code || `HTTP_${response.status}`, error.message || 'Unknown error');
        }
    }
    
    getNextResetTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }
}

// ===== STABLE DIFFUSION PROVIDER IMPLEMENTATION =====

class StableDiffusionProvider extends BaseAPIProvider {
    constructor(apiKey) {
        super(apiKey);
        this.baseUrl = 'https://api.stability.ai/v2beta/stable-image/generate/sd3.5';
        this.model = 'sd3.5-large';
    }
    
    getName() {
        return 'stablediffusion';
    }
    
    getRateLimits() {
        return {
            creditsPerMinute: 100,
            creditsPerMonth: 1000
        };
    }
    
    getCostPerImage() {
        return 0.05; // $0.05 per image average
    }
    
    async generateImage(prompt, options = {}) {
        this.recordRequest();
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('model', options.model || this.model);
        formData.append('aspect_ratio', options.aspectRatio || '1:1');
        formData.append('output_format', 'png');
        
        if (options.negativePrompt) {
            formData.append('negative_prompt', options.negativePrompt);
        }
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'image/*'
                },
                body: formData
            });
            
            if (!response.ok) {
                throw await this.handleErrorResponse(response);
            }
            
            // Stability AI returns image directly
            const blob = await response.blob();
            const imageDataURL = await this.blobToDataURL(blob);
            
            this.updateHealthScore(true);
            return imageDataURL;
            
        } catch (error) {
            this.updateHealthScore(false);
            throw error;
        }
    }
    
    async blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    async validateKey() {
        try {
            const response = await fetch('https://api.stability.ai/v1/user/account', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    async getQuota() {
        try {
            const response = await fetch('https://api.stability.ai/v1/user/balance', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    remaining: data.credits,
                    limit: null, // No fixed limit, credit-based
                    resetTime: null
                };
            }
        } catch (error) {
            console.warn('Failed to fetch Stability AI quota:', error);
        }
        
        // Fallback to estimated values
        return {
            remaining: 100,
            limit: 1000,
            resetTime: this.getNextResetTime()
        };
    }
    
    async handleErrorResponse(response) {
        let errorData = {};
        
        try {
            const text = await response.text();
            errorData = JSON.parse(text);
        } catch (e) {
            // Response might not be JSON
        }
        
        switch (response.status) {
            case 401:
            case 403:
                throw new APIKeyInvalidError(this.getName(), errorData.message || 'Invalid API key');
            case 429:
                throw new RateLimitError(this.getName(), 60, errorData.message || 'Rate limit exceeded');
            case 402:
                throw new QuotaExceededError(this.getName(), null, errorData.message || 'Insufficient credits');
            default:
                throw new ProviderError(this.getName(), `HTTP_${response.status}`, errorData.message || 'Unknown error');
        }
    }
    
    getNextResetTime() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.getTime();
    }
}

// Procedural Provider - wraps existing procedural generation functions
class ProceduralProvider extends BaseAPIProvider {
    constructor() {
        super(null); // No API key required
        this.baseUrl = null; // No API endpoint needed
        this.healthScore = 100; // Always healthy
    }

    getName() {
        return 'procedural';
    }

    getRateLimits() {
        return {
            requestsPerMinute: Infinity,
            requestsPerDay: Infinity
        };
    }

    getCostPerImage() {
        return 0; // Free generation
    }

    getQuota() {
        return {
            remaining: Infinity,
            limit: Infinity,
            resetTime: null
        };
    }

    validateKey() {
        return Promise.resolve(true); // No API key validation needed
    }

    updateHealthScore(success) {
        // Increment error count on failures for observability
        if (!success) {
            this.errorCount = (this.errorCount || 0) + 1;
        }
        // Always maintain perfect health score
        this.healthScore = 100;
    }

    isHealthy() {
        return true; // Procedural generation never fails
    }

    getStatus() {
        const baseStatus = super.getStatus();
        return {
            ...baseStatus,
            cost: 0,
            quota: 'unlimited',
            apiKeyRequired: false
        };
    }

    async generateImage(prompt, options = {}) {
        try {
            this.recordRequest();

            // Extract required parameters from options
            const { category, complexity, colorSeed, index } = options;

            // Validate required parameters
            if (!category) {
                throw new ValidationError('category', category, 'Category is required for procedural generation');
            }
            if (complexity === undefined || complexity === null) {
                throw new ValidationError('complexity', complexity, 'Complexity is required for procedural generation');
            }
            if (!colorSeed) {
                throw new ValidationError('colorSeed', colorSeed, 'Color seed is required for procedural generation');
            }
            if (index === undefined || index === null) {
                throw new ValidationError('index', index, 'Index is required for procedural generation');
            }

            // Generate procedural trait
            const dataUrl = this._generateProceduralTraitInternal(category, complexity, colorSeed, index);
            
            this.updateHealthScore(true);
            return dataUrl;

        } catch (error) {
            this.updateHealthScore(false);
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ProviderError(this.getName(), 'PROCEDURAL_GENERATION_FAILED', `Procedural generation failed: ${error.message}`);
        }
    }

    _generateProceduralTraitInternal(category, complexity, colorSeed, index) {
        // Create off-screen canvas
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = validateCanvasContext(canvas);

        // Parse color seed
        const baseColor = parseColorSeed(colorSeed, category, index);

        // Calculate seed value
        const seed = seedManager.useMasterSeed 
            ? seedManager.getCategorySeed(category) + index
            : (baseColor.h + baseColor.s + baseColor.l + index) * 1000;

        // Clear canvas
        ctx.clearRect(0, 0, 500, 500);

        // Generate based on category
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
                throw new ValidationError('category', category, 'Unknown category for procedural generation');
        }

        // Convert to data URL
        return canvas.toDataURL('image/png');
    }
}

// Export classes for global usage
window.BaseAPIProvider = BaseAPIProvider;
window.GeminiProvider = GeminiProvider;
window.OpenAIProvider = OpenAIProvider;
window.StableDiffusionProvider = StableDiffusionProvider;
window.ProceduralProvider = ProceduralProvider;