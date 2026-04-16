/**
 * SectionManagementPage.jsx
 *
 * Centralized Section Management Module
 * ─ Manage sections for each academic year (I, II, III, IV for B.Tech, M.Tech)
 * ─ Add, rename, delete sections
 * ─ Sync section data across all pages (Allocation, Workload, etc.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import './SectionManagementPage.css';
import {
  DEFAULT_SECTIONS,
  fetchSectionsConfig,
  addSectionConfig,
  renameSectionConfig,
  deleteSectionConfig,
} from './utils/sectionsApi';
import { useSharedData } from './DataContext';

const YEARS = ['I', 'II', 'III', 'IV', 'M.Tech'];

const SectionManagementPage = () => {
  const [activeYear, setActiveYear] = useState('I');
  const [sectionsConfig, setSectionsConfig] = useState(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [newSectionInput, setNewSectionInput] = useState('');
  const [editingSection, setEditingSection] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const { setSectionsConfig: setSharedSectionsConfig } = useSharedData();

  // Load sections config on mount
  useEffect(() => {
    loadSectionsConfig();
  }, []);

  const loadSectionsConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchSectionsConfig();
      setSectionsConfig(cfg);
      setSharedSectionsConfig(cfg);
      setMessage('');
    } catch (err) {
      console.error('Error loading sections:', err);
      setSectionsConfig(DEFAULT_SECTIONS);
      setMessage('Failed to load section configuration. Using defaults.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, [setSharedSectionsConfig]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionInput.trim()) {
      showMessage('Please enter a section name', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await addSectionConfig(activeYear, newSectionInput.trim());
      if (!result.success) {
        showMessage(result.message || 'Failed to add section', 'error');
      } else {
        showMessage(`✅ Section "${newSectionInput.trim()}" added successfully`, 'success');
        setNewSectionInput('');
        await loadSectionsConfig();
      }
    } catch (err) {
      console.error('Error adding section:', err);
      showMessage('Failed to add section', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSection = async (oldName) => {
    if (!editingValue.trim() || editingValue.trim() === oldName) {
      setEditingSection(null);
      setEditingValue('');
      return;
    }

    setLoading(true);
    try {
      const result = await renameSectionConfig(activeYear, oldName, editingValue.trim());
      if (!result.success) {
        showMessage(result.message || 'Failed to rename section', 'error');
      } else {
        showMessage(`✅ Section renamed to "${editingValue.trim()}"`, 'success');
        setEditingSection(null);
        setEditingValue('');
        await loadSectionsConfig();
      }
    } catch (err) {
      console.error('Error renaming section:', err);
      showMessage('Failed to rename section', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSection = async (section) => {
    if (!window.confirm(`Delete section "${section}" for ${activeYear}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteSectionConfig(activeYear, section);
      if (!result.success) {
        showMessage(result.message || 'Failed to delete section', 'error');
      } else {
        showMessage(`✅ Section "${section}" deleted successfully`, 'success');
        setEditingSection(null);
        setEditingValue('');
        await loadSectionsConfig();
      }
    } catch (err) {
      console.error('Error deleting section:', err);
      showMessage('Failed to delete section', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sections = sectionsConfig[activeYear] || [];

  return (
    <main className="smp-main">
      <h1 className="smp-heading">Section Management</h1>
      <p className="smp-subheading">Centralized section management for all academic years</p>

      {/* Message/Alert */}
      {message && (
        <div className={`smp-alert smp-alert-${messageType}`}>
          {message}
          <button 
            className="smp-alert-close" 
            onClick={() => setMessage('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Year Tabs */}
      <div className="smp-year-tabs">
        {YEARS.map(year => (
          <button
            key={year}
            className={`smp-year-tab${activeYear === year ? ' active' : ''}`}
            onClick={() => setActiveYear(year)}
            disabled={loading}
          >
            {year === 'M.Tech' ? 'M.Tech' : `${year} Year`}
          </button>
        ))}
      </div>

      {/* Current Year Info */}
      <div className="smp-year-info">
        <span className="smp-info-label">
          {activeYear === 'M.Tech' ? 'M.Tech Sections:' : `${activeYear} Year Sections:`}
        </span>
        <span className="smp-info-count">
          {sections.length} section{sections.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add Section Form */}
      <div className="smp-add-section">
        <form onSubmit={handleAddSection} className="smp-form">
          <input
            type="text"
            className="smp-input"
            placeholder="Enter section name (e.g., A, B, 1, CSE-A)"
            value={newSectionInput}
            onChange={(e) => setNewSectionInput(e.target.value)}
            disabled={loading}
          />
          <button 
            type="submit" 
            className="smp-btn smp-btn-add" 
            disabled={loading}
          >
            {loading ? 'Adding...' : '+ Add Section'}
          </button>
        </form>
      </div>

      {/* Sections Grid */}
      <div className="smp-sections-grid">
        {sections.length === 0 ? (
          <div className="smp-empty-state">
            <span className="smp-empty-icon">📭</span>
            <p>No sections configured for {activeYear === 'M.Tech' ? 'M.Tech' : `${activeYear} Year`}</p>
            <p className="smp-empty-hint">Add a section using the form above</p>
          </div>
        ) : (
          sections.map((section, index) => (
            <div key={`${section}-${index}`} className="smp-section-card">
              <div className="smp-card-header">
                <span className="smp-card-number">Sec {index + 1}</span>
                <div className="smp-card-actions">
                  <button
                    className="smp-action-btn smp-action-edit"
                    onClick={() => {
                      setEditingSection(section);
                      setEditingValue(section);
                    }}
                    disabled={loading || editingSection !== null}
                    title="Edit section"
                  >
                    ✎
                  </button>
                  <button
                    className="smp-action-btn smp-action-delete"
                    onClick={() => handleDeleteSection(section)}
                    disabled={loading || editingSection !== null}
                    title="Delete section"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="smp-card-content">
                {editingSection === section ? (
                  <div className="smp-edit-form">
                    <input
                      type="text"
                      className="smp-edit-input"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      disabled={loading}
                      autoFocus
                      onBlur={() => {
                        if (editingValue.trim() && editingValue.trim() !== section) {
                          handleRenameSection(section);
                        } else {
                          setEditingSection(null);
                          setEditingValue('');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameSection(section);
                        } else if (e.key === 'Escape') {
                          setEditingSection(null);
                          setEditingValue('');
                        }
                      }}
                    />
                    <p className="smp-edit-hint">Press Enter to save, Esc to cancel</p>
                  </div>
                ) : (
                  <span className="smp-section-name">{section}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Statistics Footer */}
      <div className="smp-footer">
        <div className="smp-stats">
          <div className="smp-stat-item">
            <span className="smp-stat-label">Total Sections (All Years):</span>
            <span className="smp-stat-value">
              {Object.values(sectionsConfig).reduce((sum, secs) => sum + (Array.isArray(secs) ? secs.length : 0), 0)}
            </span>
          </div>
          {Object.entries(sectionsConfig).map(([year, secs]) => (
            <div key={year} className="smp-stat-item">
              <span className="smp-stat-label">{year === 'M.Tech' ? 'M.Tech' : `${year} Year`}:</span>
              <span className="smp-stat-value">{Array.isArray(secs) ? secs.length : 0}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default SectionManagementPage;

