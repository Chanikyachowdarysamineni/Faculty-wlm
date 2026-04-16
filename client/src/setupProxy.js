// CRA dev-server proxy — forwards /csefaculty/* API requests to the backend.
// Frontend now serves from /csefaculty/ prefix for consistency with production.
// This avoids CORS issues when running the React app locally against the
// deployed backend. Only active during `npm start` (development mode).
// Routes are HTTP-only for production compatibility.

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // ─ Production route: /csefaculty/deva → /deva ────────────
  // Used by production frontend at http://160.187.169.41/csefaculty/
  // Converts /csefaculty/deva/* to /deva/* on backend
  app.use(
    '/csefaculty/deva',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/csefaculty/deva': '/deva'  // Strip /csefaculty/deva, forward /deva to backend
      },
      onProxyReq: (proxyReq, req, res) => {
        // Ensure Authorization header is properly forwarded
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        console.log(`[Proxy] ${req.method} ${req.originalUrl} → ${proxyReq.path}`);
      },
      logLevel: 'debug',
    })
  );

  // ─ Direct /deva route ──────────────────────────────────
  // For local development and testing - forwards directly to backend
  app.use(
    '/deva',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        // Ensure Authorization header is properly forwarded
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },
      logLevel: 'debug',
    })
  );

  // ─ Legacy route: /api → /deva ─────────────────────────
  // Kept for backwards compatibility - /api/* routes are rewritten to /deva/*
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/deva'  // Rewrite /api/* to /deva/*
      },
      onProxyReq: (proxyReq, req, res) => {
        // Ensure Authorization header is properly forwarded
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },
    })
  );
};

