import React, { useState, useCallback, createContext, useContext, useMemo } from 'react';
import './Toast.css';

/**
 * Toast Context — Global, Accessible & User-Friendly Notification System
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('Item saved'); // Auto-detects type 'success'
 *   showToast.error('Failed to connect');
 *   showToast.success('Saved successfully!');
 *   showToast.warning('Capacity nearly reached');
 *   showToast({ type: 'error', message: 'Validation failed', errors: [...] });
 */
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const inferToastType = (message) => {
  if (typeof message !== 'string') return 'info';
  const lower = message.toLowerCase();
  if (/error|fail|cannot|could not|invalid|conflict|duplicate|denied|unauthorized|prohibited|mismatch|exceed/i.test(lower)) {
    return 'error';
  }
  if (/warn|caution|required|locked|notice|please/i.test(lower)) {
    return 'warning';
  }
  if (/success|saved|updated|created|deleted|restored|sent|reordered/i.test(lower)) {
    return 'success';
  }
  return 'info';
};

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToastBase = useCallback((args) => {
    let type = 'info';
    let message = '';
    let duration = 4000;
    let action = null;
    let errors = [];

    if (typeof args === 'string') {
      message = args;
      type = inferToastType(args);
    } else if (args && typeof args === 'object') {
      message = args.message || '';
      type = args.type || inferToastType(message);
      duration = args.duration !== undefined ? args.duration : (type === 'error' ? 6000 : 4000);
      action = args.action || null;
      errors = args.errors || [];
    }

    const id = Date.now() + Math.random();
    const toast = { id, type, message, action, errors };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useMemo(() => {
    const fn = (args) => showToastBase(args);
    fn.success = (msg, opts = {}) => showToastBase({ type: 'success', message: msg, ...opts });
    fn.error = (msg, opts = {}) => showToastBase({ type: 'error', message: msg, ...opts });
    fn.warning = (msg, opts = {}) => showToastBase({ type: 'warning', message: msg, ...opts });
    fn.info = (msg, opts = {}) => showToastBase({ type: 'info', message: msg, ...opts });
    return fn;
  }, [showToastBase]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container" aria-live="polite" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ⓘ',
  };

  return (
    <div className={`toast toast-${toast.type}`} role="alert">
      <div className="toast-icon" aria-hidden="true">{icons[toast.type] || icons.info}</div>
      <div className="toast-content">
        <div className="toast-message">{toast.message}</div>
        {toast.errors && toast.errors.length > 0 && (
          <ul className="toast-errors-list" style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem' }}>
            {toast.errors.map((err, idx) => (
              <li key={idx}>
                {typeof err === 'string' ? err : (
                  <><strong>{err.field ? `${err.field}: ` : ''}</strong>{err.message || err.msg}</>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action.onClick();
            onRemove();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={onRemove} aria-label="Close notification">
        ×
      </button>
    </div>
  );
};

export default ToastProvider;
