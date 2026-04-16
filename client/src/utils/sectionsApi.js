import API, { isSectionsEndpointLikelyUnsupported } from '../config';
import { fetchJsonWithRetry } from './apiFetchAll';

export const DEFAULT_SECTIONS = {
  I: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  II: Array.from({ length: 22 }, (_, i) => String(i + 1)),
  III: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  IV: Array.from({ length: 9 }, (_, i) => String(i + 1)),
  'M.Tech': ['1', '2'],
};

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('wlm_token') || ''}`,
  'Content-Type': 'application/json',
});

let sectionsEndpointUnavailable = isSectionsEndpointLikelyUnsupported();
let unavailableSince = sectionsEndpointUnavailable ? Date.now() : null;
const RETRY_AFTER_MS = 5 * 60 * 1000; // retry after 5 minutes

export const fetchSectionsConfig = async () => {
  // If unavailable, let it retry after the backoff window
  if (sectionsEndpointUnavailable) {
    if (unavailableSince && Date.now() - unavailableSince >= RETRY_AFTER_MS) {
      sectionsEndpointUnavailable = false;
      unavailableSince = null;
    } else {
      return DEFAULT_SECTIONS;
    }
  }

  const result = await fetchJsonWithRetry(`${API}/deva/settings/sections`, { headers: authHeader() });
  const data = result.data || {};
  if (result.status === 404) {
    sectionsEndpointUnavailable = true;
    unavailableSince = Date.now();
    return DEFAULT_SECTIONS;
  }
  if (!result.success || !data.success) {
    throw new Error(result.message || data.message || 'Failed to fetch sections');
  }
  return data.data || DEFAULT_SECTIONS;
};

export const addSectionConfig = async (year, section) => {
  const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(year)}`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ section }),
  });
  return res.json();
};

export const renameSectionConfig = async (year, oldSection, newSection) => {
  const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(year)}/${encodeURIComponent(oldSection)}`, {
    method: 'PUT', headers: authHeader(), body: JSON.stringify({ newSection }),
  });
  return res.json();
};

export const deleteSectionConfig = async (year, section) => {
  const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(year)}/${encodeURIComponent(section)}`, {
    method: 'DELETE', headers: authHeader(),
  });
  return res.json();
};

