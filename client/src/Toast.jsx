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

  const showToast = useCallback(({ type = 'info', message, duration = 4000, action = null }) => {
    const id = Date.now() + Math.random();
    const toast = { id, type, message, action };

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
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
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

