/**
 * MobileNav.jsx - Mobile Navigation Drawer Component
 * 
 * Provides hamburger menu and slide-out drawer navigation for mobile devices
 * - Hamburger button with animated icon
 * - Overlay drawer that slides in from left
 * - Touch-friendly navigation items (min 44px height)
 * - Smooth transitions and animations
 * - Closes on item selection or overlay click
 */

import React, { useState, useCallback } from 'react';

/**
 * MobileNav Component
 * @param {boolean} isOpen - Whether drawer is open
 * @param {function} onToggle - Callback to toggle drawer open/close
 * @param {function} onClose - Callback to close drawer
 * @param {React.ReactNode} children - Navigation items to render in drawer
 */
const MobileNav = ({
  isOpen = false,
  onToggle = () => {},
  onClose = () => {},
  children = null,
  className = ''
}) => {
  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleNavItemClick = useCallback((e) => {
    // Close drawer when user clicks on a navigation item
    const navLink = e.target.closest('button, a, [role="button"]');
    if (navLink) {
      setTimeout(() => {
        onClose();
      }, 50);
    }
  }, [onClose]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        className={`hamburger-btn ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {/* Navigation Drawer */}
      <nav
        id="mobile-nav-drawer"
        className={`nav-drawer ${isOpen ? 'open' : ''} ${className}`}
        onClick={handleNavItemClick}
        role="navigation"
        aria-label="Main navigation"
      >
        {children}
      </nav>

      {/* Overlay (backdrop) */}
      <div
        className={`nav-drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
    </>
  );
};

export default MobileNav;
