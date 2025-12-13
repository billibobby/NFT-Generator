// NFT Generator - Budget Manager
// Budget tracking and enforcement system with per-provider limits

class BudgetManager {
    constructor() {
        this.db = null;
        this.dbName = 'nft-generator-budget';
        this.dbVersion = 1;
        this.isInitialized = false;
        
        // Default budget configuration
        this.defaultBudgets = {
            gemini: { daily: 5.00, monthly: 50.00 },
            openai: { daily: 10.00, monthly: 100.00 },
            stablediffusion: { daily: 7.50, monthly: 75.00 },
            global: { monthly: 200.00 },
            warningThreshold: 75 // Percentage
        };
        
        this.currentBudgets = { ...this.defaultBudgets };
        this.spendCache = new Map(); // In-memory cache for recent spend
        this.warningsSent = new Set(); // Track warnings to avoid spam
    }

    async initialize() {
        try {
            if (!window.indexedDB) {
                console.warn('IndexedDB not available for budget tracking');
                this.loadBudgetsFromLocalStorage();
                return false;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('Failed to open budget database:', request.error);
                    this.loadBudgetsFromLocalStorage();
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.isInitialized = true;
                    console.log('Budget manager initialized');
                    this.loadBudgetConfiguration();
                    resolve(true);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    // Create spendRecords store
                    if (!db.objectStoreNames.contains('spendRecords')) {
                        const spendStore = db.createObjectStore('spendRecords', { keyPath: 'id', autoIncrement: true });
                        spendStore.createIndex('timestamp', 'timestamp', { unique: false });
                        spendStore.createIndex('provider', 'provider', { unique: false });
                        spendStore.createIndex('category', 'category', { unique: false });
                        spendStore.createIndex('date', 'date', { unique: false });
                    }

                    // Create budgetLimits store
                    if (!db.objectStoreNames.contains('budgetLimits')) {
                        db.createObjectStore('budgetLimits', { keyPath: 'provider' });
                    }

                    // Create budgetAlerts store
                    if (!db.objectStoreNames.contains('budgetAlerts')) {
                        const alertStore = db.createObjectStore('budgetAlerts', { keyPath: 'id', autoIncrement: true });
                        alertStore.createIndex('timestamp', 'timestamp', { unique: false });
                        alertStore.createIndex('provider', 'provider', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.error('Budget manager initialization failed:', error);
            this.loadBudgetsFromLocalStorage();
            return false;
        }
    }

    async recordSpend(provider, amount, metadata = {}) {
        const spendRecord = {
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            provider,
            amount: parseFloat(amount),
            category: metadata.category || 'unknown',
            traitIndex: metadata.traitIndex || 0,
            success: metadata.success !== false,
            requestId: metadata.requestId || this.generateRequestId()
        };

        // Add to in-memory cache
        const cacheKey = `${provider}_${spendRecord.date}`;
        if (!this.spendCache.has(cacheKey)) {
            this.spendCache.set(cacheKey, []);
        }
        this.spendCache.get(cacheKey).push(spendRecord);

        // Store in IndexedDB
        if (this.isInitialized) {
            try {
                const transaction = this.db.transaction(['spendRecords'], 'readwrite');
                const store = transaction.objectStore('spendRecords');
                await new Promise((resolve, reject) => {
                    const request = store.add(spendRecord);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Failed to record spend:', error);
            }
        }

        // Check budget limits and emit warnings
        await this.checkBudgetLimits(provider);

        // Emit spend recorded event
        this.emitEvent('budget:recordSpend', spendRecord);

        return spendRecord;
    }

    async getCurrentSpend(provider, period = 'daily') {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'total':
                startDate = new Date(0); // Beginning of time
                break;
            default:
                throw new Error(`Invalid period: ${period}`);
        }

        // Check cache first
        const cacheKey = `${provider}_${startDate.toISOString().split('T')[0]}`;
        if (period === 'daily' && this.spendCache.has(cacheKey)) {
            const cachedRecords = this.spendCache.get(cacheKey);
            return cachedRecords.reduce((sum, record) => sum + record.amount, 0);
        }

        // Query database
        if (!this.isInitialized) {
            return 0;
        }

        try {
            const transaction = this.db.transaction(['spendRecords'], 'readonly');
            const store = transaction.objectStore('spendRecords');
            const index = store.index('timestamp');
            const range = IDBKeyRange.lowerBound(startDate.getTime());
            const request = index.openCursor(range);

            return new Promise((resolve) => {
                let totalSpend = 0;

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const record = cursor.value;
                        if (record.provider === provider && record.success) {
                            totalSpend += record.amount;
                        }
                        cursor.continue();
                    } else {
                        resolve(totalSpend);
                    }
                };

                request.onerror = () => {
                    console.error('Failed to get current spend:', request.error);
                    resolve(0);
                };
            });
        } catch (error) {
            console.error('Failed to get current spend:', error);
            return 0;
        }
    }

    async getRemainingBudget(provider) {
        const dailySpend = await this.getCurrentSpend(provider, 'daily');
        const monthlySpend = await this.getCurrentSpend(provider, 'monthly');

        const limits = this.currentBudgets[provider] || { daily: 0, monthly: 0 };
        
        return {
            daily: {
                limit: limits.daily,
                spent: dailySpend,
                remaining: Math.max(0, limits.daily - dailySpend),
                percentage: limits.daily > 0 ? (dailySpend / limits.daily) * 100 : 0
            },
            monthly: {
                limit: limits.monthly,
                spent: monthlySpend,
                remaining: Math.max(0, limits.monthly - monthlySpend),
                percentage: limits.monthly > 0 ? (monthlySpend / limits.monthly) * 100 : 0
            }
        };
    }

    async getSpendHistory(startDate, endDate) {
        if (!this.isInitialized) {
            return [];
        }

        try {
            const transaction = this.db.transaction(['spendRecords'], 'readonly');
            const store = transaction.objectStore('spendRecords');
            const index = store.index('timestamp');
            const range = IDBKeyRange.bound(
                new Date(startDate).getTime(),
                new Date(endDate).getTime()
            );
            const request = index.getAll(range);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = () => {
                    console.error('Failed to get spend history:', request.error);
                    resolve([]);
                };
            });
        } catch (error) {
            console.error('Failed to get spend history:', error);
            return [];
        }
    }

