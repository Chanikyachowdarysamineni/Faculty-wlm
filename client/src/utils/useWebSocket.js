/**
 * useWebSocket Hook - Simple React hook for WebSocket integration
 */

import { useEffect, useCallback } from 'react';
import WebSocketClient from './WebSocketClient';

/**
 * Hook to manage WebSocket connection in React components
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onMessage - Callback when message received
 * @param {Function} options.onConnect - Callback when connected
 * @param {Function} options.onDisconnect - Callback when disconnected
 * @param {Function} options.onError - Callback on error
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: true)
 * @returns {Object} WebSocket client reference and methods
 * 
 * @example
 * function MyComponent() {
 *   const { isConnected, send } = useWebSocket({
 *     onMessage: (data) => console.log('Received:', data),
 *     onConnect: () => console.log('Connected!'),
 *   });
 * 
 *   return (
 *     <div>
 *       Status: {isConnected ? '✓ Connected' : '✗ Disconnected'}
 *       <button onClick={() => send({ type: 'ping' })}>Send Ping</button>
 *     </div>
 *   );
 * }
 */
export const useWebSocket = (options = {}) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
  } = options;

  // Set up listeners
  useEffect(() => {
    if (onMessage) {
      WebSocketClient.on('message', onMessage);
      return () => WebSocketClient.off('message', onMessage);
    }
  }, [onMessage]);

  useEffect(() => {
    if (onConnect) {
      WebSocketClient.on('connect', onConnect);
      return () => WebSocketClient.off('connect', onConnect);
    }
  }, [onConnect]);

  useEffect(() => {
    if (onDisconnect) {
      WebSocketClient.on('disconnect', onDisconnect);
      return () => WebSocketClient.off('disconnect', onDisconnect);
    }
  }, [onDisconnect]);

  useEffect(() => {
    if (onError) {
      WebSocketClient.on('error', onError);
      return () => WebSocketClient.off('error', onError);
    }
  }, [onError]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !WebSocketClient.isConnected()) {
      WebSocketClient.connect();
    }

    // Cleanup: disconnect on unmount
    return () => {
      // Don't disconnect here - WebSocket connection should persist
      // Uncomment if you want component unmount to disconnect
      // WebSocketClient.disconnect();
    };
  }, [autoConnect]);

  const send = useCallback((data) => {
    return WebSocketClient.send(data);
  }, []);

  return {
    client: WebSocketClient,
    isConnected: WebSocketClient.isConnected(),
    send,
    connect: () => WebSocketClient.connect(),
    disconnect: () => WebSocketClient.disconnect(),
  };
};

export default useWebSocket;
