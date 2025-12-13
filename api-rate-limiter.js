// API Rate Limiting and Quota Management
// Token bucket algorithm implementation for client-side rate limiting

// ===== RATE LIMITER CLASS =====

class RateLimiter {
    constructor(capacity, refillRate, refillInterval = 1000) {
        this.capacity = capacity; // Maximum tokens in bucket
        this.refillRate = refillRate; // Tokens added per interval
        this.refillInterval = refillInterval; // Interval in milliseconds
        this.tokens = capacity; // Current available tokens
        this.lastRefill = Date.now();
        this.queue = []; // Queue for pending requests
        this.maxQueueSize = 50;
        this.queueTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    async acquireToken() {
        return new Promise((resolve, reject) => {
            this.refillTokens();
            
            if (this.tokens >= 1) {
                // Token available immediately
                this.tokens -= 1;
                resolve();
            } else {
                // Need to queue the request
                if (this.queue.length >= this.maxQueueSize) {
                    reject(new Error('Request queue is full'));
                    return;
                }
                
                const queueItem = {
                    resolve,
                    reject,
                    timestamp: Date.now()
                };
                
                this.queue.push(queueItem);
                
                // Set timeout for queued request
                setTimeout(() => {
                    const index = this.queue.indexOf(queueItem);
                    if (index !== -1) {
                        this.queue.splice(index, 1);
                        reject(new Error('Request timed out in queue'));
                    }
                }, this.queueTimeout);
                
                // Start processing queue
                this.processQueue();
            }
        });
    }
    
    releaseToken() {
        // Return token to bucket (for failed requests)
        if (this.tokens < this.capacity) {
            this.tokens += 1;
        }
    }
    
    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        
        if (timePassed >= this.refillInterval) {
            const tokensToAdd = Math.floor(timePassed / this.refillInterval) * this.refillRate;
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }
    
    processQueue() {
        if (this.queue.length === 0) return;
        
        const processNext = () => {
            this.refillTokens();
            
            if (this.tokens >= 1 && this.queue.length > 0) {
                const queueItem = this.queue.shift();
                this.tokens -= 1;
                queueItem.resolve();
                
                // Continue processing if more tokens available
                if (this.tokens >= 1 && this.queue.length > 0) {
                    setTimeout(processNext, 0);
                }
            }
            
            // Schedule next check
            if (this.queue.length > 0) {
                setTimeout(processNext, this.refillInterval);
            }
        };
        
        setTimeout(processNext, this.getWaitTime());
    }
    
    getWaitTime() {
        this.refillTokens();
        
        if (this.tokens >= 1) {
            return 0;
        }
        
        // Calculate time until next token is available
        const timeSinceLastRefill = Date.now() - this.lastRefill;
        const timeUntilNextRefill = this.refillInterval - timeSinceLastRefill;
        
        return Math.max(0, timeUntilNextRefill);
    }
    
    reset() {
        this.tokens = this.capacity;
        this.lastRefill = Date.now();
        
        // Reject all queued requests
        while (this.queue.length > 0) {
            const queueItem = this.queue.shift();
            queueItem.reject(new Error('Rate limiter was reset'));
        }
    }
    
    getStatus() {
        this.refillTokens();
        return {
            tokens: this.tokens,
            capacity: this.capacity,
            queueLength: this.queue.length,
            waitTime: this.getWaitTime()
        };
    }
}

// ===== QUOTA TRACKER CLASS =====

class QuotaTracker {
    constructor(provider) {
        this.provider = provider;
        this.quotaData = {
            remaining: null,
            limit: null,
            resetTime: null,
            lastUpdated: null
        };
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.warningThreshold = 0.8; // 80%
        this.blockingThreshold = 0.95; // 95%
    }
    
    async updateQuota() {
        try {
            const quota = await this.provider.getQuota();
            this.quotaData = {
                ...quota,
                lastUpdated: Date.now()
            };
            
            this.checkThresholds();
            return this.quotaData;
        } catch (error) {
            console.warn(`Failed to update quota for ${this.provider.getName()}:`, error);
            return this.quotaData;
        }
    }
    
