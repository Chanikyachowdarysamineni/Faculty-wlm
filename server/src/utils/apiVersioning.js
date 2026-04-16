/**
 * utils/apiVersioning.js
 * 
 * API versioning strategy
 * Support multiple API versions simultaneously
 */

'use strict';

const API_VERSION = '1.0.0';
const SUPPORTED_VERSIONS = ['1.0.0'];
const DEPRECATED_VERSIONS = [];
const MIN_SUPPORTED_VERSION = '1.0.0';

/**
 * Parse version from Accept header or URL
 * Format: application/vnd.wlm.v1+json or /api/v1/...
 */
const parseVersion = (req) => {
  // Check Accept header: application/vnd.wlm.v1+json
  const acceptHeader = req.get('Accept') || '';
  const versionMatch = acceptHeader.match(/vnd\.wlm\.v(\d+(?:\.\d+)*)/i);
  if (versionMatch) {
    return versionMatch[1];
  }

  // Check URL: /api/v1/endpoint
  const urlMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)*)\//);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check X-API-Version header
  if (req.get('X-API-Version')) {
    return req.get('X-API-Version');
  }

  // Default to latest version
  return API_VERSION;
};

/**
 * Check if version is supported
 */
const isVersionSupported = (version) => {
  return SUPPORTED_VERSIONS.includes(version);
};

/**
 * Check if version is deprecated
 */
const isVersionDeprecated = (version) => {
  return DEPRECATED_VERSIONS.includes(version);
};

/**
 * Middleware for API versioning
 */
const apiVersioning = (req, res, next) => {
  const requestVersion = parseVersion(req);
  req.apiVersion = requestVersion;

  // Set version in response headers
  res.setHeader('X-API-Version', requestVersion);

  if (!isVersionSupported(requestVersion)) {
    return res.status(400).json({
      success: false,
      message: `API version ${requestVersion} is not supported`,
      supportedVersions: SUPPORTED_VERSIONS,
    });
  }

  if (isVersionDeprecated(requestVersion)) {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    console.warn(`⚠️  Deprecated API version ${requestVersion} in use`);
  }

  next();
};

/**
 * Middleware to require specific version
 */
const requireVersion = (minVersion) => {
  return (req, res, next) => {
    if (req.apiVersion && req.apiVersion < minVersion) {
      return res.status(400).json({
        success: false,
        message: `This endpoint requires API version ${minVersion} or higher`,
        requiredVersion: minVersion,
        currentVersion: req.apiVersion,
      });
    }
    next();
  };
};

module.exports = {
  API_VERSION,
  SUPPORTED_VERSIONS,
  parseVersion,
  isVersionSupported,
  isVersionDeprecated,
  apiVersioning,
  requireVersion,
};
