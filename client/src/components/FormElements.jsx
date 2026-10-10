import React from 'react';
import './FormElements.css';

export const ErrorMessage = ({ error, id }) => {
  if (!error) return null;
  return (
    <div className="ff-field-error" id={id} aria-live="polite">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {error}
    </div>
  );
};

export const FormGroup = ({ children, className = '' }) => (
  <div className={`ff-form-group ${className}`}>
    {children}
  </div>
);
