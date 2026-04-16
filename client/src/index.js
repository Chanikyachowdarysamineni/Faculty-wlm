import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './responsive.css';
import './mobile-optimization.css';
import './mobile-component-fixes.css';
import './mobile-responsive.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

