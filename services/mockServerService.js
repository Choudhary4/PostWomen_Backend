import path from 'path';

class MockServerService {
  constructor() {
    this.mockConfigs = new Map(); // Store mock configurations
    this.requestLogs = [];
    this.statistics = {
      totalRequests: 0,
      matchedRequests: 0,
      totalConfigs: 0,
      enabledConfigs: 0,
      totalRoutes: 0
    };
    this.faker = null; // Will be loaded dynamically
    this.fakerLoaded = false;
  }

  // Dynamically load faker (for serverless compatibility)
  async loadFaker() {
    if (!this.fakerLoaded) {
      try {
        const fakerModule = await import('@faker-js/faker');
        this.faker = fakerModule.faker;
        this.fakerLoaded = true;
      } catch (error) {
        console.warn('Faker.js not available, using fallback data generation');
        this.faker = this.createFallbackFaker();
        this.fakerLoaded = true;
      }
    }
    return this.faker;
  }

  // Fallback faker implementation for when faker.js is not available
  createFallbackFaker() {
    const names = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'];
    const emails = ['user@example.com', 'test@email.com', 'sample@domain.com'];
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const companies = ['TechCorp', 'DataSoft', 'WebSolutions', 'CloudTech', 'DevCompany'];
    
    return {
      person: {
        fullName: () => names[Math.floor(Math.random() * names.length)],
        firstName: () => names[Math.floor(Math.random() * names.length)].split(' ')[0],
        lastName: () => names[Math.floor(Math.random() * names.length)].split(' ')[1] || 'Smith'
      },
      internet: {
        email: () => emails[Math.floor(Math.random() * emails.length)],
        url: () => 'https://example.com',
        userName: () => 'user' + Math.floor(Math.random() * 1000),
        domainName: () => 'example.com'
      },
      location: {
        streetAddress: () => Math.floor(Math.random() * 9999) + ' Main St',
        city: () => cities[Math.floor(Math.random() * cities.length)],
        country: () => 'United States',
        zipCode: () => Math.floor(Math.random() * 99999).toString().padStart(5, '0')
      },
      company: {
        name: () => companies[Math.floor(Math.random() * companies.length)],
        buzzPhrase: () => 'Innovative solutions for modern businesses'
      },
      lorem: {
        sentence: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        paragraph: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        words: (count = 3) => Array(count).fill('lorem').join(' ')
      },
      number: {
        int: ({ min = 0, max = 999 } = {}) => Math.floor(Math.random() * (max - min + 1)) + min,
        float: ({ min = 0, max = 999 } = {}) => Math.random() * (max - min) + min
      }
    };
  }

