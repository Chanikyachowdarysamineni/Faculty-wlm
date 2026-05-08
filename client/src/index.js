import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import responsive styles in order of specificity
import './styles/responsive.css';        // Comprehensive responsive system
import './styles/responsive-patterns.css'; // Page pattern templates
import './responsive.css';                // Global responsive layer
import './mobile-optimization.css';       // Mobile optimizations
import './mobile-component-fixes.css';    // Component-specific fixes
import './mobile-responsive.css';         // Mobile responsive utilities

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

