// NFT Generator - Smart Regeneration System
// Change detection to only regenerate traits when configuration changes

class SmartRegenerator {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
        this.configHashes = new Map();
        this.isEnabled = true;
        this.lastGenerationTime = null;
        this.changeThreshold = 0.1; // Minimum change to trigger regeneration
    }

    async initialize() {
        try {
            await this.loadStoredHashes();
            console.log('Smart Regenerator initialized');
            return true;
        } catch (error) {
            console.error('Smart Regenerator initialization failed:', error);
            return false;
        }
    }

    async generateConfigHash(category, config = null) {
        // Get current configuration for the category
        const categoryConfig = config || this.getCurrentCategoryConfig(category);
        
        // Include all parameters that affect trait generation
        const hashData = {
            numTraits: categoryConfig.numTraits,
            complexity: categoryConfig.complexity,
            colorSeed: categoryConfig.colorSeed,
            generationMode: categoryConfig.generationMode,
            aiOptions: categoryConfig.aiOptions,
            // Include global style settings that affect this category
            globalStyle: this.getRelevantGlobalStyle(),
            // Include style engine settings
            styleSettings: this.getStyleEngineSettings(category)
        };

        // Create a stable hash from the configuration
        const configString = JSON.stringify(hashData, Object.keys(hashData).sort());
        return await this.createHash(configString);
    }

    getCurrentCategoryConfig(category) {
        if (typeof window !== 'undefined' && window.configCache) {
            return window.configCache[category] || {};
        }
        return {};
    }

    getRelevantGlobalStyle() {
        if (typeof window !== 'undefined' && window.configCache && window.configCache.globalStyle) {
            const globalStyle = window.configCache.globalStyle;
            return {
                masterPrompt: globalStyle.masterPrompt,
                globalNegativePrompt: globalStyle.globalNegativePrompt,
                activePreset: globalStyle.activePreset,
                colorPaletteLock: globalStyle.colorPaletteLock,
                lockedColors: globalStyle.lockedColors,
                useMasterSeed: globalStyle.useMasterSeed,
                masterSeed: globalStyle.masterSeed,
                useAIGeneration: globalStyle.useAIGeneration
            };
        }
        return {};
    }

    getStyleEngineSettings(category) {
        if (typeof window !== 'undefined' && window.styleEngine) {
            return {
                masterStylePrompt: window.styleEngine.masterStylePrompt,
                activePreset: window.styleEngine.activePreset,
                categoryTemplate: window.styleEngine.categoryTemplates[category],
                negativePrompt: window.styleEngine.buildNegativePrompt(category)
            };
        }
        return {};
    }

    async createHash(input) {
        // Use SHA-256 for proper hashing (collision-resistant)
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(input);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (error) {
                console.warn('SHA-256 hashing failed, using fallback:', error);
            }
        }

        // Fallback for older browsers
        let hash = 0;
        if (input.length === 0) return hash.toString();
        
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    async detectChanges() {
        if (!this.isEnabled) {
            return { hasChanges: false, changedCategories: [], allCategories: [] };
        }

        const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
        const changedCategories = [];
        const allCategories = [];

        for (const category of categories) {
            const currentHash = await this.generateConfigHash(category);
            const storedHash = this.configHashes.get(category);

            allCategories.push({
                category,
                currentHash,
                storedHash,
                hasChanged: currentHash !== storedHash,
                isNew: !storedHash
            });

            if (currentHash !== storedHash) {
                changedCategories.push({
                    category,
                    reason: storedHash ? 'configuration_changed' : 'first_generation',
                    oldHash: storedHash,
                    newHash: currentHash
                });
            }
        }

        return {
            hasChanges: changedCategories.length > 0,
            changedCategories,
            allCategories,
            timestamp: Date.now()
        };
    }

    async hasConfigChanged(category) {
        const currentHash = await this.generateConfigHash(category);
        const storedHash = this.configHashes.get(category);
        
        return {
            hasChanged: currentHash !== storedHash,
            currentHash,
            storedHash,
            category
        };
    }

    async regenerateChanged(categories = null) {
        const changeDetection = await this.detectChanges();
        
        if (!changeDetection.hasChanges && categories === null) {
            return {
                regenerated: [],
                skipped: changeDetection.allCategories.map(c => c.category),
                message: 'No configuration changes detected'
            };
        }

        const categoriesToRegenerate = categories || changeDetection.changedCategories.map(c => c.category);
        const regenerated = [];
        const skipped = [];

        for (const categoryInfo of changeDetection.allCategories) {
            const category = categoryInfo.category;
            
            if (categoriesToRegenerate.includes(category) || categoryInfo.hasChanged) {
                regenerated.push(category);
                
                // Update stored hash
                await this.updateStoredHash(category, categoryInfo.currentHash);
                
                // Emit regeneration event
                this.emitEvent('regeneration:categoryStarted', {
                    category,
                    reason: categoryInfo.hasChanged ? 'config_changed' : 'forced',
                    hash: categoryInfo.currentHash
                });
            } else {
                skipped.push(category);
                
                this.emitEvent('regeneration:skipped', {
                    category,
                    reason: 'no_changes',
                    hash: categoryInfo.currentHash
                });
            }
        }

        this.lastGenerationTime = Date.now();

        return {
            regenerated,
            skipped,
            changeDetection,
            message: `Regenerating ${regenerated.length} categories, skipping ${skipped.length}`
        };
    }

    async updateStoredHash(category, hash) {
        this.configHashes.set(category, hash);
        await this.saveHashesToStorage();
    }

    async saveHashesToStorage() {
        if (!this.cacheManager || !this.cacheManager.isInitialized) {
            // Fallback to localStorage
            try {
                const hashData = Object.fromEntries(this.configHashes);
                localStorage.setItem('nft_generator_config_hashes', JSON.stringify(hashData));
            } catch (error) {
                console.error('Failed to save config hashes to localStorage:', error);
            }
            return;
        }

        try {
            const transaction = this.cacheManager.db.transaction(['configHashes'], 'readwrite');
            const store = transaction.objectStore('configHashes');

            // Save each category hash
            for (const [category, hash] of this.configHashes) {
                await new Promise((resolve, reject) => {
                    const request = store.put({
                        category,
                        hash,
                        timestamp: Date.now()
                    });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        } catch (error) {
            console.error('Failed to save config hashes to IndexedDB:', error);
        }
    }

    async loadStoredHashes() {
        if (!this.cacheManager || !this.cacheManager.isInitialized) {
            // Fallback to localStorage
            try {
                const saved = localStorage.getItem('nft_generator_config_hashes');
                if (saved) {
                    const hashData = JSON.parse(saved);
                    this.configHashes = new Map(Object.entries(hashData));
                }
            } catch (error) {
                console.error('Failed to load config hashes from localStorage:', error);
            }
            return;
        }

        try {
            const transaction = this.cacheManager.db.transaction(['configHashes'], 'readonly');
            const store = transaction.objectStore('configHashes');
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    const hashes = request.result || [];
                    hashes.forEach(item => {
                        this.configHashes.set(item.category, item.hash);
                    });
                    resolve();
                };

                request.onerror = () => {
                    console.error('Failed to load config hashes:', request.error);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Failed to load config hashes from IndexedDB:', error);
        }
    }

    // Diff visualization methods
    generateDiffReport() {
        return this.detectChanges().then(changeDetection => {
            const report = {
                timestamp: Date.now(),
                hasChanges: changeDetection.hasChanges,
                summary: {
                    totalCategories: changeDetection.allCategories.length,
                    changedCategories: changeDetection.changedCategories.length,
                    unchangedCategories: changeDetection.allCategories.length - changeDetection.changedCategories.length
                },
                categories: changeDetection.allCategories.map(cat => ({
                    category: cat.category,
                    status: cat.hasChanged ? 'changed' : 'unchanged',
                    isNew: cat.isNew,
                    details: this.getChangeDetails(cat.category)
                })),
                estimatedCost: this.estimateRegenerationCost(changeDetection.changedCategories),
                estimatedTime: this.estimateRegenerationTime(changeDetection.changedCategories)
            };

            return report;
        });
    }

    getChangeDetails(category) {
        const currentConfig = this.getCurrentCategoryConfig(category);
        const details = {
            numTraits: currentConfig.numTraits || 0,
            complexity: currentConfig.complexity || 0,
            generationMode: currentConfig.generationMode || 'procedural',
            hasAI: currentConfig.generationMode !== 'procedural',
            styleSettings: this.getStyleEngineSettings(category)
        };

        return details;
    }

    estimateRegenerationCost(changedCategories) {
        if (!changedCategories || changedCategories.length === 0) {
            return { total: 0, breakdown: {} };
        }

        const providerCosts = {
            gemini: 0.039,
            openai: 0.080,
            stablediffusion: 0.050
        };

        let totalCost = 0;
        const breakdown = {};

        changedCategories.forEach(categoryInfo => {
            const category = categoryInfo.category;
            const config = this.getCurrentCategoryConfig(category);
            
            if (config.generationMode === 'ai' || config.generationMode === 'hybrid') {
                const activeProvider = window.apiManager ? window.apiManager.getActiveProviderName() : 'gemini';
                const costPerImage = providerCosts[activeProvider] || providerCosts.gemini;
                const categoryCost = (config.numTraits || 0) * costPerImage;
                
                totalCost += categoryCost;
                breakdown[category] = {
                    numTraits: config.numTraits || 0,
                    costPerTrait: costPerImage,
                    totalCost: categoryCost,
                    provider: activeProvider
                };
            } else {
                breakdown[category] = {
                    numTraits: config.numTraits || 0,
                    costPerTrait: 0,
                    totalCost: 0,
                    provider: 'procedural'
                };
            }
        });

        return { total: totalCost, breakdown };
    }

    estimateRegenerationTime(changedCategories) {
        if (!changedCategories || changedCategories.length === 0) {
            return { total: 0, breakdown: {} };
        }

        // Rough time estimates (in seconds)
        const timeEstimates = {
            procedural: 0.1, // 100ms per trait
            ai: 3.0,         // 3 seconds per AI trait
            hybrid: 3.5      // 3.5 seconds per hybrid trait
        };

        let totalTime = 0;
        const breakdown = {};

        changedCategories.forEach(categoryInfo => {
            const category = categoryInfo.category;
            const config = this.getCurrentCategoryConfig(category);
            const mode = config.generationMode || 'procedural';
            const timePerTrait = timeEstimates[mode] || timeEstimates.procedural;
            const categoryTime = (config.numTraits || 0) * timePerTrait;
            
            totalTime += categoryTime;
            breakdown[category] = {
                numTraits: config.numTraits || 0,
                timePerTrait,
                totalTime: categoryTime,
                mode
            };
        });

        return {
            total: totalTime,
            totalFormatted: this.formatDuration(totalTime * 1000),
            breakdown
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Cache integration methods
    async getCachedTraitCount(category) {
        if (!this.cacheManager) return 0;

        // This would query the cache for existing traits in this category
        // Implementation depends on cache structure
        return 0; // Placeholder
    }

    async estimateCacheSavings(changedCategories) {
        const savings = {
            traitsReused: 0,
            costSaved: 0,
            timeSaved: 0
        };

        // Calculate how many traits can be reused from cache
        for (const categoryInfo of changedCategories) {
            const category = categoryInfo.category;
            const cachedCount = await this.getCachedTraitCount(category);
            const config = this.getCurrentCategoryConfig(category);
            const totalNeeded = config.numTraits || 0;
            const reusable = Math.min(cachedCount, totalNeeded);
            
            savings.traitsReused += reusable;
            
            if (config.generationMode !== 'procedural') {
                const providerCosts = { gemini: 0.039, openai: 0.080, stablediffusion: 0.050 };
                const activeProvider = window.apiManager ? window.apiManager.getActiveProviderName() : 'gemini';
                const costPerTrait = providerCosts[activeProvider] || providerCosts.gemini;
                
                savings.costSaved += reusable * costPerTrait;
                savings.timeSaved += reusable * 3; // 3 seconds per AI trait
            }
        }

        return savings;
    }

    // Configuration methods
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.emitEvent('regeneration:enabledChanged', { enabled });
    }

    isSmartRegenerationEnabled() {
        return this.isEnabled;
    }

    setChangeThreshold(threshold) {
        this.changeThreshold = Math.max(0, Math.min(1, threshold));
    }

    // Force regeneration methods
    async forceRegenerateAll() {
        const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
        
        // Clear all stored hashes to force regeneration
        this.configHashes.clear();
        await this.saveHashesToStorage();
        
        this.emitEvent('regeneration:forceAll', {
            categories,
            timestamp: Date.now()
        });

        return {
            regenerated: categories,
            skipped: [],
            message: 'Force regenerating all categories'
        };
    }

    async forceRegenerateCategory(category) {
        // Clear hash for specific category
        this.configHashes.delete(category);
        await this.saveHashesToStorage();
        
        this.emitEvent('regeneration:forceCategory', {
            category,
            timestamp: Date.now()
        });

        return {
            regenerated: [category],
            skipped: [],
            message: `Force regenerating ${category} category`
        };
    }

    // Utility methods
    emitEvent(eventName, detail) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    getStatus() {
        return {
            isEnabled: this.isEnabled,
            lastGenerationTime: this.lastGenerationTime,
            storedHashes: Object.fromEntries(this.configHashes),
            changeThreshold: this.changeThreshold
        };
    }

    reset() {
        this.configHashes.clear();
        this.lastGenerationTime = null;
        this.saveHashesToStorage();
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartRegenerator;
} else if (typeof window !== 'undefined') {
    window.SmartRegenerator = SmartRegenerator;
}