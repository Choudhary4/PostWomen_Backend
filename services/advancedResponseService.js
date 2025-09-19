const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class AdvancedResponseService {
  constructor() {
    // In-memory storage
    this.responseCache = new Map(); // responseId -> cached response
    this.responseComparisons = new Map(); // comparisonId -> comparison data
    this.responseValidations = new Map(); // validationId -> validation results
    this.performanceMetrics = new Map(); // requestId -> performance data
    this.responseSchemas = new Map(); // schemaId -> schema definition
    this.responseHistory = new Map(); // endpoint -> [responses]
    this.alertRules = new Map(); // ruleId -> alert rule
    this.responseChains = new Map(); // chainId -> chain definition
    
    this.initializeDefaultSchemas();
  }

  // Initialize common response schemas
  initializeDefaultSchemas() {
    const defaultSchemas = [
      {
        id: 'json-api',
        name: 'JSON API Response',
        description: 'Standard JSON API response format',
        schema: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            meta: { type: 'object' },
            errors: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  title: { type: 'string' },
                  detail: { type: 'string' }
                }
              }
            }
          }
        }
      },
      {
        id: 'rest-api',
        name: 'REST API Response',
        description: 'Standard REST API response format',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: ['object', 'array'] },
            message: { type: 'string' },
            error: { type: 'string' }
          },
          required: ['success']
        }
      },
      {
        id: 'graphql',
        name: 'GraphQL Response',
        description: 'GraphQL response format',
        schema: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  locations: { type: 'array' },
                  path: { type: 'array' }
                }
              }
            },
            extensions: { type: 'object' }
          }
        }
      }
    ];

    defaultSchemas.forEach(schema => {
      this.responseSchemas.set(schema.id, {
        ...schema,
        isDefault: true,
        createdAt: new Date().toISOString()
      });
    });
  }

  // Response Caching
  async cacheResponse(requestData, responseData, options = {}) {
    const cacheKey = this.generateCacheKey(requestData);
    const cacheId = uuidv4();
    
    const cached = {
      id: cacheId,
      key: cacheKey,
      request: {
        url: requestData.url,
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      },
      response: {
        status: responseData.status,
        statusText: responseData.statusText,
        headers: responseData.headers,
        body: responseData.body,
        size: responseData.size,
        time: responseData.time
      },
      metadata: {
        cachedAt: new Date().toISOString(),
        expiresAt: options.ttl ? new Date(Date.now() + options.ttl * 1000).toISOString() : null,
        tags: options.tags || [],
        environment: options.environment || 'default'
      },
      performance: this.extractPerformanceMetrics(responseData)
    };

    this.responseCache.set(cacheId, cached);
    
    // Store in history
    this.addToHistory(requestData.url, cached);
    
    return cacheId;
  }

  async getCachedResponse(cacheId) {
    const cached = this.responseCache.get(cacheId);
    if (!cached) {
      return null;
    }

    // Check expiration
    if (cached.metadata.expiresAt && new Date(cached.metadata.expiresAt) < new Date()) {
      this.responseCache.delete(cacheId);
      return null;
    }

    return cached;
  }

  async getCachedResponseByKey(requestData) {
    const cacheKey = this.generateCacheKey(requestData);
    
    for (const cached of this.responseCache.values()) {
      if (cached.key === cacheKey) {
        // Check expiration
        if (cached.metadata.expiresAt && new Date(cached.metadata.expiresAt) < new Date()) {
          this.responseCache.delete(cached.id);
          continue;
        }
        return cached;
      }
    }
    
    return null;
  }

  async getAllCachedResponses(filters = {}) {
    let responses = Array.from(this.responseCache.values());

    // Apply filters
    if (filters.environment) {
      responses = responses.filter(r => r.metadata.environment === filters.environment);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      responses = responses.filter(r => 
        filters.tags.some(tag => r.metadata.tags.includes(tag))
      );
    }
    
    if (filters.method) {
      responses = responses.filter(r => r.request.method === filters.method);
    }
    
    if (filters.status) {
      responses = responses.filter(r => r.response.status === filters.status);
    }

    return responses.sort((a, b) => new Date(b.metadata.cachedAt) - new Date(a.metadata.cachedAt));
  }

  async clearCache(filters = {}) {
    if (Object.keys(filters).length === 0) {
      // Clear all
      this.responseCache.clear();
      return { cleared: true };
    }

    const toDelete = [];
    for (const [id, cached] of this.responseCache) {
      let shouldDelete = true;
      
      if (filters.environment && cached.metadata.environment !== filters.environment) {
        shouldDelete = false;
      }
      
      if (filters.tags && !filters.tags.some(tag => cached.metadata.tags.includes(tag))) {
        shouldDelete = false;
      }
      
      if (shouldDelete) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.responseCache.delete(id));
    return { cleared: toDelete.length };
  }

  // Response Comparison
  async compareResponses(response1Id, response2Id, options = {}) {
    const comparison1 = await this.getCachedResponse(response1Id);
    const comparison2 = await this.getCachedResponse(response2Id);
    
    if (!comparison1 || !comparison2) {
      throw new Error('One or both responses not found');
    }

    const comparisonId = uuidv4();
    const comparison = {
      id: comparisonId,
      responses: [comparison1, comparison2],
      comparison: {
        status: this.compareValues(comparison1.response.status, comparison2.response.status),
        headers: this.compareObjects(comparison1.response.headers, comparison2.response.headers),
        body: this.compareResponseBodies(comparison1.response.body, comparison2.response.body, options),
        performance: this.comparePerformance(comparison1.performance, comparison2.performance)
      },
      metadata: {
        comparedAt: new Date().toISOString(),
        options
      }
    };

    this.responseComparisons.set(comparisonId, comparison);
    return comparison;
  }

  async getComparison(comparisonId) {
    return this.responseComparisons.get(comparisonId);
  }

  async getAllComparisons(limit = 50) {
    return Array.from(this.responseComparisons.values())
      .sort((a, b) => new Date(b.metadata.comparedAt) - new Date(a.metadata.comparedAt))
      .slice(0, limit);
  }

  // Response Validation
  async validateResponse(responseId, schemaId, options = {}) {
    const cached = await this.getCachedResponse(responseId);
    if (!cached) {
      throw new Error('Response not found');
    }

    const schema = this.responseSchemas.get(schemaId);
    if (!schema) {
      throw new Error('Schema not found');
    }

    const validationId = uuidv4();
    const validation = {
      id: validationId,
      responseId,
      schemaId,
      result: this.validateAgainstSchema(cached.response.body, schema.schema),
      metadata: {
        validatedAt: new Date().toISOString(),
        options
      }
    };

    this.responseValidations.set(validationId, validation);
    return validation;
  }

  async getValidation(validationId) {
    return this.responseValidations.get(validationId);
  }

  async getResponseValidations(responseId) {
    const validations = [];
    for (const validation of this.responseValidations.values()) {
      if (validation.responseId === responseId) {
        validations.push(validation);
      }
    }
    return validations;
  }

  // Schema Management
  async createSchema(schemaData) {
    const schemaId = uuidv4();
    const schema = {
      id: schemaId,
      name: schemaData.name,
      description: schemaData.description || '',
      schema: schemaData.schema,
      tags: schemaData.tags || [],
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    this.responseSchemas.set(schemaId, schema);
    return schema;
  }

  async getSchema(schemaId) {
    return this.responseSchemas.get(schemaId);
  }

  async getAllSchemas() {
    return Array.from(this.responseSchemas.values());
  }

  async updateSchema(schemaId, updates) {
    const schema = this.responseSchemas.get(schemaId);
    if (!schema) {
      throw new Error('Schema not found');
    }

    if (schema.isDefault) {
      throw new Error('Cannot modify default schemas');
    }

    const updated = {
      ...schema,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.responseSchemas.set(schemaId, updated);
    return updated;
  }

  async deleteSchema(schemaId) {
    const schema = this.responseSchemas.get(schemaId);
    if (!schema) {
      throw new Error('Schema not found');
    }

    if (schema.isDefault) {
      throw new Error('Cannot delete default schemas');
    }

    this.responseSchemas.delete(schemaId);
    return { success: true };
  }

  // Performance Metrics
  async recordPerformance(requestId, metrics) {
    const performance = {
      requestId,
      metrics: {
        dns: metrics.dns || 0,
        tcp: metrics.tcp || 0,
        tls: metrics.tls || 0,
        firstByte: metrics.firstByte || 0,
        download: metrics.download || 0,
        total: metrics.total || 0,
        size: {
          request: metrics.requestSize || 0,
          response: metrics.responseSize || 0,
          total: (metrics.requestSize || 0) + (metrics.responseSize || 0)
        }
      },
      timestamp: new Date().toISOString()
    };

    this.performanceMetrics.set(requestId, performance);
    return performance;
  }

  async getPerformanceMetrics(requestId) {
    return this.performanceMetrics.get(requestId);
  }

  async getPerformanceStats(timeRange = '24h') {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.parseTimeRange(timeRange));
    
    const recentMetrics = Array.from(this.performanceMetrics.values())
      .filter(m => new Date(m.timestamp) > cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const totalTimes = recentMetrics.map(m => m.metrics.total);
    const responseSizes = recentMetrics.map(m => m.metrics.size.response);

    return {
      requestCount: recentMetrics.length,
      averageResponseTime: this.average(totalTimes),
      medianResponseTime: this.median(totalTimes),
      p95ResponseTime: this.percentile(totalTimes, 95),
      p99ResponseTime: this.percentile(totalTimes, 99),
      averageResponseSize: this.average(responseSizes),
      totalDataTransferred: responseSizes.reduce((sum, size) => sum + size, 0),
      timeRange
    };
  }

  // Response History and Trends
  addToHistory(endpoint, response) {
    const history = this.responseHistory.get(endpoint) || [];
    history.push({
      ...response,
      timestamp: new Date().toISOString()
    });

    // Keep last 100 responses per endpoint
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.responseHistory.set(endpoint, history);
  }

  async getResponseHistory(endpoint, limit = 50) {
    const history = this.responseHistory.get(endpoint) || [];
    return history
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getResponseTrends(endpoint, timeRange = '24h') {
    const history = await this.getResponseHistory(endpoint, 1000);
    const cutoff = new Date(Date.now() - this.parseTimeRange(timeRange));
    
    const recentResponses = history.filter(r => new Date(r.timestamp) > cutoff);
    
    if (recentResponses.length === 0) {
      return null;
    }

    // Group by hour
    const hourlyData = {};
    recentResponses.forEach(response => {
      const hour = new Date(response.timestamp).toISOString().substring(0, 13);
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          timestamp: hour,
          responses: [],
          successCount: 0,
          errorCount: 0
        };
      }
      
      hourlyData[hour].responses.push(response);
      if (response.response.status >= 200 && response.response.status < 400) {
        hourlyData[hour].successCount++;
      } else {
        hourlyData[hour].errorCount++;
      }
    });

    // Calculate metrics for each hour
    const trends = Object.values(hourlyData).map(hourData => {
      const responseTimes = hourData.responses.map(r => r.performance?.total || 0);
      
      return {
        timestamp: hourData.timestamp,
        requestCount: hourData.responses.length,
        successRate: hourData.successCount / hourData.responses.length,
        averageResponseTime: this.average(responseTimes),
        errorCount: hourData.errorCount
      };
    });

    return trends.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // Alert Rules
  async createAlertRule(ruleData) {
    const ruleId = uuidv4();
    const rule = {
      id: ruleId,
      name: ruleData.name,
      description: ruleData.description || '',
      conditions: ruleData.conditions, // Array of conditions
      actions: ruleData.actions, // Array of actions to take
      enabled: ruleData.enabled !== false,
      endpoints: ruleData.endpoints || [], // Specific endpoints to monitor
      createdAt: new Date().toISOString()
    };

    this.alertRules.set(ruleId, rule);
    return rule;
  }

  async evaluateAlerts(responseData) {
    const alerts = [];
    
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check if rule applies to this endpoint
      if (rule.endpoints.length > 0 && !rule.endpoints.includes(responseData.request.url)) {
        continue;
      }
      
      // Evaluate conditions
      const triggered = rule.conditions.every(condition => {
        return this.evaluateCondition(condition, responseData);
      });
      
      if (triggered) {
        alerts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          response: responseData,
          triggeredAt: new Date().toISOString(),
          actions: rule.actions
        });
      }
    }
    
    return alerts;
  }

  // Utility Methods
  generateCacheKey(requestData) {
    const keyData = {
      method: requestData.method,
      url: requestData.url,
      headers: requestData.headers,
      body: requestData.body
    };
    
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  extractPerformanceMetrics(responseData) {
    return {
      dns: responseData.timings?.dns || 0,
      tcp: responseData.timings?.tcp || 0,
      tls: responseData.timings?.tls || 0,
      firstByte: responseData.timings?.firstByte || 0,
      download: responseData.timings?.download || 0,
      total: responseData.time || 0,
      size: {
        request: responseData.requestSize || 0,
        response: responseData.size || 0
      }
    };
  }

  compareValues(val1, val2) {
    return {
      value1: val1,
      value2: val2,
      equal: val1 === val2,
      type: typeof val1 === typeof val2 ? 'same' : 'different'
    };
  }

  compareObjects(obj1, obj2) {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = [...new Set([...keys1, ...keys2])];
    
    const differences = {};
    let hasChanges = false;
    
    allKeys.forEach(key => {
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];
      
      if (val1 !== val2) {
        hasChanges = true;
        differences[key] = {
          value1: val1,
          value2: val2,
          status: val1 === undefined ? 'added' : val2 === undefined ? 'removed' : 'changed'
        };
      }
    });
    
    return {
      hasChanges,
      differences,
      summary: {
        total: allKeys.length,
        changed: Object.keys(differences).length,
        same: allKeys.length - Object.keys(differences).length
      }
    };
  }

  compareResponseBodies(body1, body2, options = {}) {
    if (typeof body1 === 'string' && typeof body2 === 'string') {
      try {
        const json1 = JSON.parse(body1);
        const json2 = JSON.parse(body2);
        return this.compareObjects(json1, json2);
      } catch (e) {
        // String comparison
        return {
          hasChanges: body1 !== body2,
          type: 'text',
          differences: body1 !== body2 ? { text: { value1: body1, value2: body2, status: 'changed' } } : {},
          similarity: this.calculateStringSimilarity(body1, body2)
        };
      }
    }
    
    return this.compareObjects(body1, body2);
  }

  comparePerformance(perf1, perf2) {
    const metrics = ['dns', 'tcp', 'tls', 'firstByte', 'download', 'total'];
    const comparison = {};
    
    metrics.forEach(metric => {
      const val1 = perf1?.[metric] || 0;
      const val2 = perf2?.[metric] || 0;
      const diff = val2 - val1;
      const percentChange = val1 > 0 ? (diff / val1) * 100 : 0;
      
      comparison[metric] = {
        value1: val1,
        value2: val2,
        difference: diff,
        percentChange: percentChange,
        improved: diff < 0
      };
    });
    
    return comparison;
  }

  validateAgainstSchema(data, schema) {
    // Simple JSON Schema validation (in production, use ajv or similar)
    try {
      const result = {
        valid: true,
        errors: [],
        warnings: []
      };
      
      // Basic type checking
      if (schema.type && typeof data !== schema.type) {
        if (!(schema.type === 'array' && Array.isArray(data))) {
          result.valid = false;
          result.errors.push(`Expected type ${schema.type}, got ${typeof data}`);
        }
      }
      
      // Required properties
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(prop => {
          if (!(prop in data)) {
            result.valid = false;
            result.errors.push(`Missing required property: ${prop}`);
          }
        });
      }
      
      // Property validation
      if (schema.properties && typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (!schema.properties[key]) {
            result.warnings.push(`Unexpected property: ${key}`);
          }
        });
      }
      
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  evaluateCondition(condition, responseData) {
    const { field, operator, value } = condition;
    let actualValue;
    
    // Extract field value
    switch (field) {
      case 'status':
        actualValue = responseData.response.status;
        break;
      case 'responseTime':
        actualValue = responseData.performance?.total || 0;
        break;
      case 'responseSize':
        actualValue = responseData.response.size || 0;
        break;
      default:
        return false;
    }
    
    // Apply operator
    switch (operator) {
      case 'eq': return actualValue === value;
      case 'ne': return actualValue !== value;
      case 'gt': return actualValue > value;
      case 'gte': return actualValue >= value;
      case 'lt': return actualValue < value;
      case 'lte': return actualValue <= value;
      case 'contains': return String(actualValue).includes(String(value));
      default: return false;
    }
  }

  parseTimeRange(timeRange) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h
    
    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  median(numbers) {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  percentile(numbers, p) {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  calculateStringSimilarity(str1, str2) {
    // Simple string similarity calculation
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Data Export/Import
  exportData() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      responseCache: Array.from(this.responseCache.values()),
      responseComparisons: Array.from(this.responseComparisons.values()),
      responseValidations: Array.from(this.responseValidations.values()),
      responseSchemas: Array.from(this.responseSchemas.values()).filter(s => !s.isDefault),
      performanceMetrics: Array.from(this.performanceMetrics.values()),
      alertRules: Array.from(this.alertRules.values())
    };
  }

  importData(data) {
    try {
      let imported = 0;

      if (data.responseCache) {
        data.responseCache.forEach(item => {
          this.responseCache.set(item.id, item);
          imported++;
        });
      }

      if (data.responseComparisons) {
        data.responseComparisons.forEach(item => {
          this.responseComparisons.set(item.id, item);
          imported++;
        });
      }

      if (data.responseValidations) {
        data.responseValidations.forEach(item => {
          this.responseValidations.set(item.id, item);
          imported++;
        });
      }

      if (data.responseSchemas) {
        data.responseSchemas.forEach(item => {
          this.responseSchemas.set(item.id, item);
          imported++;
        });
      }

      if (data.performanceMetrics) {
        data.performanceMetrics.forEach(item => {
          this.performanceMetrics.set(item.requestId, item);
          imported++;
        });
      }

      if (data.alertRules) {
        data.alertRules.forEach(item => {
          this.alertRules.set(item.id, item);
          imported++;
        });
      }

      return { success: true, imported };
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Cleanup old data
  cleanup() {
    const now = new Date();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Clean old cache entries
    for (const [id, cached] of this.responseCache) {
      if (cached.metadata.expiresAt && new Date(cached.metadata.expiresAt) < now) {
        this.responseCache.delete(id);
      } else if (now - new Date(cached.metadata.cachedAt) > maxAge) {
        this.responseCache.delete(id);
      }
    }
    
    // Clean old comparisons
    for (const [id, comparison] of this.responseComparisons) {
      if (now - new Date(comparison.metadata.comparedAt) > maxAge) {
        this.responseComparisons.delete(id);
      }
    }
    
    // Clean old validations
    for (const [id, validation] of this.responseValidations) {
      if (now - new Date(validation.metadata.validatedAt) > maxAge) {
        this.responseValidations.delete(id);
      }
    }
  }

  // Statistics
  getStatistics() {
    return {
      cachedResponses: this.responseCache.size,
      comparisons: this.responseComparisons.size,
      validations: this.responseValidations.size,
      schemas: this.responseSchemas.size,
      performanceRecords: this.performanceMetrics.size,
      alertRules: this.alertRules.size,
      responseHistory: this.responseHistory.size
    };
  }
}

module.exports = new AdvancedResponseService();