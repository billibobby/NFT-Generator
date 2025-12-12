// API Key Storage System with AES-256-GCM Encryption
// Secure localStorage management for NFT Generator API keys

// ===== ENCRYPTION UTILITIES =====

class EncryptionUtils {
    static async generateEncryptionKey() {
        // Generate or retrieve salt for PBKDF2 (used only as salt, not as key material)
        let salt = localStorage.getItem('nft_generator_encryption_salt');
        if (!salt) {
            const saltArray = crypto.getRandomValues(new Uint8Array(16));
            salt = btoa(String.fromCharCode(...saltArray));
            localStorage.setItem('nft_generator_encryption_salt', salt);
        }
        
        // Generate or retrieve master key (separate from salt for proper entropy)
        let masterKey = localStorage.getItem('nft_generator_master_key');
        if (!masterKey) {
            // Generate a random master key with proper entropy
            const masterKeyArray = crypto.getRandomValues(new Uint8Array(32));
            masterKey = btoa(String.fromCharCode(...masterKeyArray));
            localStorage.setItem('nft_generator_master_key', masterKey);
        }
        
        // Convert to Uint8Arrays
        const saltBytes = new Uint8Array(atob(salt).split('').map(char => char.charCodeAt(0)));
        const masterKeyBytes = new Uint8Array(atob(masterKey).split('').map(char => char.charCodeAt(0)));
        
        // Import master key as PBKDF2 key material (proper entropy source)
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            masterKeyBytes,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        // Derive AES-256-GCM key using master key as source and salt as salt parameter
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBytes, // Salt used properly as salt parameter
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial, // Master key used as key material (proper entropy)
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    static async encryptData(plaintext, key) {
        try {
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt the data
            const encodedText = new TextEncoder().encode(plaintext);
            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedText
            );
            
            return {
                encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
                iv: btoa(String.fromCharCode(...iv))
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    
    static async decryptData(encryptedData, key) {
        try {
            // Convert base64 back to Uint8Array
            const ciphertext = new Uint8Array(atob(encryptedData.encrypted).split('').map(char => char.charCodeAt(0)));
            const iv = new Uint8Array(atob(encryptedData.iv).split('').map(char => char.charCodeAt(0)));
            
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );
            
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }
    
    static deriveKeyFromPassword(password) {
        // Optional password-based encryption for future use
        const encoder = new TextEncoder();
        return crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
    }
}

// ===== STORAGE MANAGER =====

class APIKeyStorage {
    constructor() {
        this.storageKey = 'nft_generator_api_keys';
        this.encryptionKey = null;
        this.isWebCryptoSupported = this.checkWebCryptoSupport();
    }
    
    checkWebCryptoSupport() {
        return !!(window.crypto && window.crypto.subtle);
    }
    
    async initializeEncryption() {
        if (!this.isWebCryptoSupported) {
            console.warn('WebCrypto API not supported, falling back to Base64 encoding');
            return;
        }
        
        if (!this.encryptionKey) {
            this.encryptionKey = await EncryptionUtils.generateEncryptionKey();
        }
    }
    
    async saveAPIKey(providerName, apiKey) {
        try {
            await this.initializeEncryption();
            
            // Get existing storage or create new
            const storage = this.getStorageObject();
            
            if (this.isWebCryptoSupported) {
                // Encrypt the API key
                const encryptedData = await EncryptionUtils.encryptData(apiKey, this.encryptionKey);
                storage[providerName] = {
                    encrypted: encryptedData.encrypted,
                    iv: encryptedData.iv,
                    timestamp: Date.now()
                };
            } else {
                // Fallback to Base64 encoding with warning
                console.warn('Storing API key with Base64 encoding - not secure!');
                storage[providerName] = {
                    encoded: btoa(apiKey),
                    timestamp: Date.now(),
                    insecure: true
                };
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
            return true;
        } catch (error) {
            console.error('Failed to save API key:', error);
            return false;
        }
    }
    
    async getAPIKey(providerName) {
        try {
            await this.initializeEncryption();
            
            const storage = this.getStorageObject();
            const keyData = storage[providerName];
            
            if (!keyData) {
                return null;
            }
            
            // Check for auto-expiration (30 days default)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            if (keyData.timestamp < thirtyDaysAgo) {
                console.warn(`API key for ${providerName} has expired, removing`);
                await this.removeAPIKey(providerName);
                return null;
            }
            
            if (this.isWebCryptoSupported && keyData.encrypted) {
                // Decrypt the API key
                const decrypted = await EncryptionUtils.decryptData({
                    encrypted: keyData.encrypted,
                    iv: keyData.iv
                }, this.encryptionKey);
                
                return decrypted;
            } else if (keyData.encoded) {
                // Fallback Base64 decoding
                return atob(keyData.encoded);
            }
            
            return null;
        } catch (error) {
            console.error('Failed to retrieve API key:', error);
            return null;
        }
    }
    
    async removeAPIKey(providerName) {
        try {
            const storage = this.getStorageObject();
            delete storage[providerName];
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
            return true;
        } catch (error) {
            console.error('Failed to remove API key:', error);
            return false;
        }
    }
    
    async getAllProviders() {
        const storage = this.getStorageObject();
        return Object.keys(storage).map(providerName => ({
            name: providerName,
            hasKey: true,
            timestamp: storage[providerName].timestamp,
            isSecure: !storage[providerName].insecure
        }));
    }
    
    async clearAllKeys() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem('nft_generator_encryption_salt');
            localStorage.removeItem('nft_generator_master_key');
            this.encryptionKey = null;
            return true;
        } catch (error) {
            console.error('Failed to clear all keys:', error);
            return false;
        }
    }
    
    isKeyStored(providerName) {
        const storage = this.getStorageObject();
        return !!storage[providerName];
    }
    
    getStorageObject() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Failed to parse storage object:', error);
            return {};
        }
    }
    
    // Security check - warn if not HTTPS
    checkSecurityContext() {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.warn('API keys should only be stored over HTTPS connections');
            return false;
        }
        return true;
    }
}

// Export for module usage
window.APIKeyStorage = APIKeyStorage;
window.EncryptionUtils = EncryptionUtils;