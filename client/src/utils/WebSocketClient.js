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

    if (process.env.REACT_APP_WS_URL) {
      backendUrl = process.env.REACT_APP_WS_URL.replace(/\/+$/, '');
    } else if (process.env.REACT_APP_API_URL && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      const apiUrl = process.env.REACT_APP_API_URL.replace(/\/+$/, '');
      backendUrl = apiUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    } else if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development or localhost: Use current hostname with port 5000
      const host = window.location.hostname || 'localhost';
      backendUrl = `ws://${host}:5000`;
    } else {
      // Production: Match page protocol (HTTPS → WSS, HTTP → WS)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      backendUrl = `${protocol}//${host}`;
    }

    const isCseFaculty = typeof window !== 'undefined' && window.location.pathname.startsWith('/csefaculty');
    const wsPath = isCseFaculty ? '/csefaculty/ws' : '/ws';
    let url = `${backendUrl}${wsPath}`;
    const token = localStorage.getItem('wlm_token') || localStorage.getItem('token');
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = localStorage.getItem('wlm_token') || localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.url = this.getWebSocketURL();

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connect');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
          if (data && data.type) {
            this.emit(data.type, data);
            window.dispatchEvent(new CustomEvent('wlm:realtime', { detail: data }));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.emit('message', event.data);
        }
      };

      this.ws.onerror = (error) => {
        if (this.reconnectAttempts === 0) {
          console.warn('ℹ️ Real-time updates WebSocket connection pending or unavailable (data is synchronized via REST API)');
        }
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        this.emit('disconnect');
        if (event && event.code === 1008) {
          return;
        }
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
    const token = localStorage.getItem('wlm_token') || localStorage.getItem('token');
    if (!token) {
      return;
    }

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
