import React from 'react';
import './SearchBar.css';

/**
 * SearchBar - Reusable search input component
 * 
 * Usage:
 * <SearchBar
 *   value={search}
 *   onChange={(e) => setSearch(e.target.value)}
 *   placeholder="Search courses..."
 * />
 */
const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  onClear 
}) => {
  const handleClear = () => {
    onChange({ target: { value: '' } });
    onClear?.();
  };

  return (
    <div className="search-bar-wrap">
      <svg 
        className="search-icon" 
        xmlns="http://www.w3.org/2000/svg" 
        width="14" 
        height="14"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5"
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        className="search-bar"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        type="text"
      />
      {value && (
        <button 
          className="search-clear" 
          onClick={handleClear}
          title="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchBar;

