import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';


class WebSocketService {
  constructor() {
    this.connections = new Map(); // Store active WebSocket connections
    this.messageHistory = new Map(); // Store message history per connection
    this.connectionStats = new Map(); // Store connection statistics
  }

  // Create WebSocket connection
  createConnection(config) {
    const connectionId = uuidv4();
    
    try {
      const wsConfig = {
        headers: config.headers || {},
        protocols: config.protocols || [],
        ...config.options
      };

      const ws = new WebSocket(config.url, wsConfig);
      
      const connectionData = {
        id: connectionId,
        url: config.url,
        status: 'connecting',
        ws,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        config: config
      };

      this.connections.set(connectionId, connectionData);
      this.messageHistory.set(connectionId, []);
      this.connectionStats.set(connectionId, {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        connectionAttempts: 1,
        lastPingTime: null,
        averageLatency: 0,
        errors: []
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(connectionId, ws);

      return {
        success: true,
        connectionId,
        connection: this.getConnectionInfo(connectionId)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Setup WebSocket event handlers
  setupWebSocketHandlers(connectionId, ws) {
    const connectionData = this.connections.get(connectionId);
    const stats = this.connectionStats.get(connectionId);

    ws.on('open', () => {
      connectionData.status = 'connected';
      connectionData.lastActivity = new Date().toISOString();
      this.addMessage(connectionId, {
        type: 'system',
        direction: 'system',
        content: 'WebSocket connection established',
        timestamp: new Date().toISOString()
      });
    });

    ws.on('message', (data) => {
      const message = data.toString();
      connectionData.lastActivity = new Date().toISOString();
      stats.messagesReceived++;
      stats.bytesReceived += message.length;

      this.addMessage(connectionId, {
        type: 'message',
        direction: 'received',
        content: message,
        size: message.length,
        timestamp: new Date().toISOString()
      });

      // Check if this is a pong response for latency calculation
      if (message.startsWith('pong:')) {
        const pingTime = parseInt(message.split(':')[1]);
        const latency = Date.now() - pingTime;
        stats.lastPingTime = latency;
        
        // Calculate average latency
        if (stats.averageLatency === 0) {
          stats.averageLatency = latency;
        } else {
          stats.averageLatency = (stats.averageLatency + latency) / 2;
        }
      }
    });

    ws.on('error', (error) => {
      connectionData.status = 'error';
      connectionData.lastActivity = new Date().toISOString();
      stats.errors.push({
        message: error.message,
        timestamp: new Date().toISOString()
      });

      this.addMessage(connectionId, {
        type: 'error',
        direction: 'system',
        content: `WebSocket error: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });

    ws.on('close', (code, reason) => {
      connectionData.status = 'closed';
      connectionData.lastActivity = new Date().toISOString();
      connectionData.closeCode = code;
      connectionData.closeReason = reason.toString();

      this.addMessage(connectionId, {
        type: 'system',
        direction: 'system',
        content: `WebSocket connection closed (Code: ${code}, Reason: ${reason || 'No reason provided'})`,
        timestamp: new Date().toISOString()
      });
    });

    ws.on('ping', (data) => {
      this.addMessage(connectionId, {
        type: 'ping',
        direction: 'received',
        content: `Ping received: ${data.toString()}`,
        timestamp: new Date().toISOString()
      });
    });

    ws.on('pong', (data) => {
      this.addMessage(connectionId, {
        type: 'pong',
        direction: 'received',
        content: `Pong received: ${data.toString()}`,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Send message through WebSocket
  sendMessage(connectionId, message, messageType = 'text') {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      return { success: false, error: 'Connection not found' };
    }

    if (connectionData.status !== 'connected') {
      return { success: false, error: 'Connection is not active' };
    }

    try {
      const stats = this.connectionStats.get(connectionId);
      
      if (messageType === 'binary') {
        const buffer = Buffer.from(message, 'base64');
        connectionData.ws.send(buffer);
        stats.bytesSent += buffer.length;
      } else if (messageType === 'ping') {
        const pingData = `ping:${Date.now()}`;
        connectionData.ws.ping(pingData);
        stats.bytesSent += pingData.length;
        message = pingData;
      } else {
        connectionData.ws.send(message);
        stats.bytesSent += message.length;
      }

      stats.messagesSent++;
      connectionData.lastActivity = new Date().toISOString();

      this.addMessage(connectionId, {
        type: messageType,
        direction: 'sent',
        content: message,
        size: messageType === 'binary' ? Buffer.from(message, 'base64').length : message.length,
        timestamp: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Close WebSocket connection
  closeConnection(connectionId, code = 1000, reason = 'Client closed connection') {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      if (connectionData.ws.readyState === WebSocket.OPEN) {
        connectionData.ws.close(code, reason);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get connection information
  getConnectionInfo(connectionId) {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      return null;
    }

    const stats = this.connectionStats.get(connectionId);
    const messages = this.messageHistory.get(connectionId) || [];

    return {
      id: connectionData.id,
      url: connectionData.url,
      status: connectionData.status,
      createdAt: connectionData.createdAt,
      lastActivity: connectionData.lastActivity,
      closeCode: connectionData.closeCode,
      closeReason: connectionData.closeReason,
      config: connectionData.config,
      stats: stats,
      messageCount: messages.length,
      readyState: connectionData.ws.readyState
    };
  }

  // Get all connections
  getAllConnections() {
    const connections = [];
    for (const connectionId of this.connections.keys()) {
      connections.push(this.getConnectionInfo(connectionId));
    }
    return connections;
  }

  // Get message history for a connection
  getMessageHistory(connectionId, limit = 100) {
    const messages = this.messageHistory.get(connectionId) || [];
    return messages.slice(-limit).reverse(); // Return most recent first
  }

  // Add message to history
  addMessage(connectionId, message) {
    const messages = this.messageHistory.get(connectionId) || [];
    messages.push({
      id: uuidv4(),
      ...message
    });

    // Keep only last 1000 messages per connection
    if (messages.length > 1000) {
      messages.splice(0, messages.length - 1000);
    }

    this.messageHistory.set(connectionId, messages);
  }

  // Clear message history for a connection
  clearMessageHistory(connectionId) {
    this.messageHistory.set(connectionId, []);
    return { success: true };
  }

  // Delete connection and cleanup
  deleteConnection(connectionId) {
    const connectionData = this.connections.get(connectionId);
    if (!connectionData) {
      return { success: false, error: 'Connection not found' };
    }

    // Close connection if still open
    if (connectionData.ws.readyState === WebSocket.OPEN) {
      connectionData.ws.close(1000, 'Connection deleted');
    }

    // Remove from maps
    this.connections.delete(connectionId);
    this.messageHistory.delete(connectionId);
    this.connectionStats.delete(connectionId);

    return { success: true };
  }

  // Get WebSocket connection statistics
  getGlobalStats() {
    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected').length;
    
    let totalMessages = 0;
    let totalBytes = 0;
    let totalErrors = 0;

    for (const stats of this.connectionStats.values()) {
      totalMessages += stats.messagesReceived + stats.messagesSent;
      totalBytes += stats.bytesReceived + stats.bytesSent;
      totalErrors += stats.errors.length;
    }

    return {
      totalConnections,
      activeConnections,
      totalMessages,
      totalBytes,
      totalErrors
    };
  }

  // Test WebSocket connection without creating persistent connection
  testConnection(config) {
    return new Promise((resolve) => {
      const timeout = config.timeout || 5000;
      let resolved = false;

      const ws = new WebSocket(config.url, {
        headers: config.headers || {},
        protocols: config.protocols || []
      });

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            success: false,
            error: 'Connection timeout',
            duration: timeout
          });
        }
      }, timeout);

      const startTime = Date.now();

      ws.on('open', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          ws.close();
          resolve({
            success: true,
            duration,
            message: 'Connection successful'
          });
        }
      });

      ws.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          resolve({
            success: false,
            error: error.message,
            duration
          });
        }
      });
    });
  }

  // Get connection templates
  getConnectionTemplates() {
    return [
      {
        name: 'Echo Server',
        url: 'wss://echo.websocket.org',
        description: 'Simple echo server for testing',
        headers: {},
        protocols: []
      },
      {
        name: 'Socket.IO Server',
        url: 'ws://localhost:3001/socket.io/?EIO=4&transport=websocket',
        description: 'Socket.IO server connection',
        headers: {},
        protocols: []
      },
      {
        name: 'Chat Server',
        url: 'wss://localhost:8080/chat',
        description: 'Real-time chat server',
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN'
        },
        protocols: ['chat']
      },
      {
        name: 'Trading WebSocket',
        url: 'wss://stream.binance.com:9443/ws/btcusdt@ticker',
        description: 'Cryptocurrency trading data stream',
        headers: {},
        protocols: []
      }
    ];
  }

  // Export connection data
  exportConnections() {
    const connections = this.getAllConnections();
    const history = {};
    
    for (const connectionId of this.connections.keys()) {
      history[connectionId] = this.getMessageHistory(connectionId, 500);
    }

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      connections,
      messageHistory: history,
      globalStats: this.getGlobalStats()
    };
  }

  // Import connection data
  importConnections(data) {
    try {
      if (!data.connections || !Array.isArray(data.connections)) {
        throw new Error('Invalid import data format');
      }

      // Note: We can't restore active WebSocket connections, 
      // but we can restore message history and config
      let imported = 0;
      
      if (data.messageHistory) {
        for (const [connectionId, messages] of Object.entries(data.messageHistory)) {
          this.messageHistory.set(connectionId, messages);
          imported++;
        }
      }

      return { success: true, imported, note: 'Message history imported. Active connections cannot be restored.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Cleanup closed connections
  cleanup() {
    let cleaned = 0;
    for (const [connectionId, connectionData] of this.connections.entries()) {
      if (connectionData.status === 'closed' || connectionData.ws.readyState === WebSocket.CLOSED) {
        this.connections.delete(connectionId);
        // Keep message history for reference
        cleaned++;
      }
    }
    return { cleaned };
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;