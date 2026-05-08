/**
 * Express server to serve React build with correct MIME types
 * Serves from /csefaculty base path for production deployment
 * Required for Render deployment when using Web Service instead of Static hosting
 * Now supports both HTTP and HTTPS
 */

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.resolve(__dirname, 'build');

// Middleware
app.use(compression());

// Serve static files from /csefaculty base path with correct MIME types
app.use('/csefaculty', express.static(BUILD_DIR, {
  setHeaders: (res, filePath) => {
    // CSS files
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    // JavaScript files
    else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    // JSON files
    else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    // Font files
    else if (filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
    else if (filePath.endsWith('.woff')) {
      res.setHeader('Content-Type', 'font/woff');
    }
    else if (filePath.endsWith('.ttf')) {
      res.setHeader('Content-Type', 'font/ttf');
    }
    // Images
    else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    }
    else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    // Cache control
    if (filePath.includes('/static/')) {
      // Static assets with hash in filename - cache forever
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('index.html')) {
      // index.html - no cache
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      // Other files - short cache
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

// SPA routing for /csefaculty/* paths - serve index.html for all routes
app.get('/csefaculty/*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Redirect root to /csefaculty
app.get('/', (req, res) => {
  res.redirect(301, '/csefaculty/');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Frontend server is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (HTTP or HTTPS based on SSL certificate availability)
const sslKeyPath = process.env.SSL_KEY_PATH || '/etc/ssl/private/your-domain.key';
const sslCertPath = process.env.SSL_CERT_PATH || '/etc/ssl/certs/your-domain.crt';

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  // Start HTTPS server if certificates exist
  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  
  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Frontend server listening on port ${PORT} (HTTPS)`);
    console.log(`   URL: https://localhost:${PORT}/csefaculty`);
    console.log(`   Build directory: ${BUILD_DIR}\n`);
  });
} else {
  // Fallback to HTTP if certificates not found
  console.warn('\n⚠️  SSL certificates not found. Starting in HTTP mode.');
  console.warn(`   Expected: ${sslKeyPath} and ${sslCertPath}`);
  console.warn('   For HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH environment variables\n');
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Frontend server listening on port ${PORT} (HTTP)`);
    console.log(`   URL: http://localhost:${PORT}/csefaculty`);
    console.log(`   Build directory: ${BUILD_DIR}\n`);
  });
}
