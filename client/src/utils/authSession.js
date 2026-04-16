let lastUnauthorizedAt = 0;

export const clearAuthSession = () => {
  localStorage.removeItem('wlm_token');
  localStorage.removeItem('wlm_user');
};

export const notifyUnauthorized = () => {
  const now = Date.now();
  if (now - lastUnauthorizedAt < 1200) return;
  lastUnauthorizedAt = now;
  clearAuthSession();
  window.dispatchEvent(new CustomEvent('wlm:unauthorized'));
};

