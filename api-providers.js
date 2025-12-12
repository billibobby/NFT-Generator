// API Provider Implementations
// Abstract provider interface and concrete implementations for AI services

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
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `Generate an image: ${prompt}`
                }]
            }],
            generationConfig: {
                temperature: options.temperature || 0.7,
                maxOutputTokens: options.maxTokens || 1024
            }
        };
        
        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw await this.handleErrorResponse(response);
            }
            
            const data = await response.json();
            
            // Gemini returns text, not images directly
            // This is a placeholder - actual implementation would need image generation capability
            const imageData = await this.convertTextToImage(data.candidates[0].content.parts[0].text);
            
            this.updateHealthScore(true);
            return imageData;
            
        } catch (error) {
            this.updateHealthScore(false);
            throw error;
        }
    }
    
    async convertTextToImage(text) {
        // Placeholder for text-to-image conversion
        // In reality, Gemini would need to be used with a different endpoint or model
        // For now, return a placeholder data URL
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Gemini Generated', 256, 256);
        ctx.fillText(text.substring(0, 50), 256, 280);
        
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
        return 'stable_diffusion';
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

// Export classes for global usage
window.BaseAPIProvider = BaseAPIProvider;
window.GeminiProvider = GeminiProvider;
window.OpenAIProvider = OpenAIProvider;
window.StableDiffusionProvider = StableDiffusionProvider;