    checkThresholds() {
        if (!this.quotaData.remaining || !this.quotaData.limit) return;
        
        const usageRatio = 1 - (this.quotaData.remaining / this.quotaData.limit);
        
        if (usageRatio >= this.blockingThreshold) {
            console.error(`${this.provider.getName()}: Quota nearly exhausted (${Math.round(usageRatio * 100)}%)`);
            this.onQuotaBlocking();
        } else if (usageRatio >= this.warningThreshold) {
            console.warn(`${this.provider.getName()}: Quota warning (${Math.round(usageRatio * 100)}%)`);
            this.onQuotaWarning();
        }
    }
    
    onQuotaWarning() {
        // Emit warning event or show notification
        window.dispatchEvent(new CustomEvent('quotaWarning', {
            detail: {
                provider: this.provider.getName(),
                usage: this.getUsagePercentage()
            }
        }));
    }
    
    onQuotaBlocking() {
        // Emit blocking event
        window.dispatchEvent(new CustomEvent('quotaBlocking', {
            detail: {
                provider: this.provider.getName(),
                resetTime: this.quotaData.resetTime
            }
        }));
    }
    
    getUsagePercentage() {
        if (!this.quotaData.remaining || !this.quotaData.limit) return 0;
        return Math.round((1 - (this.quotaData.remaining / this.quotaData.limit)) * 100);
    }
    
    canMakeRequest() {
        if (!this.quotaData.remaining) return true; // Unknown quota, allow request
        
        const usageRatio = 1 - (this.quotaData.remaining / this.quotaData.limit);
        return usageRatio < this.blockingThreshold;
    }
    
    shouldUpdateQuota() {
        if (!this.quotaData.lastUpdated) return true;
        
        const timeSinceUpdate = Date.now() - this.quotaData.lastUpdated;
        return timeSinceUpdate >= this.updateInterval;
    }
}

// ===== PROVIDER-SPECIFIC RATE LIMITERS =====

class ProviderRateLimiters {
    constructor() {
        this.limiters = new Map();
        this.quotaTrackers = new Map();
        
        // Default rate limits per provider
        this.defaultLimits = {
            'gemini': { capacity: 60, refillRate: 1, interval: 1000 }, // 60 RPM
            'openai': { capacity: 15, refillRate: 1, interval: 4000 }, // 15 per minute (Tier 5)
            'stablediffusion': { capacity: 30, refillRate: 1, interval: 2000 } // 30 per minute
        };
    }
    
    getRateLimiter(providerName) {
        if (!this.limiters.has(providerName)) {
            const limits = this.defaultLimits[providerName] || this.defaultLimits['gemini'];
            const limiter = new RateLimiter(limits.capacity, limits.refillRate, limits.interval);
            this.limiters.set(providerName, limiter);
        }
        
        return this.limiters.get(providerName);
    }
    
    getQuotaTracker(provider) {
        const providerName = provider.getName();
        
        if (!this.quotaTrackers.has(providerName)) {
            const tracker = new QuotaTracker(provider);
            this.quotaTrackers.set(providerName, tracker);
        }
        
        return this.quotaTrackers.get(providerName);
    }
    
    async acquireToken(providerName) {
        const limiter = this.getRateLimiter(providerName);
        return await limiter.acquireToken();
    }
    
    releaseToken(providerName) {
        const limiter = this.getRateLimiter(providerName);
        limiter.releaseToken();
    }
    
    async checkQuota(provider) {
        const tracker = this.getQuotaTracker(provider);
        
        if (tracker.shouldUpdateQuota()) {
            await tracker.updateQuota();
        }
        
        return tracker.canMakeRequest();
    }
    
    updateLimits(providerName, limits) {
        // Allow dynamic rate limit updates
        this.defaultLimits[providerName] = limits;
        
        // Reset existing limiter to apply new limits
        if (this.limiters.has(providerName)) {
            this.limiters.delete(providerName);
        }
    }
    
    getStatus(providerName) {
        const limiter = this.limiters.get(providerName);
        const tracker = this.quotaTrackers.get(providerName);
        
        return {
            rateLimiter: limiter ? limiter.getStatus() : null,
            quota: tracker ? {
                remaining: tracker.quotaData.remaining,
                limit: tracker.quotaData.limit,
                usagePercentage: tracker.getUsagePercentage(),
                canMakeRequest: tracker.canMakeRequest()
            } : null
        };
    }
    
    resetAll() {
        // Reset all rate limiters
        for (const limiter of this.limiters.values()) {
            limiter.reset();
        }
    }
}

// Export classes for global usage
window.RateLimiter = RateLimiter;
window.QuotaTracker = QuotaTracker;
window.ProviderRateLimiters = ProviderRateLimiters;