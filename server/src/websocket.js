/**
 * WebSocket Handler - Server-side WebSocket connection management
 * Integrates with Express server using ws library
 */

const WebSocket = require('ws');
const url = require('url');
const logger = require('./utils/logger');

class WebSocketHandler {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Initialize WebSocket server attached to HTTP server
   * @param {http.Server} server - Express HTTP server
   */
  initialize(server) {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
    });

    // Handle new connections
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`✓ WebSocket client connected from ${clientIp}`);

      // Add to clients set
      this.clients.add(ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to WebSocket server',
        timestamp: new Date().toISOString(),
      }));

      // Handle messages
      ws.on('message', (data) => {
        try {
          logger.debug(`Message from ${clientIp}:`, data);
          const message = JSON.parse(data);
          this.handleMessage(ws, message, clientIp);
        } catch (error) {
          logger.error('Error parsing message:', { error: error.message });
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
          }));
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error from ${clientIp}:`, { error: error.message });
      });

      // Handle disconnection
      ws.on('close', () => {
        logger.info(`✗ WebSocket client disconnected from ${clientIp}`);
        this.clients.delete(ws);
      });
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', { error: error.message });
    });

    logger.info('✓ WebSocket server initialized on /ws');
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws, message, clientIp) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        }));
        break;

      case 'broadcast':
        this.broadcast({
          type: 'notification',
          from: clientIp,
          data,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        logger.warn(`Unknown message type: ${type}`);
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${type}`,
        }));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    let broadcastCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        broadcastCount++;
      }
    });

    if (broadcastCount > 0) {
      logger.debug(`Broadcasted message to ${broadcastCount} clients`);
    }
  }

  /**
   * Send message to specific client
   */
  sendTo(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Get number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Close all connections gracefully
   */
  close() {
    this.clients.forEach((client) => {
      client.close();
    });
    this.wss.close();
    logger.info('✓ WebSocket server closed');
  }
}

module.exports = new WebSocketHandler();
