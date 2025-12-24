// NFT Generator - Cost Analytics Dashboard
// Analytics system to track and visualize spending patterns

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

// ===== COST ANALYTICS CLASS =====

class CostAnalytics {
    constructor(budgetManager) {
        this.budgetManager = budgetManager;
        this.chartInstances = {};
        this.updateInterval = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.isInitialized = true;
            console.log('Cost Analytics initialized');
            
            // Set up real-time updates
            this.startRealTimeUpdates();
            
            // Listen for budget events
            this.setupEventListeners();
            
            return true;
        } catch (error) {
            console.error('Cost Analytics initialization failed:', error);
            return false;
        }
    }

    async getSpendByProvider(period = 'monthly') {
        const providers = ['gemini', 'openai', 'stablediffusion', 'procedural'];
        const spendData = {};

        for (const provider of providers) {
            spendData[provider] = await this.budgetManager.getCurrentSpend(provider, period);
        }

        return spendData;
    }

    async getSpendByCategory(period = 'monthly') {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const history = await this.budgetManager.getSpendHistory(startDate, now);
        const categorySpend = {};

        history.forEach(record => {
            const category = record.category || 'unknown';
            if (!categorySpend[category]) {
                categorySpend[category] = 0;
            }
            categorySpend[category] += record.amount;
        });

        return categorySpend;
    }

    async getSpendTrend(period = 'monthly', granularity = 'daily') {
        const now = new Date();
        let startDate;
        let dateFormat;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFormat = granularity === 'hourly' ? 'YYYY-MM-DD HH' : 'YYYY-MM-DD';
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFormat = 'YYYY-MM-DD';
                break;
            case 'quarterly':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                dateFormat = 'YYYY-MM-DD';
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                dateFormat = 'YYYY-MM-DD';
        }

        const history = await this.budgetManager.getSpendHistory(startDate, now);
        const trendData = {};

        history.forEach(record => {
            let dateKey;
            const recordDate = new Date(record.timestamp);

            if (granularity === 'hourly') {
                dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')} ${String(recordDate.getHours()).padStart(2, '0')}`;
            } else {
                dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
            }

            if (!trendData[dateKey]) {
                trendData[dateKey] = 0;
            }
            trendData[dateKey] += record.amount;
        });

        // Fill in missing dates with 0
        const filledData = this.fillMissingDates(trendData, startDate, now, granularity);
        
        return filledData;
    }

    async getCostPerNFT() {
        const history = await this.budgetManager.getSpendHistory(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            new Date()
        );

        if (history.length === 0) return 0;

        // Group by collection generation sessions (approximate)
        const sessions = this.groupBySession(history);
        const totalCost = history.reduce((sum, record) => sum + record.amount, 0);
        
        return sessions.length > 0 ? totalCost / sessions.length : 0;
    }

    async getEfficiencyMetrics() {
        // This would integrate with cache manager for hit rates
        const cacheStats = window.imageCacheManager ? await window.imageCacheManager.getStats() : null;
        
        const history = await this.budgetManager.getSpendHistory(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            new Date()
        );

        const totalRequests = history.length;
        const successfulRequests = history.filter(r => r.success).length;
        const failedRequests = totalRequests - successfulRequests;

        return {
            cacheHitRate: cacheStats ? cacheStats.hitRate : 0,
            apiSuccessRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
            fallbackRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
            totalRequests,
            successfulRequests,
            failedRequests,
            cacheSavings: this.calculateCacheSavings(cacheStats, history)
        };
    }

    calculateCacheSavings(cacheStats, history) {
        if (!cacheStats || cacheStats.hits === 0) return 0;

        // Estimate average cost per API call
        const totalCost = history.reduce((sum, record) => sum + record.amount, 0);
        const avgCostPerCall = history.length > 0 ? totalCost / history.length : 0.05; // Default estimate

        return cacheStats.hits * avgCostPerCall;
    }

    async exportReport(format = 'json') {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // This month

        const report = {
            generatedAt: now.toISOString(),
            period: {
                start: startDate.toISOString(),
                end: now.toISOString()
            },
            summary: {
                totalSpend: await this.budgetManager.getGlobalSpend('monthly'),
                spendByProvider: await this.getSpendByProvider('monthly'),
                spendByCategory: await this.getSpendByCategory('monthly'),
                costPerNFT: await this.getCostPerNFT(),
                efficiency: await this.getEfficiencyMetrics()
            },
            trends: {
                daily: await this.getSpendTrend('monthly', 'daily'),
                weekly: await this.getSpendTrend('quarterly', 'weekly')
            },
            budgetStatus: await this.budgetManager.getBudgetSummary()
        };

        if (format === 'csv') {
            return this.convertToCSV(report);
        } else if (format === 'json') {
            return JSON.stringify(report, null, 2);
        }

        return report;
    }

    convertToCSV(report) {
        const lines = [];
        
        // Header
        lines.push('NFT Generator Cost Analytics Report');
        lines.push(`Generated: ${report.generatedAt}`);
        lines.push(`Period: ${report.period.start} to ${report.period.end}`);
        lines.push('');

        // Summary
        lines.push('SUMMARY');
        lines.push('Metric,Value');
        lines.push(`Total Spend,$${report.summary.totalSpend.toFixed(2)}`);
        lines.push(`Cost per NFT,$${report.summary.costPerNFT.toFixed(2)}`);
        lines.push(`Cache Hit Rate,${report.summary.efficiency.cacheHitRate.toFixed(1)}%`);
        lines.push(`API Success Rate,${report.summary.efficiency.apiSuccessRate.toFixed(1)}%`);
        lines.push('');

        // Spend by Provider
        lines.push('SPEND BY PROVIDER');
        lines.push('Provider,Amount');
        Object.entries(report.summary.spendByProvider).forEach(([provider, amount]) => {
            lines.push(`${provider},$${amount.toFixed(2)}`);
        });
        lines.push('');

        // Spend by Category
        lines.push('SPEND BY CATEGORY');
        lines.push('Category,Amount');
        Object.entries(report.summary.spendByCategory).forEach(([category, amount]) => {
            lines.push(`${category},$${amount.toFixed(2)}`);
        });

        return lines.join('\n');
    }

    async exportChart(chartType = 'spendTrend') {
        const canvas = document.getElementById(`${chartType}Chart`);
        if (!canvas) return null;

        return canvas.toDataURL('image/png');
    }

    // UI Integration Methods
    async updateDashboard() {
        if (!this.isInitialized) return;

        try {
            await this.updateSummaryCards();
            await this.updateCharts();
            await this.updateTransactionTable();
        } catch (error) {
            console.error('Failed to update analytics dashboard:', error);
        }
    }

    async updateSummaryCards() {
        const totalSpendElement = document.getElementById('totalSpend');
        const totalImagesElement = document.getElementById('totalImages');
        const avgCostElement = document.getElementById('avgCost');
        const cacheSavingsElement = document.getElementById('cacheSavings');

        if (!totalSpendElement) return;

        const totalSpend = await this.budgetManager.getGlobalSpend('monthly');
        const efficiency = await this.getEfficiencyMetrics();
        const costPerNFT = await this.getCostPerNFT();

        totalSpendElement.textContent = `$${totalSpend.toFixed(2)}`;
        
        if (totalImagesElement) {
            totalImagesElement.textContent = efficiency.totalRequests.toString();
        }
        
        if (avgCostElement) {
            avgCostElement.textContent = `$${costPerNFT.toFixed(3)}`;
        }
        
        if (cacheSavingsElement) {
            cacheSavingsElement.textContent = `$${efficiency.cacheSavings.toFixed(2)}`;
        }
    }

    async updateCharts() {
        await this.updateSpendTrendChart();
        await this.updateProviderBreakdownChart();
    }

    async updateSpendTrendChart() {
        const canvas = document.getElementById('spendTrendChart');
        if (!canvas) return;

        const ctx = validateCanvasContext(canvas);
        const trendData = await this.getSpendTrend('monthly', 'daily');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Simple line chart implementation
        const dates = Object.keys(trendData).sort();
        const values = dates.map(date => trendData[date]);
        
        if (dates.length === 0) return;

        const maxValue = Math.max(...values, 1);
        const padding = 40;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;

        // Draw axes
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        // Draw data line
        if (values.length > 1) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.beginPath();

            values.forEach((value, index) => {
                const x = padding + (index / (values.length - 1)) * chartWidth;
                const y = canvas.height - padding - (value / maxValue) * chartHeight;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();

            // Draw data points
            ctx.fillStyle = '#6366f1';
            values.forEach((value, index) => {
                const x = padding + (index / (values.length - 1)) * chartWidth;
                const y = canvas.height - padding - (value / maxValue) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        // Draw labels
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';

        // Y-axis labels
        for (let i = 0; i <= 5; i++) {
            const value = (maxValue / 5) * i;
            const y = canvas.height - padding - (i / 5) * chartHeight;
            ctx.textAlign = 'right';
            ctx.fillText(`$${value.toFixed(2)}`, padding - 10, y + 4);
        }

        // X-axis labels (show every few dates to avoid crowding)
        const labelStep = Math.max(1, Math.floor(dates.length / 5));
        dates.forEach((date, index) => {
            if (index % labelStep === 0) {
                const x = padding + (index / (dates.length - 1)) * chartWidth;
                ctx.textAlign = 'center';
                ctx.save();
                ctx.translate(x, canvas.height - padding + 20);
                ctx.rotate(-Math.PI / 4);
                ctx.fillText(date.slice(5), 0, 0); // Show MM-DD
                ctx.restore();
            }
        });
    }

    async updateProviderBreakdownChart() {
        const canvas = document.getElementById('providerBreakdownChart');
        if (!canvas) return;

        const ctx = validateCanvasContext(canvas);
        const spendData = await this.getSpendByProvider('monthly');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const providers = Object.keys(spendData);
        const values = Object.values(spendData);
        const total = values.reduce((sum, val) => sum + val, 0);

        if (total === 0) return;

        // Colors for each provider
        const colors = {
            gemini: '#4285f4',
            openai: '#00a67e',
            stablediffusion: '#7c3aed',
            procedural: '#f59e0b'
        };

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        let currentAngle = -Math.PI / 2; // Start at top

        providers.forEach((provider, index) => {
            const value = values[index];
            
            // Skip drawing slices for zero values
            if (value === 0) return;
            
            const sliceAngle = (value / total) * 2 * Math.PI;

            // Draw slice
            ctx.fillStyle = colors[provider] || '#6b7280';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            // Draw label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
            const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${provider}`, labelX, labelY - 5);
            const valueText = provider === 'procedural' ? 'Free' : `$${value.toFixed(2)}`;
            ctx.fillText(valueText, labelX, labelY + 10);

            currentAngle += sliceAngle;
        });
        
        // Draw legend for zero-value providers (like procedural)
        let legendY = 20;
        providers.forEach((provider, index) => {
            const value = values[index];
            if (value === 0) {
                ctx.fillStyle = colors[provider] || '#6b7280';
                ctx.fillRect(10, legendY, 12, 12);
                
                ctx.fillStyle = '#333333';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'left';
                const valueText = provider === 'procedural' ? 'Free' : `$${value.toFixed(2)}`;
                ctx.fillText(`${provider}: ${valueText}`, 30, legendY + 9);
                
                legendY += 20;
            }
        });
    }

    async updateTransactionTable() {
        const tableBody = document.getElementById('transactionTableBody');
        if (!tableBody) return;

        const history = await this.budgetManager.getSpendHistory(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            new Date()
        );

        // Clear existing rows
        tableBody.innerHTML = '';

        // Sort by timestamp (newest first)
        history.sort((a, b) => b.timestamp - a.timestamp);

        // Show last 20 transactions
        history.slice(0, 20).forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(record.timestamp).toLocaleDateString()}</td>
                <td>${record.provider}</td>
                <td>${record.category}</td>
                <td>${record.provider === 'procedural' ? '<span class="cost-badge-free">Free</span>' : `$${record.amount.toFixed(3)}`}</td>
                <td><span class="status-badge ${record.success ? 'success' : 'error'}">${record.success ? 'Success' : 'Failed'}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }

    startRealTimeUpdates() {
        // Update dashboard every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateDashboard();
        }, 30000);

        // Initial update
        setTimeout(() => this.updateDashboard(), 1000);
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    setupEventListeners() {
        // Listen for budget events to trigger updates
        window.addEventListener('budget:recordSpend', () => {
            setTimeout(() => this.updateDashboard(), 500);
        });

        window.addEventListener('budget:warning', (event) => {
            this.showBudgetWarning(event.detail);
        });

        window.addEventListener('budget:exceeded', (event) => {
            this.showBudgetExceeded(event.detail);
        });
    }

    showBudgetWarning(detail) {
        const message = `Warning: ${detail.provider} ${detail.type} budget at ${detail.percentage.toFixed(1)}% (${detail.remaining.toFixed(2)} remaining)`;
        this.showNotification(message, 'warning');
    }

    showBudgetExceeded(detail) {
        const message = `Budget exceeded: ${detail.provider} ${detail.type} limit of $${detail.limit.toFixed(2)} reached`;
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `validation-message ${type}`;
        notification.textContent = message;
        notification.setAttribute('role', 'alert');

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Utility methods
    fillMissingDates(data, startDate, endDate, granularity) {
        const filled = {};
        const current = new Date(startDate);

        while (current <= endDate) {
            let dateKey;
            if (granularity === 'hourly') {
                dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')} ${String(current.getHours()).padStart(2, '0')}`;
                current.setHours(current.getHours() + 1);
            } else {
                dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                current.setDate(current.getDate() + 1);
            }

            filled[dateKey] = data[dateKey] || 0;
        }

        return filled;
    }

    groupBySession(history) {
        // Simple session detection based on time gaps
        const sessions = [];
        let currentSession = [];
        const sessionGapMs = 10 * 60 * 1000; // 10 minutes

        history.sort((a, b) => a.timestamp - b.timestamp);

        history.forEach(record => {
            if (currentSession.length === 0 || 
                record.timestamp - currentSession[currentSession.length - 1].timestamp > sessionGapMs) {
                if (currentSession.length > 0) {
                    sessions.push(currentSession);
                }
                currentSession = [record];
            } else {
                currentSession.push(record);
            }
        });

        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }

        return sessions;
    }

    resetStats() {
        // Clear all cached data and reset analytics state
        if (this.budgetManager) {
            // Note: This would ideally clear budget history in BudgetManager
            // For now, we reset what we can in the analytics layer
            console.log('Resetting analytics stats...');
        }
        
        // Clear any cached chart data
        Object.keys(this.chartInstances).forEach(chartId => {
            if (this.chartInstances[chartId]) {
                // If using a chart library, destroy chart instances here
                delete this.chartInstances[chartId];
            }
        });
        
        // Reset internal state
        this.chartInstances = {};
        
        // Emit reset event
        window.dispatchEvent(new CustomEvent('analytics:reset', {
            detail: { timestamp: Date.now() }
        }));
        
        console.log('Analytics stats reset completed');
    }

    destroy() {
        this.stopRealTimeUpdates();
        this.isInitialized = false;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CostAnalytics;
} else if (typeof window !== 'undefined') {
    window.CostAnalytics = CostAnalytics;
}