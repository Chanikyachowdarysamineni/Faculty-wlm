const DEFAULT_API_BASE = 'https://160.187.169.41';

const LEGACY_API_HOSTS = [
	'http://wlm-server.onrender.com',
	'https://wlm-server.onrender.com',
	'http://faculty-workload-management.onrender.com',
	'https://faculty-workload-management.onrender.com',
	'http://faculty-workload-management-1.onrender.com',
	'https://faculty-workload-management-1.onrender.com',
];

const SECTIONS_ENDPOINT_UNSUPPORTED_HOSTS = [];

// CRITICAL: Detect localhost - always use HTTP, never HTTPS
const isLocalhost = () => {
	if (typeof window === 'undefined') return false;
	return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const normalizeApiBase = (value) => {
	const trimmed = String(value || '').trim();
	if (!trimmed) return '';
	const withoutSlash = trimmed.replace(/\/+$/, '');
	
	// CRITICAL: Force HTTP for localhost/127.0.0.1 (development only)
	if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
		const result = withoutSlash
			.replace(/^https?:\/\//i, 'http://')
			.replace(/^wss?:\/\//i, 'ws://');
		console.log('[API Config] Localhost detected, forcing HTTP:', result);
		return result;
	}
	
	if (LEGACY_API_HOSTS.includes(withoutSlash)) return DEFAULT_API_BASE;
	return withoutSlash;
};

const resolveApiBase = () => {
	// PRIORITY 1: If localhost, ALWAYS use HTTP (no exceptions)
	if (isLocalhost()) {
		console.log('[API Config] Localhost detected (window.location.hostname), forcing HTTP://localhost:5000');
		return 'http://localhost:5000';
	}
	
	// PRIORITY 2: Check environment variable
	const envApi = normalizeApiBase(process.env.REACT_APP_API_URL);
	if (envApi) {
		console.log('[API Config] Using REACT_APP_API_URL:', envApi);
		return envApi;
	}
	
	// PRIORITY 3: Development mode
	if (process.env.NODE_ENV === 'development') {
		console.log('[API Config] Development mode, using HTTP://localhost:5000');
		return 'http://localhost:5000';
	}
	
	// PRIORITY 4: Production - use relative paths for nginx proxy
	console.log('[API Config] Production mode, using /csefaculty');
	return '/csefaculty';
};

const API = resolveApiBase();

// Debug logging in development
if (process.env.NODE_ENV === 'development') {
	console.log('[API Config] Environment:', {
		NODE_ENV: process.env.NODE_ENV,
		REACT_APP_API_URL: process.env.REACT_APP_API_URL,
		REACT_APP_USE_LOCAL_API: process.env.REACT_APP_USE_LOCAL_API,
		resolvedAPI: API,
	});
}

export const isSectionsEndpointLikelyUnsupported = () => {
	try {
		const host = new URL(API).host;
		return SECTIONS_ENDPOINT_UNSUPPORTED_HOSTS.includes(host);
	} catch {
		return false;
	}
};

export default API;

