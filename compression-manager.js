// NFT Generator - Compression Manager
// Image compression and resolution optimization to reduce storage and API costs

class CompressionManager {
    constructor() {
        this.isInitialized = false;
        this.workerPool = [];
        this.maxWorkers = 2;
        this.compressionQueue = [];
        this.isProcessing = false;
        
        // Compression presets
        this.qualityPresets = {
            high: { quality: 0.9, format: 'webp' },
            medium: { quality: 0.75, format: 'webp' },
            low: { quality: 0.6, format: 'webp' }
        };
        
        // Resolution presets
        this.resolutionPresets = {
            preview: { width: 256, height: 256 },
            standard: { width: 512, height: 512 },
            high: { width: 1024, height: 1024 }
        };
        
        this.defaultSettings = {
            quality: 'medium',
            resolution: 'standard',
            format: 'webp',
            enableCompression: true
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.stats = {
            totalCompressed: 0,
            totalSizeBefore: 0,
            totalSizeAfter: 0,
            averageCompressionRatio: 0
        };
    }

    async initialize(settings = {}) {
        try {
            this.currentSettings = { ...this.defaultSettings, ...settings };
            
            // Check browser support for WebP
            this.webpSupported = await this.checkWebPSupport();
            if (!this.webpSupported) {
                console.warn('WebP not supported, falling back to JPEG');
                this.currentSettings.format = 'jpeg';
            }
            
            // Initialize worker pool for non-blocking compression
            await this.initializeWorkerPool();
            
            this.isInitialized = true;
            console.log('Compression Manager initialized', this.currentSettings);
            
            return true;
        } catch (error) {
            console.error('Compression Manager initialization failed:', error);
            return false;
        }
    }

    async checkWebPSupport() {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    async initializeWorkerPool() {
        // For now, we'll use main thread compression
        // In a full implementation, we'd create Web Workers for background processing
        this.workerPool = [];
    }

    async compressImage(dataURL, options = {}) {
        if (!this.isInitialized) {
            console.warn('Compression Manager not initialized');
            return dataURL;
        }

        const settings = { ...this.currentSettings, ...options };
        
        if (!settings.enableCompression) {
            return dataURL;
        }

        try {
            const startTime = Date.now();
            const originalSize = this.estimateSize(dataURL);
            
            // Convert data URL to canvas
            const canvas = await this.dataURLToCanvas(dataURL);
            
            // Apply resolution optimization if needed
            const optimizedCanvas = await this.optimizeResolution(canvas, settings.resolution);
            
            // Compress to target format and quality
            const compressedDataURL = await this.canvasToCompressedDataURL(optimizedCanvas, settings);
            
            const compressedSize = this.estimateSize(compressedDataURL);
            const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
            
            // Update statistics
            this.updateStats(originalSize, compressedSize);
            
            const processingTime = Date.now() - startTime;
            
            this.emitEvent('compression:completed', {
                originalSize,
                compressedSize,
                compressionRatio,
                processingTime,
                settings
            });
            
            return compressedDataURL;
            
        } catch (error) {
            console.error('Image compression failed:', error);
            return dataURL; // Return original on error
        }
    }

    async dataURLToCanvas(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0);
                resolve(canvas);
            };
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    async optimizeResolution(canvas, targetResolution) {
        const preset = this.resolutionPresets[targetResolution];
        if (!preset) {
            return canvas; // Return original if preset not found
        }

        const { width: targetWidth, height: targetHeight } = preset;
        
        // If canvas is already at target resolution or smaller, return as-is
        if (canvas.width <= targetWidth && canvas.height <= targetHeight) {
            return canvas;
        }

        // Create new canvas with target resolution
        const optimizedCanvas = document.createElement('canvas');
        const ctx = optimizedCanvas.getContext('2d');
        
        // Calculate aspect ratio preserving dimensions
        const aspectRatio = canvas.width / canvas.height;
        let newWidth, newHeight;
        
        if (aspectRatio > 1) {
            // Landscape
            newWidth = Math.min(targetWidth, canvas.width);
            newHeight = newWidth / aspectRatio;
        } else {
            // Portrait or square
            newHeight = Math.min(targetHeight, canvas.height);
            newWidth = newHeight * aspectRatio;
        }
        
        optimizedCanvas.width = Math.round(newWidth);
        optimizedCanvas.height = Math.round(newHeight);
        
        // Use high-quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(canvas, 0, 0, optimizedCanvas.width, optimizedCanvas.height);
        
        return optimizedCanvas;
    }

    async canvasToCompressedDataURL(canvas, settings) {
        const format = this.webpSupported && settings.format === 'webp' ? 'image/webp' : 'image/jpeg';
        const quality = this.qualityPresets[settings.quality]?.quality || 0.75;
        
        return canvas.toDataURL(format, quality);
    }

    estimateSize(dataURL) {
        if (typeof dataURL !== 'string') return 0;
        
        // Remove data URL prefix to get base64 data
        const base64Data = dataURL.split(',')[1] || dataURL;
        
        // Estimate size: base64 is ~33% larger than binary
        return Math.round(base64Data.length * 0.75);
    }

    calculateSavings(originalDataURL, compressedDataURL) {
        const originalSize = this.estimateSize(originalDataURL);
        const compressedSize = this.estimateSize(compressedDataURL);
        
        return {
            originalSize,
            compressedSize,
            savedBytes: originalSize - compressedSize,
            compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
            compressionPercentage: originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0
        };
    }

    async compressBatch(images, options = {}) {
        if (!Array.isArray(images) || images.length === 0) {
            return [];
        }

        const batchId = this.generateBatchId();
        const results = [];
        const settings = { ...this.currentSettings, ...options };
        
        this.emitEvent('compression:batchStarted', {
            batchId,
            totalImages: images.length,
            settings
        });

        for (let i = 0; i < images.length; i++) {
            try {
                const compressedImage = await this.compressImage(images[i], settings);
                results.push({
                    index: i,
                    original: images[i],
                    compressed: compressedImage,
                    success: true
                });
                
                this.emitEvent('compression:batchProgress', {
                    batchId,
                    completed: i + 1,
                    total: images.length,
                    percentage: ((i + 1) / images.length) * 100
                });
                
                // Yield to browser every few iterations
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
            } catch (error) {
                console.error(`Batch compression failed for image ${i}:`, error);
                results.push({
                    index: i,
                    original: images[i],
                    compressed: images[i], // Return original on error
                    success: false,
                    error: error.message
                });
            }
        }

        this.emitEvent('compression:batchCompleted', {
            batchId,
            results,
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length
        });

        return results;
    }

    // Configuration methods
    setQuality(quality) {
        if (this.qualityPresets[quality]) {
            this.currentSettings.quality = quality;
            this.saveSettings();
        }
    }

    setResolution(resolution) {
        if (this.resolutionPresets[resolution]) {
            this.currentSettings.resolution = resolution;
            this.saveSettings();
        }
    }

    setFormat(format) {
        const supportedFormats = this.webpSupported ? ['webp', 'jpeg'] : ['jpeg'];
        if (supportedFormats.includes(format)) {
            this.currentSettings.format = format;
            this.saveSettings();
        }
    }

    setCompressionEnabled(enabled) {
        this.currentSettings.enableCompression = enabled;
        this.saveSettings();
    }

    getSettings() {
        return { ...this.currentSettings };
    }

    updateSettings(newSettings) {
        this.currentSettings = { ...this.currentSettings, ...newSettings };
        this.saveSettings();
    }

    saveSettings() {
        try {
            localStorage.setItem('nft_generator_compression_settings', JSON.stringify(this.currentSettings));
        } catch (error) {
            console.error('Failed to save compression settings:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('nft_generator_compression_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.currentSettings = { ...this.defaultSettings, ...settings };
            }
        } catch (error) {
            console.error('Failed to load compression settings:', error);
        }
    }

    // Statistics methods
    updateStats(originalSize, compressedSize) {
        this.stats.totalCompressed++;
        this.stats.totalSizeBefore += originalSize;
        this.stats.totalSizeAfter += compressedSize;
        
        if (this.stats.totalSizeBefore > 0) {
            this.stats.averageCompressionRatio = this.stats.totalSizeAfter / this.stats.totalSizeBefore;
        }
    }

    getStats() {
        const totalSaved = this.stats.totalSizeBefore - this.stats.totalSizeAfter;
        const compressionPercentage = this.stats.totalSizeBefore > 0 ? 
            (totalSaved / this.stats.totalSizeBefore) * 100 : 0;

        return {
            ...this.stats,
            totalSaved,
            compressionPercentage,
            averageOriginalSize: this.stats.totalCompressed > 0 ? 
                this.stats.totalSizeBefore / this.stats.totalCompressed : 0,
            averageCompressedSize: this.stats.totalCompressed > 0 ? 
                this.stats.totalSizeAfter / this.stats.totalCompressed : 0
        };
    }

    resetStats() {
        this.stats = {
            totalCompressed: 0,
            totalSizeBefore: 0,
            totalSizeAfter: 0,
            averageCompressionRatio: 0
        };
    }

    // Format conversion utilities
    async convertFormat(dataURL, targetFormat, quality = 0.75) {
        try {
            const canvas = await this.dataURLToCanvas(dataURL);
            const mimeType = targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
            return canvas.toDataURL(mimeType, quality);
        } catch (error) {
            console.error('Format conversion failed:', error);
            return dataURL;
        }
    }

    async createThumbnail(dataURL, size = 128) {
        try {
            const canvas = await this.dataURLToCanvas(dataURL);
            const thumbnailCanvas = document.createElement('canvas');
            const ctx = thumbnailCanvas.getContext('2d');
            
            thumbnailCanvas.width = size;
            thumbnailCanvas.height = size;
            
            // Calculate crop dimensions to maintain aspect ratio
            const sourceSize = Math.min(canvas.width, canvas.height);
            const sourceX = (canvas.width - sourceSize) / 2;
            const sourceY = (canvas.height - sourceSize) / 2;
            
            ctx.drawImage(
                canvas,
                sourceX, sourceY, sourceSize, sourceSize,
                0, 0, size, size
            );
            
            return thumbnailCanvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error('Thumbnail creation failed:', error);
            return dataURL;
        }
    }

    // Utility methods
    generateBatchId() {
        return `compress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    emitEvent(eventName, detail) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    // Integration methods for ZIP export
    async prepareForExport(images, exportSettings = {}) {
        const settings = {
            quality: exportSettings.quality || 'high',
            resolution: exportSettings.resolution || 'standard',
            format: exportSettings.format || this.currentSettings.format,
            enableCompression: exportSettings.enableCompression !== false
        };

        if (!settings.enableCompression) {
            return images;
        }

        return await this.compressBatch(images, settings);
    }

    // Cleanup methods
    destroy() {
        this.compressionQueue = [];
        this.isProcessing = false;
        this.workerPool = [];
        this.isInitialized = false;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompressionManager;
} else if (typeof window !== 'undefined') {
    window.CompressionManager = CompressionManager;
}