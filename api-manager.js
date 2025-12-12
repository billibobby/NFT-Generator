// API Manager - Central orchestration system
// Handles provider registration, failover logic, and request coordination

// ===== GLOBAL API STATE =====

const apiState = {
    providers: [], // Array of registered provider instances
    activeProvider: null, // Currently selected provider
    failoverQueue: [], // Ordered list of fallback providers
    requestLog: [], // Array of request/response logs with timestamps
    quotaTracking: {} // Per-provider usage statistics
};

// ===== API MANAGER CLASS =====

class APIManager {
    constructor() {
        this.errorHandler = new APIErrorHandler();
        this.rateLimiters = new ProviderRateLimiters();
        this.logger = new APIRequestLogger();
        this.maxFailoverAttempts = 3;
        this.healthCheckInterval = 5 * 60 * 1000; // 5 minutes
        this.cooldownPeriod = 5 * 60 * 1000; // 5 minutes
        this.disabledProviders = new Map(); // Track disabled providers with cooldown
        
        // Start periodic health checks
        this.startHealthChecks();
    }
    
    registerProvider(provider) {
        if (!(provider instanceof BaseAPIProvider)) {
            throw new Error('Provider must extend BaseAPIProvider');
        }
        
        // Check if provider already registered
        const existingIndex = apiState.providers.findIndex(p => p.getName() === provider.getName());
        if (existingIndex !== -1) {
            // Replace existing provider
            apiState.providers[existingIndex] = provider;
        } else {
            // Add new provider
            apiState.providers.push(provider);
        }
        
        // Update failover queue
        this.updateFailoverQueue();
        
        // Set as active if no active provider
        if (!apiState.activeProvider) {
            this.setActiveProvider(provider.getName());
        }
        
        console.log(`Provider registered: ${provider.getName()}`);
        return true;
    }
    
