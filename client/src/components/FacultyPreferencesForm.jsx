/**
 * FacultyPreferencesForm.jsx
 * 
 * Component for faculty/admin to view and manage course preferences
 * - Select preferred courses
 * - Add notes
 * - Submit/update preferences
 * - View current preferences
 * - Clear preferences
 */

import React, { useState, useEffect, useCallback } from 'react';
import './FacultyPreferencesForm.css';
import {
  fetchFacultyPreferences,
  saveFacultyPreferences,
  updateFacultyPreferences,
  clearFacultyPreferences,
} from '../utils/facultyPreferencesApi';

/**
 * FacultyPreferencesForm Component
 * 
 * Props:
 *   empId (string) - Employee ID of faculty
 *   courseList (array) - Available courses to select from
 *   onSave (function) - Callback after preferences saved
 *   isAdmin (boolean) - Show admin controls (default: false)
 *   readOnly (boolean) - Read-only mode (default: false)
 */
const FacultyPreferencesForm = ({
  empId,
  courseList = [],
  onSave = null,
  isAdmin = false,
  readOnly = false,
}) => {
  const [preferences, setPreferences] = useState(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'edit'

  /**
   * Load existing preferences when empId changes
   */
  useEffect(() => {
    if (!empId) return;

    const loadPreferences = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchFacultyPreferences(empId);
        setPreferences(data);
        setSelectedCourseIds(data.preferredCourseIds || []);
        setNotes(data.notes || '');
        setMode('view');
      } catch (err) {
        setError(`Error loading preferences: ${err.message}`);
        setPreferences(null);
        setSelectedCourseIds([]);
        setNotes('');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [empId]);

  /**
   * Toggle course selection
   */
  const handleToggleCourse = useCallback((courseId) => {
    setSelectedCourseIds((prev) => {
      if (prev.includes(courseId)) {
        return prev.filter((id) => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  }, []);

  /**
   * Select all courses
   */
  const handleSelectAll = useCallback(() => {
    const allIds = courseList.map((c) => Number(c.id));
    setSelectedCourseIds(allIds);
  }, [courseList]);

  /**
   * Clear all selections
   */
  const handleClearAll = useCallback(() => {
    setSelectedCourseIds([]);
  }, []);

  /**
   * Save preferences
   */
  const handleSave = async () => {
    if (!empId) {
      setError('Employee ID is required');
      return;
    }

    if (selectedCourseIds.length === 0) {
      setError('Please select at least one course');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let result;
      if (preferences?.isSubmitted) {
        // Update existing
        result = await updateFacultyPreferences(empId, selectedCourseIds, notes);
      } else {
        // Create new
        result = await saveFacultyPreferences(empId, selectedCourseIds, notes);
      }

      setPreferences(result);
      setSuccess(`✅ Preferences saved! (${selectedCourseIds.length} courses selected)`);
      setMode('view');

      if (onSave) {
        onSave(result);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Error saving preferences: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Clear preferences
   */
  const handleClear = async () => {
    if (!preferences?.isSubmitted) {
      setError('No preferences to clear');
      return;
    }

    const confirmClear = window.confirm(
      `Clear preferences for ${empId}? This cannot be undone.`
    );

    if (!confirmClear) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await clearFacultyPreferences(empId);
      setPreferences(null);
      setSelectedCourseIds([]);
      setNotes('');
      setSuccess('✅ Preferences cleared successfully');
      setMode('view');

      if (onSave) {
        onSave(null);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Error clearing preferences: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="fpf-container">
        <div className="fpf-loading">Loading preferences...</div>
      </div>
    );
  }

  const selectedCount = selectedCourseIds.length;
  const hasPreferences = preferences?.isSubmitted;
  const isEditing = mode === 'edit' && !readOnly;

  return (
    <div className="fpf-container">
      {/* Header */}
      <div className="fpf-header">
        <h3 className="fpf-title">Course Preferences</h3>
        <div className="fpf-emp-id">
          Employee ID: <strong>{empId || 'Not selected'}</strong>
        </div>
      </div>

      {/* Status Messages */}
      {error && <div className="fpf-error">⚠️ {error}</div>}
      {success && <div className="fpf-success">{success}</div>}

      {/* Current Status */}
      {hasPreferences && !isEditing && (
        <div className="fpf-status">
          <strong>{selectedCount} courses selected</strong>
          {preferences.submittedAt && (
            <span className="fpf-timestamp">
              Last updated: {new Date(preferences.submittedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Course Selection */}
      <div className="fpf-section">
        <div className="fpf-section-header">
          <h4>Select Preferred Courses</h4>
          {!isEditing && !readOnly && hasPreferences && (
            <button
              className="fpf-btn fpf-btn-small fpf-btn-edit"
              onClick={() => setMode('edit')}
              disabled={saving}
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {/* Controls */}
        {isEditing && (
          <div className="fpf-controls">
            <button
              className="fpf-btn-link"
              onClick={handleSelectAll}
              disabled={saving || selectedCount === courseList.length}
            >
              Select All
            </button>
            <span className="fpf-divider">|</span>
            <button
              className="fpf-btn-link"
              onClick={handleClearAll}
              disabled={saving || selectedCount === 0}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Course List */}
        <div className="fpf-course-list">
          {courseList.length === 0 ? (
            <div className="fpf-empty">No courses available</div>
          ) : (
            courseList.map((course) => (
              <label
                key={course.id}
                className={`fpf-course-item ${
                  selectedCourseIds.includes(Number(course.id)) ? 'selected' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(Number(course.id))}
                  onChange={() => handleToggleCourse(Number(course.id))}
                  disabled={!isEditing && readOnly}
                />
                <span className="fpf-course-code">{course.subjectCode}</span>
                <span className="fpf-course-name">{course.subjectName}</span>
                <span className="fpf-course-hours">
                  L:{course.L} T:{course.T} P:{course.P}
                </span>
              </label>
            ))
          )}
        </div>

        {/* Selection Count */}
        <div className="fpf-count">
          {selectedCount} of {courseList.length} courses selected
        </div>
      </div>

      {/* Notes Section */}
      <div className="fpf-section">
        <label htmlFor="fpf-notes" className="fpf-label">
          Notes (Optional)
        </label>
        <textarea
          id="fpf-notes"
          className="fpf-textarea"
          placeholder="Add any notes about your preference..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!isEditing && readOnly}
          rows="3"
        />
      </div>

      {/* Action Buttons */}
      <div className="fpf-actions">
        {isEditing ? (
          <>
            <button
              className="fpf-btn fpf-btn-primary"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
            >
              {saving ? 'Saving...' : '💾 Save Preferences'}
            </button>
            <button
              className="fpf-btn fpf-btn-secondary"
              onClick={() => {
                setMode('view');
                setSelectedCourseIds(preferences?.preferredCourseIds || []);
                setNotes(preferences?.notes || '');
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {!readOnly && (
              <button
                className="fpf-btn fpf-btn-primary"
                onClick={() => setMode('edit')}
                disabled={saving}
              >
                ✏️ Edit Preferences
              </button>
            )}
            {hasPreferences && isAdmin && (
              <button
                className="fpf-btn fpf-btn-danger"
                onClick={handleClear}
                disabled={saving}
              >
                🗑️ Clear Preferences
              </button>
            )}
          </>
        )}
      </div>

      {/* Info Box */}
      {!isEditing && hasPreferences && (
        <div className="fpf-info-box">
          <strong>ℹ️ How it works:</strong>
          <p>
            When assigning workload to you, only these {selectedCount} preferred courses will be shown in the dropdown.
            If you need to include other courses, update your preferences.
          </p>
        </div>
      )}

      {!hasPreferences && mode === 'view' && (
        <div className="fpf-info-box">
          <strong>ℹ️ No preferences submitted yet</strong>
          <p>
            If you have course preferences, select them above and click "Edit Preferences" to get started.
            When you submit preferences, only those courses will be available for workload assignment.
          </p>
        </div>
      )}
    </div>
  );
};

export default FacultyPreferencesForm;
