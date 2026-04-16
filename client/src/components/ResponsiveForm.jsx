/**
 * ResponsiveForm.jsx - Mobile-Optimized Form Component
 * 
 * Features:
 * - Responsive grid layout (1 column on mobile, 2 on tablet, etc.)
 * - Touch-friendly input sizing (min 44px on mobile)
 * - Prevents zoom on iOS when input focused
 * - Proper spacing and alignment
 * - Accessible labels and error messages
 * - Full-width buttons on mobile
 */

import React from 'react';
import './ResponsiveForm.css';

/**
 * FormField Component
 * Wraps form inputs with label and error handling
 */
export const FormField = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => (
  <div className={`form-field ${error ? 'error' : ''} ${className}`}>
    {label && (
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
      </label>
    )}
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      {...props}
      className="form-input"
    />
    {error && <span className="form-error">{error}</span>}
  </div>
);

/**
 * FormSelect Component
 * Mobile-friendly select dropdown
 */
export const FormSelect = ({
  label,
  name,
  value,
  onChange,
  options = [],
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => (
  <div className={`form-field ${error ? 'error' : ''} ${className}`}>
    {label && (
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
      </label>
    )}
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      {...props}
      className="form-input"
    >
      <option value="">Select {label?.toLowerCase() || 'option'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <span className="form-error">{error}</span>}
  </div>
);

/**
 * FormTextarea Component
 * Mobile-friendly textarea
 */
export const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  ...props
}) => (
  <div className={`form-field ${error ? 'error' : ''} ${className}`}>
    {label && (
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
      </label>
    )}
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      rows={rows}
      {...props}
      className="form-input form-textarea"
    />
    {error && <span className="form-error">{error}</span>}
  </div>
);

/**
 * FormGroup Component
 * Wrapper for form rows/groups
 */
export const FormGroup = ({ children, cols = 1, className = '' }) => {
  const colClass = {
    1: 'form-group-1',
    2: 'form-group-2',
    3: 'form-group-3',
    4: 'form-group-4',
  }[cols] || 'form-group-1';

  return (
    <div className={`form-group ${colClass} ${className}`}>
      {children}
    </div>
  );
};

/**
 * FormActions Component
 * Button group at bottom of form
 */
export const FormActions = ({
  children,
  align = 'flex-end',
  className = '',
  ...props
}) => (
  <div
    className={`form-actions ${className}`}
    style={{ justifyContent: align }}
    {...props}
  >
    {children}
  </div>
);

/**
 * ResponsiveForm Component
 * Main form component that combines all pieces
 */
export const ResponsiveForm = ({
  onSubmit,
  children,
  className = '',
  noValidate = false,
  ...props
}) => (
  <form
    onSubmit={onSubmit}
    className={`responsive-form ${className}`}
    noValidate={noValidate}
    {...props}
  >
    {children}
  </form>
);

export default ResponsiveForm;
