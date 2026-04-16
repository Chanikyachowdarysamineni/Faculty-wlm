import React from 'react';
import './ErrorBoundary.css';

/**
 * ErrorBoundary — Catches React component errors and shows fallback UI
 * Prevents entire app from crashing when a component fails
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>Oops! Something Went Wrong</h1>
            <p className="error-message">
              The application encountered an unexpected error.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-actions">
              <button 
                className="error-btn error-btn-primary" 
                onClick={this.handleReset}
              >
                Try Again
              </button>
              <button 
                className="error-btn error-btn-secondary" 
                onClick={() => window.location.href = '/csefaculty/'}
              >
                Go to Dashboard
              </button>
            </div>

            <p className="error-help">
              If the problem persists, please contact support or try refreshing the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

