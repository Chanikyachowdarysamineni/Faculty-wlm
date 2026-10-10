
import React from 'react';

/**
 * FieldError
 * Reusable component to render inline field errors for forms.
 * 
 * @param {string} error - The error message to display
 * @param {string} id - HTML ID for the aria-describedby binding
 */
export const FieldError = ({ error, id }) => {
  if (!error) return null;

  return (
    <span
      id={id}
      className="field-error"
      style={{
        color: '#dc2626',
        fontSize: '0.875rem',
        marginTop: '0.25rem',
        display: 'block'
      }}
      role="alert"
    >
      {error}
    </span>
  );
};
