import React, { useState, useEffect } from 'react';
import './OverloadedFacultyModal.css';
import API from './config';
import { authJsonHeaders } from './utils/apiFetchAll';

const OverloadedFacultyModal = ({ isOpen, onClose }) => {
  const [overloadedFaculty, setOverloadedFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [editingWorkload, setEditingWorkload] = useState(null);
  const [editForm, setEditForm] = useState({ manualL: 0, manualT: 0, manualP: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Fetch overloaded faculty data
  useEffect(() => {
    if (!isOpen) return;
    fetchOverloadedFaculty();
  }, [isOpen]);

  const fetchOverloadedFaculty = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = authJsonHeaders();
      const res = await fetch(`${API}/deva/stats/overloaded-faculty`, { headers });
      const data = await res.json();

      if (data.success) {
        setOverloadedFaculty(data.data.faculty || []);
      } else {
        setError(data.message || 'Failed to load overloaded faculty.');
      }
    } catch (err) {
      setError('Failed to fetch overloaded faculty data. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFaculty = (faculty) => {
    setSelectedFaculty(faculty);
    setEditingWorkload(null);
    setEditForm({ manualL: 0, manualT: 0, manualP: 0 });
  };

  const handleEditWorkload = (assignment) => {
    setEditingWorkload(assignment);
    setEditForm({
      manualL: assignment.lectureHours,
      manualT: assignment.tutorialHours,
      manualP: assignment.practicalHours,
    });
    setSaveError('');
    setSaveSuccess('');
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: Math.max(0, Number(value) || 0),
    }));
    setSaveError('');
  };

  const handleSaveWorkload = async () => {
    if (!editingWorkload) return;

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    
    try {
      const headers = authJsonHeaders();
      const res = await fetch(`${API}/deva/workloads/${editingWorkload.id}/periods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          manualL: editForm.manualL,
          manualT: editForm.manualT,
          manualP: editForm.manualP,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveError(data.message || 'Failed to update workload periods.');
        return;
      }

      setSaveSuccess('Workload periods updated successfully!');
      
      // Update the workload in the list
      setEditingWorkload(prev => ({
        ...prev,
        lectureHours: editForm.manualL,
        tutorialHours: editForm.manualT,
        practicalHours: editForm.manualP,
        totalHours: editForm.manualL + editForm.manualT + editForm.manualP,
      }));

      // Update the selected faculty data
      if (selectedFaculty) {
        const updatedAssignments = selectedFaculty.assignments.map(a =>
          a.id === editingWorkload.id
            ? {
              ...a,
              lectureHours: editForm.manualL,
              tutorialHours: editForm.manualT,
              practicalHours: editForm.manualP,
              totalHours: editForm.manualL + editForm.manualT + editForm.manualP,
            }
            : a
        );

        // Recalculate faculty totals
        let newCurrentLoad = 0;
        updatedAssignments.forEach(a => {
          newCurrentLoad += a.totalHours;
        });

        const newRemainingHours = Math.max(0, selectedFaculty.totalCapacity - newCurrentLoad);
        const newExcessHours = Math.max(0, newCurrentLoad - selectedFaculty.totalCapacity);

        setSelectedFaculty(prev => ({
          ...prev,
          assignments: updatedAssignments,
          currentLoad: newCurrentLoad,
          remainingHours: newRemainingHours,
          excessHours: newExcessHours,
          utilizationPercent: selectedFaculty.totalCapacity > 0 
            ? ((newCurrentLoad / selectedFaculty.totalCapacity) * 100).toFixed(2)
            : 0,
        }));
      }

      setTimeout(() => {
        setEditingWorkload(null);
        setSaveSuccess('');
      }, 2000);
    } catch (err) {
      setSaveError('Error saving workload periods: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (selectedFaculty) {
    const faculty = selectedFaculty;
    const newTotalHours = editingWorkload
      ? (faculty.currentLoad - editingWorkload.totalHours + editForm.manualL + editForm.manualT + editForm.manualP)
      : faculty.currentLoad;
    const newRemainingHours = Math.max(0, faculty.totalCapacity - newTotalHours);
    const willBeOverloaded = newTotalHours > faculty.totalCapacity;

    return (
      <div className="modal-overlay" onClick={() => setSelectedFaculty(null)}>
        <div className="modal-content ofm-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Faculty Workload Details</h2>
            <button
              className="modal-close-btn"
              onClick={() => {
                setSelectedFaculty(null);
                setEditingWorkload(null);
              }}
            >
              ✕
            </button>
          </div>

          <div className="ofm-detail-container">
            {/* Faculty Header */}
            <div className="ofm-detail-header">
              <div className="ofm-detail-info">
                <h3 className="ofm-detail-name">{faculty.name}</h3>
                <p className="ofm-detail-emp">ID: {faculty.empId}</p>
                <p className="ofm-detail-designation">{faculty.designation} | {faculty.department}</p>
              </div>
              <div className="ofm-detail-stats">
                <div className="ofm-stat-box ofm-stat-capacity">
                  <span className="ofm-stat-label">Capacity</span>
                  <span className="ofm-stat-value">{faculty.totalCapacity}h</span>
                </div>
                <div className="ofm-stat-box ofm-stat-current">
                  <span className="ofm-stat-label">Current Load</span>
                  <span className="ofm-stat-value">{faculty.currentLoad}h</span>
                </div>
                <div className="ofm-stat-box ofm-stat-excess">
                  <span className="ofm-stat-label">Excess</span>
                  <span className="ofm-stat-value">{faculty.excessHours}h</span>
                </div>
                <div className="ofm-stat-box ofm-stat-remaining">
                  <span className="ofm-stat-label">Remaining</span>
                  <span className="ofm-stat-value">{Math.max(0, faculty.remainingHours)}h</span>
                </div>
              </div>
            </div>

            {/* Capacity Bar */}
            <div className="ofm-capacity-bar-container">
              <div className="ofm-capacity-bar-wrapper">
                <div className="ofm-capacity-bar-track">
                  <div
                    className="ofm-capacity-bar-fill"
                    style={{
                      width: `${Math.min(100, (faculty.currentLoad / faculty.totalCapacity) * 100)}%`,
                      background: faculty.isOverAllocated ? '#ef4444' : '#22c55e',
                    }}
                  />
                </div>
              </div>
              <span className="ofm-utilization-text">
                {faculty.utilizationPercent}% Utilized {faculty.isOverAllocated ? '(OVERLOADED)' : ''}
              </span>
            </div>

            {/* Assignments List */}
            <div className="ofm-assignments-section">
              <h4 className="ofm-section-title">Course Assignments ({faculty.assignmentCount})</h4>
              <div className="ofm-assignments-list">
                {faculty.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className={`ofm-assignment-card ${editingWorkload?.id === assignment.id ? 'editing' : ''}`}
                    onClick={() => !editingWorkload && handleEditWorkload(assignment)}
                  >
                    {editingWorkload?.id === assignment.id ? (
                      // Edit form
                      <div className="ofm-edit-form" onClick={e => e.stopPropagation()}>
                        <div className="ofm-form-header">
                          <h5 className="ofm-form-title">{assignment.subjectName} ({assignment.year}-{assignment.section})</h5>
                          <button
                            className="ofm-form-close"
                            onClick={() => {
                              setEditingWorkload(null);
                              setSaveError('');
                              setSaveSuccess('');
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="ofm-form-fields">
                          <div className="ofm-form-field">
                            <label>Lecture Hours (L)</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.manualL}
                              onChange={e => handleFormChange('manualL', e.target.value)}
                              className="ofm-form-input"
                            />
                          </div>
                          <div className="ofm-form-field">
                            <label>Tutorial Hours (T)</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.manualT}
                              onChange={e => handleFormChange('manualT', e.target.value)}
                              className="ofm-form-input"
                            />
                          </div>
                          <div className="ofm-form-field">
                            <label>Practical Hours (P)</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.manualP}
                              onChange={e => handleFormChange('manualP', e.target.value)}
                              className="ofm-form-input"
                            />
                          </div>
                        </div>

                        {/* Validation Preview */}
                        <div className="ofm-form-preview">
                          <div className="ofm-preview-row">
                            <span>New Total Hours:</span>
                            <strong>{editForm.manualL + editForm.manualT + editForm.manualP}h</strong>
                          </div>
                          <div className="ofm-preview-row">
                            <span>Faculty New Total Load:</span>
                            <strong>{newTotalHours}h / {faculty.totalCapacity}h</strong>
                          </div>
                          <div className="ofm-preview-row">
                            <span>Remaining Capacity:</span>
                            <strong style={{ color: willBeOverloaded ? '#ef4444' : '#22c55e' }}>
                              {newRemainingHours}h
                              {willBeOverloaded && ' (WILL OVERLOAD)'}
                            </strong>
                          </div>
                        </div>

                        {saveError && (
                          <div className="ofm-error-msg">{saveError}</div>
                        )}
                        {saveSuccess && (
                          <div className="ofm-success-msg">{saveSuccess}</div>
                        )}

                        <div className="ofm-form-actions">
                          <button
                            className="ofm-btn ofm-btn-secondary"
                            onClick={() => {
                              setEditingWorkload(null);
                              setSaveError('');
                            }}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button
                            className={`ofm-btn ofm-btn-primary ${saving ? 'loading' : ''}`}
                            onClick={handleSaveWorkload}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display view
                      <>
                        <div className="ofm-assignment-header">
                          <div>
                            <h5 className="ofm-assignment-name">{assignment.subjectCode}</h5>
                            <p className="ofm-assignment-info">{assignment.subjectName}</p>
                          </div>
                          <div className="ofm-assignment-year-section">
                            {assignment.year} - Section {assignment.section}
                          </div>
                        </div>
                        <div className="ofm-assignment-hours">
                          <span className="ofm-hour-badge ofm-hour-l">L: {assignment.lectureHours}</span>
                          <span className="ofm-hour-badge ofm-hour-t">T: {assignment.tutorialHours}</span>
                          <span className="ofm-hour-badge ofm-hour-p">P: {assignment.practicalHours}</span>
                          <span className="ofm-hour-badge ofm-hour-total">Total: {assignment.totalHours}h</span>
                        </div>
                        <span className="ofm-edit-hint">Click to edit periods</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="modal-btn modal-btn-secondary" onClick={() => setSelectedFaculty(null)}>
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ofm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Overloaded Faculty Management</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="ofm-loading">
              <span className="ofm-spinner"></span>
              Loading overloaded faculty...
            </div>
          )}

          {error && (
            <div className="ofm-error">
              <span>⚠️ {error}</span>
              <button className="ofm-retry-btn" onClick={fetchOverloadedFaculty}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && overloadedFaculty.length === 0 && (
            <div className="ofm-empty">
              <span className="ofm-empty-icon">✓</span>
              <p>Great! No overloaded faculty at the moment.</p>
            </div>
          )}

          {!loading && !error && overloadedFaculty.length > 0 && (
            <div className="ofm-faculty-list">
              <div className="ofm-list-header">
                <span className="ofm-list-count">Showing {overloadedFaculty.length} overloaded faculty</span>
              </div>
              {overloadedFaculty.map((faculty) => (
                <div
                  key={faculty.empId}
                  className="ofm-faculty-card"
                  onClick={() => handleSelectFaculty(faculty)}
                >
                  <div className="ofm-card-left">
                    <div className="ofm-faculty-avatar">{faculty.name.charAt(0).toUpperCase()}</div>
                    <div className="ofm-faculty-info">
                      <h3 className="ofm-faculty-name">{faculty.name}</h3>
                      <p className="ofm-faculty-id">{faculty.empId} • {faculty.designation}</p>
                    </div>
                  </div>
                  <div className="ofm-card-right">
                    <div className="ofm-stat">
                      <span className="ofm-stat-label">Capacity</span>
                      <span className="ofm-stat-num">{faculty.totalCapacity}h</span>
                    </div>
                    <div className="ofm-stat">
                      <span className="ofm-stat-label">Current</span>
                      <span className="ofm-stat-num ofm-over">{faculty.currentLoad}h</span>
                    </div>
                    <div className="ofm-stat">
                      <span className="ofm-stat-label">Excess</span>
                      <span className="ofm-stat-num ofm-excess">{faculty.excessHours}h</span>
                    </div>
                    <div className="ofm-stat">
                      <span className="ofm-stat-label">Remaining</span>
                      <span className="ofm-stat-num">{Math.max(0, faculty.remainingHours)}h</span>
                    </div>
                  </div>
                  <span className="ofm-card-arrow">→</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverloadedFacultyModal;
