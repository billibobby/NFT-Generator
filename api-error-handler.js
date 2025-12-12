// API Error Handling and Recovery System
// Centralized error handling for all API operations

// ===== CUSTOM ERROR CLASSES =====

class APIKeyInvalidError extends Error {
    constructor(provider, message = 'Invalid or expired API key') {
        super(message);
        this.name = 'APIKeyInvalidError';
        this.provider = provider;
        this.code = 'INVALID_API_KEY';
        this.retriable = false;
    }
}

class RateLimitError extends Error {
    constructor(provider, retryAfter = 60, message = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
        this.provider = provider;
        this.code = 'RATE_LIMIT_EXCEEDED';
        this.retryAfter = retryAfter;
        this.retriable = true;
    }
}

class QuotaExceededError extends Error {
    constructor(provider, resetTime = null, message = 'Monthly/daily quota exhausted') {
        super(message);
        this.name = 'QuotaExceededError';
        this.provider = provider;
        this.code = 'QUOTA_EXCEEDED';
        this.resetTime = resetTime;
        this.retriable = false;
    }
}

class NetworkError extends Error {
    constructor(provider, originalError, message = 'Network connection failed') {
        super(message);
        this.name = 'NetworkError';
        this.provider = provider;
        this.code = 'NETWORK_ERROR';
        this.originalError = originalError;
        this.retriable = true;
    }
}

class ProviderError extends Error {
    constructor(provider, code, message = 'Provider-specific error') {
        super(message);
        this.name = 'ProviderError';
        this.provider = provider;
        this.code = code;
        this.retriable = false;
    }
}

class ValidationError extends Error {
    constructor(field, value, message = 'Invalid parameter') {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
        this.code = 'VALIDATION_ERROR';
        this.retriable = false;
    }
}

// ===== ERROR HANDLER CLASS =====

class APIErrorHandler {
    constructor() {
        this.maxRetryAttempts = 5;
        this.baseRetryDelay = 1000; // 1 second
        this.maxRetryDelay = 16000; // 16 seconds
    }
    
    handleError(error, context = {}) {
        const errorInfo = {
            timestamp: Date.now(),
            provider: context.provider || 'unknown',
            operation: context.operation || 'unknown',
            attempt: context.attempt || 1,
            originalError: error
        };
        
        // Classify the error
        const classifiedError = this.classifyError(error, context);
        
        // Log the error
        this.logError(classifiedError, errorInfo);
        
        // Determine action
        const action = this.determineAction(classifiedError, context);
        
        return {
            error: classifiedError,
            action: action,
            retryDelay: this.getRetryDelay(classifiedError, context.attempt || 1),
            userMessage: this.formatErrorMessage(classifiedError)
        };
    }
    
    classifyError(error, context) {
        // If already classified, return as-is
        if (error instanceof APIKeyInvalidError || 
            error instanceof RateLimitError || 
            error instanceof QuotaExceededError || 
            error instanceof NetworkError || 
            error instanceof ProviderError || 
            error instanceof ValidationError) {
            return error;
        }
        
        // Classify based on HTTP status or error message
        if (error.status) {
            switch (error.status) {
                case 401:
                case 403:
                    return new APIKeyInvalidError(context.provider, error.message);
                case 429:
                    const retryAfter = this.parseRetryAfter(error.headers);
                    return new RateLimitError(context.provider, retryAfter, error.message);
                case 402:
                    return new QuotaExceededError(context.provider, null, error.message);
                case 400:
                    return new ValidationError('request', error.body, error.message);
                case 500:
                case 502:
                case 503:
                case 504:
                    return new ProviderError(context.provider, `HTTP_${error.status}`, error.message);
                default:
                    if (error.status >= 500) {
                        return new ProviderError(context.provider, `HTTP_${error.status}`, error.message);
                    }
            }
        }
        
        // Classify based on error message patterns
        const message = error.message?.toLowerCase() || '';
        
        if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
            return new NetworkError(context.provider, error);
        }
        
