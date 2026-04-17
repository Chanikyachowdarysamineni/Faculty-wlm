const DEFAULT_API_BASE = 'http://160.187.169.41';

const LEGACY_API_HOSTS = [
	'http://wlm-server.onrender.com',
	'https://wlm-server.onrender.com',
	'http://faculty-workload-management.onrender.com',
	'https://faculty-workload-management.onrender.com',
	'http://faculty-workload-management-1.onrender.com',
	'https://faculty-workload-management-1.onrender.com',
];

const SECTIONS_ENDPOINT_UNSUPPORTED_HOSTS = [];

const normalizeApiBase = (value) => {
	const trimmed = String(value || '').trim();
	if (!trimmed) return '';
	const withoutSlash = trimmed.replace(/\/+$/, '');
	if (LEGACY_API_HOSTS.includes(withoutSlash)) return DEFAULT_API_BASE;
	return withoutSlash;
};

const resolveApiBase = () => {
	const envApi = normalizeApiBase(process.env.REACT_APP_API_URL);
	if (envApi) return envApi;
	if (process.env.REACT_APP_USE_LOCAL_API === 'true') return 'http://localhost:5000';
	// In development, use relative paths so CRA's dev proxy handles the request
	// (avoids CORS issues when connecting to the production server locally).
	// This allows setupProxy.js to intercept and forward requests to the backend.
	if (process.env.NODE_ENV === 'development') return '/csefaculty';
	// Production uses HTTP-only at /csefaculty base path
	return DEFAULT_API_BASE + '/csefaculty';
};

const API = resolveApiBase();

export const isSectionsEndpointLikelyUnsupported = () => {
	try {
		const host = new URL(API).host;
		return SECTIONS_ENDPOINT_UNSUPPORTED_HOSTS.includes(host);
	} catch {
		return false;
	}
};

export default API;

