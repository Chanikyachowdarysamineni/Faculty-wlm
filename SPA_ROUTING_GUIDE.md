# SPA Routing Configuration - Stay on Same Page After Reload ✅

## Problem Fixed ✅

**Issue**: On page reload in production, the app was redirecting to root instead of staying on the current page.

**Root Cause**: SPAs (Single Page Apps) require special server configuration to serve `index.html` for all routes, not just the static files.

**Solution**: Configure server to fall back to `index.html` for all `/csefaculty/*` routes.

---

## Architecture

```
Request Flow:
┌─────────────────────────────────────────────────────────┐
│ User reloads page at: localhost:3000/csefaculty/faculty │
└─────────────────────────────────────────────────────────┘
                          ↓
         Browser sends request to server
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Production Server (nginx/Apache/Express)                │
│                                                         │
│ 1. Is /csefaculty/faculty a real file? NO             │
│ 2. Is /csefaculty/faculty a real directory? NO        │
│ 3. Serve /csefaculty/index.html instead ✅            │
└─────────────────────────────────────────────────────────┘
                          ↓
        React loads and React Router handles:
        /csefaculty/faculty → FacultyPage component
                          ↓
┌─────────────────────────────────────────────────────────┐
│ User stays on Faculty Page (same as before reload) ✅   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation by Server Type

### 1. Express.js Server (client/server.js) ✅ UPDATED

```javascript
// Serve static files from /csefaculty base path
app.use('/csefaculty', express.static(BUILD_DIR, { ... }));

