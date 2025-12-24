// NFT Generator - Batch Request Optimizer
// Optimize API calls through parallel processing and request deduplication

class BatchOptimizer {
    // Configuration constants
    static DEFAULT_MAX_CONCURRENCY = 5;
    static DEFAULT_MAX_QUEUE_ITERATIONS = 1000;
    static REQUEST_TIMEOUT_MS = 300000; // 5 minutes
    static QUEUE_PROCESSING_DELAY_MS = 100;
    static ITERATION_WARNING_THRESHOLD = 50;

    constructor() {
        this.maxConcurrency = BatchOptimizer.DEFAULT_MAX_CONCURRENCY;
        this.requestQueue = [];
        this.activeRequests = new Map();
        this.pendingRequests = new Map(); // Track in-flight requests for deduplication
        this.isProcessing = false;
        this.queueIterations = 0;
        this.maxQueueIterations = BatchOptimizer.DEFAULT_MAX_QUEUE_ITERATIONS;
        this.stats = {
            totalRequests: 0,
            deduplicatedRequests: 0,
            completedBatches: 0,
            averageLatency: 0,
            successRate: 0
        };
    }

    initialize(config = {}) {
        this.maxConcurrency = config.maxConcurrency || BatchOptimizer.DEFAULT_MAX_CONCURRENCY;
        this.priorityLevels = config.priorityLevels || ['high', 'medium', 'low'];
        
        console.log(`Batch Optimizer initialized with concurrency: ${this.maxConcurrency}`);
        return true;
    }

    async generateBatch(requests, options = {}) {
        const batchId = this.generateBatchId();
        const maxConcurrency = options.maxConcurrency || this.maxConcurrency;
        const priority = options.priority || 'medium';

        console.log(`Starting batch ${batchId} with ${requests.length} requests, concurrency: ${maxConcurrency}`);

        // Deduplicate requests
        const { uniqueRequests, duplicateMap } = this.deduplicateRequests(requests);
        
        this.emitEvent('batch:started', {
            batchId,
            totalRequests: requests.length,
            uniqueRequests: uniqueRequests.length,
            deduplicatedCount: requests.length - uniqueRequests.length
        });

        // Process requests in parallel batches
        const results = await this.processRequestsInParallel(uniqueRequests, maxConcurrency, batchId);

        // Map results back to original request order, handling duplicates
        const finalResults = this.mapResultsToOriginalOrder(requests, results, uniqueRequests, duplicateMap);

        this.stats.completedBatches++;
        this.stats.totalRequests += requests.length;
        this.stats.deduplicatedRequests += requests.length - uniqueRequests.length;

        this.emitEvent('batch:completed', {
            batchId,
            results: finalResults,
            stats: this.getStats()
        });

        return finalResults;
    }

    deduplicateRequests(requests) {
        const uniqueRequests = [];
        const duplicateMap = new Map();
        const seenHashes = new Map();

        requests.forEach((request, originalIndex) => {
            const hash = this.generateRequestHash(request);
            
            if (seenHashes.has(hash)) {
                // This is a duplicate - map it to the first occurrence
                const firstIndex = seenHashes.get(hash);
                if (!duplicateMap.has(firstIndex)) {
                    duplicateMap.set(firstIndex, []);
                }
                duplicateMap.get(firstIndex).push(originalIndex);
            } else {
                // This is unique
                seenHashes.set(hash, uniqueRequests.length);
                uniqueRequests.push({
                    ...request,
                    originalIndex,
                    hash
                });
            }
        });

        return { uniqueRequests, duplicateMap };
    }

    generateRequestHash(request) {
        // Create a hash based on request parameters that affect the result
        const hashData = {
            category: request.category,
            complexity: request.complexity,
            colorSeed: request.colorSeed,
            index: request.index,
            prompt: request.prompt || '',
            provider: request.provider || 'auto'
        };

        return btoa(JSON.stringify(hashData)).replace(/[^a-zA-Z0-9]/g, '');
    }

