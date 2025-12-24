// NFT Generator - Quality Assurance Engine
// Database: 'nft-generator-qa' (version 1)
// Purpose: Image analysis, consistency scoring, outlier detection, and regeneration queue management
// Object Stores:
//   - qaMetadata: Quality scores and approval status for analyzed images
//   - regenerationQueue: Queue for regenerating images that failed quality checks

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

// ===== QUALITY ASSURANCE ENGINE CLASS =====

class QualityAssuranceEngine {
    constructor() {
        this.db = null;
        this.dbName = 'nft-generator-qa';
        this.dbVersion = 1;
        this.isInitialized = false;
        this.analysisCache = new Map();
        this.regenerationQueue = [];
        this.processingQueue = false;
    }

    async initialize() {
        try {
            if (!window.indexedDB) {
                console.warn('IndexedDB not available for QA system');
                return false;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('Failed to open QA database:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.isInitialized = true;
                    console.log('Quality Assurance Engine initialized');
                    resolve(true);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const oldVersion = event.oldVersion;
                    const newVersion = event.newVersion;
                    
                    console.log(`Upgrading QA database from version ${oldVersion} to ${newVersion}`);

                    // Version 1: Initial schema
                    if (oldVersion < 1) {
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
                            regenStore.createIndex('status', 'status', { unique: false });
                            regenStore.createIndex('priority', 'priority', { unique: false });
                        }
                    }

                    // Future version migrations would go here
                    // if (oldVersion < 2) { ... }
                };
            });
        } catch (error) {
            console.error('QA Engine initialization failed:', error);
            return false;
        }
    }

    // ===== IMAGE ANALYSIS METHODS =====

    async calculatePerceptualHash(imageDataURL) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = validateCanvasContext(canvas);
            canvas.width = 32;
            canvas.height = 32;

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataURL;
            });

            // Draw image to 32x32 grayscale
            ctx.drawImage(img, 0, 0, 32, 32);
            const imageData = ctx.getImageData(0, 0, 32, 32);
            const pixels = imageData.data;

            // Convert to grayscale
            const grayscale = [];
            for (let i = 0; i < pixels.length; i += 4) {
                const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
                grayscale.push(gray);
            }

            // Simple DCT approximation for pHash
            const dct = this.simpleDCT(grayscale, 32, 32);
            
            // Extract 8x8 top-left corner (excluding DC component)
            const hash = [];
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    if (x === 0 && y === 0) continue; // Skip DC component
                    hash.push(dct[y * 32 + x]);
                }
            }

            // Calculate median
            const sortedHash = [...hash].sort((a, b) => a - b);
            const median = sortedHash[Math.floor(sortedHash.length / 2)];

            // Generate binary hash
            let binaryHash = '';
            for (const value of hash) {
                binaryHash += value > median ? '1' : '0';
            }

            return binaryHash;
        } catch (error) {
            console.error('Error calculating perceptual hash:', error);
            return '0'.repeat(63); // Fallback hash
        }
    }

    simpleDCT(pixels, width, height) {
        const dct = new Array(width * height).fill(0);
        
        for (let v = 0; v < height; v++) {
            for (let u = 0; u < width; u++) {
                let sum = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        sum += pixels[y * width + x] * 
                               Math.cos(((2 * x + 1) * u * Math.PI) / (2 * width)) *
                               Math.cos(((2 * y + 1) * v * Math.PI) / (2 * height));
                    }
                }
                
                const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
                const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
                dct[v * width + u] = (cu * cv / 4) * sum;
            }
        }
        
        return dct;
    }

    compareImages(hash1, hash2) {
        if (hash1.length !== hash2.length) return 64; // Max distance
        
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i]) distance++;
        }
        
        return distance;
    }

    async analyzeColorDistribution(imageDataURL) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = validateCanvasContext(canvas);
            canvas.width = 100;
            canvas.height = 100;

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataURL;
            });

            ctx.drawImage(img, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const pixels = imageData.data;

            // HSL histogram (10 bins per channel)
            const hBins = new Array(10).fill(0);
            const sBins = new Array(10).fill(0);
            const lBins = new Array(10).fill(0);

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i] / 255;
                const g = pixels[i + 1] / 255;
                const b = pixels[i + 2] / 255;

                const hsl = this.rgbToHsl(r, g, b);
                
                const hBin = Math.min(9, Math.floor(hsl.h / 36)); // 0-359 -> 0-9
                const sBin = Math.min(9, Math.floor(hsl.s * 10)); // 0-1 -> 0-9
                const lBin = Math.min(9, Math.floor(hsl.l * 10)); // 0-1 -> 0-9

                hBins[hBin]++;
                sBins[sBin]++;
                lBins[lBin]++;
            }

            // Normalize histograms
            const totalPixels = (100 * 100);
            return {
                hue: hBins.map(count => count / totalPixels),
                saturation: sBins.map(count => count / totalPixels),
                lightness: lBins.map(count => count / totalPixels)
            };
        } catch (error) {
            console.error('Error analyzing color distribution:', error);
            return {
                hue: new Array(10).fill(0.1),
                saturation: new Array(10).fill(0.1),
                lightness: new Array(10).fill(0.1)
            };
        }
    }

    rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
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

        return { h: h * 360, s, l };
    }

    async calculateEdgeDensity(imageDataURL) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = validateCanvasContext(canvas);
            canvas.width = 100;
            canvas.height = 100;

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataURL;
            });

            ctx.drawImage(img, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const pixels = imageData.data;

            // Convert to grayscale
            const grayscale = [];
            for (let i = 0; i < pixels.length; i += 4) {
                const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
                grayscale.push(gray);
            }

            // Sobel edge detection
            const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
            const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
            
            let edgeSum = 0;
            const width = 100;
            const height = 100;

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let gx = 0, gy = 0;
                    
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixel = grayscale[(y + ky) * width + (x + kx)];
                            const kernelIndex = (ky + 1) * 3 + (kx + 1);
                            gx += pixel * sobelX[kernelIndex];
                            gy += pixel * sobelY[kernelIndex];
                        }
                    }
                    
                    const magnitude = Math.sqrt(gx * gx + gy * gy);
                    edgeSum += magnitude;
                }
            }

            // Normalize to 0-100 scale
            const maxPossibleEdgeSum = (width - 2) * (height - 2) * 255 * Math.sqrt(2);
            return Math.min(100, (edgeSum / maxPossibleEdgeSum) * 100);
        } catch (error) {
            console.error('Error calculating edge density:', error);
            return 50; // Fallback value
        }
    }

    async analyzeBrightness(imageDataURL) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = validateCanvasContext(canvas);
            canvas.width = 100;
            canvas.height = 100;

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageDataURL;
            });

            ctx.drawImage(img, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const pixels = imageData.data;

            let totalLuminance = 0;
            const pixelCount = pixels.length / 4;

            for (let i = 0; i < pixels.length; i += 4) {
                const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
                totalLuminance += luminance;
            }

            return totalLuminance / pixelCount; // 0-255 range
        } catch (error) {
            console.error('Error analyzing brightness:', error);
            return 128; // Fallback value
        }
    }

    // ===== CONSISTENCY SCORING =====

    async calculateConsistencyScore(images, category) {
        try {
            if (!images || images.length === 0) {
                return { overall: 0, breakdown: { color: 0, edge: 0, brightness: 0, similarity: 0 }, outliers: [] };
            }

            const analyses = [];
            
            // Analyze each image
            for (const imageData of images) {
                const hash = await this.calculatePerceptualHash(imageData);
                const colorDist = await this.analyzeColorDistribution(imageData);
                const edgeDensity = await this.calculateEdgeDensity(imageData);
                const brightness = await this.analyzeBrightness(imageData);
                
                analyses.push({
                    hash,
                    colorDist,
                    edgeDensity,
                    brightness
                });
            }

            // Calculate scores
            const colorScore = this.calculateColorConsistency(analyses);
            const edgeScore = this.calculateEdgeConsistency(analyses);
            const brightnessScore = this.calculateBrightnessConsistency(analyses);
            const similarityScore = this.calculateSimilarityScore(analyses);

            // Weighted overall score
            const overall = (colorScore * 0.4) + (edgeScore * 0.3) + (brightnessScore * 0.2) + (similarityScore * 0.1);

            // Detect outliers
            const outliers = this.detectOutliers(analyses, 60);

            return {
                overall: Math.round(overall),
                breakdown: {
                    color: Math.round(colorScore),
                    edge: Math.round(edgeScore),
                    brightness: Math.round(brightnessScore),
                    similarity: Math.round(similarityScore)
                },
                outliers
            };
        } catch (error) {
            console.error('Error calculating consistency score:', error);
            return { overall: 0, breakdown: { color: 0, edge: 0, brightness: 0, similarity: 0 }, outliers: [] };
        }
    }

    calculateColorConsistency(analyses) {
        if (analyses.length < 2) return 100;

        let totalVariance = 0;
        const channels = ['hue', 'saturation', 'lightness'];

        for (const channel of channels) {
            for (let bin = 0; bin < 10; bin++) {
                const values = analyses.map(a => a.colorDist[channel][bin]);
                const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
                const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                totalVariance += variance;
            }
        }

        // Convert variance to consistency score (lower variance = higher score)
        const maxVariance = 0.1; // Empirical threshold
        const consistencyScore = Math.max(0, 100 - (totalVariance / maxVariance) * 100);
        return Math.min(100, consistencyScore);
    }

    calculateEdgeConsistency(analyses) {
        if (analyses.length < 2) return 100;

        const edgeValues = analyses.map(a => a.edgeDensity);
        const mean = edgeValues.reduce((sum, val) => sum + val, 0) / edgeValues.length;
        const variance = edgeValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / edgeValues.length;
        
        // Convert variance to consistency score
        const maxVariance = 500; // Empirical threshold
        const consistencyScore = Math.max(0, 100 - (variance / maxVariance) * 100);
        return Math.min(100, consistencyScore);
    }

    calculateBrightnessConsistency(analyses) {
        if (analyses.length < 2) return 100;

        const brightnessValues = analyses.map(a => a.brightness);
        const mean = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;
        const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / brightnessValues.length;
        
        // Convert variance to consistency score
        const maxVariance = 2000; // Empirical threshold
        const consistencyScore = Math.max(0, 100 - (variance / maxVariance) * 100);
        return Math.min(100, consistencyScore);
    }

    calculateSimilarityScore(analyses) {
        if (analyses.length < 2) return 100;

        let totalDistance = 0;
        let comparisons = 0;

        for (let i = 0; i < analyses.length; i++) {
            for (let j = i + 1; j < analyses.length; j++) {
                const distance = this.compareImages(analyses[i].hash, analyses[j].hash);
                totalDistance += distance;
                comparisons++;
            }
        }

        const avgDistance = totalDistance / comparisons;
        
        // Convert distance to similarity score (lower distance = higher score)
        const maxDistance = 32; // Half of 64-bit hash
        const similarityScore = Math.max(0, 100 - (avgDistance / maxDistance) * 100);
        return Math.min(100, similarityScore);
    }

    // ===== OUTLIER DETECTION =====

    detectOutliers(analyses, threshold = 60) {
        const outliers = [];
        
        if (analyses.length < 3) return outliers; // Need at least 3 for meaningful outlier detection

        // Calculate individual scores for each image
        for (let i = 0; i < analyses.length; i++) {
            const otherAnalyses = analyses.filter((_, index) => index !== i);
            
            // Compare this image against the others
            let colorVariance = 0;
            let edgeVariance = 0;
            let brightnessVariance = 0;
            let avgSimilarity = 0;

            for (const other of otherAnalyses) {
                // Color variance
                const channels = ['hue', 'saturation', 'lightness'];
                for (const channel of channels) {
                    for (let bin = 0; bin < 10; bin++) {
                        colorVariance += Math.abs(analyses[i].colorDist[channel][bin] - other.colorDist[channel][bin]);
                    }
                }

                // Edge variance
                edgeVariance += Math.abs(analyses[i].edgeDensity - other.edgeDensity);

                // Brightness variance
                brightnessVariance += Math.abs(analyses[i].brightness - other.brightness);

                // Similarity
                const distance = this.compareImages(analyses[i].hash, other.hash);
                avgSimilarity += distance;
            }

            colorVariance /= otherAnalyses.length;
            edgeVariance /= otherAnalyses.length;
            brightnessVariance /= otherAnalyses.length;
            avgSimilarity /= otherAnalyses.length;

            // Calculate composite outlier score
            const colorScore = Math.max(0, 100 - colorVariance * 1000);
            const edgeScore = Math.max(0, 100 - edgeVariance * 2);
            const brightnessScore = Math.max(0, 100 - brightnessVariance / 2);
            const similarityScore = Math.max(0, 100 - (avgSimilarity / 32) * 100);

            const overallScore = (colorScore * 0.4) + (edgeScore * 0.3) + (brightnessScore * 0.2) + (similarityScore * 0.1);

            if (overallScore < threshold) {
                outliers.push(i);
            }
        }

        return outliers;
    }

    flagAnomalies(images) {
        // Detect extreme deviations (>2 standard deviations from mean)
        // This would be implemented for more sophisticated anomaly detection
        return [];
    }

    // ===== REGENERATION QUEUE =====

    async addToRegenerationQueue(imageMetadata, reason) {
        if (!this.isInitialized) return false;

        try {
            const transaction = this.db.transaction(['regenerationQueue'], 'readwrite');
            const store = transaction.objectStore('regenerationQueue');
            
            const queueItem = {
                cacheKey: imageMetadata.cacheKey,
                category: imageMetadata.category,
                reason: reason,
                originalMetadata: imageMetadata.originalMetadata || {},
                status: 'pending',
                priority: reason === 'rejected' ? 1 : reason === 'outlier' ? 2 : 3,
                retryCount: 0,
                maxRetries: 3,
                timestamp: Date.now(),
                notes: imageMetadata.notes || ''
            };

            await new Promise((resolve, reject) => {
                const request = store.add(queueItem);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`Added to regeneration queue: ${imageMetadata.cacheKey} (${reason})`);
            return true;
        } catch (error) {
            console.error('Failed to add to regeneration queue:', error);
            return false;
        }
    }

    async getRegenerationQueue() {
        if (!this.isInitialized) return [];

        try {
            const transaction = this.db.transaction(['regenerationQueue'], 'readonly');
            const store = transaction.objectStore('regenerationQueue');
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = () => {
                    console.error('Failed to get regeneration queue:', request.error);
                    resolve([]);
                };
            });
        } catch (error) {
            console.error('Failed to get regeneration queue:', error);
            return [];
        }
    }

    async processRegenerationQueue(maxRetries = 3) {
        if (this.processingQueue) {
            console.log('Regeneration queue already processing');
            return { success: 0, failed: 0 };
        }

        this.processingQueue = true;
        const results = { success: 0, failed: 0 };

        try {
            const queue = await this.getRegenerationQueue();
            const pendingItems = queue.filter(item => item.status === 'pending' && item.retryCount < maxRetries);

            for (const item of pendingItems) {
                try {
                    // Update status to processing
                    await this.updateQueueItemStatus(item.id, 'processing');

                    // Regenerate image using original metadata
                    const newImageData = await this.regenerateImage(item);

                    if (newImageData) {
                        // Analyze new image
                        const qaData = await this.analyzeImage(newImageData, item.category, item.cacheKey);

                        // Check if improvement achieved
                        if (qaData.scores.overall > 60) { // Configurable threshold
                            // Update cache with new image
                            if (window.imageCacheManager) {
                                await window.imageCacheManager.store(item.cacheKey, newImageData);
                                await window.imageCacheManager.storeQAMetadata(item.cacheKey, qaData);
                            }

                            await this.updateQueueItemStatus(item.id, 'completed');
                            results.success++;
                        } else {
                            // Still not good enough, increment retry count
                            await this.incrementRetryCount(item.id);
                            if (item.retryCount + 1 >= maxRetries) {
                                await this.updateQueueItemStatus(item.id, 'failed');
                                results.failed++;
                            }
                        }
                    } else {
                        await this.incrementRetryCount(item.id);
                        if (item.retryCount + 1 >= maxRetries) {
                            await this.updateQueueItemStatus(item.id, 'failed');
                            results.failed++;
                        }
                    }
                } catch (error) {
                    console.error(`Failed to process queue item ${item.id}:`, error);
                    await this.incrementRetryCount(item.id);
                    if (item.retryCount + 1 >= maxRetries) {
                        await this.updateQueueItemStatus(item.id, 'failed');
                        results.failed++;
                    }
                }
            }
        } catch (error) {
            console.error('Error processing regeneration queue:', error);
        } finally {
            this.processingQueue = false;
        }

        return results;
    }

    async regenerateImage(queueItem) {
        try {
            // Use the original metadata to regenerate
            const { category, originalMetadata } = queueItem;
            const { complexity, colorSeed, index } = originalMetadata;

            // Call the appropriate generation function
            if (window.generateTraitImage) {
                return await window.generateTraitImage(category, complexity, colorSeed, index);
            } else {
                console.error('generateTraitImage function not available');
                return null;
            }
        } catch (error) {
            console.error('Error regenerating image:', error);
            return null;
        }
    }

    async updateQueueItemStatus(id, status) {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['regenerationQueue'], 'readwrite');
            const store = transaction.objectStore('regenerationQueue');
            const getRequest = store.get(id);

            return new Promise((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const item = getRequest.result;
                    if (item) {
                        item.status = status;
                        const updateRequest = store.put(item);
                        updateRequest.onsuccess = () => resolve();
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            console.error('Failed to update queue item status:', error);
        }
    }

    async incrementRetryCount(id) {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['regenerationQueue'], 'readwrite');
            const store = transaction.objectStore('regenerationQueue');
            const getRequest = store.get(id);

            return new Promise((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const item = getRequest.result;
                    if (item) {
                        item.retryCount = (item.retryCount || 0) + 1;
                        const updateRequest = store.put(item);
                        updateRequest.onsuccess = () => resolve();
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            console.error('Failed to increment retry count:', error);
        }
    }

    async clearRegenerationQueue(category = null) {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['regenerationQueue'], 'readwrite');
            const store = transaction.objectStore('regenerationQueue');

            if (category) {
                const index = store.index('category');
                const request = index.openCursor(IDBKeyRange.only(category));
                
                return new Promise((resolve) => {
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            cursor.delete();
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    request.onerror = () => resolve();
                });
            } else {
                return new Promise((resolve) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => resolve();
                });
            }
        } catch (error) {
            console.error('Failed to clear regeneration queue:', error);
        }
    }

    // ===== ANALYSIS INTEGRATION =====

    async analyzeImage(imageDataURL, category, cacheKey) {
        try {
            const hash = await this.calculatePerceptualHash(imageDataURL);
            const colorDist = await this.analyzeColorDistribution(imageDataURL);
            const edgeDensity = await this.calculateEdgeDensity(imageDataURL);
            const brightness = await this.analyzeBrightness(imageDataURL);

            // Calculate individual scores (simplified for single image)
            const scores = {
                overall: 75, // Default score, would be calculated against baseline
                color: Math.min(100, Math.max(0, 100 - (this.calculateColorVariance(colorDist) * 100))),
                edge: Math.min(100, Math.max(0, edgeDensity)),
                brightness: Math.min(100, Math.max(0, 100 - Math.abs(brightness - 128) / 128 * 100)),
                similarity: 75 // Would be calculated against category baseline
            };

            scores.overall = (scores.color * 0.4) + (scores.edge * 0.3) + (scores.brightness * 0.2) + (scores.similarity * 0.1);

            const qaData = {
                cacheKey,
                category,
                scores,
                approved: null,
                outlier: scores.overall < 60,
                timestamp: Date.now(),
                retryCount: 0,
                approvedBy: null,
                notes: '',
                hash,
                colorDist,
                edgeDensity,
                brightness
            };

            // Cache the analysis
            this.analysisCache.set(cacheKey, qaData);

            return qaData;
        } catch (error) {
            console.error('Error analyzing image:', error);
            return {
                cacheKey,
                category,
                scores: { overall: 0, color: 0, edge: 0, brightness: 0, similarity: 0 },
                approved: null,
                outlier: true,
                timestamp: Date.now(),
                retryCount: 0
            };
        }
    }

    calculateColorVariance(colorDist) {
        // Simple variance calculation for color distribution
        let variance = 0;
        const channels = ['hue', 'saturation', 'lightness'];
        
        for (const channel of channels) {
            const values = colorDist[channel];
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const channelVariance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            variance += channelVariance;
        }
        
        return variance / channels.length;
    }

    // ===== QUALITY REPORT GENERATION =====

    async generateQualityReport() {
        const categories = ['background', 'body', 'eyes', 'mouth', 'hat'];
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalImages: 0,
                averageScore: 0,
                outlierCount: 0,
                regenerationCount: 0,
                approvedCount: 0,
                rejectedCount: 0
            },
            categories: {},
            recommendations: []
        };

        for (const category of categories) {
            const qaMetadata = await this.getQAMetadataByCategory(category);
            if (qaMetadata.length === 0) continue;

            const categoryReport = {
                totalImages: qaMetadata.length,
                averageScore: 0,
                outliers: [],
                approved: 0,
                rejected: 0,
                pending: 0,
                scoreDistribution: {
                    excellent: 0, // 90-100
                    good: 0,      // 70-89
                    fair: 0,      // 50-69
                    poor: 0       // 0-49
                },
                sampleImages: []
            };

            let totalScore = 0;
            qaMetadata.forEach(item => {
                totalScore += item.scores.overall;
                report.summary.totalImages++;

                if (item.outlier) {
                    categoryReport.outliers.push({
                        index: item.cacheKey.split('_').pop(),
                        score: item.scores.overall,
                        reason: 'Low consistency score'
                    });
                    report.summary.outlierCount++;
                }

                if (item.approved === true) {
                    categoryReport.approved++;
                    report.summary.approvedCount++;
                } else if (item.approved === false) {
                    categoryReport.rejected++;
                    report.summary.rejectedCount++;
                } else {
                    categoryReport.pending++;
                }

                // Score distribution
                const score = item.scores.overall;
                if (score >= 90) categoryReport.scoreDistribution.excellent++;
                else if (score >= 70) categoryReport.scoreDistribution.good++;
                else if (score >= 50) categoryReport.scoreDistribution.fair++;
                else categoryReport.scoreDistribution.poor++;
            });

            categoryReport.averageScore = totalScore / qaMetadata.length;
            report.summary.averageScore += categoryReport.averageScore;

            // Add sample images (top 3 and bottom 3)
            const sorted = qaMetadata.sort((a, b) => b.scores.overall - a.scores.overall);
            categoryReport.sampleImages = [
                ...sorted.slice(0, 3).map(item => ({ type: 'best', cacheKey: item.cacheKey, score: item.scores.overall })),
                ...sorted.slice(-3).map(item => ({ type: 'worst', cacheKey: item.cacheKey, score: item.scores.overall }))
            ];

            report.categories[category] = categoryReport;

            // Generate recommendations
            if (categoryReport.averageScore < 60) {
                report.recommendations.push(`${category}: Average score is low (${Math.round(categoryReport.averageScore)}). Consider reducing complexity or adjusting color palette.`);
            }
            if (categoryReport.outliers.length > qaMetadata.length * 0.2) {
                report.recommendations.push(`${category}: High outlier rate (${Math.round((categoryReport.outliers.length / qaMetadata.length) * 100)}%). Review style consistency settings.`);
            }
        }

        report.summary.averageScore /= Object.keys(report.categories).length;

        // Get regeneration queue stats
        const queue = await this.getRegenerationQueue();
        report.summary.regenerationCount = queue.length;

        return report;
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

    async exportReport(format = 'json') {
        const report = await this.generateQualityReport();

        if (format === 'csv') {
            return this.convertReportToCSV(report);
        } else if (format === 'html') {
            return this.convertReportToHTML(report);
        }

        return JSON.stringify(report, null, 2);
    }

    convertReportToCSV(report) {
        const lines = [];

        // Header
        lines.push('NFT Generator - Quality Assurance Report');
        lines.push(`Generated: ${report.generatedAt}`);
        lines.push('');

        // Summary
        lines.push('SUMMARY');
        lines.push('Metric,Value');
        lines.push(`Total Images,${report.summary.totalImages}`);
        lines.push(`Average Score,${report.summary.averageScore.toFixed(2)}`);
        lines.push(`Outliers,${report.summary.outlierCount}`);
        lines.push(`Approved,${report.summary.approvedCount}`);
        lines.push(`Rejected,${report.summary.rejectedCount}`);
        lines.push(`Regeneration Queue,${report.summary.regenerationCount}`);
        lines.push('');

        // Per-category breakdown
        lines.push('CATEGORY BREAKDOWN');
        lines.push('Category,Total Images,Avg Score,Outliers,Approved,Rejected,Pending');
        Object.entries(report.categories).forEach(([category, data]) => {
            lines.push(`${category},${data.totalImages},${data.averageScore.toFixed(2)},${data.outliers.length},${data.approved},${data.rejected},${data.pending}`);
        });
        lines.push('');

        // Recommendations
        if (report.recommendations.length > 0) {
            lines.push('RECOMMENDATIONS');
            report.recommendations.forEach(rec => {
                lines.push(rec);
            });
        }

        return lines.join('\n');
    }

    convertReportToHTML(report) {
        // Basic HTML report generation
        return `
        <html>
        <head><title>Quality Assurance Report</title></head>
        <body>
        <h1>NFT Generator - Quality Assurance Report</h1>
        <p>Generated: ${report.generatedAt}</p>
        <h2>Summary</h2>
        <ul>
        <li>Total Images: ${report.summary.totalImages}</li>
        <li>Average Score: ${report.summary.averageScore.toFixed(2)}</li>
        <li>Outliers: ${report.summary.outlierCount}</li>
        <li>Approved: ${report.summary.approvedCount}</li>
        <li>Rejected: ${report.summary.rejectedCount}</li>
        </ul>
        </body>
        </html>
        `;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualityAssuranceEngine;
} else if (typeof window !== 'undefined') {
    window.QualityAssuranceEngine = QualityAssuranceEngine;
}