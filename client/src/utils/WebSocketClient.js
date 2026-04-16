/**
 * WebSocket Client - Manages WebSocket connection to backend
 * Handles both development and production environments
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 seconds
    this.listeners = {};
  }

  /**
   * Get the correct WebSocket URL based on environment
   */
  getWebSocketURL() {
    let backendUrl;

    if (process.env.NODE_ENV === 'development') {
      // Development: Connect to backend at localhost:5000
      backendUrl = 'ws://localhost:5000';
    } else {
      // Production: Use protocol-relative URL or explicit production URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // includes port if non-standard
      backendUrl = `${protocol}//${host}`;
    }

    return `${backendUrl}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.url = this.getWebSocketURL();
    console.log(`Connecting to WebSocket: ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✓ WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.emit('connect');
      };

      this.ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.emit('message', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('✗ WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.emit('disconnect');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.emit('error', error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('✗ Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to WebSocket server
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unregister event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for event "${event}":`, error);
        }
      });
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    console.log('Disconnecting from WebSocket...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state (for debugging)
   */
  getState() {
    if (!this.ws) return 'NOT_INSTANTIATED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Export singleton instance
export default new WebSocketClient();
