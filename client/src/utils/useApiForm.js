import { useState, useCallback, useRef } from 'react';
import { MESSAGES } from './messages';

export const useApiForm = ({ initialValues, validate, onSubmit, onSuccess, onError, showToast }) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Keep refs for all form fields to enable auto-focusing the first error
  const fieldRefs = useRef({});

  const registerField = (name) => (ref) => {
    if (ref) {
      fieldRefs.current[name] = ref;
    } else {
      delete fieldRefs.current[name];
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error for this field when typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }, [errors]);

  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }, [errors]);

  const resetForm = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    let validationErrors = {};
    if (validate) {
      validationErrors = validate(values) || {};
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus first error field
      const firstErrorField = Object.keys(validationErrors)[0];
      if (fieldRefs.current[firstErrorField]) {
        fieldRefs.current[firstErrorField].focus();
      }
      return;
    }

    setIsSubmitting(true);
    setErrors({}); // Clear generic or api errors

    try {
      const response = await onSubmit(values);
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Validation failed or other server error
        const apiErrors = {};
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((err) => {
            if (err.field) {
              apiErrors[err.field] = err.message;
            }
          });
        }
        
        if (Object.keys(apiErrors).length > 0) {
          setErrors(apiErrors);
          // Focus first error field from server
          const firstErrorField = Object.keys(apiErrors)[0];
          if (fieldRefs.current[firstErrorField]) {
            fieldRefs.current[firstErrorField].focus();
          }
          if (showToast) showToast({ type: 'error', message: MESSAGES.VALIDATION_FAILED || 'Please fix the errors below.' });
        } else {
          // No field-specific errors, just a generic message
          setErrors({ _form: data.message || MESSAGES.UNKNOWN_ERROR });
          if (showToast) showToast({ type: 'error', message: data.message || MESSAGES.UNKNOWN_ERROR });
        }
        
        if (onError) onError(data);
      } else {
        // Success
        if (showToast) showToast({ type: 'success', message: data.message || MESSAGES.SAVE_SUCCESS });
        if (onSuccess) onSuccess(data.data, data);
      }
    } catch (err) {
      console.error('API Form Submit Error:', err);
      setErrors({ _form: MESSAGES.NETWORK_ERROR });
      if (showToast) showToast({ type: 'error', message: MESSAGES.NETWORK_ERROR });
      if (onError) onError({ message: MESSAGES.NETWORK_ERROR });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    setFieldValue,
    handleSubmit,
    resetForm,
    registerField,
    setValues,
    setErrors
  };
};