  // Create a new mock configuration
  createMockConfig(config) {
    const mockConfig = {
      id: this.generateId(),
      name: config.name || 'New Mock Server',
      baseUrl: config.baseUrl || '/api',
      enabled: config.enabled !== false,
      routes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.mockConfigs.set(mockConfig.id, mockConfig);
    this.updateStatistics();
    return mockConfig;
  }

  // Get all mock configurations
  getAllMockConfigs() {
    return Array.from(this.mockConfigs.values());
  }

  // Get mock configuration by ID
  getMockConfig(id) {
    return this.mockConfigs.get(id);
  }

  // Update mock configuration
  updateMockConfig(id, updates) {
    const config = this.mockConfigs.get(id);
    if (!config) return null;

    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.mockConfigs.set(id, updatedConfig);
    this.updateStatistics();
    return updatedConfig;
  }

  // Delete mock configuration
  deleteMockConfig(id) {
    const deleted = this.mockConfigs.delete(id);
    if (deleted) {
      this.updateStatistics();
    }
    return deleted;
  }

  // Add route to mock configuration
  addRoute(configId, route) {
    const config = this.mockConfigs.get(configId);
    if (!config) return null;

    const newRoute = {
      id: this.generateId(),
      method: route.method || 'GET',
      path: route.path,
      response: {
        status: route.response?.status || 200,
        headers: route.response?.headers || { 'Content-Type': 'application/json' },
        body: route.response?.body || {},
        delay: route.response?.delay || 0
      },
      createdAt: new Date().toISOString()
    };

    config.routes.push(newRoute);
    config.updatedAt = new Date().toISOString();
    this.updateStatistics();
    return newRoute;
  }

  // Update route
  updateRoute(configId, routeId, updates) {
    const config = this.mockConfigs.get(configId);
    if (!config) return null;

    const routeIndex = config.routes.findIndex(r => r.id === routeId);
    if (routeIndex === -1) return null;

    config.routes[routeIndex] = {
      ...config.routes[routeIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    config.updatedAt = new Date().toISOString();
    return config.routes[routeIndex];
  }

  // Delete route
  deleteRoute(configId, routeId) {
    const config = this.mockConfigs.get(configId);
    if (!config) return false;

    const routeIndex = config.routes.findIndex(r => r.id === routeId);
    if (routeIndex === -1) return false;

    config.routes.splice(routeIndex, 1);
    config.updatedAt = new Date().toISOString();
    this.updateStatistics();
    return true;
  }

  // Process mock request
  async processMockRequest(req) {
    const { method, path: requestPath, body, headers } = req;
    const url = requestPath;

    // Ensure faker is loaded
    await this.loadFaker();

    // Log the request
    const logEntry = {
      id: this.generateId(),
      method,
      url,
      body,
      headers,
      timestamp: new Date().toISOString(),
      matched: false
    };

    this.requestLogs.unshift(logEntry);
    this.statistics.totalRequests++;

    // Keep only last 1000 logs
    if (this.requestLogs.length > 1000) {
      this.requestLogs = this.requestLogs.slice(0, 1000);
    }

    // Find matching route
    const matchResult = this.findMatchingRoute(method, url);
    if (matchResult) {
      logEntry.matched = true;
      this.statistics.matchedRequests++;

      const { config, route, params } = matchResult;
      const response = await this.generateResponse(route, params, { body, headers });
      
      return {
        success: true,
        response,
        matchedRoute: route,
        matchedConfig: config,
        extractedParams: params
      };
    }

    return {
      success: false,
      error: 'No matching mock route found'
    };
  }

  // Find matching route
  findMatchingRoute(method, url) {
    for (const config of this.mockConfigs.values()) {
      if (!config.enabled) continue;

      for (const route of config.routes) {
        if (route.method.toLowerCase() === method.toLowerCase()) {
          const params = this.matchRoute(route.path, url, config.baseUrl);
          if (params !== null) {
            return { config, route, params };
          }
        }
      }
    }
    return null;
  }

  // Match route pattern against URL
  matchRoute(routePattern, url, baseUrl) {
    // Remove base URL from the request URL
    let cleanUrl = url;
    if (baseUrl && url.startsWith(baseUrl)) {
      cleanUrl = url.slice(baseUrl.length);
    }
    
    // Ensure both patterns start with /
    if (!cleanUrl.startsWith('/')) cleanUrl = '/' + cleanUrl;
    if (!routePattern.startsWith('/')) routePattern = '/' + routePattern;

    // Split into segments
    const routeSegments = routePattern.split('/').filter(s => s);
    const urlSegments = cleanUrl.split('/').filter(s => s);

    // Quick length check (unless route has wildcards)
    if (!routePattern.includes('*') && routeSegments.length !== urlSegments.length) {
      return null;
    }

    const params = {};
    let urlIndex = 0;

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      
      if (urlIndex >= urlSegments.length) {
        return null; // URL too short
      }

      if (routeSegment === '*') {
        // Wildcard matches any number of remaining segments
        break;
      } else if (routeSegment === '**') {
        // Double wildcard matches everything remaining
        break;
      } else if (routeSegment.startsWith(':')) {
        // Parameter segment
        const paramName = routeSegment.slice(1);
        params[paramName] = urlSegments[urlIndex];
        urlIndex++;
      } else if (routeSegment === urlSegments[urlIndex]) {
        // Exact match
        urlIndex++;
      } else {
        return null; // No match
      }
    }

    // If we haven't consumed all URL segments (and no wildcard), no match
    if (!routePattern.includes('*') && urlIndex < urlSegments.length) {
      return null;
    }

    return params;
  }

  // Generate response with template processing
  async generateResponse(route, params, requestData) {
    const templateContext = {
      params,
      body: requestData.body,
      headers: requestData.headers,
      faker: await this.createFakerProxy(),
      date: {
        now: new Date().toISOString(),
        timestamp: Date.now(),
        unix: Math.floor(Date.now() / 1000)
      },
      random: {
        uuid: this.generateId(),
        int: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
        float: (min = 0, max = 1) => Math.random() * (max - min) + min,
        bool: () => Math.random() < 0.5,
        choice: (arr) => arr[Math.floor(Math.random() * arr.length)]
      }
    };

    const processedBody = this.processTemplate(route.response.body, templateContext);
    const processedHeaders = this.processTemplate(route.response.headers, templateContext);

    return {
      status: route.response.status,
      statusText: this.getStatusText(route.response.status),
      headers: processedHeaders,
      body: processedBody,
      delay: route.response.delay
    };
  }

  // Process template variables in response
  processTemplate(obj, context) {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
        try {
          // Simple expression evaluation
          const result = this.evaluateExpression(expression.trim(), context);
          return result !== undefined ? result : match;
        } catch (error) {
          console.warn('Template evaluation error:', error.message);
          return match;
        }
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.processTemplate(item, context));
    } else if (obj && typeof obj === 'object') {
      const processed = {};
      for (const [key, value] of Object.entries(obj)) {
        const processedKey = this.processTemplate(key, context);
        processed[processedKey] = this.processTemplate(value, context);
      }
      return processed;
    }
    return obj;
  }

