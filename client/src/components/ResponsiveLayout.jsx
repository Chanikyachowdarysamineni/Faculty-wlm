/**
 * ════════════════════════════════════════════════════════════════════════
 * RESPONSIVE LAYOUT WRAPPER COMPONENT
 * ════════════════════════════════════════════════════════════════════════
 * 
 * Provides responsive layout structure for the entire application
 * - Mobile-first design
 * - Responsive sidebar/navigation
 * - Flexible content area
 * - Touch-friendly controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import './ResponsiveLayout.css';

/**
 * ResponsiveLayout Component
 * Wraps all pages with responsive layout structure
 * 
 * @param {React.ReactNode} sidebar - Sidebar content
 * @param {React.ReactNode} topbar - Top navigation bar
 * @param {React.ReactNode} children - Main content
 * @param {boolean} showSidebar - Show/hide sidebar
 */
const ResponsiveLayout = ({
  sidebar = null,
  topbar = null,
  children = null,
  showSidebar = true,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Close sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track scroll position for sticky elements
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="responsive-layout">
      {/* Mobile Header */}
      <header className={`responsive-topbar ${isScrolled ? 'scrolled' : ''}`}>
        {topbar || (
          <div className="topbar-content">
            <button
              className="hamburger-btn"
              onClick={toggleSidebar}
              aria-label="Toggle navigation"
              aria-expanded={isSidebarOpen}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            <h1 className="topbar-title">Faculty WLM</h1>
            <div className="topbar-actions"></div>
          </div>
        )}
      </header>

      <div className="responsive-main-layout">
        {/* Sidebar Navigation */}
        {showSidebar && (
          <>
            <aside
              className={`responsive-sidebar ${isSidebarOpen ? 'active' : ''}`}
              id="responsive-sidebar"
            >
              {sidebar}
            </aside>
            <div
              className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
              onClick={closeSidebar}
              role="presentation"
            ></div>
          </>
        )}

        {/* Main Content Area */}
        <main className="responsive-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
