import express from 'express';
import cors from 'cors';
import axios from 'axios';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';

const app = express();

// ─── Connect to MongoDB ────────────────────────────────────────────────────
await connectDB();

// ─── Global Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('🚀 PostWomen Backend is running!'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PostWomen Backend is healthy' });
});

// ══════════════════════════════════════════════════════════════════════════
// 1. AUTH ROUTES
//    Handles: register, login, profile, change-password, logout
// ══════════════════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes);


// ══════════════════════════════════════════════════════════════════════════
// 2. PROXY
//    Receives a request config from frontend, forwards it to the real API.
//    This avoids CORS issues when calling external APIs from the browser.
//    POST /api/proxy
// ══════════════════════════════════════════════════════════════════════════
app.post('/api/proxy', async (req, res) => {
  const { url, method = 'GET', headers = {}, body, auth } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Build axios config
  const config = {
    method: method.toLowerCase(),
    url,
    headers: { ...headers, 'User-Agent': 'PostWomen/1.0' },
    timeout: 30000,
    validateStatus: () => true, // Accept all HTTP status codes, don't throw on 4xx/5xx
  };

  // Attach body for POST, PUT, PATCH
  if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
    config.data = body;
  }

  // Attach authentication header
  if (auth) {
    if (auth.type === 'bearer' && auth.token) {
      config.headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'apikey' && auth.key && auth.value) {
      config.headers[auth.key] = auth.value;
    } else if (auth.type === 'basic' && auth.username && auth.password) {
      const b64 = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      config.headers['Authorization'] = `Basic ${b64}`;
    }
  }

  try {
    const start = Date.now();
    const response = await axios(config);
    const duration = Date.now() - start;

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      duration,
      size: JSON.stringify(response.data).length,
    });
  } catch (error) {
    // Network error or timeout
    res.status(500).json({
      error: 'Network error or timeout',
      message: error.message,
      code: error.code,
    });
  }
});


// ══════════════════════════════════════════════════════════════════════════
// 3. MOCK SERVER
//    Users can create named mock endpoints. Each endpoint has a method,
//    path, status code, and a JSON response body.
//    Data is stored in-memory (resets on server restart — by design).
//
//    GET    /api/mocks          → list all mock configs
//    POST   /api/mocks          → create a new mock
//    PUT    /api/mocks/:id      → update a mock
//    DELETE /api/mocks/:id      → delete a mock
//    *      /mock/*             → catch-all: matches incoming request to a mock
// ══════════════════════════════════════════════════════════════════════════

// In-memory store for mock configurations
const mockStore = new Map();

// Create a mock
app.post('/api/mocks', (req, res) => {
  const { name, method, path, status, responseBody, responseHeaders, delay } = req.body;

  if (!method || !path) {
    return res.status(400).json({ error: 'method and path are required' });
  }

  const mock = {
    id: uuidv4(),
    name: name || `${method} ${path}`,
    method: method.toUpperCase(),
    path: path.startsWith('/') ? path : `/${path}`,
    status: status || 200,
    responseBody: responseBody || {},
    responseHeaders: responseHeaders || { 'Content-Type': 'application/json' },
    delay: delay || 0,
    createdAt: new Date().toISOString(),
    hitCount: 0,
  };

  mockStore.set(mock.id, mock);
  res.status(201).json(mock);
});

// List all mocks
app.get('/api/mocks', (req, res) => {
  res.json([...mockStore.values()]);
});

// Update a mock
app.put('/api/mocks/:id', (req, res) => {
  const mock = mockStore.get(req.params.id);
  if (!mock) return res.status(404).json({ error: 'Mock not found' });

  const updated = { ...mock, ...req.body, id: mock.id };
  mockStore.set(mock.id, updated);
  res.json(updated);
});

// Delete a mock
app.delete('/api/mocks/:id', (req, res) => {
  if (!mockStore.has(req.params.id)) return res.status(404).json({ error: 'Mock not found' });
  mockStore.delete(req.params.id);
  res.status(204).send();
});

