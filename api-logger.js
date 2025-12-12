// API Request/Response Logging System
// Comprehensive logging for debugging and monitoring

// ===== LOGGER CLASS =====

class APIRequestLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100; // Circular buffer
        this.verbosity = 2; // 0=off, 1=errors only, 2=all
        this.persistLogs = false;
        this.storageKey = 'nft_generator_api_logs';
        this.requestIdCounter = 0;
        
        // Load settings from localStorage
        this.loadSettings();
        
        // Load persisted logs if enabled
        if (this.persistLogs) {
            this.loadPersistedLogs();
        }
    }
    
    generateRequestId() {
        return `req_${Date.now()}_${++this.requestIdCounter}`;
    }
    
    logRequest(provider, prompt, options = {}) {
        const requestId = this.generateRequestId();
        
        const logEntry = {
            id: requestId,
            timestamp: Date.now(),
            provider: provider,
            prompt: this.truncatePrompt(prompt),
            options: { ...options },
            status: 'pending',
            duration: null,
            error: null,
            responseSize: null
        };
        
        this.addLog(logEntry);
        
        if (this.verbosity >= 2) {
            console.group(`%c[API Request] ${provider}`, 'color: #3b82f6; font-weight: bold');
            console.log('Request ID:', requestId);
            console.log('Prompt:', prompt);
            console.log('Options:', options);
            console.log('Timestamp:', new Date(logEntry.timestamp).toISOString());
            console.groupEnd();
        }
        
        return requestId;
    }
    
    logResponse(requestId, status, data = null, duration = null) {
        const logEntry = this.findLog(requestId);
        if (!logEntry) {
            console.warn('Log entry not found for request ID:', requestId);
            return;
        }
        
        logEntry.status = status;
        logEntry.duration = duration;
        
        if (data && typeof data === 'string') {
            logEntry.responseSize = data.length;
        }
        
        const color = status === 'success' ? '#10b981' : '#ef4444';
        const icon = status === 'success' ? '✓' : '✗';
        
        if (this.verbosity >= 2 || (this.verbosity >= 1 && status !== 'success')) {
            console.group(`%c[API Response] ${icon} ${logEntry.provider}`, `color: ${color}; font-weight: bold`);
            console.log('Request ID:', requestId);
            console.log('Status:', status);
            console.log('Duration:', duration ? `${duration}ms` : 'unknown');
            console.log('Response Size:', logEntry.responseSize ? `${logEntry.responseSize} bytes` : 'unknown');
            console.groupEnd();
        }
        
        this.persistLogsIfEnabled();
    }
    
    logError(requestId, error) {
        const logEntry = this.findLog(requestId);
        if (!logEntry) {
            console.warn('Log entry not found for request ID:', requestId);
            return;
        }
        
        logEntry.status = 'error';
        logEntry.error = {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            code: error.code || null,
            provider: error.provider || logEntry.provider
        };
        
        if (this.verbosity >= 1) {
            console.group(`%c[API Error] ✗ ${logEntry.provider}`, 'color: #ef4444; font-weight: bold');
            console.log('Request ID:', requestId);
            console.log('Error Type:', error.name);
            console.log('Error Message:', error.message);
            console.log('Error Code:', error.code);
            console.error('Full Error:', error);
            console.groupEnd();
        }
        
        this.persistLogsIfEnabled();
    }
    
    addLog(logEntry) {
        this.logs.push(logEntry);
        
        // Maintain circular buffer
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }
    
    findLog(requestId) {
        return this.logs.find(log => log.id === requestId);
    }
    
    truncatePrompt(prompt, maxLength = 100) {
        if (!prompt || prompt.length <= maxLength) {
            return prompt;
        }
        return prompt.substring(0, maxLength) + '...';
    }
    
    getRecentLogs(count = 10) {
        return this.logs.slice(-count).reverse();
    }
    
    exportLogs() {
        const exportData = {
            timestamp: new Date().toISOString(),
            totalLogs: this.logs.length,
            logs: this.logs,
            statistics: this.getStatistics()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nft-generator-api-logs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('API logs exported successfully');
    }
    
    clearLogs() {
        this.logs = [];
        this.requestIdCounter = 0;
        
        if (this.persistLogs) {
            localStorage.removeItem(this.storageKey);
        }
        
        console.log('API logs cleared');
    }
    
    getStatistics() {
        if (this.logs.length === 0) {
            return {
                totalRequests: 0,
                successRate: 0,
                averageResponseTime: 0,
                providerStats: {},
                errorStats: {}
            };
        }
        
        const stats = {
            totalRequests: this.logs.length,
            successCount: 0,
            errorCount: 0,
            totalDuration: 0,
            durationCount: 0,
            providerStats: {},
            errorStats: {}
        };
        
        this.logs.forEach(log => {
            // Success rate calculation
            if (log.status === 'success') {
                stats.successCount++;
            } else if (log.status === 'error') {
                stats.errorCount++;
            }
            
            // Duration calculation
            if (log.duration) {
                stats.totalDuration += log.duration;
                stats.durationCount++;
            }
            
            // Provider statistics
            if (!stats.providerStats[log.provider]) {
                stats.providerStats[log.provider] = {
                    total: 0,
                    success: 0,
                    error: 0,
                    totalDuration: 0,
                    durationCount: 0
                };
            }
            
            const providerStat = stats.providerStats[log.provider];
            providerStat.total++;
            
            if (log.status === 'success') {
                providerStat.success++;
            } else if (log.status === 'error') {
                providerStat.error++;
            }
            
            if (log.duration) {
                providerStat.totalDuration += log.duration;
                providerStat.durationCount++;
            }
            
            // Error statistics
            if (log.error) {
                const errorType = log.error.name || 'Unknown';
                if (!stats.errorStats[errorType]) {
                    stats.errorStats[errorType] = 0;
                }
                stats.errorStats[errorType]++;
            }
        });
        
        // Calculate derived statistics
        stats.successRate = stats.totalRequests > 0 ? 
            (stats.successCount / stats.totalRequests) * 100 : 0;
        
        stats.averageResponseTime = stats.durationCount > 0 ? 
            stats.totalDuration / stats.durationCount : 0;
        
        // Calculate provider success rates and average response times
        Object.keys(stats.providerStats).forEach(provider => {
            const providerStat = stats.providerStats[provider];
            providerStat.successRate = providerStat.total > 0 ? 
                (providerStat.success / providerStat.total) * 100 : 0;
            providerStat.averageResponseTime = providerStat.durationCount > 0 ? 
                providerStat.totalDuration / providerStat.durationCount : 0;
        });
        
        return stats;
    }
    
    setVerbosity(level) {
        this.verbosity = Math.max(0, Math.min(2, level));
        this.saveSettings();
        console.log(`API logging verbosity set to ${level}`);
    }
    
    setPersistence(enabled) {
        this.persistLogs = enabled;
        this.saveSettings();
        
        if (enabled) {
            this.persistLogsIfEnabled();
        } else {
            localStorage.removeItem(this.storageKey);
        }
        
        console.log(`API log persistence ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    loadSettings() {
        try {
            const settings = localStorage.getItem('nft_generator_logger_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                this.verbosity = parsed.verbosity ?? 2;
                this.persistLogs = parsed.persistLogs ?? false;
            }
        } catch (error) {
            console.warn('Failed to load logger settings:', error);
        }
    }
    
    saveSettings() {
        try {
            const settings = {
                verbosity: this.verbosity,
                persistLogs: this.persistLogs
            };
            localStorage.setItem('nft_generator_logger_settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save logger settings:', error);
        }
    }
    
    persistLogsIfEnabled() {
        if (!this.persistLogs) return;
        
        try {
            // Implement log rotation - keep last 7 days
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const recentLogs = this.logs.filter(log => log.timestamp > sevenDaysAgo);
            
            localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
        } catch (error) {
            console.warn('Failed to persist logs:', error);
        }
    }
    
    loadPersistedLogs() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const logs = JSON.parse(stored);
                this.logs = Array.isArray(logs) ? logs : [];
                
                // Update request ID counter to avoid conflicts
                if (this.logs.length > 0) {
                    const lastLog = this.logs[this.logs.length - 1];
                    const lastId = lastLog.id.split('_')[2];
                    this.requestIdCounter = parseInt(lastId) || 0;
                }
            }
        } catch (error) {
            console.warn('Failed to load persisted logs:', error);
            this.logs = [];
        }
    }
    
    // Privacy mode - disable all logging
    enablePrivacyMode() {
        this.verbosity = 0;
        this.persistLogs = false;
        this.clearLogs();
        this.saveSettings();
        console.log('Privacy mode enabled - all logging disabled');
    }
    
    // Debug helper - display formatted statistics
    displayStatistics() {
        const stats = this.getStatistics();
        
        console.group('%c[API Statistics]', 'color: #8b5cf6; font-weight: bold; font-size: 14px');
        console.log(`Total Requests: ${stats.totalRequests}`);
        console.log(`Success Rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`Average Response Time: ${stats.averageResponseTime.toFixed(0)}ms`);
        
        if (Object.keys(stats.providerStats).length > 0) {
            console.group('Provider Statistics:');
            Object.entries(stats.providerStats).forEach(([provider, stat]) => {
                console.log(`${provider}: ${stat.total} requests, ${stat.successRate.toFixed(1)}% success, ${stat.averageResponseTime.toFixed(0)}ms avg`);
            });
            console.groupEnd();
        }
        
        if (Object.keys(stats.errorStats).length > 0) {
            console.group('Error Statistics:');
            Object.entries(stats.errorStats).forEach(([errorType, count]) => {
                console.log(`${errorType}: ${count} occurrences`);
            });
            console.groupEnd();
        }
        
        console.groupEnd();
    }
}

// Export for global usage
window.APIRequestLogger = APIRequestLogger;