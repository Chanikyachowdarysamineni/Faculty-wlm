/**
 * Express server to serve React build with correct MIME types
 * Required for Render deployment when using Web Service instead of Static hosting
 */

const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.resolve(__dirname, 'build');

// Middleware
app.use(compression());

// Serve static files with correct MIME types
app.use(express.static(BUILD_DIR, {
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

// SPA routing - all other routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server listening on port ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Build directory: ${BUILD_DIR}`);
});
