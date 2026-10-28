/**
 * SectionManagementPage.jsx
 *
 * Centralized Section Management Module
 * ─ Manage sections for each academic year (I, II, III, IV for B.Tech)
 * ─ Add, rename, delete sections
 * ─ Sync section data across all pages (Allocation, Workload, etc.)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './SectionManagementPage.css';
import {
  DEFAULT_SECTIONS,
  fetchSectionsConfig,
  addSectionConfig,
  renameSectionConfig,
  deleteSectionConfig,
} from './utils/sectionsApi';
import { useSharedData } from './DataContext';
import { useAcademicPeriod } from './AcademicPeriodContext';

// const YEARS removed

const SectionManagementPage = () => {
  const { selectedAcademicYear, selectedSemester } = useAcademicPeriod();
  const [activeYear, setActiveYear] = useState('');
  const [sectionsConfig, setSectionsConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [newSectionInput, setNewSectionInput] = useState('');
  const [editingSection, setEditingSection] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const DEFAULT_PROGRAMS = ['B.Tech', 'M.Tech'];
  const BASE_BTECH_YEARS = ['I', 'II', 'III', 'IV'];
  const BASE_MTECH_YEARS = ['I', 'II'];

  const { setSectionsConfig: setSharedSectionsConfig, systemConfig, courses: contextCourses } = useSharedData();
  const configPrograms = (systemConfig?.programs || [])
    .filter(c => c && (typeof c === 'string' ? true : c.isActive !== false))
    .map(c => (typeof c === 'string' ? c : (c.value || c.name || c.label)))
    .filter(Boolean);
  const distinctCoursePrograms = Array.from(new Set((contextCourses || []).map(c => c.program).filter(Boolean)));
  const PROGRAMS = useMemo(() => {
    return Array.from(new Set([...DEFAULT_PROGRAMS, ...configPrograms, ...distinctCoursePrograms])).filter(Boolean);
  }, [configPrograms, distinctCoursePrograms]);

  const [activeProgram, setActiveProgram] = useState('');

  const displayYears = useMemo(() => {
    const isMTech = activeProgram === 'M.Tech';
    const baseYears = isMTech ? BASE_MTECH_YEARS : BASE_BTECH_YEARS;
    const inProg = Array.from(
      new Set(
        (contextCourses || [])
          .filter(c => c.program === activeProgram)
          .map(c => c.year)
          .filter(Boolean)
      )
    );
    const inSections = Object.keys(sectionsConfig || {})
      .filter(k => isMTech ? k.startsWith('M.Tech_') : (!k.includes('_') || k.startsWith('B.Tech_')))
      .map(k => k.includes('_') ? k.split('_')[1] : k)
      .filter(Boolean);

    const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
    return Array.from(new Set([...baseYears, ...inProg, ...inSections])).sort((a, b) => {
      return (romanOrder[a] || 99) - (romanOrder[b] || 99);
    });
  }, [activeProgram, contextCourses, sectionsConfig]);

  const effProgram = activeProgram || PROGRAMS[0] || 'B.Tech';
  const effYear = activeYear || displayYears[0] || 'I';
  const yearKey = effProgram === 'B.Tech' ? effYear : `${effProgram}_${effYear}`;

  useEffect(() => {
    if (PROGRAMS.length > 0 && !PROGRAMS.includes(activeProgram)) {
      setActiveProgram(PROGRAMS[0]);
    }
  }, [PROGRAMS, activeProgram]);

  useEffect(() => {
    if (displayYears.length > 0 && !displayYears.includes(activeYear)) {
      setActiveYear(displayYears[0]);
    }
  }, [displayYears, activeYear]);

  const loadSectionsConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchSectionsConfig(selectedAcademicYear, selectedSemester);
      setSectionsConfig(cfg || {});
      setSharedSectionsConfig(cfg || {});
      setMessage('');
    } catch (err) {
      console.error('Error loading sections:', err);
      setSectionsConfig({});
      setMessage('Failed to load section configuration.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, [setSharedSectionsConfig, selectedAcademicYear, selectedSemester]);

  // Load sections config on mount and on real-time reload events
  useEffect(() => {
    loadSectionsConfig();
    const onRealtimeSections = () => { loadSectionsConfig(); };
    window.addEventListener('wlm:sections_reload', onRealtimeSections);
    return () => window.removeEventListener('wlm:sections_reload', onRealtimeSections);
  }, [loadSectionsConfig]);

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
      const result = await addSectionConfig(yearKey, newSectionInput.trim(), selectedAcademicYear, selectedSemester);
      if (!result.success) {
        const errMsg = result?.errors?.length ? result.errors.join(' | ') : (result?.message || 'Failed to add section');
        showMessage(errMsg, 'error');
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
      const result = await renameSectionConfig(yearKey, oldName, editingValue.trim(), selectedAcademicYear, selectedSemester);
      if (!result.success) {
        const errMsg = result?.errors?.length ? result.errors.join(' | ') : (result?.message || 'Failed to rename section');
        showMessage(errMsg, 'error');
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
    if (!window.confirm(`Delete section "${section}" for ${effProgram} ${effYear} Year? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteSectionConfig(yearKey, section, selectedAcademicYear, selectedSemester);
      if (!result.success) {
        const errMsg = result?.errors?.length ? result.errors.join(' | ') : (result?.message || 'Failed to delete section');
        showMessage(errMsg, 'error');
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

  const sections = sectionsConfig[yearKey] || (effProgram === 'B.Tech' ? sectionsConfig[`B.Tech_${effYear}`] : null) || [];

  return (
    <main className="smp-main">
      {/* Page header */}
      <div className="smp-page-header">
        <h1 className="smp-heading">Section Management</h1>
        <p className="smp-subheading">Centralized section management for all academic years</p>
      </div>

      <div className="smp-content">

        {/* Program Tabs */}
        <div className="smp-prog-tabs">
          {PROGRAMS.map(p => (
            <button
              key={p}
              className={`smp-prog-tab${activeProgram === p ? ' active' : ''}`}
              onClick={() => { setActiveProgram(p); setActiveYear('I'); }}
              disabled={loading}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Alert/Message */}
        {message && (
          <div className={`smp-alert smp-alert-${messageType}`}>
            {message}
            <button className="smp-alert-close" onClick={() => setMessage('')}>✕</button>
          </div>
        )}

        {/* Year Tabs */}
        <div className="smp-year-tabs">
          {displayYears.map(year => (
            <button
              key={year}
              className={`smp-year-tab${activeYear === year ? ' active' : ''}`}
              onClick={() => setActiveYear(year)}
              disabled={loading}
            >
              {`${year} Year`}
            </button>
          ))}
        </div>

        {/* Statistics Cards */}
        <div className="smp-stats">
          <div className="smp-stat-item">
            <span className="smp-stat-label">Total Sections ({effProgram})</span>
            <span className="smp-stat-value">
              {displayYears.reduce((sum, yr) => {
                const k = effProgram === 'B.Tech' ? yr : `${effProgram}_${yr}`;
                const secs = sectionsConfig[k] || (effProgram === 'B.Tech' ? sectionsConfig[`B.Tech_${yr}`] : null) || [];
                return sum + (Array.isArray(secs) ? secs.length : 0);
              }, 0)}
            </span>
          </div>
          {displayYears.map(yr => {
            const k = effProgram === 'B.Tech' ? yr : `${effProgram}_${yr}`;
            const secs = sectionsConfig[k] || (effProgram === 'B.Tech' ? sectionsConfig[`B.Tech_${yr}`] : null) || [];
            return (
              <div key={yr} className="smp-stat-item">
                <span className="smp-stat-label">{`${yr} Year`}</span>
                <span className="smp-stat-value">{Array.isArray(secs) ? secs.length : 0}</span>
              </div>
            );
          })}
        </div>

        {/* Current Year Info */}
        <div className="smp-year-info">
          <span className="smp-info-label">{`${effYear} Year — ${effProgram}`}</span>
          <span className="smp-info-count">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Add Section Form */}
        <div className="smp-add-section">
          <span className="smp-add-label">Add New Section</span>
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
              {loading ? 'Adding…' : '+ Add Section'}
            </button>
          </form>
        </div>

        {/* Sections Grid */}
        <div className="smp-sections-grid">
          {sections.length === 0 ? (
            <div className="smp-empty-state">
              <span className="smp-empty-icon">📭</span>
              <p>No sections configured for {`${activeYear} Year`}</p>
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

      </div>{/* end smp-content */}
    </main>
  );
};

export default SectionManagementPage;