  // Evaluate template expressions
  evaluateExpression(expression, context) {
    // Split by dots to handle nested properties
    const parts = expression.split('.');
    let result = context;
    
    for (const part of parts) {
      if (result && typeof result === 'object' && part in result) {
        result = result[part];
      } else if (typeof result === 'function') {
        // Handle function calls (basic support)
        try {
          result = result();
        } catch (error) {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    
    return result;
  }

  // Create faker proxy for template usage
  async createFakerProxy() {
    await this.loadFaker();
    
    return {
      name: {
        fullName: () => this.faker.person.fullName(),
        firstName: () => this.faker.person.firstName(),
        lastName: () => this.faker.person.lastName()
      },
      internet: {
        email: () => this.faker.internet.email(),
        url: () => this.faker.internet.url(),
        username: () => this.faker.internet.userName(),
        domain: () => this.faker.internet.domainName()
      },
      address: {
        street: () => this.faker.location.streetAddress(),
        city: () => this.faker.location.city(),
        country: () => this.faker.location.country(),
        zipCode: () => this.faker.location.zipCode()
      },
      company: {
        name: () => this.faker.company.name(),
        industry: () => this.faker.company.buzzPhrase()
      },
      lorem: {
        sentence: () => this.faker.lorem.sentence(),
        paragraph: () => this.faker.lorem.paragraph(),
        words: (count = 3) => this.faker.lorem.words(count)
      },
      number: {
        int: (min = 0, max = 999) => this.faker.number.int({ min, max }),
        float: (min = 0, max = 999) => this.faker.number.float({ min, max })
      }
    };
  }

  // Get request logs
  getRequestLogs(limit = 100) {
    return this.requestLogs.slice(0, limit);
  }

  // Clear request logs
  clearRequestLogs() {
    this.requestLogs = [];
    this.statistics.totalRequests = 0;
    this.statistics.matchedRequests = 0;
  }

  // Get statistics
  getStatistics() {
    return {
      ...this.statistics,
      recentRequests: this.requestLogs.filter(log => 
        Date.now() - new Date(log.timestamp).getTime() < 3600000 // Last hour
      ).length
    };
  }

  // Update statistics
  updateStatistics() {
    this.statistics.totalConfigs = this.mockConfigs.size;
    this.statistics.enabledConfigs = Array.from(this.mockConfigs.values()).filter(c => c.enabled).length;
    this.statistics.totalRoutes = Array.from(this.mockConfigs.values()).reduce((sum, c) => sum + c.routes.length, 0);
  }

  // Get route templates
  getRouteTemplates() {
    return [
      {
        name: 'User List',
        method: 'GET',
        path: '/users',
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            users: [
              {
                id: '{{random.int}}',
                name: '{{faker.name.fullName}}',
                email: '{{faker.internet.email}}',
                createdAt: '{{date.now}}'
              }
            ],
            total: 1
          },
          delay: 0
        }
      },
      {
        name: 'User by ID',
        method: 'GET',
        path: '/users/:id',
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            id: '{{params.id}}',
            name: '{{faker.name.fullName}}',
            email: '{{faker.internet.email}}',
            address: {
              street: '{{faker.address.street}}',
              city: '{{faker.address.city}}',
              country: '{{faker.address.country}}'
            },
            createdAt: '{{date.now}}'
          },
          delay: 0
        }
      },
      {
        name: 'Create User',
        method: 'POST',
        path: '/users',
        response: {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: {
            id: '{{random.int}}',
            name: '{{body.name}}',
            email: '{{body.email}}',
            createdAt: '{{date.now}}'
          },
          delay: 100
        }
      },
      {
        name: 'Error Response',
        method: 'GET',
        path: '/error',
        response: {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: {
            error: 'Internal Server Error',
            message: 'Something went wrong',
            timestamp: '{{date.now}}'
          },
          delay: 0
        }
      }
    ];
  }

  // Export configurations
  exportMockConfigs() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      configs: Array.from(this.mockConfigs.values())
    };
  }

  // Import configurations
  importMockConfigs(data) {
    try {
      if (!data.configs || !Array.isArray(data.configs)) {
        throw new Error('Invalid import data format');
      }

      let imported = 0;
      for (const config of data.configs) {
        const newConfig = {
          ...config,
          id: this.generateId(), // Generate new ID to avoid conflicts
          importedAt: new Date().toISOString()
        };
        this.mockConfigs.set(newConfig.id, newConfig);
        imported++;
      }

      this.updateStatistics();
      return { success: true, imported };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get HTTP status text
  getStatusText(status) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };
    return statusTexts[status] || 'Unknown';
  }

  // Clear all data
  clearAllData() {
    this.mockConfigs.clear();
    this.requestLogs = [];
    this.statistics = {
      totalRequests: 0,
      matchedRequests: 0,
      totalConfigs: 0,
      enabledConfigs: 0,
      totalRoutes: 0
    };
  }
}

const mockServerService = new MockServerService();
export default mockServerService;