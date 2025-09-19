import express from 'express';
import cors from 'cors';
import axios from 'axios';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import connectDB from './config/database.js';
import mockServerService from './services/mockServerService.js';
import webSocketService from './services/webSocketService.js';
import themeService from './services/themeService.js';

// Import authentication routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PostWomen Backend is running' });
});

// ============ AUTHENTICATION ENDPOINTS ============

// Authentication routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// ============ END AUTHENTICATION ENDPOINTS ============

// Proxy endpoint to handle API requests
app.post('/api/proxy', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body, auth } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Prepare axios config
    const config = {
      method: method.toLowerCase(),
      url,
      headers: {
        ...headers,
        'User-Agent': 'Postman-MVP/1.0'
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true // Accept all status codes
    };

    // Add body for POST, PUT, PATCH requests
    if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
      config.data = body;
    }

    // Handle authentication
    if (auth) {
      switch (auth.type) {
        case 'bearer':
          config.headers.Authorization = `Bearer ${auth.token}`;
          break;
        case 'apikey':
          if (auth.key && auth.value) {
            config.headers[auth.key] = auth.value;
          }
          break;
        case 'basic':
          if (auth.username && auth.password) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            config.headers.Authorization = `Basic ${credentials}`;
          }
          break;
      }
    }

    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      duration,
      size: JSON.stringify(response.data).length
    });

  } catch (error) {
    console.error('Proxy request error:', error.message);
    
    if (error.response) {
      // Server responded with error status
      res.json({
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        duration: 0,
        size: 0
      });
    } else if (error.request) {
      // Request timeout or network error
      res.status(500).json({
        error: 'Network error or timeout',
        message: error.message,
        code: error.code
      });
    } else {
      // Other errors
      res.status(500).json({
        error: 'Request failed',
        message: error.message
      });
    }
  }
});

// Collections endpoints (for future implementation with database)
app.get('/api/collections', (req, res) => {
  // For MVP, we'll use client-side storage
  res.json({ message: 'Collections are stored in browser localStorage' });
});

app.post('/api/collections', (req, res) => {
  // For MVP, we'll use client-side storage
  res.json({ message: 'Collections are stored in browser localStorage' });
});

// ============ MOCK SERVER ENDPOINTS ============