    setActiveProvider(providerName) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider not found: ${providerName}`);
        }
        
        if (!provider.isHealthy()) {
            console.warn(`Provider ${providerName} is unhealthy, but setting as active anyway`);
        }
        
        apiState.activeProvider = provider;
        console.log(`Active provider set to: ${providerName}`);
        return true;
    }
    
    async generateImage(prompt, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            throw new ValidationError('prompt', prompt, 'Prompt must be a non-empty string');
        }
        
        const startTime = Date.now();
        let lastError = null;
        let attemptCount = 0;
        
        // Get ordered list of providers to try
        const providersToTry = this.getFailoverSequence();
        
        if (providersToTry.length === 0) {
            throw new Error('No healthy providers available');
        }
        
        for (const provider of providersToTry) {
            attemptCount++;
            
            try {
                // Check if provider is in cooldown
                if (this.isProviderInCooldown(provider.getName())) {
                    console.log(`Skipping ${provider.getName()} - in cooldown`);
                    continue;
                }
                
                // Check quota before attempting request
                const canMakeRequest = await this.rateLimiters.checkQuota(provider);
                if (!canMakeRequest) {
                    console.log(`Skipping ${provider.getName()} - quota exceeded`);
                    continue;
                }
                
                // Acquire rate limit token
                await this.rateLimiters.acquireToken(provider.getName());
                
                // Log request start
                const requestId = this.logger.logRequest(provider.getName(), prompt, options);
                
                try {
                    // Attempt image generation
                    const result = await provider.generateImage(prompt, options);
                    
                    // Log successful response
                    const duration = Date.now() - startTime;
                    this.logger.logResponse(requestId, 'success', result, duration);
                    
                    // Update provider health
                    provider.updateHealthScore(true);
                    
                    // Emit success event
                    this.emitEvent('imageGenerated', {
                        provider: provider.getName(),
                        prompt,
                        duration,
                        attempt: attemptCount
                    });
                    
                    return result;
                    
                } catch (error) {
                    // Release rate limit token on failure
                    this.rateLimiters.releaseToken(provider.getName());
                    
                    // Handle and classify error
                    const errorInfo = this.errorHandler.handleError(error, {
                        provider: provider.getName(),
                        operation: 'generateImage',
                        attempt: attemptCount
                    });
                    
                    // Log error
                    this.logger.logError(requestId, errorInfo.error);
                    
                    // Update provider health
                    provider.updateHealthScore(false);
                    
                    // Check if we should disable provider
                    if (!provider.isHealthy()) {
                        this.disableProviderTemporarily(provider.getName());
                    }
                    
                    lastError = errorInfo.error;
                    
                    // If error is not retriable or this is the last provider, break
                    if (!this.errorHandler.isRetriable(errorInfo.error) || 
                        provider === providersToTry[providersToTry.length - 1]) {
                        break;
                    }
                    
                    // Show failover notification
                    this.showFailoverNotification(provider.getName(), errorInfo.error);
                    
                    // Wait before trying next provider if needed
                    if (errorInfo.retryDelay > 0) {
                        await this.delay(Math.min(errorInfo.retryDelay, 5000)); // Max 5 second delay
                    }
                }
                
            } catch (error) {
                // Unexpected error in failover logic
                console.error(`Unexpected error with provider ${provider.getName()}:`, error);
                lastError = error;
            }
        }
        
        // All providers failed
        const totalDuration = Date.now() - startTime;
        
        // Emit failure event
        this.emitEvent('imageGenerationFailed', {
            prompt,
            attempts: attemptCount,
            duration: totalDuration,
            lastError: lastError
        });
        
        // Throw aggregated error
        throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    async validateAllProviders() {
        const results = {};
        
        for (const provider of apiState.providers) {
            try {
                const isValid = await provider.validateKey();
                results[provider.getName()] = {
                    valid: isValid,
                    error: null
                };
                
                if (isValid) {
                    provider.updateHealthScore(true);
                } else {
                    provider.updateHealthScore(false);
                }
            } catch (error) {
                results[provider.getName()] = {
                    valid: false,
                    error: error.message
                };
                provider.updateHealthScore(false);
            }
        }
        
        return results;
    }
    
    getProviderStatus() {
        return apiState.providers.map(provider => ({
            ...provider.getStatus(),
            isActive: provider === apiState.activeProvider,
            isInCooldown: this.isProviderInCooldown(provider.getName()),
            rateLimitStatus: this.rateLimiters.getStatus(provider.getName())
        }));
    }
    
    clearRequestLog() {
        this.logger.clearLogs();
        apiState.requestLog = [];
    }
    
    exportRequestLog() {
        return this.logger.exportLogs();
    }
    
    // Private helper methods
    
    getProvider(providerName) {
        return apiState.providers.find(p => p.getName() === providerName);
    }
    
    getFailoverSequence() {
        // Start with active provider if healthy
        const sequence = [];
        
        if (apiState.activeProvider && apiState.activeProvider.isHealthy() && 
            !this.isProviderInCooldown(apiState.activeProvider.getName())) {
            sequence.push(apiState.activeProvider);
        }
        
        // Add other healthy providers in failover order
        const otherProviders = apiState.failoverQueue.filter(provider => 
            provider !== apiState.activeProvider && 
            provider.isHealthy() && 
            !this.isProviderInCooldown(provider.getName())
        );
        
        sequence.push(...otherProviders);
        
        return sequence;
    }
    
    updateFailoverQueue() {
        // Default order: Gemini → Stable Diffusion → OpenAI
        const defaultOrder = ['gemini', 'stable_diffusion', 'openai'];
        
        apiState.failoverQueue = [];
        
        // Add providers in default order
        defaultOrder.forEach(providerName => {
            const provider = this.getProvider(providerName);
            if (provider) {
                apiState.failoverQueue.push(provider);
            }
        });
        
        // Add any remaining providers
        apiState.providers.forEach(provider => {
            if (!apiState.failoverQueue.includes(provider)) {
                apiState.failoverQueue.push(provider);
            }
        });
    }
    
    disableProviderTemporarily(providerName) {
        const disableUntil = Date.now() + this.cooldownPeriod;
        this.disabledProviders.set(providerName, disableUntil);
        
        console.warn(`Provider ${providerName} disabled temporarily until ${new Date(disableUntil).toISOString()}`);
        
        // Emit event
        this.emitEvent('providerDisabled', {
            provider: providerName,
            disableUntil: disableUntil
        });
    }
    
    isProviderInCooldown(providerName) {
        const disableUntil = this.disabledProviders.get(providerName);
        if (!disableUntil) return false;
        
        if (Date.now() >= disableUntil) {
            // Cooldown expired, re-enable provider
            this.disabledProviders.delete(providerName);
            console.log(`Provider ${providerName} re-enabled after cooldown`);
            return false;
        }
        
        return true;
    }
    
    showFailoverNotification(failedProvider, error) {
        // Show user-friendly notification about failover
        const message = `${failedProvider} failed (${error.name}), trying next provider...`;
        console.warn(message);
        
        // Emit event for UI to show notification
        this.emitEvent('failoverOccurred', {
            failedProvider,
            error: error.name,
            message
        });
    }
    
    startHealthChecks() {
        setInterval(async () => {
            try {
                await this.performHealthChecks();
            } catch (error) {
                console.error('Health check failed:', error);
            }
        }, this.healthCheckInterval);
    }
    
    async performHealthChecks() {
        for (const provider of apiState.providers) {
            try {
                // Update quota information
                const tracker = this.rateLimiters.getQuotaTracker(provider);
                if (tracker.shouldUpdateQuota()) {
                    await tracker.updateQuota();
                }
                
                // Check if provider should be re-enabled
                if (!provider.isHealthy() && !this.isProviderInCooldown(provider.getName())) {
                    // Try to validate key to see if provider recovered
                    const isValid = await provider.validateKey();
                    if (isValid) {
                        provider.healthScore = 50; // Partial recovery
                        console.log(`Provider ${provider.getName()} appears to have recovered`);
                    }
                }
            } catch (error) {
                console.warn(`Health check failed for ${provider.getName()}:`, error);
            }
        }
    }
    
    emitEvent(eventName, data) {
        // Emit custom events for UI integration
        window.dispatchEvent(new CustomEvent(`apiManager:${eventName}`, {
            detail: data
        }));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Public API for configuration
    
    setFailoverOrder(providerNames) {
        const newQueue = [];
        
        providerNames.forEach(name => {
            const provider = this.getProvider(name);
            if (provider) {
                newQueue.push(provider);
            }
        });
        
        // Add any remaining providers
        apiState.providers.forEach(provider => {
            if (!newQueue.includes(provider)) {
                newQueue.push(provider);
            }
        });
        
        apiState.failoverQueue = newQueue;
        console.log('Failover order updated:', providerNames);
    }
    
    getConfiguration() {
        return {
            activeProvider: apiState.activeProvider?.getName() || null,
            failoverOrder: apiState.failoverQueue.map(p => p.getName()),
            providerStatus: this.getProviderStatus(),
            statistics: this.logger.getStatistics()
        };
    }
    
    // Automatic failover system implementation
    async executeWithFailover(operation, context = {}) {
        const providersToTry = this.getFailoverSequence();
        let lastError = null;
        
        for (let i = 0; i < providersToTry.length; i++) {
            const provider = providersToTry[i];
            
            try {
                context.provider = provider.getName();
                context.attempt = i + 1;
                
                const result = await operation(provider, context);
                
                // Success - update health and return
                provider.updateHealthScore(true);
                return result;
                
            } catch (error) {
                lastError = error;
                provider.updateHealthScore(false);
                
                // Check if we should continue to next provider
                const errorInfo = this.errorHandler.handleError(error, context);
                
                if (errorInfo.action === 'fail' || i === providersToTry.length - 1) {
                    break;
                }
                
                // Wait before trying next provider
                if (errorInfo.retryDelay > 0) {
                    await this.delay(Math.min(errorInfo.retryDelay, 5000));
                }
            }
        }
        
        throw lastError || new Error('All providers failed');
    }
}

// Export for global usage
window.APIManager = APIManager;
window.apiState = apiState;