        if (message.includes('api key') || message.includes('unauthorized') || message.includes('forbidden')) {
            return new APIKeyInvalidError(context.provider, error.message);
        }
        
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return new RateLimitError(context.provider, 60, error.message);
        }
        
        if (message.includes('quota') || message.includes('credit') || message.includes('billing')) {
            return new QuotaExceededError(context.provider, null, error.message);
        }
        
        // Default to provider error
        return new ProviderError(context.provider, 'UNKNOWN_ERROR', error.message || 'Unknown error occurred');
    }
    
    isRetriable(error) {
        if (error.retriable !== undefined) {
            return error.retriable;
        }
        
        // Default retriable logic
        return error instanceof NetworkError || 
               error instanceof RateLimitError ||
               (error instanceof ProviderError && error.code.startsWith('HTTP_5'));
    }
    
    getRetryDelay(error, attemptCount) {
        if (!this.isRetriable(error)) {
            return 0;
        }
        
        // Rate limit errors use specific retry-after time
        if (error instanceof RateLimitError && error.retryAfter) {
            return error.retryAfter * 1000; // Convert to milliseconds
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(
            this.baseRetryDelay * Math.pow(2, attemptCount - 1),
            this.maxRetryDelay
        );
        
        // Add jitter (±25%)
        const jitter = delay * 0.25 * (Math.random() - 0.5);
        return Math.max(0, delay + jitter);
    }
    
    determineAction(error, context) {
        const attempt = context.attempt || 1;
        
        if (!this.isRetriable(error)) {
            return 'fail';
        }
        
        if (attempt >= this.maxRetryAttempts) {
            return 'fail';
        }
        
        if (error instanceof RateLimitError) {
            return 'retry_after_delay';
        }
        
        if (error instanceof NetworkError) {
            return 'retry_with_backoff';
        }
        
        return 'retry_with_backoff';
    }
    
    formatErrorMessage(error) {
        const baseMessages = {
            'APIKeyInvalidError': 'Invalid API key. Please check your API key configuration.',
            'RateLimitError': 'Rate limit exceeded. Please wait before making more requests.',
            'QuotaExceededError': 'API quota exhausted. Please check your account limits.',
            'NetworkError': 'Network connection failed. Please check your internet connection.',
            'ProviderError': 'Service temporarily unavailable. Please try again later.',
            'ValidationError': 'Invalid request parameters. Please check your input.'
        };
        
        let message = baseMessages[error.name] || 'An unexpected error occurred.';
        
        // Add provider-specific suggestions
        if (error.provider) {
            const suggestions = this.getProviderSuggestions(error.provider, error);
            if (suggestions) {
                message += ` ${suggestions}`;
            }
        }
        
        return message;
    }
    
    getProviderSuggestions(provider, error) {
        const suggestions = {
            'gemini': {
                'APIKeyInvalidError': 'Visit Google AI Studio to verify your API key.',
                'QuotaExceededError': 'Check your usage in Google Cloud Console.'
            },
            'openai': {
                'APIKeyInvalidError': 'Visit OpenAI Platform to verify your API key.',
                'QuotaExceededError': 'Check your usage limits in OpenAI Dashboard.'
            },
            'stable_diffusion': {
                'APIKeyInvalidError': 'Visit Stability AI Platform to verify your API key.',
                'QuotaExceededError': 'Check your credit balance in Stability AI Dashboard.'
            }
        };
        
        return suggestions[provider]?.[error.name] || null;
    }
    
    parseRetryAfter(headers) {
        if (!headers) return 60;
        
        const retryAfter = headers['retry-after'] || headers['Retry-After'];
        if (retryAfter) {
            const seconds = parseInt(retryAfter);
            return isNaN(seconds) ? 60 : seconds;
        }
        
        return 60;
    }
    
    logError(error, errorInfo) {
        const logLevel = this.getLogLevel(error);
        const logMessage = `[${errorInfo.provider}] ${error.name}: ${error.message}`;
        
        switch (logLevel) {
            case 'error':
                console.error(logMessage, { error, errorInfo });
                break;
            case 'warn':
                console.warn(logMessage, { error, errorInfo });
                break;
            case 'info':
                console.info(logMessage, { error, errorInfo });
                break;
        }
    }
    
    getLogLevel(error) {
        if (error instanceof NetworkError || error instanceof ProviderError) {
            return 'error';
        }
        
        if (error instanceof RateLimitError || error instanceof QuotaExceededError) {
            return 'warn';
        }
        
        return 'info';
    }
    
    reportError(error) {
        // Optional error reporting/analytics
        // Could be implemented to send errors to external service
        console.debug('Error reported:', error);
    }
}

// Export classes for global usage
window.APIErrorHandler = APIErrorHandler;
window.APIKeyInvalidError = APIKeyInvalidError;
window.RateLimitError = RateLimitError;
window.QuotaExceededError = QuotaExceededError;
window.NetworkError = NetworkError;
window.ProviderError = ProviderError;
window.ValidationError = ValidationError;