    async processRequestsInParallel(requests, maxConcurrency, batchId) {
        const results = new Array(requests.length);
        const semaphore = new Semaphore(maxConcurrency);
        const startTime = Date.now();

        // Create promises for all requests
        const requestPromises = requests.map(async (request, index) => {
            await semaphore.acquire();
            
            try {
                const requestStartTime = Date.now();
                
                // Check if this request is already in flight
                const pendingResult = await this.checkPendingRequest(request.hash);
                if (pendingResult) {
                    results[index] = pendingResult;
                    return;
                }

                // Mark request as in-flight
                this.markRequestPending(request.hash);

                // Execute the actual request
                const result = await this.executeRequest(request, batchId, index);
                results[index] = result;

                // Update stats
                const latency = Date.now() - requestStartTime;
                this.updateLatencyStats(latency);

                // Share result with any duplicate requests
                this.shareResultWithPending(request.hash, result);

                this.emitEvent('batch:progress', {
                    batchId,
                    completed: index + 1,
                    total: requests.length,
                    latency
                });

            } catch (error) {
                console.error(`Request ${index} failed:`, error);
                results[index] = { error: error.message, success: false };
                this.clearPendingRequest(request.hash);
            } finally {
                semaphore.release();
            }
        });

        // Wait for all requests to complete
        await Promise.all(requestPromises);

        const totalTime = Date.now() - startTime;
        console.log(`Batch ${batchId} completed in ${totalTime}ms`);

        return results;
    }

    async executeRequest(request, batchId, index) {
        // This method will be called by the AIGenerationCoordinator
        // For now, it's a placeholder that should be overridden
        if (this.requestExecutor) {
            return await this.requestExecutor(request, batchId, index);
        }

        throw new Error('No request executor configured');
    }

    setRequestExecutor(executor) {
        this.requestExecutor = executor;
    }

