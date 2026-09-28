import React from 'react';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && (resource.includes('/api/') || resource.includes('/deva/'))) {
    const yearId = localStorage.getItem('selectedAcademicYearId');
    const sem = localStorage.getItem('selectedSemester') || 'ODD';
    
    if (yearId && sem) {
      try {
        // If resource is relative, base it on window.location.origin for parsing
        const isRelative = !resource.startsWith('http');
        const urlObj = isRelative 
          ? new URL(resource, window.location.origin) 
          : new URL(resource);
          
        if (!urlObj.searchParams.has('academicYearId')) {
          urlObj.searchParams.append('academicYearId', yearId);
        }
        if (!urlObj.searchParams.has('semester')) {
          urlObj.searchParams.append('semester', sem);
        }
        
        resource = isRelative 
          ? urlObj.pathname + urlObj.search + urlObj.hash
          : urlObj.toString();
      } catch (e) {
        if (!resource.includes('academicYearId=')) {
          const sep = resource.includes('?') ? '&' : '?';
          resource += `${sep}academicYearId=${yearId}&semester=${sem}`;
        }
      }
    }
  }
  return originalFetch(resource, config);
};

import ReactDOM from 'react-dom/client';
import App from './App';

// Import responsive styles in order of specificity
import './styles/responsive.css';        // Comprehensive responsive system
import './styles/responsive-patterns.css'; // Page pattern templates
import './responsive.css';                // Global responsive layer
import './mobile-optimization.css';       // Mobile optimizations
import './mobile-component-fixes.css';    // Component-specific fixes
import './mobile-responsive.css';         // Mobile responsive utilities

// Client-side security: Disable context menu and dev tools shortcuts
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'i', 'j'].includes(e.key)) ||
    (e.ctrlKey && ['U', 'u'].includes(e.key))
  ) {
    e.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