// Get all mock configurations
app.get('/api/mock-configs', (req, res) => {
  try {
    const configs = mockServerService.getAllMockConfigs();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create mock configuration
app.post('/api/mock-configs', (req, res) => {
  try {
    const config = mockServerService.createMockConfig(req.body);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update mock configuration
app.put('/api/mock-configs/:id', (req, res) => {
  try {
    const config = mockServerService.updateMockConfig(req.params.id, req.body);
    if (!config) {
      return res.status(404).json({ error: 'Mock configuration not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete mock configuration
app.delete('/api/mock-configs/:id', (req, res) => {
  try {
    const deleted = mockServerService.deleteMockConfig(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Mock configuration not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add route to mock configuration
app.post('/api/mock-configs/:id/routes', (req, res) => {
  try {
    const route = mockServerService.addRoute(req.params.id, req.body);
    if (!route) {
      return res.status(404).json({ error: 'Mock configuration not found' });
    }
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update route
app.put('/api/mock-configs/:id/routes/:routeId', (req, res) => {
  try {
    const route = mockServerService.updateRoute(req.params.id, req.params.routeId, req.body);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete route
app.delete('/api/mock-configs/:id/routes/:routeId', (req, res) => {
  try {
    const deleted = mockServerService.deleteRoute(req.params.id, req.params.routeId);
    if (!deleted) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get request logs
app.get('/api/mock-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = mockServerService.getRequestLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear request logs
app.delete('/api/mock-logs', (req, res) => {
  try {
    mockServerService.clearRequestLogs();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get mock server statistics
app.get('/api/mock-stats', (req, res) => {
  try {
    const stats = mockServerService.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get route templates
app.get('/api/mock-templates', (req, res) => {
  try {
    const templates = mockServerService.getRouteTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export mock configurations
app.get('/api/mock-export', (req, res) => {
  try {
    const data = mockServerService.exportMockConfigs();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import mock configurations
app.post('/api/mock-import', (req, res) => {
  try {
    const result = mockServerService.importMockConfigs(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test mock endpoint
app.post('/api/mock-test', async (req, res) => {
  try {
    const { method, url, body, headers } = req.body;
    const mockRequest = {
      method: method || 'GET',
      path: url,
      body,
      headers: headers || {}
    };
    
    const result = await mockServerService.processMockRequest(mockRequest);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mock server catch-all route (should be last)
app.use('/mock/*', async (req, res) => {
  try {
    const mockRequest = {
      method: req.method,
      path: req.originalUrl,
      body: req.body,
      headers: req.headers
    };
    
    const result = await mockServerService.processMockRequest(mockRequest);
    
    if (result.success) {
      // Apply delay if specified
      const delay = result.response.delay || 0;
      setTimeout(() => {
        res.status(result.response.status)
           .set(result.response.headers)
           .json(result.response.body);
      }, delay);
    } else {
      res.status(404).json({
        error: 'Mock endpoint not found',
        message: result.error,
        path: req.originalUrl,
        method: req.method
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ END MOCK SERVER ENDPOINTS ============

// ============ WEBSOCKET ENDPOINTS ============

// Create WebSocket connection
app.post('/api/websocket/connections', (req, res) => {
  try {
    const result = webSocketService.createConnection(req.body);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all WebSocket connections
app.get('/api/websocket/connections', (req, res) => {
  try {
    const connections = webSocketService.getAllConnections();
    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific WebSocket connection
app.get('/api/websocket/connections/:id', (req, res) => {
  try {
    const connection = webSocketService.getConnectionInfo(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message through WebSocket
app.post('/api/websocket/connections/:id/send', (req, res) => {
  try {
    const { message, messageType } = req.body;
    const result = webSocketService.sendMessage(req.params.id, message, messageType);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close WebSocket connection
app.post('/api/websocket/connections/:id/close', (req, res) => {
  try {
    const { code, reason } = req.body;
    const result = webSocketService.closeConnection(req.params.id, code, reason);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete WebSocket connection
app.delete('/api/websocket/connections/:id', (req, res) => {
  try {
    const result = webSocketService.deleteConnection(req.params.id);
    if (result.success) {
      res.status(204).send();
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get message history for connection
app.get('/api/websocket/connections/:id/messages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const messages = webSocketService.getMessageHistory(req.params.id, limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear message history for connection
app.delete('/api/websocket/connections/:id/messages', (req, res) => {
  try {
    const result = webSocketService.clearMessageHistory(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test WebSocket connection
app.post('/api/websocket/test', (req, res) => {
  webSocketService.testConnection(req.body)
    .then(result => res.json(result))
    .catch(error => res.status(500).json({ error: error.message }));
});

// Get WebSocket statistics
app.get('/api/websocket/stats', (req, res) => {
  try {
    const stats = webSocketService.getGlobalStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get WebSocket connection templates
app.get('/api/websocket/templates', (req, res) => {
  try {
    const templates = webSocketService.getConnectionTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export WebSocket data
app.get('/api/websocket/export', (req, res) => {
  try {
    const data = webSocketService.exportConnections();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import WebSocket data
app.post('/api/websocket/import', (req, res) => {
  try {
    const result = webSocketService.importConnections(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup closed connections
app.post('/api/websocket/cleanup', (req, res) => {
  try {
    const result = webSocketService.cleanup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ END WEBSOCKET ENDPOINTS ============

// ============ THEME ENDPOINTS ============

// Get all themes
app.get('/api/themes', (req, res) => {
  try {
    const themes = themeService.getAllThemes();
    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific theme
app.get('/api/themes/:id', (req, res) => {
  try {
    const theme = themeService.getTheme(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json(theme);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create custom theme
app.post('/api/themes', (req, res) => {
  try {
    const validation = themeService.validateTheme(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    const theme = themeService.createTheme(req.body);
    res.status(201).json(theme);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update theme
app.put('/api/themes/:id', (req, res) => {
  try {
    const theme = themeService.updateTheme(req.params.id, req.body);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json(theme);
  } catch (error) {
    if (error.message.includes('Cannot modify')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete theme
app.delete('/api/themes/:id', (req, res) => {
  try {
    const deleted = themeService.deleteTheme(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('Cannot delete')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Clone theme
app.post('/api/themes/:id/clone', (req, res) => {
  try {
    const { name } = req.body;
    const clonedTheme = themeService.cloneTheme(req.params.id, name);
    if (!clonedTheme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.status(201).json(clonedTheme);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user preferences
app.get('/api/themes/users/:userId/preferences', (req, res) => {
  try {
    const preferences = themeService.getUserPreferences(req.params.userId);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
app.put('/api/themes/users/:userId/preferences', (req, res) => {
  try {
    const preferences = themeService.updateUserPreferences(req.params.userId, req.body);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set active theme for user
app.post('/api/themes/users/:userId/active', (req, res) => {
  try {
    const { themeId } = req.body;
    const preferences = themeService.setActiveTheme(req.params.userId, themeId);
    res.json(preferences);
  } catch (error) {
    if (error.message === 'Theme not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get active theme for user
app.get('/api/themes/users/:userId/active', (req, res) => {
  try {
    const theme = themeService.getActiveTheme(req.params.userId);
    res.json(theme);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate CSS variables for theme
app.get('/api/themes/:id/css', (req, res) => {
  try {
    const css = themeService.generateCSSVariables(req.params.id);
    if (!css) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.type('text/css').send(css);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get theme statistics
app.get('/api/themes/stats', (req, res) => {
  try {
    const stats = themeService.getThemeStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export themes
app.get('/api/themes/export', (req, res) => {
  try {
    const data = themeService.exportThemes();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import themes
app.post('/api/themes/import', (req, res) => {
  try {
    const result = themeService.importThemes(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate theme
app.post('/api/themes/validate', (req, res) => {
  try {
    const validation = themeService.validateTheme(req.body);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear custom data
app.delete('/api/themes/custom', (req, res) => {
  try {
    const result = themeService.clearCustomData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset to defaults
app.post('/api/themes/reset', (req, res) => {
  try {
    const result = themeService.resetToDefaults();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/', (req, res) => {
  res.send('🚀 PostWomen Backend is running!');
});


// ============ END THEME ENDPOINTS ============

// Start server
const PORT = process.env.PORT || 9000;

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 PostWomen Backend running on port ${PORT}`);
    console.log(`📡 Proxy endpoint: http://localhost:${PORT}/api/proxy`);
    console.log(`🎭 Mock Server: http://localhost:${PORT}/mock/*`);
    console.log(`🔌 WebSocket Testing: http://localhost:${PORT}/api/websocket/*`);
    console.log(`🎨 Theme Management: http://localhost:${PORT}/api/themes/*`);
    console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth/*`);
    console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/api/admin/*`);
    console.log(`\n🎯 Phase 3 Professional Features:`);
    console.log(`   ✅ Mock Server with dynamic data generation`);
    console.log(`   ✅ WebSocket Testing with real-time messaging`);
    console.log(`   ✅ Dark Mode & Themes with user preferences`);
    console.log(`   ✅ User Authentication with JWT & MongoDB`);
    console.log(`   ✅ Admin Panel with role-based access control`);
  });
}

export default app;
