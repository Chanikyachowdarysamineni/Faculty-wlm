import React, { useState, useCallback, createContext, useContext } from 'react';
import './Toast.css';

/**
 * Toast Context — Global notification system
 * Usage: const { showToast } = useToast();
 *        showToast({ type: 'success', message: 'Saved!' });
 */
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((args) => {
    let type = 'info';
    let message = '';
    let duration = 4000;
    let action = null;

    let errors = [];

    if (typeof args === 'string') {
      message = args;
    } else if (args && typeof args === 'object') {
      type = args.type || 'info';
      message = args.message || '';
      duration = args.duration !== undefined ? args.duration : 4000;
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

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container">
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
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-icon">{icons[toast.type]}</div>
      <div className="toast-content">
        <div className="toast-message">{toast.message}</div>
        {toast.errors && toast.errors.length > 0 && (
          <ul className="toast-errors-list" style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem' }}>
            {toast.errors.map((err, idx) => (
              <li key={idx}><strong>{err.field}:</strong> {err.message}</li>
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
      <button className="toast-close" onClick={onRemove}>
        ×
      </button>
    </div>
  );
};

export default ToastProvider;

