import React, { useState, useMemo, useEffect, useCallback } from 'react';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';
import './MySubmissionsPage.css';

const MySubmissionsPage = ({
  currentUser,
  submissions,
  editEnabled,
  onUpdateSubmission,
  onNavigateToForm,
}) => {
  const { faculty: contextFaculty, courses: contextCourses } = useSharedData();
  
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);

  // Sync shared context data to local state
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      setFacultyList(contextFaculty);
    }
    if (contextCourses && contextCourses.length > 0) {
      setCourseList(contextCourses);
    }
  }, [contextFaculty, contextCourses]);
  const mySubmission = submissions.find(s => s.empId === currentUser.id);
  const myFaculty = useMemo(
    () => facultyList.find(f => f.empId === currentUser.id),
    [facultyList, currentUser.id]
  );

  // ── inline edit state ──────────────────────────
  const [editMode, setEditMode]     = useState(false);
  const [prefs,    setPrefs]        = useState([]);
  const [errors,   setErrors]       = useState({});
  const [saved,    setSaved]        = useState(false);
  const [saving,   setSaving]       = useState(false);
  const [apiError, setApiError]     = useState('');
  const [prefsOther, setPrefsOther] = useState(['', '', '', '', '']);
  const [readApiError, setReadApiError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);

  const authHeaders = () => ({
    ...authJsonHeaders(),
  });

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Load master data (faculty and courses) from API
  const loadMasterData = useCallback(async ({ silent = true } = {}) => {
    if (!silent) setMasterLoading(true);
    setReadApiError('');
    try {
      const headers = authHeaders();
      const [fReq, cReq] = await Promise.allSettled([
        fetchAllPages('/deva/faculty', {}, { headers }),
        fetchAllPages('/deva/courses', {}, { headers }),
      ]);
      const facultyOk = fReq.status === 'fulfilled';
      const coursesOk = cReq.status === 'fulfilled';
      if (facultyOk) setFacultyList(Array.isArray(fReq.value.data) ? fReq.value.data : []);
      if (coursesOk) setCourseList(Array.isArray(cReq.value.data) ? cReq.value.data : []);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Master data load error:', err);
      if (!silent) setReadApiError('Failed to load master data. Please check your connection.');
    } finally {
      if (!silent) setMasterLoading(false);
    }
  }, []);

  const getCourse = cid => courseList.find(c => String(c.id) === String(cid));

  const startEdit = () => {
    const filled = [...(mySubmission.prefs.map(String))];
    while (filled.length < 5) filled.push('');
    setPrefs(filled);
    setEditMode(true);
    setSaved(false);
    setErrors({});
  };

  const cancelEdit = () => { setEditMode(false); setErrors({}); };

  const handleSave = async () => {
    const filled = prefs.filter(p => p !== '' && p !== '__other__');
    if (filled.length === 0) { setErrors({ prefs: 'Select at least 1 preference.' }); return; }
    if (new Set(filled).size !== filled.length) { setErrors({ prefs: 'Duplicate preferences are not allowed.' }); return; }
    setSaving(true);
    setApiError('');
    try {
      const res  = await fetch(`${API}/deva/submissions/by-faculty/${currentUser.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ prefs: filled.map(Number) }),
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
      setSaved(true);
      setErrors({});
    } catch { setApiError('Network error. Please try again.'); }
    setSaving(false);
  };

  // ══════════════════════════════════════════════
  return (
    <div className="ms-wrapper">

      {/* ── Page header ── */}
      <div className="ms-page-header">
        <div>
          <h2 className="ms-page-title">My Submission</h2>
          <p className="ms-page-sub">Your submitted course preferences for the current academic cycle</p>
          <p className="ms-sync-meta">Last synced: {formatSyncedAt(lastSyncedAt)}</p>
        </div>
        <div className="ms-status-pills">
          <button className="ms-sync-btn" onClick={() => loadMasterData({ silent: false })}>
            {masterLoading ? 'Syncing…' : '↻ Retry Sync'}
          </button>
          <span className={`ms-pill ${editEnabled ? 'ms-pill-on' : 'ms-pill-off'}`}>
            {editEnabled ? '✏️ Editing Enabled' : '🔒 Editing Disabled'}
          </span>
          {mySubmission && (
            <span className="ms-pill ms-pill-submitted">✅ Submitted</span>
          )}
        </div>
      </div>

      {readApiError && (
        <div className="ms-banner ms-banner-error">
          <span>⚠️ {readApiError}</span>
          <button className="ms-error-retry" onClick={() => loadMasterData({ silent: false })}>Retry</button>
        </div>
      )}

      {/* ── Saved banner ── */}
      {saved && (
        <div className="ms-banner ms-banner-success">
          ✅ &nbsp;Your preferences have been updated successfully!
          <button className="ms-banner-close" onClick={() => setSaved(false)}>✕</button>
        </div>
      )}

      {/* ── Edit disabled banner ── */}
      {!editEnabled && mySubmission && (
        <div className="ms-banner ms-banner-locked">
          🔒 &nbsp;The administrator has <strong>disabled editing</strong>. You cannot modify your preferences at this time.
        </div>
      )}

      {/* ── No submission state ── */}
      {!mySubmission ? (
        <div className="ms-empty">
          <div className="ms-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24"
              fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className="ms-empty-title">No Submission Yet</div>
          <div className="ms-empty-desc">You haven't submitted your course preferences yet.</div>
          <button className="ms-go-btn" onClick={onNavigateToForm}>
            Go to Faculty Form →
          </button>
        </div>
      ) : (
        <div className="ms-content">

          {/* ── Faculty profile card ── */}
          <div className="ms-profile-card">
            <div className="ms-profile-avatar">
              {(myFaculty?.name || currentUser.name || 'F').trim()[0].toUpperCase()}
            </div>
            <div className="ms-profile-info">
              <div className="ms-profile-name">{myFaculty?.name || currentUser.name || '—'}</div>
              <div className="ms-profile-meta">
                <span className="ms-meta-chip ms-meta-id">ID: {currentUser.id}</span>
                <span className="ms-meta-chip ms-meta-desig">{myFaculty?.designation || '—'}</span>
                {myFaculty?.mobile && (
                  <span className="ms-meta-chip ms-meta-mobile">📱 {myFaculty.mobile}</span>
                )}
              </div>
              <div className="ms-profile-time">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Submitted: {mySubmission.submittedAt}
              </div>
            </div>

            {/* Edit button */}
            {!editMode && editEnabled && (
              <button className="ms-edit-btn" onClick={startEdit}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Preferences
              </button>
            )}
            {!editMode && !editEnabled && (
              <button className="ms-edit-btn ms-edit-btn-disabled" disabled title="Editing is disabled by the administrator">
                🔒 Edit Disabled
              </button>
            )}
          </div>

          {/* ── VIEW mode: preference cards ── */}
          {!editMode && (
            <div className="ms-prefs-section">
              <div className="ms-prefs-heading">
                Course Preferences
                <span className="ms-prefs-count">{mySubmission.prefs.length} selected</span>
              </div>
              <div className="ms-pref-cards">
                {mySubmission.prefs.map((cid, i) => {
                  const c = getCourse(cid);
                  if (!c) return null;
                  return (
                    <div className="ms-pref-card" key={i}>
                      <div className="ms-pref-rank">#{i + 1}</div>
                      <div className="ms-pref-body">
                        <div className="ms-pref-code">{c.subjectCode}</div>
                        <div className="ms-pref-name">{c.subjectName}</div>
                        <div className="ms-pref-short">{c.shortName}</div>
                        <div className="ms-pref-ltpc">
                          <span>L: {c.L}</span>
                          <span>T: {c.T}</span>
                          <span>P: {c.P}</span>
                          <span>C: {c.C}</span>
                        </div>
                      </div>
                      <div className="ms-pref-prog">{c.program}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── EDIT mode ── */}
          {editMode && (
            <div className="ms-edit-section">
              <div className="ms-edit-heading">
                <span>✏️ Edit Your Preferences</span>
                <span className="ms-edit-hint">Select up to 5 courses (no duplicates)</span>
              </div>

              {errors.prefs && <div className="ms-err-block">{errors.prefs}</div>}

              <div className="ms-edit-list">
                {prefs.map((p, i) => {
                  const c = getCourse(+p);
                  return (
                    <div className="ms-edit-row" key={i}>
                      <div className="ms-edit-pnum">Pref {i + 1}</div>
                      <select
                        value={p}
                        className="ms-edit-select"
                        onChange={e => {
                          const copy = [...prefs];
                          copy[i] = e.target.value;
                          setPrefs(copy);
                          setErrors({});
                        }}
                      >
                        <option value="">— Select a course —</option>
                        {['B.Tech', 'M.Tech'].map(prog => (
                          <optgroup key={prog} label={`── ${prog} ──`}>
                            {courseList.filter(c2 => c2.program === prog).map(c2 => (
                              <option
                                key={c2.id}
                                value={c2.id}
                                disabled={prefs.some((v, j) => j !== i && v === String(c2.id))}
                              >
                                [{c2.subjectCode}] {c2.subjectName}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="__other__">Other…</option>
                      </select>
                      {p === '__other__' && (
                        <input
                          className="ms-other-input"
                          placeholder="Type course name…"
                          value={prefsOther[i]}
                          onChange={e => {
                            const copy = [...prefsOther]; copy[i] = e.target.value; setPrefsOther(copy);
                          }}
                        />
                      )}
                      {p && c && (
                        <div className="ms-edit-meta">
                          <span className="ms-edit-badge">{c.shortName}</span>
                          <span className="ms-edit-ltpc">L:{c.L} T:{c.T} P:{c.P} C:{c.C}</span>
                        </div>
                      )}
                      {p && (
                        <button className="ms-edit-clear" onClick={() => {
                          const copy = [...prefs]; copy[i] = ''; setPrefs(copy);
                        }} title="Clear">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="ms-edit-actions">
                {apiError && (
                  <span style={{ color: '#f87171', fontSize: 13, flex: 1 }}>⚠️ {apiError}</span>
                )}
                <button className="ms-btn ms-btn-ghost" disabled={saving} onClick={cancelEdit}>Cancel</button>
                <button className="ms-btn ms-btn-save" disabled={saving} onClick={handleSave}>
                  {saving ? '⏳ Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MySubmissionsPage;

