import React, { useState, useMemo, useEffect, useCallback } from 'react';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';
import './FacultyFormPage.css';

const FacultyFormPage = ({
  formEnabled, setFormEnabled,
  editEnabled, setEditEnabled,
  submissions, onSubmit, onUpdateSubmission, onDeleteSubmission,
  isAdmin, currentUser,
}) => {
  const { faculty: contextFaculty, courses: contextCourses } = useSharedData();
  
  // Auto-fill empId for logged-in faculty
  const initialEmpId = !isAdmin && currentUser?.id ? currentUser.id : '';
  const [empIdInput, setEmpIdInput]   = useState(initialEmpId);
  const [prefs, setPrefs]             = useState(['', '', '', '', '']);
  const [errors, setErrors]           = useState({});
  const [submitted, setSubmitted]     = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('submitted'); // 'submitted' | 'updated'
  const [editMode, setEditMode]       = useState(false);  // true = updating existing
  const [editTargetId, setEditTargetId] = useState(null); // id of submission being edited
  const [activeTab, setActiveTab]     = useState('form'); // 'form' | 'submissions'
  const [search, setSearch]           = useState('');
  const [expandRow, setExpandRow]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [apiError, setApiError]       = useState('');
  const [readApiError, setReadApiError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [empOtherDetails, setEmpOtherDetails] = useState({ empId: '', name: '', designation: '' });
  const [prefsOther, setPrefsOther]   = useState(['', '', '', '', '']);
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState('all'); // 'all' | 'submitted' | 'notsubmitted'

  // Sync shared context data to local state
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      setFacultyList(contextFaculty);
    }
    if (contextCourses && contextCourses.length > 0) {
      setCourseList(contextCourses);
    }
    setLastSyncedAt(new Date());
  }, [contextFaculty, contextCourses]);

  const authHeaders = () => ({
    ...authJsonHeaders(),
  });

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  const foundFaculty = useMemo(
    () => facultyList.find(f => f.empId === empIdInput.trim()),
    [empIdInput, facultyList]
  );

  // Existing submission for the currently typed empId
  const existingSubmission = useMemo(
    () => submissions.find(s => s.empId === empIdInput.trim()),
    [empIdInput, submissions]
  );

  // ── Validation ──────────────────────────────────
  const validate = () => {
    const e = {};
    if (!empIdInput.trim())                                                       e.empId = 'Employee ID is required.';
    else if (empIdInput === '__other__' && !empOtherDetails.empId.trim())          e.empId = 'Type the employee ID.';
    else if (empIdInput !== '__other__' && !foundFaculty)                          e.empId = 'Employee ID not found in faculty records.';
    const filled    = prefs.filter(p => p !== '' && p !== '__other__');
    const uniqueSet = new Set(filled);
    if (filled.length === 0)              e.prefs = 'Select at least 1 preference.';
    else if (uniqueSet.size !== filled.length) e.prefs = 'Duplicate preferences are not allowed.';
    return e;
  };

  // ── Start editing an existing submission ───────────
  const startEditing = (sub) => {
    const filled = [...sub.prefs.map(String)];
    while (filled.length < 5) filled.push('');
    setPrefs(filled);
    setEditMode(true);
    setEditTargetId(sub.id);
    setErrors({});
    setSubmitted(false);

  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditTargetId(null);
    setPrefs(['', '', '', '', '']);
    setErrors({});
  };

  // ── Submit / Update handler ──────────────────────
  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setApiError('');
    setSaving(true);

    if (editMode) {
      // PUT /api/submissions/by-faculty/:empId
      try {
        const res  = await fetch(`${API}/deva/submissions/by-faculty/${foundFaculty.empId}`, {
          method: 'PUT', headers: authHeaders(),
          body: JSON.stringify({ prefs: prefs.filter(Boolean).map(Number) }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) { 
          setApiError(data?.message || 'Update failed.'); 
          setSaving(false); 
          return; 
        }
        const updatedSubmission = data?.data;
        if (!updatedSubmission) {
          setApiError('Server returned invalid submission data.');
          setSaving(false);
          return;
        }
        onUpdateSubmission(updatedSubmission);
        setEditMode(false);
        setEditTargetId(null);
        setSubmittedLabel('updated');
        setSubmitted(true);
        setPrefs(['', '', '', '', '']);
        setErrors({});
      } catch { setApiError('Network error. Please try again.'); }
      setSaving(false);
      return;
    }

    // New submission — POST /api/submissions
    if (existingSubmission) {
      setErrors({ empId: 'This faculty already submitted. Click "Edit Submission" to update it.' });
      setSaving(false);
      return;
    }
    try {
      const effectiveFaculty = empIdInput === '__other__'
        ? { empId: empOtherDetails.empId.trim(), name: empOtherDetails.name || empOtherDetails.empId, designation: empOtherDetails.designation || 'Other', mobile: '' }
        : foundFaculty;
      const res  = await fetch(`${API}/deva/submissions`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          empId:       effectiveFaculty.empId,
          prefs:       prefs.filter(p => p !== '' && p !== '__other__').map(Number),
          empName:     effectiveFaculty.name,
          designation: effectiveFaculty.designation,
          mobile:      effectiveFaculty.mobile,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) { 
        setApiError(data?.message || 'Submission failed.'); 
        setSaving(false); 
        return; 
      }
      const newSubmission = data?.data;
      if (!newSubmission) {
        setApiError('Server returned invalid submission data.');
        setSaving(false);
        return;
      }
      onSubmit(newSubmission);
      setSubmittedLabel('submitted');
      setSubmitted(true);
      setEmpIdInput(initialEmpId);
      setPrefs(['', '', '', '', '']);
      setErrors({});
    } catch { setApiError('Network error. Please try again.'); }
    setSaving(false);
  };

  // ── Helpers ─────────────────────────────────────
  const getCourse   = cid => courseList.find(c => String(c.id) === String(cid));
  const ltpcLabel   = cid => {
    const c = getCourse(cid);
    return c ? `L:${c.L} T:${c.T} P:${c.P} C:${c.C}` : '';
  };

  // Calculate not-submitted faculty
  const notSubmittedFaculty = useMemo(() => {
    const submittedEmpIds = new Set(submissions.map(s => s.empId));
    return facultyList.filter(f => !submittedEmpIds.has(f.empId));
  }, [facultyList, submissions]);

  const filteredSubs = useMemo(() => {
    const q = search.toLowerCase();
    
    let data = [];
    if (submissionFilter === 'submitted') {
      // Show only submitted
      data = submissions.filter(s =>
        !q || s.empId.includes(q) || s.empName.toLowerCase().includes(q)
      );
    } else if (submissionFilter === 'notsubmitted') {
      // Show only not-submitted (as faculty objects)
      data = notSubmittedFaculty.filter(f =>
        !q || f.empId.includes(q) || f.name.toLowerCase().includes(q)
      );
    } else {
      // Show all submissions
      data = submissions.filter(s =>
        !q || s.empId.includes(q) || s.empName.toLowerCase().includes(q)
      );
    }
    
    return data;
  }, [submissions, notSubmittedFaculty, search, submissionFilter]);

  // ── Export handlers ─────────────────────────────
  const handleExport = async (format) => {
    if (submissions.length === 0) {
      alert('No submissions to export.');
      return;
    }
    setExportLoading(true);
    setExportError('');
    try {
      const res = await fetch(`${API}/deva/submissions/export?format=${format}`, {
        method: 'GET',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `Export failed with status ${res.status}`);
      }

      // Get filename from header if available
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `submissions_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Download file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // ═══════════════════════════════════════════════
  return (
    <div className="ff-wrapper">

      {/* ── Top bar ── */}
      <div className="ff-topbar">
        <div className="ff-topbar-left">
          <h2 className="ff-heading">Faculty Form</h2>
          <span className="ff-sync-pill">Last synced: {formatSyncedAt(lastSyncedAt)}</span>
          <span className={`ff-status-pill ${formEnabled ? 'ff-open' : 'ff-closed'}`}>
            {formEnabled ? '🟢 Form Open' : '🔴 Form Closed'}
          </span>
          <span className={`ff-status-pill ${editEnabled ? 'ff-edit-on' : 'ff-edit-off'}`}>
            {editEnabled ? '✏️ Edit On' : '🔒 Edit Off'}
          </span>
        </div>
        <div className="ff-topbar-right">
          <button className="ff-toggle-btn ff-sync-btn" onClick={() => loadMasterData({ silent: false })}>
            {masterLoading ? 'Syncing…' : '↻ Retry Sync'}
          </button>
          {isAdmin && (
            <>
              <button
                className={`ff-toggle-btn ${editEnabled ? 'ff-toggle-disable' : 'ff-toggle-enable'}`}
                onClick={async () => {
                  const next = !editEnabled;
                  setEditEnabled(next);
                  await fetch(`${API}/deva/settings/edit-status`, {
                    method: 'PUT', headers: authHeaders(),
                    body: JSON.stringify({ editEnabled: next }),
                  }).catch(() => {});
                }}
                title={editEnabled ? 'Prevent faculty from editing submitted preferences' : 'Allow faculty to edit submitted preferences'}
              >
                {editEnabled ? '✏️ Disable Edit' : '✏️ Enable Edit'}
              </button>
              <button
                className={`ff-toggle-btn ${formEnabled ? 'ff-toggle-disable' : 'ff-toggle-enable'}`}
                onClick={async () => {
                  const next = !formEnabled;
                  setFormEnabled(next);
                  await fetch(`${API}/deva/settings/form-status`, {
                    method: 'PUT', headers: authHeaders(),
                    body: JSON.stringify({ formEnabled: next }),
                  }).catch(() => {});
                }}
              >
                {formEnabled ? '🔒 Disable Form' : '🔓 Enable Form'}
              </button>
            </>
          )}
          <div className="ff-tab-group">
            <button
              className={`ff-tab${activeTab === 'form' ? ' ff-tab-active' : ''}`}
              onClick={() => setActiveTab('form')}
            >
              Submit Preferences
            </button>
            {isAdmin && (
              <button
                className={`ff-tab${activeTab === 'submissions' ? ' ff-tab-active' : ''}`}
                onClick={() => setActiveTab('submissions')}
              >
                All Submissions
                {submissions.length > 0 && (
                  <span className="ff-tab-badge">{submissions.length}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {readApiError && (
        <div className="ff-banner ff-banner-error">
          <span>⚠️ {readApiError}</span>
          <button className="ff-error-retry" onClick={() => loadMasterData({ silent: false })}>Retry</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 1 — FORM
      ═══════════════════════════════════════════ */}
      {activeTab === 'form' && (
        <div className="ff-form-panel">

          {/* ── Faculty identity banner (non-admin) ── */}
          {!isAdmin && foundFaculty && (
            <div className="ff-identity-banner">
              <div className="ff-identity-avatar">
                {foundFaculty.name.trim()[0].toUpperCase()}
              </div>
              <div className="ff-identity-info">
                <div className="ff-identity-name">{foundFaculty.name}</div>
                <div className="ff-identity-meta">
                  <span className="ff-identity-chip ff-id-chip">ID&nbsp;{foundFaculty.empId}</span>
                  <span className="ff-identity-chip ff-desig-chip">{foundFaculty.designation}</span>
                  {foundFaculty.mobile && (
                    <span className="ff-identity-chip ff-mob-chip">📱&nbsp;{foundFaculty.mobile}</span>
                  )}
                </div>
              </div>
              <div className="ff-identity-lock">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Profile locked
              </div>
            </div>
          )}

          {!formEnabled && !editMode && (
            <div className="ff-banner ff-banner-disabled">
              🔴&nbsp; This form is currently <strong>disabled</strong> by the administrator.
              Faculty cannot submit preferences at this time.
            </div>
          )}

          {submitted && (
            <div className="ff-banner ff-banner-success">
              ✅&nbsp; Preferences <strong>{submittedLabel}</strong> successfully!
              <button className="ff-banner-close" onClick={() => setSubmitted(false)}>✕</button>
            </div>
          )}

          {/* Existing submission notice — show only when NOT in edit mode */}
          {!editMode && existingSubmission && foundFaculty && (
            <div className={`ff-banner ${editEnabled ? 'ff-banner-warning' : 'ff-banner-disabled'}`}>
              {editEnabled ? (
                <>
                  ✏️&nbsp; <strong>{foundFaculty.name}</strong> already has a submission.
                  <button
                    className="ff-edit-submission-btn"
                    onClick={() => startEditing(existingSubmission)}
                  >
                    Edit Submission
                  </button>
                </>
              ) : (
                <>🔒&nbsp; <strong>{foundFaculty.name}</strong> already submitted. Editing is currently <strong>disabled</strong> by the administrator.</>
              )}
            </div>
          )}

          {/* Edit mode active notice */}
          {editMode && (
            <div className="ff-banner ff-banner-edit">
              ✏️&nbsp; Editing submission for <strong>{foundFaculty?.name}</strong>. Update preferences and click <strong>Update Preferences</strong>.
              <button className="ff-banner-close" onClick={cancelEdit} title="Cancel edit">✕ Cancel</button>
            </div>
          )}

          <div className={`ff-card${(!formEnabled && !editMode) ? ' ff-card-locked' : ''}`}>

            {/* ── Faculty identification (admin enters ID; faculty sees locked banner above) ── */}
            {isAdmin && (
              <>
                <div className="ff-section-title">Faculty Identification</div>
                <div className="ff-id-row">
                  <div className="ff-fg">
                    <label>Employee ID *</label>
                    {editMode ? (
                      <input value={empIdInput} readOnly className="ff-readonly" />
                    ) : (
                      <>
                        <select
                          value={empIdInput}
                          disabled={!formEnabled && !editMode}
                          className="ff-empid-select"
                          onChange={e => {
                            setEmpIdInput(e.target.value);
                            setEmpOtherDetails({ empId: '', name: '', designation: '' });
                            setErrors({});
                            setSubmitted(false);
                          }}
                        >
                          <option value="">— Select Employee —</option>
                          {[...facultyList]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(f => (
                              <option key={f.empId} value={f.empId}>
                                [{f.empId}] {f.name}
                              </option>
                            ))}
                          <option value="__other__">Other…</option>
                        </select>
                        {empIdInput === '__other__' && (
                          <div className="ff-other-group">
                            <input className="ff-other-input" placeholder="Employee ID *"
                              disabled={!formEnabled && !editMode}
                              value={empOtherDetails.empId}
                              onChange={e => setEmpOtherDetails(p => ({ ...p, empId: e.target.value }))} />
                            <input className="ff-other-input" placeholder="Employee Name"
                              disabled={!formEnabled && !editMode}
                              value={empOtherDetails.name}
                              onChange={e => setEmpOtherDetails(p => ({ ...p, name: e.target.value }))} />
                            <input className="ff-other-input" placeholder="Designation"
                              disabled={!formEnabled && !editMode}
                              value={empOtherDetails.designation}
                              onChange={e => setEmpOtherDetails(p => ({ ...p, designation: e.target.value }))} />
                          </div>
                        )}
                      </>
                    )}
                    {errors.empId && <span className="ff-err">{errors.empId}</span>}
                  </div>
                  <div className="ff-fg">
                    <label>Employee Name</label>
                    <input value={foundFaculty ? foundFaculty.name : ''} readOnly placeholder="Auto-filled" className="ff-readonly" />
                  </div>
                  <div className="ff-fg">
                    <label>Designation</label>
                    <input value={foundFaculty ? foundFaculty.designation : ''} readOnly placeholder="—" className="ff-readonly" />
                  </div>
                  <div className="ff-fg">
                    <label>Mobile</label>
                    <input value={foundFaculty ? foundFaculty.mobile : ''} readOnly placeholder="—" className="ff-readonly" />
                  </div>
                </div>
              </>
            )}
            {!isAdmin && errors.empId && (
              <div className="ff-banner ff-banner-disabled" style={{ marginBottom: 16 }}>⚠️ {errors.empId}</div>
            )}

            {/* ── Course Preferences ── */}
            <>
            <div className="ff-section-title" style={{ marginTop: '22px' }}>
              Course Preferences
              <span className="ff-section-hint"> — Select up to 5 courses (no duplicates)</span>
            </div>
            {errors.prefs && <div className="ff-err ff-err-block">{errors.prefs}</div>}

            <div className="ff-prefs-list">
              {prefs.map((p, i) => {
                const YEARS_ORDER = ['I', 'II', 'III', 'IV'];
                return (
                <div className="ff-pref-row" key={i}>
                  <div className="ff-pref-tag">Pref&nbsp;{i + 1}</div>
                  <select
                    value={p}
                    disabled={!formEnabled && !editMode}
                    className="ff-pref-select"
                    onChange={e => {
                      const copy = [...prefs];
                      copy[i] = e.target.value;
                      setPrefs(copy);
                      setErrors({});
                    }}
                  >
                    <option value="">— Select a course —</option>
                    {YEARS_ORDER.map(yr => {
                      const yrCourses = courseList.filter(c => c.program === 'B.Tech' && c.year === yr);
                      if (!yrCourses.length) return null;
                      return (
                        <optgroup key={yr} label={`── B.Tech ${yr} Year ──`}>
                          {yrCourses.map(c => (
                            <option key={c.id} value={c.id} disabled={prefs.some((v, j) => j !== i && v === String(c.id))}>
                              [{c.subjectCode}] {c.subjectName} ({c.shortName})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                    <option value="__other__">Other…</option>
                  </select>
                  {p === '__other__' && (
                    <input
                      className="ff-other-input ff-other-pref"
                      placeholder="Type course name…"
                      disabled={!formEnabled && !editMode}
                      value={prefsOther[i]}
                      onChange={e => {
                        const copy = [...prefsOther]; copy[i] = e.target.value; setPrefsOther(copy);
                      }}
                    />
                  )}
                  {p && p !== '__other__' && (
                    <div className="ff-pref-meta">
                      <span className="ff-pref-badge">{getCourse(+p)?.shortName}</span>
                      <span className="ff-pref-ltpc">{ltpcLabel(+p)}</span>
                    </div>
                  )}
                  {p && (
                    <button
                      className="ff-pref-clear"
                      disabled={!formEnabled && !editMode}
                      onClick={() => {
                        const copy = [...prefs];
                        copy[i] = '';
                        setPrefs(copy);
                      }}
                      title="Clear"
                    >✕</button>
                  )}
                </div>
                );
              })}
            </div>

            {apiError && (
              <div className="ff-banner ff-banner-error" style={{ marginTop: 12 }}>
                ⚠️ {apiError}
              </div>
            )}
            <div className="ff-form-footer">
              <button
                className="ff-btn ff-btn-ghost"
                disabled={saving || (!formEnabled && !editMode)}
                onClick={() => {
                  setPrefs(['', '', '', '', '']);
                  if (!editMode) setEmpIdInput(initialEmpId);
                  setErrors({});
                  setSubmitted(false);
                  setApiError('');
                  if (editMode) cancelEdit();
                }}
              >
                {editMode ? 'Cancel Edit' : 'Reset'}
              </button>
              <button
                className={`ff-btn ${editMode ? 'ff-btn-update' : 'ff-btn-submit'}`}
                disabled={saving || (!formEnabled && !editMode)}
                onClick={handleSubmit}
              >
                {saving ? '⏳ Saving…' : editMode ? '💾 Update Preferences' : 'Submit Preferences'}
              </button>
            </div>
            </>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2 — SUBMISSIONS (Admin View)
      ═══════════════════════════════════════════ */}
      {activeTab === 'submissions' && (
        <div className="ff-sub-panel">
          <div className="ff-sub-topbar">
            <span className="ff-sub-count">
              {submissionFilter === 'submitted' && `${submissions.length} submission${submissions.length !== 1 ? 's' : ''}`}
              {submissionFilter === 'notsubmitted' && `${notSubmittedFaculty.length} faculty not submitted`}
              {submissionFilter === 'all' && `${submissions.length} submitted + ${notSubmittedFaculty.length} not submitted`}
            </span>
            <div className="ff-search-wrap">
              <svg className="ff-search-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="ff-search"
                placeholder="Search by ID or name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="ff-search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
            <div className="ff-export-actions">
              {exportError && <span className="ff-export-error">⚠️ {exportError}</span>}
              <button
                className="ff-export-btn ff-export-csv"
                onClick={() => handleExport('csv')}
                disabled={exportLoading || submissions.length === 0}
                title="Export submissions as CSV"
              >
                {exportLoading ? '⏳' : '📊'} CSV
              </button>
              <button
                className="ff-export-btn ff-export-excel"
                onClick={() => handleExport('excel')}
                disabled={exportLoading || submissions.length === 0}
                title="Export submissions as Excel"
              >
                {exportLoading ? '⏳' : '📈'} Excel
              </button>
            </div>
          </div>

          {/* ── Filter buttons ── */}
          <div className="ff-filter-buttons">
            <button
              className={`ff-filter-btn${submissionFilter === 'all' ? ' ff-filter-active' : ''}`}
              onClick={() => {
                setSubmissionFilter('all');
                setSearch('');
              }}
            >
              All ({submissions.length + notSubmittedFaculty.length})
            </button>
            <button
              className={`ff-filter-btn${submissionFilter === 'submitted' ? ' ff-filter-active' : ''}`}
              onClick={() => {
                setSubmissionFilter('submitted');
                setSearch('');
              }}
            >
              ✅ Submitted ({submissions.length})
            </button>
            <button
              className={`ff-filter-btn${submissionFilter === 'notsubmitted' ? ' ff-filter-active' : ''}`}
              onClick={() => {
                setSubmissionFilter('notsubmitted');
                setSearch('');
              }}
            >
              ⏳ Not Submitted ({notSubmittedFaculty.length})
            </button>
          </div>

          {filteredSubs.length === 0 ? (
            <div className="ff-empty-state">
              <div className="ff-empty-icon">📋</div>
              <div className="ff-empty-title">
                {submissionFilter === 'notsubmitted' && notSubmittedFaculty.length === 0 
                  ? '✅ All faculty have submitted!' 
                  : submissions.length === 0 && submissionFilter !== 'notsubmitted'
                  ? 'No submissions yet' 
                  : 'No matching records'}
              </div>
              <div className="ff-empty-sub">
                {submissions.length === 0
                  ? 'Faculty can submit preferences when the form is enabled.'
                  : 'Try clearing the search filter.'}
              </div>
            </div>
          ) : (
            <div className="ff-table-wrap">
              <table className="ff-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Pref 1</th>
                    <th>Pref 2</th>
                    <th>Pref 3</th>
                    <th>Pref 4</th>
                    <th>Pref 5</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((s, i) => (
                    <React.Fragment key={s.id}>
                      <tr
                        className={`${i % 2 === 0 ? 'ff-tr-even' : 'ff-tr-odd'}${expandRow === s.id ? ' ff-tr-expanded' : ''}`}
                        onClick={() => setExpandRow(expandRow === s.id ? null : s.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ff-td-sl">{i + 1}</td>
                        <td className="ff-td-empid">{s.empId}</td>
                        <td className="ff-td-name">{s.empName || s.name}</td>
                        <td className="ff-td-desig">{s.designation}</td>
                        {submissionFilter === 'notsubmitted' ? (
                          // Not-submitted faculty: show empty cells + status
                          <>
                            {[0, 1, 2, 3, 4].map(pi => (
                              <td key={pi} className="ff-td-pref">
                                <span className="ff-chip-empty">—</span>
                              </td>
                            ))}
                            <td className="ff-td-time" style={{ color: '#f97316', fontWeight: '600' }}>Not Submitted</td>
                            <td></td>
                          </>
                        ) : (
                          // Submitted faculty: show preferences
                          <>
                            {[0, 1, 2, 3, 4].map(pi => (
                              <td key={pi} className="ff-td-pref">
                                {s.prefs && s.prefs[pi] ? (
                                  <span className="ff-chip">{getCourse(s.prefs[pi])?.shortName || '—'}</span>
                                ) : <span className="ff-chip-empty">—</span>}
                              </td>
                            ))}
                            <td className="ff-td-time">{s.submittedAt}</td>
                            <td>
                              <button
                                className="ff-action-del"
                                onClick={async e => {
                                  e.stopPropagation();
                                  if (!window.confirm('Delete this submission?')) return;
                                  try {
                                    const res = await fetch(`${API}/deva/submissions/${s.id}`, {
                                      method: 'DELETE', headers: authHeaders(),
                                    });
                                    const data = await res.json();
                                    if (res.ok) onDeleteSubmission(s.id);
                                    else alert(data.message || 'Delete failed.');
                                  } catch { alert('Network error.'); }
                                }}
                              >✕ Remove</button>
                            </td>
                          </>
                        )}
                      </tr>
                      {expandRow === s.id && submissionFilter !== 'notsubmitted' && s.prefs && (
                        <tr className="ff-tr-detail">
                          <td colSpan={11}>
                            <div className="ff-detail-block">
                              <strong>Full Preferences:</strong>
                              <div className="ff-detail-prefs">
                                {s.prefs.map((cid, pi) => {
                                  const c = getCourse(cid);
                                  return c ? (
                                    <div key={pi} className="ff-detail-pref-item">
                                      <span className="ff-detail-pnum">Pref {pi + 1}</span>
                                      <span className="ff-detail-code">{c.subjectCode}</span>
                                      <span className="ff-detail-sname">{c.subjectName}</span>
                                      <span className="ff-detail-ltpc">L:{c.L} T:{c.T} P:{c.P} C:{c.C}</span>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {expandRow === s.id && submissionFilter === 'notsubmitted' && (
                        <tr className="ff-tr-detail">
                          <td colSpan={11}>
                            <div className="ff-detail-block" style={{ color: '#666' }}>
                              <strong>Faculty Details:</strong>
                              <div className="ff-detail-faculty" style={{ marginTop: '10px', padding: '10px', background: '#fef3c7', borderRadius: '4px' }}>
                                <div><strong>ID:</strong> {s.empId}</div>
                                <div><strong>Name:</strong> {s.name}</div>
                                <div><strong>Designation:</strong> {s.designation}</div>
                                <div><strong>Department:</strong> {s.department || 'N/A'}</div>
                                <div><strong>Mobile:</strong> {s.mobile || 'N/A'}</div>
                                <div><strong>Email:</strong> {s.email || 'N/A'}</div>
                                <p style={{ marginTop: '10px', color: '#d97706', fontWeight: '600' }}>⏳ This faculty member has not submitted their course preferences yet.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FacultyFormPage;

