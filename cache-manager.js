// NFT Generator - IndexedDB Cache Manager
// Persistent caching layer for generated trait images across sessions

class ImageCacheManager {
    constructor() {
        this.db = null;
        this.dbName = 'nft-generator-cache';
        this.dbVersion = 1;
        this.isInitialized = false;
        this.fallbackCache = new Map(); // In-memory fallback
        this.maxCacheSize = 500 * 1024 * 1024; // 500MB
        this.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        this.stats = {
            hits: 0,
            misses: 0,
            stores: 0,
            totalSize: 0,
            entryCount: 0
        };
    }

    async initialize() {
        try {
            if (!window.indexedDB) {
                console.warn('IndexedDB not available, using in-memory cache fallback');
                return false;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('Failed to open IndexedDB:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.isInitialized = true;
                    console.log('IndexedDB cache manager initialized');
                    this.loadStats();
                    resolve(true);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // Create traitImages store
                    if (!db.objectStoreNames.contains('traitImages')) {
                        const traitStore = db.createObjectStore('traitImages', { keyPath: 'cacheKey' });
                        traitStore.createIndex('category', 'category', { unique: false });
                        traitStore.createIndex('timestamp', 'timestamp', { unique: false });
                        traitStore.createIndex('provider', 'provider', { unique: false });
                    }

                    // Create cacheMetadata store
                    if (!db.objectStoreNames.contains('cacheMetadata')) {
                        db.createObjectStore('cacheMetadata', { keyPath: 'key' });
                    }

                    // Create configHashes store
                    if (!db.objectStoreNames.contains('configHashes')) {
                        db.createObjectStore('configHashes', { keyPath: 'category' });
                    }

                    // QA Metadata Store
                    if (!db.objectStoreNames.contains('qaMetadata')) {
                        const qaStore = db.createObjectStore('qaMetadata', { keyPath: 'cacheKey' });
                        qaStore.createIndex('category', 'category', { unique: false });
                        qaStore.createIndex('approved', 'approved', { unique: false });
                        qaStore.createIndex('score', 'score', { unique: false });
                        qaStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    // Regeneration Queue Store
                    if (!db.objectStoreNames.contains('regenerationQueue')) {
                        const regenStore = db.createObjectStore('regenerationQueue', { keyPath: 'id', autoIncrement: true });
                        regenStore.createIndex('category', 'category', { unique: false });
                        regenStore.createIndex('status', 'status', { unique: false }); // 'pending', 'processing', 'completed', 'failed'
                        regenStore.createIndex('priority', 'priority', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.error('Cache manager initialization failed:', error);
            return false;
        }
    }

    generateCacheKey(category, complexity, colorSeed, index) {
        return `${category}_${complexity}_${colorSeed}_${index}`;
    }

    async get(cacheKey) {
        if (!this.isInitialized) {
            return this.fallbackCache.get(cacheKey) || null;
        }

        try {
            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const request = store.get(cacheKey);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        // Update access timestamp
                        result.lastAccessed = Date.now();
                        store.put(result);
                        
                        this.stats.hits++;
                        this.emitEvent('cacheManager:hit', { cacheKey, size: result.size });
                        resolve(result);
                    } else {
                        this.stats.misses++;
                        this.emitEvent('cacheManager:miss', { cacheKey });
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error('Cache get error:', request.error);
                    this.stats.misses++;
                    resolve(null);
                };
            });
        } catch (error) {
            console.error('Cache get failed:', error);
            return this.fallbackCache.get(cacheKey) || null;
        }
    }

    async set(cacheKey, imageData, metadata = {}) {
        const cacheEntry = {
            cacheKey,
            imageData,
            category: metadata.category || 'unknown',
            provider: metadata.provider || 'unknown',
            cost: metadata.cost || 0,
            size: this.calculateSize(imageData),
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            complexity: metadata.complexity || 0,
            colorSeed: metadata.colorSeed || '',
            index: metadata.index || 0
        };

        if (!this.isInitialized) {
            this.fallbackCache.set(cacheKey, cacheEntry);
            return true;
        }

        try {
            // Check if adding this entry would exceed cache size limit
            if (this.stats.totalSize + cacheEntry.size > this.maxCacheSize) {
                await this.cleanup();
            }

            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const request = store.put(cacheEntry);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    this.stats.stores++;
                    this.stats.totalSize += cacheEntry.size;
                    this.stats.entryCount++;
                    this.saveStats();
                    this.emitEvent('cacheManager:stored', { cacheKey, size: cacheEntry.size });
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('Cache set error:', request.error);
                    resolve(false);
                };
            });
        } catch (error) {
            console.error('Cache set failed:', error);
            this.fallbackCache.set(cacheKey, cacheEntry);
            return false;
        }
    }

    async has(cacheKey) {
        if (!this.isInitialized) {
            return this.fallbackCache.has(cacheKey);
        }

        try {
            const transaction = this.db.transaction(['traitImages'], 'readonly');
            const store = transaction.objectStore('traitImages');
            const request = store.count(cacheKey);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result > 0);
                };

                request.onerror = () => {
                    resolve(false);
                };
            });
        } catch (error) {
            return this.fallbackCache.has(cacheKey);
        }
    }

    async delete(cacheKey) {
        if (!this.isInitialized) {
            return this.fallbackCache.delete(cacheKey);
        }

        try {
            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const request = store.delete(cacheKey);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    this.stats.entryCount = Math.max(0, this.stats.entryCount - 1);
                    this.saveStats();
                    resolve(true);
                };

                request.onerror = () => {
                    resolve(false);
                };
            });
        } catch (error) {
            return this.fallbackCache.delete(cacheKey);
        }
    }

    async clear() {
        if (!this.isInitialized) {
            this.fallbackCache.clear();
            return true;
        }

        try {
            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const request = store.clear();

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    this.stats.totalSize = 0;
                    this.stats.entryCount = 0;
                    this.saveStats();
                    console.log('Cache cleared successfully');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('Cache clear error:', request.error);
                    resolve(false);
                };
            });
        } catch (error) {
            console.error('Cache clear failed:', error);
            this.fallbackCache.clear();
            return false;
        }
    }

    async getStats() {
        if (!this.isInitialized) {
            return {
                ...this.stats,
                hitRate: this.stats.hits + this.stats.misses > 0 ? 
                    (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0,
                isIndexedDB: false
            };
        }

        try {
            // Recalculate actual stats from database
            const transaction = this.db.transaction(['traitImages'], 'readonly');
            const store = transaction.objectStore('traitImages');
            const countRequest = store.count();

            return new Promise((resolve) => {
                countRequest.onsuccess = () => {
                    const actualCount = countRequest.result;
                    const hitRate = this.stats.hits + this.stats.misses > 0 ? 
                        (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

                    resolve({
                        ...this.stats,
                        entryCount: actualCount,
                        hitRate,
                        isIndexedDB: true,
                        maxCacheSize: this.maxCacheSize,
                        maxAge: this.maxAge
                    });
                };

                countRequest.onerror = () => {
                    resolve({
                        ...this.stats,
                        hitRate: 0,
                        isIndexedDB: false
                    });
                };
            });
        } catch (error) {
            return {
                ...this.stats,
                hitRate: 0,
                isIndexedDB: false
            };
        }
    }

    async cleanup(maxAge = this.maxAge, maxSize = this.maxCacheSize) {
        if (!this.isInitialized) {
            // Simple LRU cleanup for fallback cache
            if (this.fallbackCache.size > 500) {
                const entries = Array.from(this.fallbackCache.entries());
                entries.sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
                
                // Remove oldest 25% of entries
                const toRemove = Math.floor(entries.length * 0.25);
                for (let i = 0; i < toRemove; i++) {
                    this.fallbackCache.delete(entries[i][0]);
                }
            }
            return;
        }

        try {
            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const index = store.index('timestamp');
            const request = index.openCursor();

            const now = Date.now();
            let totalSize = 0;
            const entriesToDelete = [];

            return new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const entry = cursor.value;
                        const age = now - entry.timestamp;

                        // Mark for deletion if too old
                        if (age > maxAge) {
                            entriesToDelete.push(entry.cacheKey);
                        } else {
                            totalSize += entry.size || 0;
                        }

                        cursor.continue();
                    } else {
                        // Delete old entries
                        const deletePromises = entriesToDelete.map(key => {
                            return new Promise((deleteResolve) => {
                                const deleteRequest = store.delete(key);
                                deleteRequest.onsuccess = () => deleteResolve();
                                deleteRequest.onerror = () => deleteResolve();
                            });
                        });

                        Promise.all(deletePromises).then(() => {
                            // If still over size limit, remove oldest entries
                            if (totalSize > maxSize) {
                                this.cleanupBySize(maxSize - totalSize);
                            }

                            this.stats.entryCount -= entriesToDelete.length;
                            this.stats.totalSize = Math.max(0, this.stats.totalSize - entriesToDelete.length * 50000); // Estimate
                            this.saveStats();

                            console.log(`Cache cleanup completed: removed ${entriesToDelete.length} entries`);
                            resolve();
                        });
                    }
                };

                request.onerror = () => {
                    console.error('Cache cleanup error:', request.error);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Cache cleanup failed:', error);
        }
    }

    async cleanupBySize(targetReduction) {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['traitImages'], 'readwrite');
            const store = transaction.objectStore('traitImages');
            const request = store.openCursor();

            const entries = [];

            return new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        entries.push({
                            key: cursor.value.cacheKey,
                            lastAccessed: cursor.value.lastAccessed || 0,
                            size: cursor.value.size || 0
                        });
                        cursor.continue();
                    } else {
                        // Sort by last accessed (LRU)
                        entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

                        let removedSize = 0;
                        const deletePromises = [];

                        for (const entry of entries) {
                            if (removedSize >= Math.abs(targetReduction)) break;

                            deletePromises.push(new Promise((deleteResolve) => {
                                const deleteRequest = store.delete(entry.key);
                                deleteRequest.onsuccess = () => deleteResolve();
                                deleteRequest.onerror = () => deleteResolve();
                            }));

                            removedSize += entry.size;
                        }

                        Promise.all(deletePromises).then(() => {
                            console.log(`Size-based cleanup: removed ${deletePromises.length} entries, freed ${removedSize} bytes`);
                            resolve();
                        });
                    }
                };

                request.onerror = () => resolve();
            });
        } catch (error) {
            console.error('Size-based cleanup failed:', error);
        }
    }

    calculateSize(imageData) {
        if (typeof imageData === 'string') {
            // Data URL - estimate size
            return Math.round(imageData.length * 0.75); // Base64 overhead
        } else if (imageData instanceof Blob) {
            return imageData.size;
        } else if (imageData instanceof ArrayBuffer) {
            return imageData.byteLength;
        }
        return 0;
    }

    async loadStats() {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['cacheMetadata'], 'readonly');
            const store = transaction.objectStore('cacheMetadata');
            const request = store.get('stats');

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        Object.assign(this.stats, request.result.data);
                    }
                    resolve();
                };

                request.onerror = () => resolve();
            });
        } catch (error) {
            console.error('Failed to load cache stats:', error);
        }
    }

    async saveStats() {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['cacheMetadata'], 'readwrite');
            const store = transaction.objectStore('cacheMetadata');
            const request = store.put({
                key: 'stats',
                data: this.stats,
                timestamp: Date.now()
            });

            request.onerror = () => {
                console.error('Failed to save cache stats:', request.error);
            };
        } catch (error) {
            console.error('Failed to save cache stats:', error);
        }
    }

    emitEvent(eventName, detail) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    // Compression integration methods
    async storeCompressed(cacheKey, imageData, metadata = {}) {
        // This will be integrated with CompressionManager
        return this.set(cacheKey, imageData, metadata);
    }

    async warmCache(frequentKeys) {
        // Pre-load frequently used cache entries
        console.log(`Warming cache with ${frequentKeys.length} entries`);
        // Implementation would pre-fetch common trait combinations
    }

    // ===== QA METADATA METHODS =====

    async storeQAMetadata(cacheKey, qaData) {
        if (!this.isInitialized) return false;

        try {
            const transaction = this.db.transaction(['qaMetadata'], 'readwrite');
            const store = transaction.objectStore('qaMetadata');
            
            const qaRecord = {
                cacheKey,
                category: qaData.category,
                scores: qaData.scores,
                approved: qaData.approved,
                outlier: qaData.outlier,
                timestamp: qaData.timestamp || Date.now(),
                retryCount: qaData.retryCount || 0,
                approvedBy: qaData.approvedBy || null,
                notes: qaData.notes || ''
            };

            await new Promise((resolve, reject) => {
                const request = store.put(qaRecord);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return true;
        } catch (error) {
            console.error('Failed to store QA metadata:', error);
            return false;
        }
    }

    async getQAMetadata(cacheKey) {
        if (!this.isInitialized) return null;

        try {
            const transaction = this.db.transaction(['qaMetadata'], 'readonly');
            const store = transaction.objectStore('qaMetadata');
            const request = store.get(cacheKey);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result || null);
                };

                request.onerror = () => {
                    console.error('Failed to get QA metadata:', request.error);
                    resolve(null);
                };
            });
        } catch (error) {
            console.error('Failed to get QA metadata:', error);
            return null;
        }
    }

    async getQAMetadataByCategory(category) {
        if (!this.isInitialized) return [];

        try {
            const transaction = this.db.transaction(['qaMetadata'], 'readonly');
            const store = transaction.objectStore('qaMetadata');
            const index = store.index('category');
            const request = index.getAll(category);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = () => {
                    console.error('Failed to get QA metadata by category:', request.error);
                    resolve([]);
                };
            });
        } catch (error) {
            console.error('Failed to get QA metadata by category:', error);
            return [];
        }
    }

    async updateApprovalStatus(cacheKey, approved) {
        if (!this.isInitialized) return false;

        try {
            const transaction = this.db.transaction(['qaMetadata'], 'readwrite');
            const store = transaction.objectStore('qaMetadata');
            const getRequest = store.get(cacheKey);

            return new Promise((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const qaData = getRequest.result;
                    if (qaData) {
                        qaData.approved = approved;
                        qaData.approvedBy = 'user';
                        qaData.timestamp = Date.now();
                        
                        const updateRequest = store.put(qaData);
                        updateRequest.onsuccess = () => resolve(true);
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        resolve(false);
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            console.error('Failed to update approval status:', error);
            return false;
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageCacheManager;
} else if (typeof window !== 'undefined') {
    window.ImageCacheManager = ImageCacheManager;
}