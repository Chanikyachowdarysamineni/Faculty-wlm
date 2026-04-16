/**
 * WebSocketDemo.jsx - Example component showing WebSocket usage
 * 
 * This component demonstrates:
 * - Auto-connecting with useWebSocket hook
 * - Sending and receiving messages
 * - Connection status display
 * - Error handling
 * - Message history
 */

import React, { useState } from 'react';
import { useWebSocket } from '../utils/useWebSocket';

function WebSocketDemo() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  // Use the WebSocket hook
  const { isConnected, send, disconnect, connect } = useWebSocket({
    autoConnect: true,
    onMessage: (data) => {
      console.log('📨 Message received:', data);
      setMessages((prev) => [
        ...prev,
        {
          type: 'received',
          data,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    },
    onConnect: () => {
      console.log('✓ WebSocket connected');
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          data: { message: 'Connected to WebSocket server' },
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    },
    onDisconnect: () => {
      console.log('✗ WebSocket disconnected');
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          data: { message: 'Disconnected from WebSocket server' },
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          data: { error: error.message || 'Unknown error' },
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    },
  });

  const handleSendPing = () => {
    const success = send({ type: 'ping' });
    setMessages((prev) => [
      ...prev,
      {
        type: 'sent',
        data: { type: 'ping' },
        timestamp: new Date().toLocaleTimeString(),
        success,
      },
    ]);
  };

  const handleSendBroadcast = () => {
    if (!inputMessage.trim()) return;

    const success = send({
      type: 'broadcast',
      data: { message: inputMessage },
    });

    setMessages((prev) => [
      ...prev,
      {
        type: 'sent',
        data: { type: 'broadcast', message: inputMessage },
        timestamp: new Date().toLocaleTimeString(),
        success,
      },
    ]);

    setInputMessage('');
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>📡 WebSocket Test Console</h2>

      {/* Status Bar */}
      <div
        style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          border: `2px solid ${isConnected ? '#28a745' : '#dc3545'}`,
          borderRadius: '4px',
        }}
      >
        <strong>Status:</strong>{' '}
        {isConnected ? (
          <span style={{ color: '#28a745' }}>✓ Connected</span>
        ) : (
          <span style={{ color: '#dc3545' }}>✗ Disconnected</span>
        )}
      </div>

      {/* Control Buttons */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handleSendPing}
          disabled={!isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            opacity: isConnected ? 1 : 0.5,
          }}
        >
          🔔 Send Ping
        </button>

        <button
          onClick={connect}
          disabled={isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'not-allowed' : 'pointer',
            opacity: isConnected ? 0.5 : 1,
          }}
        >
          🔌 Connect
        </button>

        <button
          onClick={disconnect}
          disabled={!isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            opacity: isConnected ? 1 : 0.5,
          }}
        >
          🔌 Disconnect
        </button>

        <button
          onClick={handleClearMessages}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗑️ Clear
        </button>
      </div>

      {/* Broadcast Input */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendBroadcast()}
          placeholder="Type a message to broadcast..."
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
          disabled={!isConnected}
        />
        <button
          onClick={handleSendBroadcast}
          disabled={!isConnected || !inputMessage.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected && inputMessage.trim() ? 'pointer' : 'not-allowed',
            opacity: isConnected && inputMessage.trim() ? 1 : 0.5,
          }}
        >
          📤 Broadcast
        </button>
      </div>

      {/* Message Console */}
      <div
        style={{
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '10px',
          height: '400px',
          overflowY: 'auto',
          fontSize: '12px',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: '#999' }}>No messages yet. Try sending a ping!</div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: '8px',
                padding: '8px',
                backgroundColor:
                  msg.type === 'sent'
                    ? '#e7f3ff'
                    : msg.type === 'received'
                    ? '#e8f5e9'
                    : msg.type === 'error'
                    ? '#ffebee'
                    : '#f5f5f5',
                borderLeft: `3px solid ${
                  msg.type === 'sent'
                    ? '#0066cc'
                    : msg.type === 'received'
                    ? '#4caf50'
                    : msg.type === 'error'
                    ? '#f44336'
                    : '#999'
                }`,
                borderRadius: '2px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                  {msg.type}
                  {msg.success === false && ' ❌'}
                </strong>
                <span style={{ color: '#999', fontSize: '10px' }}>
                  {msg.timestamp}
                </span>
              </div>
              <div style={{ marginTop: '4px', color: '#333' }}>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(msg.data, null, 2)}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <h4>📖 Instructions:</h4>
        <ul>
          <li>Click "Send Ping" to test connection with a ping/pong</li>
          <li>
            Type a message and click "Broadcast" to send to all connected clients
          </li>
          <li>
            Monitor the message console to see sent and received messages in
            real-time
          </li>
          <li>
            Open this page in multiple browser tabs to test message broadcasting
          </li>
        </ul>
      </div>
    </div>
  );
}

export default WebSocketDemo;

/**
 * USAGE IN YOUR COMPONENT:
 * 
 * Simply import and use this component anywhere:
 * 
 * import WebSocketDemo from './components/WebSocketDemo';
 * 
 * function App() {
 *   return (
 *     <div>
 *       <WebSocketDemo />
 *     </div>
 *   );
 * }
 * 
 * Or use the hook directly in your own component:
 * 
 * import { useWebSocket } from '../utils/useWebSocket';
 * 
 * function MyComponent() {
 *   const { isConnected, send } = useWebSocket({
 *     onMessage: (data) => {
 *       console.log('Received:', data);
 *     },
 *   });
 *   
 *   return (
 *     <button onClick={() => send({ type: 'ping' })}>
 *       Send Ping
 *     </button>
 *   );
 * }
 */