    async canMakeRequest(provider, estimatedCost) {
        const remaining = await this.getRemainingBudget(provider);
        
        // Check daily limit
        if (remaining.daily.remaining < estimatedCost) {
            return {
                allowed: false,
                reason: 'daily_limit_exceeded',
                message: `Request would exceed daily budget. Remaining: $${remaining.daily.remaining.toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
            };
        }

        // Check monthly limit
        if (remaining.monthly.remaining < estimatedCost) {
            return {
                allowed: false,
                reason: 'monthly_limit_exceeded',
                message: `Request would exceed monthly budget. Remaining: $${remaining.monthly.remaining.toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
            };
        }

        // Check global monthly limit
        const globalSpend = await this.getGlobalSpend('monthly');
        const globalLimit = this.currentBudgets.global.monthly;
        if (globalSpend + estimatedCost > globalLimit) {
            return {
                allowed: false,
                reason: 'global_limit_exceeded',
                message: `Request would exceed global monthly budget. Remaining: $${(globalLimit - globalSpend).toFixed(2)}, Required: $${estimatedCost.toFixed(2)}`
            };
        }

        return { allowed: true };
    }

    async enforceLimit(provider) {
        const remaining = await this.getRemainingBudget(provider);
        
        if (remaining.daily.remaining <= 0) {
            this.emitEvent('budget:exceeded', {
                provider,
                type: 'daily',
                limit: remaining.daily.limit,
                spent: remaining.daily.spent
            });
            return false;
        }

        if (remaining.monthly.remaining <= 0) {
            this.emitEvent('budget:exceeded', {
                provider,
                type: 'monthly',
                limit: remaining.monthly.limit,
                spent: remaining.monthly.spent
            });
            return false;
        }

        return true;
    }

    async checkBudgetLimits(provider) {
        const remaining = await this.getRemainingBudget(provider);
        const warningThreshold = this.currentBudgets.warningThreshold;

        // Check daily budget warnings
        if (remaining.daily.percentage >= warningThreshold) {
            const warningKey = `${provider}_daily_${Math.floor(remaining.daily.percentage / 10) * 10}`;
            if (!this.warningsSent.has(warningKey)) {
                this.warningsSent.add(warningKey);
                this.emitEvent('budget:warning', {
                    provider,
                    type: 'daily',
                    percentage: remaining.daily.percentage,
                    remaining: remaining.daily.remaining,
                    limit: remaining.daily.limit
                });

                // Store alert in database
                await this.recordAlert(provider, 'daily', remaining.daily.percentage);
            }
        }

        // Check monthly budget warnings
        if (remaining.monthly.percentage >= warningThreshold) {
            const warningKey = `${provider}_monthly_${Math.floor(remaining.monthly.percentage / 10) * 10}`;
            if (!this.warningsSent.has(warningKey)) {
                this.warningsSent.add(warningKey);
                this.emitEvent('budget:warning', {
                    provider,
                    type: 'monthly',
                    percentage: remaining.monthly.percentage,
                    remaining: remaining.monthly.remaining,
                    limit: remaining.monthly.limit
                });

                await this.recordAlert(provider, 'monthly', remaining.monthly.percentage);
            }
        }
    }

    async recordAlert(provider, type, percentage) {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['budgetAlerts'], 'readwrite');
            const store = transaction.objectStore('budgetAlerts');
            const alert = {
                timestamp: Date.now(),
                provider,
                type,
                percentage,
                message: `${provider} ${type} budget at ${percentage.toFixed(1)}%`
            };

            await new Promise((resolve, reject) => {
                const request = store.add(alert);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to record alert:', error);
        }
    }

    async getGlobalSpend(period = 'monthly') {
        const providers = ['gemini', 'openai', 'stablediffusion'];
        let totalSpend = 0;

        for (const provider of providers) {
            totalSpend += await this.getCurrentSpend(provider, period);
        }

        return totalSpend;
    }

    async setBudgetLimit(provider, type, amount) {
        if (!this.currentBudgets[provider]) {
            this.currentBudgets[provider] = {};
        }

        this.currentBudgets[provider][type] = parseFloat(amount);

        // Save to IndexedDB
        if (this.isInitialized) {
            try {
                const transaction = this.db.transaction(['budgetLimits'], 'readwrite');
                const store = transaction.objectStore('budgetLimits');
                await new Promise((resolve, reject) => {
                    const request = store.put({
                        provider,
                        ...this.currentBudgets[provider]
                    });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Failed to save budget limit:', error);
            }
        }

        // Also save to localStorage as backup
        this.saveBudgetsToLocalStorage();

        this.emitEvent('budget:limitChanged', { provider, type, amount });
    }

    async loadBudgetConfiguration() {
        if (!this.isInitialized) return;

        try {
            const transaction = this.db.transaction(['budgetLimits'], 'readonly');
            const store = transaction.objectStore('budgetLimits');
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    const limits = request.result || [];
                    limits.forEach(limit => {
                        if (limit.provider && limit.provider !== 'global') {
                            this.currentBudgets[limit.provider] = {
                                daily: limit.daily || this.defaultBudgets[limit.provider]?.daily || 0,
                                monthly: limit.monthly || this.defaultBudgets[limit.provider]?.monthly || 0
                            };
                        }
                    });
                    resolve();
                };

                request.onerror = () => {
                    console.error('Failed to load budget configuration:', request.error);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Failed to load budget configuration:', error);
        }
    }

    loadBudgetsFromLocalStorage() {
        try {
            const saved = localStorage.getItem('nft_generator_budgets');
            if (saved) {
                const budgets = JSON.parse(saved);
                Object.assign(this.currentBudgets, budgets);
            }
        } catch (error) {
            console.error('Failed to load budgets from localStorage:', error);
        }
    }

    saveBudgetsToLocalStorage() {
        try {
            localStorage.setItem('nft_generator_budgets', JSON.stringify(this.currentBudgets));
        } catch (error) {
            console.error('Failed to save budgets to localStorage:', error);
        }
    }

    resetBudgetPeriod(type = 'daily') {
        // Clear warning cache for the reset period
        const now = new Date();
        if (type === 'daily') {
            // Clear daily warnings at midnight
            this.warningsSent.forEach(key => {
                if (key.includes('_daily_')) {
                    this.warningsSent.delete(key);
                }
            });
        } else if (type === 'monthly') {
            // Clear monthly warnings at month start
            this.warningsSent.forEach(key => {
                if (key.includes('_monthly_')) {
                    this.warningsSent.delete(key);
                }
            });
        }

        this.emitEvent('budget:reset', { type, timestamp: now.getTime() });
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    emitEvent(eventName, detail) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
    }

    // Utility methods for UI integration
    async getBudgetSummary() {
        const providers = ['gemini', 'openai', 'stablediffusion'];
        const summary = {
            providers: {},
            global: {
                monthlySpent: await this.getGlobalSpend('monthly'),
                monthlyLimit: this.currentBudgets.global.monthly
            }
        };

        for (const provider of providers) {
            summary.providers[provider] = await this.getRemainingBudget(provider);
        }

        return summary;
    }

    async exportBudgetReport(startDate, endDate) {
        const history = await this.getSpendHistory(startDate, endDate);
        
        return {
            period: { startDate, endDate },
            totalSpend: history.reduce((sum, record) => sum + record.amount, 0),
            recordCount: history.length,
            byProvider: this.groupBy(history, 'provider'),
            byCategory: this.groupBy(history, 'category'),
            byDate: this.groupBy(history, 'date'),
            records: history
        };
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key] || 'unknown';
            if (!groups[group]) {
                groups[group] = { count: 0, total: 0, records: [] };
            }
            groups[group].count++;
            groups[group].total += item.amount;
            groups[group].records.push(item);
            return groups;
        }, {});
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BudgetManager;
} else if (typeof window !== 'undefined') {
    window.BudgetManager = BudgetManager;
}