import { useState, useCallback } from 'react';
import { useToast } from '../Toast';

/**
 * useApiForm
 * A universal hook for handling API-backed forms with standardized error reporting.
 * 
 * @param {Object} initialValues - Initial form state
 * @param {Function} apiCall - Function that performs the API call. Should return the fetch Promise or response JSON.
 * @param {Function} onSuccess - Callback invoked on successful API response (2xx)
 */
export const useApiForm = (initialValues, apiCall, onSuccess) => {
  const [values, setValues] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setValues(prev => ({ ...prev, [name]: val }));
    // Clear field error when user types
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const setFieldValue = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const resetForm = () => {
    setValues(initialValues);
    setFieldErrors({});
    setGlobalError('');
  };

  const submit = async (e, overrideData = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSubmitting(true);
    setGlobalError('');
    setFieldErrors({});

    try {
      const dataToSubmit = overrideData || values;
      const res = await apiCall(dataToSubmit);
      
      let data = res;
      if (res && typeof res.json === 'function') {
        data = await res.json();
      }

      if (res && !res.ok) {
        // Handle standardized 4xx/5xx responses
        const serverMessage = data?.message || 'Submission failed';
        const serverErrors = data?.errors || [];
        
        showToast({
          type: 'error',
          message: serverMessage,
          errors: serverErrors,
          duration: 6000
        });

        setGlobalError(serverMessage);

        if (serverErrors.length > 0) {
          const errorsMap = {};
          serverErrors.forEach(err => {
            errorsMap[err.field] = err.message;
          });
          setFieldErrors(errorsMap);
          
          // Focus the first invalid field
          setTimeout(() => {
            const firstErrorField = document.querySelector('[aria-invalid="true"]');
            if (firstErrorField) {
              firstErrorField.focus();
            }
          }, 100);
        }
        
        setIsSubmitting(false);
        return false; // Return false to indicate failure (modal stays open)
      }

      // Success (2xx)
      showToast({
        type: 'success',
        message: data?.message || 'Saved successfully',
      });
      
      if (onSuccess) {
        await onSuccess(data);
      }
      
      setIsSubmitting(false);
      return true; // Return true to indicate success
    } catch (err) {
      console.error('useApiForm error:', err);
      const msg = err.message || 'A network or server error occurred. Please try again.';
      setGlobalError(msg);
      showToast({ type: 'error', message: msg, duration: 6000 });
      setIsSubmitting(false);
      return false;
    }
  };

  return {
    values,
    setValues,
    handleChange,
    setFieldValue,
    isSubmitting,
    globalError,
    fieldErrors,
    submit,
    resetForm
  };
};