// Catch-all route: matches incoming requests to a registered mock
app.use('/mock', async (req, res) => {
  // Remove the '/mock' prefix to get the actual path being tested
  const incomingPath = req.originalUrl.replace('/mock', '') || '/';
  const incomingMethod = req.method.toUpperCase();

  // Find a matching mock
  const match = [...mockStore.values()].find(
    (m) => m.method === incomingMethod && m.path === incomingPath
  );

  if (!match) {
    return res.status(404).json({
      error: 'No mock found for this path and method',
      requested: `${incomingMethod} ${incomingPath}`,
      available: [...mockStore.values()].map((m) => `${m.method} ${m.path}`),
    });
  }

  // Increment hit count
  match.hitCount += 1;
  mockStore.set(match.id, match);

  // Apply optional delay
  if (match.delay > 0) {
    await new Promise((r) => setTimeout(r, match.delay));
  }

  res.status(match.status).set(match.responseHeaders).json(match.responseBody);
});


// ══════════════════════════════════════════════════════════════════════════
// 4. WEBSOCKET TESTING
//    The backend acts as a WebSocket CLIENT on behalf of the browser.
//    Browser sends REST requests → backend opens/manages WS connections.
//
//    POST   /api/ws/connect        → connect to a WS URL
//    POST   /api/ws/:id/send       → send a message
//    GET    /api/ws/:id/messages   → get message history
//    DELETE /api/ws/:id            → close connection
//    GET    /api/ws                → list all connections
// ══════════════════════════════════════════════════════════════════════════

// In-memory store for WebSocket connections
const wsConnections = new Map();

// Connect to a WebSocket URL
app.post('/api/ws/connect', (req, res) => {
  const { url, name } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  const id = uuidv4();
  const messages = [];
  let status = 'connecting';

  try {
    const ws = new WebSocket(url);

    ws.on('open', () => {
      status = 'connected';
      const conn = wsConnections.get(id);
      if (conn) conn.status = 'connected';
    });

    ws.on('message', (data) => {
      messages.push({ direction: 'received', data: data.toString(), timestamp: new Date().toISOString() });
    });

    ws.on('close', () => {
      status = 'disconnected';
      const conn = wsConnections.get(id);
      if (conn) conn.status = 'disconnected';
    });

    ws.on('error', (err) => {
      status = 'error';
      const conn = wsConnections.get(id);
      if (conn) { conn.status = 'error'; conn.error = err.message; }
    });

    wsConnections.set(id, { id, name: name || url, url, ws, status, messages, error: null, connectedAt: new Date().toISOString() });

    res.status(201).json({ id, url, name: name || url, status: 'connecting' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create WebSocket connection', message: err.message });
  }
});

// List all connections (without the ws object itself)
app.get('/api/ws', (req, res) => {
  const list = [...wsConnections.values()].map(({ ws, ...rest }) => rest);
  res.json(list);
});

// Send a message through a connection
app.post('/api/ws/:id/send', (req, res) => {
  const conn = wsConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  if (conn.ws.readyState !== WebSocket.OPEN) return res.status(400).json({ error: 'Connection is not open' });

  const message = typeof req.body.message === 'string' ? req.body.message : JSON.stringify(req.body.message);
  conn.ws.send(message);
  conn.messages.push({ direction: 'sent', data: message, timestamp: new Date().toISOString() });

  res.json({ success: true, message: 'Message sent' });
});

// Get message history
app.get('/api/ws/:id/messages', (req, res) => {
  const conn = wsConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  res.json(conn.messages);
});

// Get connection status
app.get('/api/ws/:id', (req, res) => {
  const conn = wsConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  const { ws, ...rest } = conn;
  res.json(rest);
});

// Close and delete a connection
app.delete('/api/ws/:id', (req, res) => {
  const conn = wsConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  conn.ws.close();
  wsConnections.delete(req.params.id);
  res.status(204).send();
});


// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 9000;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 PostWomen Backend running on http://localhost:${PORT}`);
    console.log(`\n   Routes:`);
    console.log(`   🔐 Auth      → /api/auth/*`);
    console.log(`   🔄 Proxy     → POST /api/proxy`);
    console.log(`   🎭 Mocks     → /api/mocks  |  /mock/*`);
    console.log(`   🔌 WebSocket → /api/ws/*\n`);
  });
}

export default app;
