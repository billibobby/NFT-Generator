// API Configuration Export/Import System
// Allows users to backup and restore API configurations

// ===== CONFIGURATION MANAGER CLASS =====

class APIConfigManager {
    constructor() {
        this.version = '1.0';
        this.configKey = 'nft_generator_api_config';
    }
    
    exportConfiguration() {
        try {
            const config = {
                version: this.version,
                timestamp: Date.now(),
                providers: this.getProviderConfiguration(),
                settings: this.getSettingsConfiguration()
            };
            
            return config;
        } catch (error) {
            console.error('Failed to export configuration:', error);
            throw new Error('Configuration export failed');
        }
    }
    
    downloadConfiguration() {
        try {
            const config = this.exportConfiguration();
            const configJson = JSON.stringify(config, null, 2);
            
            const blob = new Blob([configJson], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nft-generator-config-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Configuration downloaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to download configuration:', error);
            return false;
        }
    }
    
    getConfigurationJSON() {
        const config = this.exportConfiguration();
        return JSON.stringify(config, null, 2);
    }
    
    async importConfiguration(jsonString) {
        try {
            const config = JSON.parse(jsonString);
            
            // Validate configuration structure
            const validation = this.validateConfiguration(config);
            if (!validation.isValid) {
                throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
            }
            
            // Show warning to user
            const confirmed = confirm(
                'This will replace your current API configuration. ' +
                'API keys will NOT be imported for security reasons. ' +
                'Continue?'
            );
            
            if (!confirmed) {
                return false;
            }
            
            // Apply configuration
            await this.applyConfiguration(config);
            
            console.log('Configuration imported successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error(`Configuration import failed: ${error.message}`);
        }
    }
    
    async applyConfiguration(config) {
        try {
            // Apply provider settings
            if (config.providers) {
                await this.applyProviderConfiguration(config.providers);
            }
            
            // Apply general settings
            if (config.settings) {
                await this.applySettingsConfiguration(config.settings);
            }
            
            // Save applied configuration
            this.saveAppliedConfiguration(config);
            
            // Emit configuration changed event
            window.dispatchEvent(new CustomEvent('configurationChanged', {
                detail: { config }
            }));
            
        } catch (error) {
            console.error('Failed to apply configuration:', error);
            throw error;
        }
    }
    
    validateConfiguration(config) {
        const errors = [];
        
        // Check version
        if (!config.version) {
            errors.push('Missing version field');
        }
        
        // Check timestamp
        if (!config.timestamp || typeof config.timestamp !== 'number') {
            errors.push('Invalid or missing timestamp');
        }
        
        // Validate providers section
        if (config.providers) {
            const validProviders = ['gemini', 'openai', 'stable_diffusion'];
            
            Object.keys(config.providers).forEach(providerName => {
                if (!validProviders.includes(providerName)) {
                    errors.push(`Unknown provider: ${providerName}`);
                }
                
                const provider = config.providers[providerName];
                if (typeof provider.enabled !== 'boolean') {
                    errors.push(`Invalid enabled value for ${providerName}`);
                }
                
                if (typeof provider.priority !== 'number' || provider.priority < 1) {
                    errors.push(`Invalid priority value for ${providerName}`);
                }
            });
        }
        
        // Validate settings section
        if (config.settings) {
            const settings = config.settings;
            
            if (settings.activeProvider && typeof settings.activeProvider !== 'string') {
                errors.push('Invalid activeProvider setting');
            }
            
            if (settings.autoFailover && typeof settings.autoFailover !== 'boolean') {
                errors.push('Invalid autoFailover setting');
            }
            
            if (settings.logVerbosity && (typeof settings.logVerbosity !== 'number' || 
                settings.logVerbosity < 0 || settings.logVerbosity > 2)) {
                errors.push('Invalid logVerbosity setting');
            }
        }
        
        // Check for potential security issues
        if (this.containsSensitiveData(config)) {
            errors.push('Configuration contains potentially sensitive data');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    containsSensitiveData(config) {
        const configString = JSON.stringify(config).toLowerCase();
        
        // Check for common API key patterns
        const sensitivePatterns = [
            /api[_-]?key/,
            /secret/,
            /token/,
            /password/,
            /sk-[a-z0-9]{48}/i, // OpenAI key pattern
            /AIza[a-z0-9]{35}/i // Google API key pattern
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(configString));
    }
    
    getProviderConfiguration() {
        const providers = {};
        
        // Get current provider states from API manager
        if (window.apiManager) {
            const status = window.apiManager.getProviderStatus();
            
            status.forEach((provider, index) => {
                providers[provider.name] = {
                    enabled: provider.isHealthy,
                    priority: index + 1
                };
            });
        }
        
        return providers;
    }
    
    getSettingsConfiguration() {
        const settings = {
            autoFailover: true,
            logVerbosity: 2,
            rateLimit: { enabled: true }
        };
        
        // Get active provider
        if (window.apiManager && window.apiState.activeProvider) {
            settings.activeProvider = window.apiState.activeProvider.getName();
        }
        
        // Get logger settings
        if (window.apiLogger) {
            settings.logVerbosity = window.apiLogger.verbosity;
        }
        
        return settings;
    }
    
    async applyProviderConfiguration(providers) {
        if (!window.apiManager) {
            throw new Error('API Manager not available');
        }
        
        // Build failover order based on priorities
        const sortedProviders = Object.entries(providers)
            .sort(([, a], [, b]) => a.priority - b.priority)
            .map(([name]) => name);
        
        // Set failover order
        window.apiManager.setFailoverOrder(sortedProviders);
        
        // Set active provider (highest priority enabled provider)
        const activeProvider = sortedProviders.find(name => providers[name].enabled);
        if (activeProvider) {
            try {
                window.apiManager.setActiveProvider(activeProvider);
            } catch (error) {
                console.warn(`Could not set active provider to ${activeProvider}:`, error);
            }
        }
    }
    
    async applySettingsConfiguration(settings) {
        // Apply logger settings
        if (window.apiLogger && typeof settings.logVerbosity === 'number') {
            window.apiLogger.setVerbosity(settings.logVerbosity);
        }
        
        // Apply active provider setting
        if (window.apiManager && settings.activeProvider) {
            try {
                window.apiManager.setActiveProvider(settings.activeProvider);
            } catch (error) {
                console.warn(`Could not set active provider from config:`, error);
            }
        }
        
        // Store other settings for future use
        this.saveSettings(settings);
    }
    
    saveAppliedConfiguration(config) {
        try {
            // Save a record of the applied configuration (without sensitive data)
            const safeConfig = {
                version: config.version,
                timestamp: config.timestamp,
                appliedAt: Date.now(),
                providers: config.providers,
                settings: config.settings
            };
            
            localStorage.setItem(this.configKey, JSON.stringify(safeConfig));
        } catch (error) {
            console.warn('Failed to save applied configuration:', error);
        }
    }
    
    saveSettings(settings) {
        try {
            const currentSettings = this.loadSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            
            localStorage.setItem('nft_generator_settings', JSON.stringify(updatedSettings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
    
    loadSettings() {
        try {
            const stored = localStorage.getItem('nft_generator_settings');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return {};
        }
    }
    
    getLastAppliedConfiguration() {
        try {
            const stored = localStorage.getItem(this.configKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.warn('Failed to load last applied configuration:', error);
            return null;
        }
    }
    
    // Utility methods for UI integration
    
    createImportFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                const text = await this.readFileAsText(file);
                await this.importConfiguration(text);
                alert('Configuration imported successfully!');
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            } finally {
                document.body.removeChild(input);
            }
        });
        
        document.body.appendChild(input);
        input.click();
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    // Security helpers
    
    sanitizeConfigValue(value) {
        if (typeof value === 'string') {
            // Remove potentially dangerous characters
            return value.replace(/[<>'"&]/g, '');
        }
        return value;
    }
    
    sanitizeConfiguration(config) {
        const sanitized = {};
        
        Object.keys(config).forEach(key => {
            const value = config[key];
            
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeConfiguration(value);
            } else {
                sanitized[key] = this.sanitizeConfigValue(value);
            }
        });
        
        return sanitized;
    }
}

// Export for global usage
window.APIConfigManager = APIConfigManager;