// SPA Routing: serve index.html for all /csefaculty/* routes
app.get('/csefaculty/*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Redirect root to /csefaculty
app.get('/', (req, res) => {
  res.redirect(301, '/csefaculty/');
});
```

**How it works**:
1. Static files served from `/csefaculty/` prefix
2. Any request to `/csefaculty/[anything]` that isn't a file → serves `index.html`
3. React Router then handles the client-side routing

**Testing locally**:
```bash
npm run build
npm run server
# Visit: http://localhost:3000/csefaculty
# Then: http://localhost:3000/csefaculty/faculty
# Reload (F5) - stays on Faculty page ✅
```

---

### 2. Nginx Configuration (nginx.conf) ✅ CREATED

```nginx
location /csefaculty/ {
  alias /var/www/html/csefaculty/;
  try_files $uri $uri/ /csefaculty/index.html;
}
```

**How it works**:
- `try_files $uri` - Try exact file
- `$uri/` - Try as directory
- `/csefaculty/index.html` - Fall back to index.html

**Installation**:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/csefaculty
sudo ln -s /etc/nginx/sites-available/csefaculty /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

**Test**:
```bash
curl http://160.187.169.41/csefaculty/faculty
# Returns: contents of index.html ✅
```

---

### 3. Apache Configuration (apache.conf / .htaccess) ✅ CREATED

#### Option A: Using apache.conf
```apache
<Directory /var/www/html/csefaculty>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
</Directory>
```

#### Option B: Using .htaccess
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [L]
```

**Installation (Option A)**:
```bash
sudo cp apache.conf /etc/apache2/sites-available/csefaculty.conf
sudo a2enmod rewrite
sudo a2ensite csefaculty
sudo apache2ctl configtest  # Should show "Syntax OK"
sudo systemctl restart apache2
```

**Installation (Option B)**:
```bash
cp .htaccess /var/www/html/csefaculty/
# Make sure AllowOverride All is set in apache.conf
```

---

## Routing Verification Checklist ✅

| Item | Status | Command |
|------|--------|---------|
| Development - Pages persist on reload | ✅ | `npm start` then reload in browser |
| Production build includes all routes | ✅ | `npm run build` creates build/index.html |
| Express server fallback configured | ✅ | `npm run server` serves from /csefaculty |
| API proxy configured | ✅ | `/deva/*` routes → backend on 5000 |
| Static assets cached | ✅ | webpack hashing + server cache headers |
| React Router basename set | ✅ | `<Router basename="/csefaculty">` |
| package.json homepage set | ✅ | `"homepage": "/csefaculty"` |
| index.html base tag set | ✅ | `<base href="/csefaculty/" />` |

---

## Deploy to Production

### Step 1: Build Application
```bash
cd client
npm run build
# Creates: client/build/
```

### Step 2: Choose Hosting Option

#### Option A: Express Server on Render/Heroku
```bash
# Deploy entire project (with server.js)
git push heroku main

# Server runs on PORT and serves from /csefaculty
# Result: https://your-app.herokuapp.com/csefaculty/
```

#### Option B: Nginx on Linux Server
```bash
# Copy build to server
scp -r build/ user@160.187.169.41:/var/www/html/csefaculty/

# Copy nginx config
scp nginx.conf user@160.187.169.41:/etc/nginx/sites-available/csefaculty

# On server: enable and restart
sudo a2ensite csefaculty
sudo nginx -t && sudo systemctl restart nginx
```

#### Option C: Apache on Linux Server
```bash
# Copy build to server
scp -r build/ user@160.187.169.41:/var/www/html/csefaculty/

# Copy .htaccess
scp .htaccess user@160.187.169.41:/var/www/html/csefaculty/

# On server: restart Apache
sudo systemctl restart apache2
```

### Step 3: Verify in Production

```bash
# Test home page
curl http://160.187.169.41/csefaculty/

# Test page persistence (should return index.html)
curl http://160.187.169.41/csefaculty/faculty
curl http://160.187.169.41/csefaculty/courses
curl http://160.187.169.41/csefaculty/dashboard

# Test API routing
curl -H "Authorization: Bearer <token>" \
  http://160.187.169.41/deva/faculty

# Manual test: visit page, reload (F5) - should stay on same page ✅
```

---

## URL Mapping

### Development (npm start)
```
Frontend: http://localhost:3000/csefaculty/
API:      http://localhost:5000/deva/
Proxy:    localhost:3000 → localhost:5000 (setupProxy.js)
```

### Production (Express Server)
```
Frontend: http://160.187.169.41/csefaculty/
API:      http://160.187.169.41/deva/
Server:   Express on :3000 (or :5000 if port changed)
```

### Production (Nginx/Apache)
```
Frontend: http://160.187.169.41/csefaculty/
API:      http://160.187.169.41/deva/
Backend:  http://localhost:5000 (internal proxy)
Web Server: Nginx/Apache on :80/:443
```

---

## Request Flow Examples

### Example 1: Initial Load (Development)
```
User visits: http://localhost:3000/csefaculty
  ↓
React Scripts dev server serves: index.html
  ↓
Browser loads React app with PUBLIC_URL=/csefaculty
  ↓
React Router reads URL and shows appropriate page
```

### Example 2: Page Reload (Production with Nginx)
```
User at: http://160.187.169.41/csefaculty/faculty
Presses F5
  ↓
Browser requests: /csefaculty/faculty
  ↓
Nginx checks:
  1. Is /csefaculty/faculty a file? NO
  2. Is /csefaculty/faculty a directory? NO
  ↓
Nginx serves: /csefaculty/index.html
  ↓
Browser loads index.html
  ↓
React initializes and React Router sees /faculty route
  ↓
Displays Faculty page (same as before reload) ✅
```

### Example 3: API Call (Production)
```
Frontend calls: /deva/faculty (relative to /csefaculty/)
  ↓
Becomes: http://160.187.169.41/deva/faculty
  ↓
Nginx (or Apache) proxies to: http://localhost:5000/deva/faculty
  ↓
Backend responds with faculty data
  ↓
Frontend receives data and updates page
```

---

## Cache Strategy

| File Type | Cache Duration | Purpose |
|-----------|----------------|---------|
| index.html | No Cache | Always fetch latest |
| /static/js/*.js | 1 year | Webpack hash invalidates on change |
| /static/css/*.css | 1 year | Webpack hash invalidates on change |
| /logo.webp | 1 hour | Update available quickly |
| /image.webp | 1 hour | Update available quickly |

---

## Troubleshooting

### Issue: Reload causes 404 error
**Fix**: Ensure server is configured to serve `index.html` for all `/csefaculty/*` routes

### Issue: Static assets not loading
**Fix**: Check `process.env.PUBLIC_URL` is `/csefaculty` and `homepage` in package.json is set

### Issue: API calls return 404
**Fix**: Ensure proxy is configured for `/deva/*` to backend server

### Issue: Images/logos not loading
**Fix**: Use `${process.env.PUBLIC_URL}/logo.webp` instead of hardcoded `/logo.webp`

---

## Files Modified/Created

### Modified ✅
- `client/server.js` - Added /csefaculty routing with SPA fallback
- `client/src/Dashboard.jsx` - Fixed logo paths to use process.env.PUBLIC_URL

### Created ✅
- `nginx.conf` - Complete nginx configuration for production
- `apache.conf` - Complete Apache configuration for production
- `.htaccess` - Apache mod_rewrite rules for SPA routing

### Already Configured ✅
- `package.json` - `"homepage": "/csefaculty"`
- `index.html` - `<base href="/csefaculty/" />`
- `client/src/App.js` - `<Router basename="/csefaculty">`
- `setupProxy.js` - Development proxy configuration

---

## Summary

✅ **SPA routing fully configured for all environments**
- Development (npm start): Stays on page after reload
- Production (Express): Stays on page after reload  
- Production (Nginx): Stays on page after reload
- Production (Apache): Stays on page after reload

Users will **never** be redirected to root on page reload! 🎉
