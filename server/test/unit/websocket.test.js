'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const http = require('http');
const WebSocket = require('ws');
const wsHandler = require('../../src/websocket');
const { signToken } = require('../../src/utils/jwt');

describe('WebSocket Authentication and WHATWG URL Handling', () => {
  let server;
  let port;

  beforeAll((done) => {
    server = http.createServer();
    wsHandler.initialize(server);
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    wsHandler.close();
    server.close(done);
  });

  test('rejects connection without token with code 1008', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on('close', (code, reason) => {
      expect(code).toBe(1008);
      expect(reason.toString()).toMatch(/Authentication required/i);
      done();
    });
  });

  test('rejects connection with invalid token with code 1008', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=invalid_token_123`);
    ws.on('close', (code, reason) => {
      expect(code).toBe(1008);
      expect(reason.toString()).toMatch(/Invalid or expired token/i);
      done();
    });
  });

  test('accepts connection with valid token', (done) => {
    const token = signToken({ id: 'TEST_WS_USER', role: 'faculty', name: 'WS Test User' });
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${encodeURIComponent(token)}`);
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });
    ws.on('error', (err) => {
      done(err);
    });
  });
});