    async checkPendingRequest(hash) {
        if (this.pendingRequests.has(hash)) {
            const requestData = this.pendingRequests.get(hash);
            const pendingPromise = requestData?.promise;
            try {
                return await pendingPromise;
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    markRequestPending(hash) {
        if (!this.pendingRequests.has(hash)) {
            // Create a promise that will be resolved when the request completes
            let resolvePromise, rejectPromise;
            const promise = new Promise((resolve, reject) => {
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            
            promise.resolve = resolvePromise;
            promise.reject = rejectPromise;
            
            // Set timeout for cleanup
            const timeoutId = setTimeout(() => {
                console.warn(`Request timeout for hash ${hash}, cleaning up pending request`);
                this.clearPendingRequest(hash);
            }, BatchOptimizer.REQUEST_TIMEOUT_MS);
            
            const requestData = {
                promise,
                timeoutId,
                createdAt: Date.now()
            };
            
            this.pendingRequests.set(hash, requestData);
        }
    }

    shareResultWithPending(hash, result) {
        if (this.pendingRequests.has(hash)) {
            const requestData = this.pendingRequests.get(hash);
            
            // Clear timeout
            if (requestData.timeoutId) {
                clearTimeout(requestData.timeoutId);
            }
            
            // Resolve promise
            if (requestData.promise && requestData.promise.resolve) {
                requestData.promise.resolve(result);
            }
            
            this.pendingRequests.delete(hash);
        }
    }

    clearPendingRequest(hash) {
        if (this.pendingRequests.has(hash)) {
            const requestData = this.pendingRequests.get(hash);
            
            // Clear timeout if it exists
            if (requestData.timeoutId) {
                clearTimeout(requestData.timeoutId);
            }
            
            // Reject promise with timeout error
            if (requestData.promise && requestData.promise.reject) {
                requestData.promise.reject(new Error('Request timeout or failed'));
            }
            
            this.pendingRequests.delete(hash);
        }
    }

    cleanupExpiredRequests() {
        const now = Date.now();
        const expiredHashes = [];
        
        this.pendingRequests.forEach((requestData, hash) => {
            if (now - requestData.createdAt > BatchOptimizer.REQUEST_TIMEOUT_MS) {
                expiredHashes.push(hash);
            }
        });
        
        expiredHashes.forEach(hash => {
            console.warn(`Cleaning up expired request: ${hash}`);
            this.clearPendingRequest(hash);
        });
    }

    mapResultsToOriginalOrder(originalRequests, results, uniqueRequests, duplicateMap) {
        const finalResults = new Array(originalRequests.length);

        // First, place unique results at their original positions
        results.forEach((result, uniqueIndex) => {
            // Get the original index from the unique request
            const originalIndex = uniqueRequests[uniqueIndex].originalIndex;
            finalResults[originalIndex] = result;
        });

        // Then, copy results to duplicate positions
        duplicateMap.forEach((duplicateIndices, uniqueIndex) => {
            // Get the result for this unique request
            const result = results[uniqueIndex];
            // Copy to all duplicate positions
            duplicateIndices.forEach(dupIndex => {
                finalResults[dupIndex] = { ...result }; // Clone the result
            });
        });

        return finalResults;
    }

    // Smart batching strategies
    groupRequestsByProvider(requests) {
        const groups = {};
        
        requests.forEach(request => {
            const provider = request.provider || 'auto';
            if (!groups[provider]) {
                groups[provider] = [];
            }
            groups[provider].push(request);
        });

        return groups;
    }

    optimizeBatchSize(provider, baseSize = 5) {
        // Adjust batch size based on provider health and rate limits
        const providerHealth = this.getProviderHealth(provider);
        const rateLimitInfo = this.getRateLimitInfo(provider);

        let optimizedSize = baseSize;

        // Reduce batch size for unhealthy providers
        if (providerHealth < 0.8) {
            optimizedSize = Math.max(1, Math.floor(baseSize * providerHealth));
        }

        // Adjust for rate limits
        if (rateLimitInfo && rateLimitInfo.remaining < baseSize) {
            optimizedSize = Math.min(optimizedSize, rateLimitInfo.remaining);
        }

        return Math.max(1, optimizedSize);
    }

    getProviderHealth(provider) {
        // This would integrate with APIManager to get provider health
        if (window.apiManager) {
            const status = window.apiManager.getProviderStatus();
            const providerStatus = status.find(p => p.name === provider);
            return providerStatus ? (providerStatus.isHealthy ? 1.0 : 0.5) : 0.8;
        }
        return 0.8; // Default health
    }

    getRateLimitInfo(provider) {
        // This would integrate with rate limiter to get current limits
        if (window.apiRateLimiter) {
            return window.apiRateLimiter.getTokenCount(provider);
        }
        return null;
    }

    // Progress tracking and ETA calculation
    calculateETA(completed, total, startTime) {
        if (completed === 0) return null;

        const elapsed = Date.now() - startTime;
        const avgTimePerRequest = elapsed / completed;
        const remaining = total - completed;
        const eta = remaining * avgTimePerRequest;

        return {
            eta: eta,
            etaFormatted: this.formatDuration(eta),
            avgTimePerRequest,
            estimatedCompletion: new Date(Date.now() + eta)
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Statistics and monitoring
    updateLatencyStats(latency) {
        // Simple moving average for latency
        if (this.stats.averageLatency === 0) {
            this.stats.averageLatency = latency;
        } else {
            this.stats.averageLatency = (this.stats.averageLatency * 0.9) + (latency * 0.1);
        }
    }

    getStats() {
        return {
            ...this.stats,
            activeRequests: this.activeRequests.size,
            pendingRequests: this.pendingRequests.size,
            queueLength: this.requestQueue.length,
            deduplicationRate: this.stats.totalRequests > 0 ? 
                (this.stats.deduplicatedRequests / this.stats.totalRequests) * 100 : 0
        };
    }

    // Queue management for priority-based processing
    addToQueue(request, priority = 'medium') {
        const queueItem = {
            ...request,
            priority,
            queuedAt: Date.now(),
            id: this.generateRequestId()
        };

        this.requestQueue.push(queueItem);
        this.sortQueueByPriority();

        if (!this.isProcessing) {
            this.processQueue();
        }

        return queueItem.id;
    }

    sortQueueByPriority() {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        
        this.requestQueue.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 1;
            const bPriority = priorityOrder[b.priority] || 1;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            return a.queuedAt - b.queuedAt; // FIFO for same priority
        });
    }

    async processQueue() {
        // Increment iteration counter and check limit
        this.queueIterations++;
        if (this.queueIterations >= this.maxQueueIterations) {
            console.error(`Queue processing iteration limit exceeded (${this.maxQueueIterations}). Resetting queue to prevent infinite loop.`);
            this.resetQueueState();
            return;
        }
        
        if (this.isProcessing || this.requestQueue.length === 0) {
            // Reset iterations when queue is empty and processing completes
            if (this.requestQueue.length === 0) {
                this.queueIterations = 0;
            }
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrency) {
            const request = this.requestQueue.shift();
            this.processQueuedRequest(request);
        }

        this.isProcessing = false;

        // Continue processing if there are more items in queue
        if (this.requestQueue.length > 0) {
            // Check if approaching iteration limit
            if (this.queueIterations >= this.maxQueueIterations - BatchOptimizer.ITERATION_WARNING_THRESHOLD) {
                console.warn(`Queue processing approaching iteration limit. Current: ${this.queueIterations}, Max: ${this.maxQueueIterations}`);
            }
            setTimeout(() => this.processQueue(), BatchOptimizer.QUEUE_PROCESSING_DELAY_MS);
        } else {
            // Reset iterations when queue is empty
            this.queueIterations = 0;
        }
    }

    async processQueuedRequest(request) {
        this.activeRequests.set(request.id, request);

        try {
            const result = await this.executeRequest(request);
            this.emitEvent('batch:requestCompleted', {
                requestId: request.id,
                result,
                success: true
            });
        } catch (error) {
            console.error(`Queued request ${request.id} failed:`, error);
            this.emitEvent('batch:requestCompleted', {
                requestId: request.id,
                error: error.message,
                success: false
            });
        } finally {
            this.activeRequests.delete(request.id);
            
            // Continue processing queue
            setTimeout(() => this.processQueue(), 0);
        }
    }

    // Utility methods
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    emitEvent(eventName, detail) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    // Configuration methods
    setMaxConcurrency(concurrency) {
        this.maxConcurrency = Math.max(1, Math.min(20, concurrency));
        console.log(`Batch optimizer concurrency set to: ${this.maxConcurrency}`);
    }

    getConfiguration() {
        return {
            maxConcurrency: this.maxConcurrency,
            priorityLevels: this.priorityLevels,
            stats: this.getStats()
        };
    }

    reset() {
        this.requestQueue = [];
        this.activeRequests.clear();
        this.pendingRequests.clear();
        this.isProcessing = false;
        this.queueIterations = 0;
        this.stats = {
            totalRequests: 0,
            deduplicatedRequests: 0,
            completedBatches: 0,
            averageLatency: 0,
            successRate: 0
        };
    }

    resetQueueState() {
        console.warn('Resetting queue state due to processing issues');
        this.requestQueue = [];
        this.queueIterations = 0;
        this.isProcessing = false;
        
        // Clean up any pending requests
        this.cleanupExpiredRequests();
    }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.currentConcurrency = 0;
        this.waitQueue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.currentConcurrency < this.maxConcurrency) {
                this.currentConcurrency++;
                resolve();
            } else {
                this.waitQueue.push(resolve);
            }
        });
    }

    release() {
        this.currentConcurrency--;
        
        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift();
            this.currentConcurrency++;
            resolve();
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BatchOptimizer, Semaphore };
} else if (typeof window !== 'undefined') {
    window.BatchOptimizer = BatchOptimizer;
    window.Semaphore = Semaphore;
}