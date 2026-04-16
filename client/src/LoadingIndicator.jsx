import React, { useState, createContext, useContext, useCallback } from 'react';
import './LoadingIndicator.css';

/**
 * Loading Context — Global loading state management
 * Usage: const { setLoading, isLoading } = useLoading();
 */
const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const startLoading = useCallback((msg = '') => {
    setMessage(msg);
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setMessage('');
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading, setLoading: startLoading }}>
      {children}
      {isLoading && <GlobalLoadingIndicator message={message} />}
    </LoadingContext.Provider>
  );
};

const GlobalLoadingIndicator = ({ message }) => {
  return (
    <div className="global-loading-overlay">
      <div className="global-loading-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        {message && <p className="loading-message">{message}</p>}
      </div>
    </div>
  );
};

export default LoadingProvider;

