import React, { useState, useEffect, useCallback } from 'react';

/**
 * FacultyScrollController
 * Floating four-direction scroll controller at the top-right corner of the Faculty page.
 * Strictly controls UI scrolling (Left, Right, Up, Down) for horizontal table overflow
 * and vertical page scrolling with real-time boundary detection.
 */
const FacultyScrollController = ({ tableWrapRef }) => {
  const [scrollState, setScrollState] = useState({
    canUp: false,
    canDown: false,
    canLeft: false,
    canRight: false,
  });

  // Identify the vertical scroll container (dash-page or document/window)
  const getVerticalContainer = useCallback(() => {
    const dashPage = document.querySelector('.dash-page');
    if (dashPage && dashPage.scrollHeight > dashPage.clientHeight + 2) {
      return dashPage;
    }
    if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 2) {
      return document.documentElement;
    }
    if (document.body.scrollHeight > document.body.clientHeight + 2) {
      return document.body;
    }
    return window;
  }, []);

  // Identify the horizontal scroll container (faculty table wrapper or dash-page)
  const getHorizontalContainer = useCallback(() => {
    if (tableWrapRef?.current && tableWrapRef.current.scrollWidth > tableWrapRef.current.clientWidth + 2) {
      return tableWrapRef.current;
    }
    const dashPage = document.querySelector('.dash-page');
    if (dashPage && dashPage.scrollWidth > dashPage.clientWidth + 2) {
      return dashPage;
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      return document.documentElement;
    }
    return tableWrapRef?.current || null;
  }, [tableWrapRef]);

  // Update button enabled/disabled states based on scroll boundaries
  const updateScrollBounds = useCallback(() => {
    const vEl = getVerticalContainer();
    const hEl = getHorizontalContainer();

    // Vertical boundary checks
    let canUp = false;
    let canDown = false;
    if (vEl && vEl !== window) {
      const scrollTop = vEl.scrollTop || 0;
      const maxScrollTop = (vEl.scrollHeight || 0) - (vEl.clientHeight || 0);
      canUp = scrollTop > 2;
      canDown = maxScrollTop > 2 && scrollTop < maxScrollTop - 2;
    } else if (typeof window !== 'undefined') {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
      canUp = scrollTop > 2;
      canDown = maxScrollTop > 2 && scrollTop < maxScrollTop - 2;
    }

    // Horizontal boundary checks
    let canLeft = false;
    let canRight = false;
    if (hEl && hEl !== window) {
      const scrollLeft = hEl.scrollLeft || 0;
      const maxScrollLeft = (hEl.scrollWidth || 0) - (hEl.clientWidth || 0);
      canLeft = scrollLeft > 2;
      canRight = maxScrollLeft > 2 && scrollLeft < maxScrollLeft - 2;
    } else if (typeof window !== 'undefined') {
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const maxScrollLeft = document.documentElement.scrollWidth - window.innerWidth;
      canLeft = scrollLeft > 2;
      canRight = maxScrollLeft > 2 && scrollLeft < maxScrollLeft - 2;
    }

    setScrollState(prev => {
      if (
        prev.canUp === canUp &&
        prev.canDown === canDown &&
        prev.canLeft === canLeft &&
        prev.canRight === canRight
      ) {
        return prev;
      }
      return { canUp, canDown, canLeft, canRight };
    });
  }, [getVerticalContainer, getHorizontalContainer]);

  // Scroll actions with smooth interpolation and appropriate chunk distance
  const handleScrollUp = useCallback(() => {
    const vEl = getVerticalContainer();
    if (!vEl) return;
    const distance = Math.max(280, Math.round((vEl.clientHeight || window.innerHeight) * 0.5));
    if (vEl === window || !vEl.scrollBy) {
      window.scrollBy({ top: -distance, behavior: 'smooth' });
    } else {
      vEl.scrollBy({ top: -distance, behavior: 'smooth' });
    }
  }, [getVerticalContainer]);

  const handleScrollDown = useCallback(() => {
    const vEl = getVerticalContainer();
    if (!vEl) return;
    const distance = Math.max(280, Math.round((vEl.clientHeight || window.innerHeight) * 0.5));
    if (vEl === window || !vEl.scrollBy) {
      window.scrollBy({ top: distance, behavior: 'smooth' });
    } else {
      vEl.scrollBy({ top: distance, behavior: 'smooth' });
    }
  }, [getVerticalContainer]);

  const handleScrollLeft = useCallback(() => {
    const hEl = getHorizontalContainer();
    if (!hEl) return;
    const distance = Math.max(260, Math.round((hEl.clientWidth || window.innerWidth) * 0.45));
    if (hEl.scrollBy) {
      hEl.scrollBy({ left: -distance, behavior: 'smooth' });
    } else {
      window.scrollBy({ left: -distance, behavior: 'smooth' });
    }
  }, [getHorizontalContainer]);

  const handleScrollRight = useCallback(() => {
    const hEl = getHorizontalContainer();
    if (!hEl) return;
    const distance = Math.max(260, Math.round((hEl.clientWidth || window.innerWidth) * 0.45));
    if (hEl.scrollBy) {
      hEl.scrollBy({ left: distance, behavior: 'smooth' });
    } else {
      window.scrollBy({ left: distance, behavior: 'smooth' });
    }
  }, [getHorizontalContainer]);

  // Synchronize scroll events from containers, window, and dynamic resizes
  useEffect(() => {
    updateScrollBounds();

    const hEl = tableWrapRef?.current;
    const dashPage = document.querySelector('.dash-page');

    const onScrollOrResize = () => {
      updateScrollBounds();
    };

    if (hEl) hEl.addEventListener('scroll', onScrollOrResize, { passive: true });
    if (dashPage) dashPage.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollBounds());
      if (hEl) ro.observe(hEl);
      if (dashPage) ro.observe(dashPage);
    }

    const t1 = setTimeout(updateScrollBounds, 150);
    const t2 = setTimeout(updateScrollBounds, 500);

    return () => {
      if (hEl) hEl.removeEventListener('scroll', onScrollOrResize);
      if (dashPage) dashPage.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [updateScrollBounds, tableWrapRef]);

  return (
    <div className="fp-scroll-controller-wrapper">
      <div
        className="fp-scroll-controller"
        role="toolbar"
        aria-label="Faculty page floating directional scroll controls"
      >
        {/* ↑ Up */}
        <div className="fp-scroll-row fp-scroll-row-top">
          <button
            type="button"
            className="fp-scroll-btn fp-scroll-btn-up"
            onClick={handleScrollUp}
            disabled={!scrollState.canUp}
            title="Scroll Up"
            aria-label="Scroll Up"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>

        {/* ← Left | Hub | → Right */}
        <div className="fp-scroll-row fp-scroll-row-middle">
          <button
            type="button"
            className="fp-scroll-btn fp-scroll-btn-left"
            onClick={handleScrollLeft}
            disabled={!scrollState.canLeft}
            title="Scroll Left"
            aria-label="Scroll Left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="fp-scroll-hub" title="Scroll Navigation" aria-hidden="true">
            <span className="fp-scroll-hub-dot" />
          </div>

          <button
            type="button"
            className="fp-scroll-btn fp-scroll-btn-right"
            onClick={handleScrollRight}
            disabled={!scrollState.canRight}
            title="Scroll Right"
            aria-label="Scroll Right"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* ↓ Down */}
        <div className="fp-scroll-row fp-scroll-row-bottom">
          <button
            type="button"
            className="fp-scroll-btn fp-scroll-btn-down"
            onClick={handleScrollDown}
            disabled={!scrollState.canDown}
            title="Scroll Down"
            aria-label="Scroll Down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyScrollController;
