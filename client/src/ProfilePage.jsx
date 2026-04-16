import React, { useState, useEffect, useCallback } from 'react';
import './ProfilePage.css';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';

const ProfilePage = ({ user, submissions = [], onLogout }) => {
  const { faculty: contextFaculty, setFaculty, courses: contextCourses } = useSharedData();
  
  const [myWorkloads, setMyWorkloads] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Sync shared context data to local state
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      setFacultyList(contextFaculty);
    }
    if (contextCourses && contextCourses.length > 0) {
      setCourseList(contextCourses);
    }
  }, [contextFaculty, contextCourses]);

  // Change password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: '', ok: false });

  // Edit profile state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ mobile: '', email: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: '', ok: false });

  const authHeaders = useCallback(() => ({ ...authJsonHeaders() }), []);

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  const loadProfileData = useCallback(async ({ withLoader = true } = {}) => {
    if (!user?.id) return;
    if (withLoader) setLoading(true);
    setApiError('');

    try {
      const headers = authHeaders();
      const workloadParams = user.role === 'admin' ? {} : { empId: String(user.id) };
      const [wData] = await Promise.all([
        fetchAllPages('/deva/workloads', workloadParams, { headers }),
      ]);

      if (!wData.success) {
        setApiError(wData.message || 'Failed to load profile data.');
        return;
      }

      const allWorkloads = wData.data || [];
      setMyWorkloads(user.role === 'admin'
        ? allWorkloads
        : allWorkloads.filter((workload) => String(workload.empId) === String(user.id)));
      setLastSyncedAt(new Date());
    } catch {
      setApiError('Failed to load profile data.');
    } finally {
      if (withLoader) setLoading(false);
    }
  }, [authHeaders, user]);

  // Refetch current user's faculty data from backend
  const refetchFacultyProfile = useCallback(async () => {
    try {
      console.log('[ProfilePage] Refetching faculty profile data for user:', user.id);
      const headers = authHeaders();
      const response = await fetch(`${API}/deva/faculty/${user.id}`, {
        method: 'GET',
        headers,
      });
      const data = await response.json();
      
      if (response.ok && data?.success && data?.data) {
        const updatedFaculty = data.data;
        console.log('[ProfilePage] Received updated faculty data:', updatedFaculty);
        
        // Update local faculty list
        setFacultyList(prev => prev.map(f => f.empId === user.id ? updatedFaculty : f));
        
        // Update shared context
        setFaculty(prev => prev.map(f => f.empId === user.id ? updatedFaculty : f));
        
        console.log('[ProfilePage] Faculty profile updated successfully');
        return true;
      } else {
        console.warn('[ProfilePage] Failed to refetch faculty profile:', data?.message);
        return false;
      }
    } catch (err) {
      console.error('[ProfilePage] Error refetching faculty profile:', err.message);
      return false;
    }
  }, [user.id, authHeaders, setFaculty]);

  useEffect(() => {
    loadProfileData({ withLoader: true });
  }, [loadProfileData]);

  // Find this faculty member by their login employee ID
  const profile = facultyList.find(f => f.empId === user.id);

  // Their preference submission (if any)
  const mySubmission = submissions.find(s => s.empId === user.id);

  // Initials for avatar
  const getInitials = (name = '') => {
    const words = name.replace(/^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim().split(/\s+/);
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  // Avatar background colour based on empId
  const AVATAR_COLORS = [
    ['#6366f1', '#a855f7'], ['#f97316', '#ef4444'], ['#06b6d4', '#3b82f6'],
    ['#22c55e', '#16a34a'], ['#facc15', '#f97316'], ['#ec4899', '#a855f7'],
  ];
  const avatarPair = AVATAR_COLORS[(parseInt(user.id, 10) || 0) % AVATAR_COLORS.length];

  const getCourseById = (id) => courseList.find(c => c.id === id);

  // Open edit mode with current values (only editable fields)
  const openEditMode = useCallback(() => {
    if (profile) {
      setEditForm({
        mobile: profile.mobile || '',
        email: profile.email || '',
      });
      setEditMsg({ text: '', ok: false });
      setEditMode(true);
    }
  }, [profile]);

  // Close edit mode
  const closeEditMode = () => {
    setEditMode(false);
    setEditForm({ mobile: '', email: '' });
    setEditMsg({ text: '', ok: false });
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    if (!profile) return;
    
    setEditSaving(true);
    setEditMsg({ text: '', ok: false });

    try {
      // Only send non-empty fields
      const payload = {};
      Object.entries(editForm).forEach(([key, value]) => {
        const trimmedValue = String(value).trim();
        if (trimmedValue !== '') {
          payload[key] = trimmedValue;
        }
      });

      console.log('Saving profile changes with payload:', { payload, userId: user.id });

      const response = await fetch(`${API}/deva/faculty/${user.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log('Profile update response:', { status: response.status, data });

      if (!response.ok || !data?.success) {
        let errorMsg = data?.message || 'Failed to update profile';
        
        // Extract detailed error messages if validation errors exist
        if (data?.errors && Array.isArray(data.errors)) {
          const errorDetails = data.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          errorMsg = `Validation error: ${errorDetails}`;
        }
        
        console.error('Profile update failed:', errorMsg);
        setEditMsg({ text: errorMsg, ok: false });
        return;
      }

      // Refetch faculty profile to get fresh data from backend
      console.log('Profile update successful, refetching faculty profile...');
      const refetchSuccess = await refetchFacultyProfile();
      
      if (refetchSuccess) {
        setEditMsg({ text: 'Profile updated successfully!', ok: true });
        
        setTimeout(() => {
          closeEditMode();
        }, 1500);
      } else {
        setEditMsg({ text: 'Profile saved but unable to refresh. Please reload the page.', ok: false });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setEditMsg({ text: 'Error updating profile: ' + (error.message || 'Unknown error'), ok: false });
    } finally {
      setEditSaving(false);
    }
  };

  if (!profile) {
    return (
      <main className="pp-wrapper">
        {apiError && (
          <div className="pp-error-banner">
            <span>⚠️ {apiError}</span>
            <button className="pp-error-retry" onClick={() => loadProfileData({ withLoader: true })}>Retry</button>
          </div>
        )}
        <div className="pp-not-found">
          <div className="pp-nf-icon">🔍</div>
          <h2>Profile Not Found</h2>
          <p>Employee ID <strong>{user.id}</strong> is not registered in the faculty directory.</p>
          <p className="pp-nf-sub">Contact your administrator to link your account.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pp-wrapper">
      {apiError && (
        <div className="pp-error-banner">
          <span>⚠️ {apiError}</span>
          <button className="pp-error-retry" onClick={() => loadProfileData({ withLoader: true })}>Retry</button>
        </div>
      )}

      <div className="pp-sync-meta-row">
        <span className="pp-sync-meta">Last synced: {formatSyncedAt(lastSyncedAt)}</span>
        <button className="pp-sync-btn" onClick={() => loadProfileData({ withLoader: true })} disabled={loading}>
          {loading ? 'Syncing…' : '↻ Retry Sync'}
        </button>
      </div>

      {/* ── Hero Card ──────────────────────────────────── */}
      <div className="pp-hero">
        <div
          className="pp-avatar"
          style={{
            background: `linear-gradient(135deg, ${avatarPair[0]}, ${avatarPair[1]})`,
            boxShadow: `0 0 28px ${avatarPair[0]}88`,
          }}
        >
          {getInitials(profile.name)}
        </div>

        <div className="pp-hero-info">
          <h1 className="pp-name">{profile.name}</h1>
          <span className="pp-designation-badge">{profile.designation}</span>
          <div className="pp-emp-id-tag">
            <span className="pp-emp-label">Employee&nbsp;ID</span>
            <span className="pp-emp-val">{profile.empId}</span>
          </div>
        </div>

        <div className="pp-hero-stats">
          <div className="pp-hstat">
            <span className="pp-hstat-val">{mySubmission ? (mySubmission.prefs ?? mySubmission.preferences ?? []).filter(Boolean).length : 0}</span>
            <span className="pp-hstat-label">Preferences</span>
          </div>
          <div className="pp-hstat">
            <span className="pp-hstat-val">{myWorkloads.length}</span>
            <span className="pp-hstat-label">Assignments</span>
          </div>
        </div>
      </div>

      <div className="pp-body">

        {/* ── Contact Details ─────────────────────────── */}
        <section className="pp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 className="pp-sec-title" style={{ margin: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Personal Details
            </h2>
            <button 
              className="pp-edit-btn"
              onClick={openEditMode}
              title="Edit your profile details"
            >
              ✎ Edit Profile
            </button>
            {profile.empId && user.id && profile.empId !== user.id && (
              <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                (View only - can only edit your own profile)
              </span>
            )}
          </div>
          <div className="pp-detail-grid">
            <div className="pp-detail-cell">
              <span className="pp-dc-label">Full Name</span>
              <span className="pp-dc-val">{profile.name}</span>
            </div>
            <div className="pp-detail-cell">
              <span className="pp-dc-label">Employee ID</span>
              <span className="pp-dc-val pp-mono">{profile.empId}</span>
            </div>
            <div className="pp-detail-cell">
              <span className="pp-dc-label">Designation</span>
              <span className="pp-dc-val">{profile.designation}</span>
            </div>
            <div className="pp-detail-cell">
              <span className="pp-dc-label">Mobile</span>
              <span className="pp-dc-val pp-mono">
                {profile.mobile || <span className="pp-na">—</span>}
              </span>
            </div>
            <div className="pp-detail-cell">
              <span className="pp-dc-label">Email</span>
              <span className="pp-dc-val pp-mono">
                {profile.email
                  ? <a href={`mailto:${profile.email}`} className="pp-email-link">{profile.email}</a>
                  : <span className="pp-na">—</span>}
              </span>
            </div>
          </div>
        </section>

        {/* ── Course Preferences ─────────────────────── */}
        <section className="pp-section">
          <h2 className="pp-sec-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Course Preferences
            {mySubmission
              ? <span className="pp-badge pp-badge-green">Submitted</span>
              : <span className="pp-badge pp-badge-gray">Not Submitted</span>}
          </h2>

          {mySubmission ? (
            <>
              <p className="pp-sub-meta">
                Submitted on <strong>{new Date(mySubmission.submittedAt).toLocaleString()}</strong>
              </p>
              <div className="pp-pref-list">
                {(mySubmission.prefs ?? mySubmission.preferences ?? []).map((pid, idx) => {
                  const c = getCourseById(pid);
                  if (!c) return null;
                  return (
                    <div className="pp-pref-card" key={pid}>
                      <div className="pp-pref-rank">P{idx + 1}</div>
                      <div className="pp-pref-info">
                        <span className="pp-pref-code">{c.subjectCode}</span>
                        <span className="pp-pref-name">{c.subjectName}</span>
                        <span className="pp-pref-prog">{c.program} · {c.courseType}</span>
                      </div>
                      <div className="pp-pref-ltpc">
                        <span style={{ '--ltpc-c': '#818cf8' }}>L{c.L}</span>
                        <span style={{ '--ltpc-c': '#fb923c' }}>T{c.T}</span>
                        <span style={{ '--ltpc-c': '#34d399' }}>P{c.P}</span>
                        <span style={{ '--ltpc-c': '#f472b6' }}>C{c.C}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="pp-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>No course preferences submitted yet.</p>
            </div>
          )}
        </section>

        {/* ── Workload Assignments ────────────────────── */}
        <section className="pp-section">
          <h2 className="pp-sec-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Assigned Workloads
            <span className="pp-badge" style={{ background: '#f97316' }}>{myWorkloads.length}</span>
          </h2>

          {myWorkloads.length > 0 ? (
            <div className="pp-wl-table-wrap">
              <table className="pp-wl-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Year</th>
                    <th>Sec</th>
                    <th>L</th>
                    <th>T</th>
                    <th>P</th>
                    <th>C</th>
                  </tr>
                </thead>
                <tbody>
                  {myWorkloads.map((w, i) => (
                    <tr key={w.id}>
                      <td>{i + 1}</td>
                      <td className="pp-mono">{w.subjectCode}</td>
                      <td>{w.subjectName}</td>
                      <td><span className="pp-year-pill">{w.year}</span></td>
                      <td><span className="pp-sec-pill">{w.section}</span></td>
                      <td className="pp-td-l">{w.manualL}</td>
                      <td className="pp-td-t">{w.manualT}</td>
                      <td className="pp-td-p">{w.manualP}</td>
                      <td className="pp-td-c">{w.C}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="pp-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
              <p>No workload assignments yet.</p>
            </div>
          )}
        </section>

        {/* ── Change Password ─────────────────────────── */}
        <section className="pp-section">
          <h2 className="pp-sec-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Change Password
          </h2>
          
          {pwMsg.text && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '6px',
              background: pwMsg.ok ? '#dcfce7' : '#fee2e2',
              color: pwMsg.ok ? '#166534' : '#991b1b',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{pwMsg.ok ? '✓' : '⚠'}</span>
              {pwMsg.text}
            </div>
          )}

          <div className="pp-detail-grid" style={{ maxWidth: 480 }}>
            <div className="pp-fg cp-fg-full">
              <label className="pp-dc-label">Current Password</label>
              <input
                type="password"
                className="cp-input"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                autoComplete="current-password"
                placeholder="Enter your current password"
                disabled={pwSaving}
              />
            </div>
            <div className="pp-fg cp-fg-full">
              <label className="pp-dc-label">New Password</label>
              <input
                type="password"
                className="cp-input"
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
                placeholder="Enter a new password (min 8 characters)"
                disabled={pwSaving}
              />
              <span style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Must be at least 8 characters
              </span>
            </div>
            <div className="pp-fg cp-fg-full">
              <label className="pp-dc-label">Confirm New Password</label>
              <input
                type="password"
                className="cp-input"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                disabled={pwSaving}
              />
              {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <span style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  Passwords do not match
                </span>
              )}
              {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword === pwForm.confirmPassword && (
                <span style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                  ✓ Passwords match
                </span>
              )}
            </div>
          </div>
          
          <button
            className="cp-btn cp-btn-save"
            style={{ marginTop: 16 }}
            disabled={pwSaving || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwForm.newPassword !== pwForm.confirmPassword || pwForm.newPassword.length < 8}
            onClick={async () => {
              setPwMsg({ text: '', ok: false });
              
              if (!pwForm.currentPassword || !pwForm.newPassword) {
                setPwMsg({ text: 'Please fill in all password fields.', ok: false });
                return;
              }
              if (pwForm.newPassword !== pwForm.confirmPassword) {
                setPwMsg({ text: 'New passwords do not match.', ok: false });
                return;
              }
              if (pwForm.newPassword.length < 8) {
                setPwMsg({ text: 'New password must be at least 8 characters.', ok: false });
                return;
              }
              if (pwForm.newPassword === pwForm.currentPassword) {
                setPwMsg({ text: 'New password must be different from current password.', ok: false });
                return;
              }

              setPwSaving(true);
              try {
                console.log('Sending password change request...');
                const res = await fetch(`${API}/deva/auth/change-password`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', ...authHeaders() },
                  body: JSON.stringify({ 
                    currentPassword: pwForm.currentPassword, 
                    newPassword: pwForm.newPassword 
                  }),
                });

                const data = await res.json();
                console.log('Password change response:', { status: res.status, data });

                if (!res.ok || !data.success) {
                  setPwMsg({ text: data.message || 'Failed to change password. Please check your current password and try again.', ok: false });
                } else {
                  setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPwMsg({ text: 'Password changed successfully! You can now log in with your new password.', ok: true });
                  
                  // Clear message after 3 seconds
                  setTimeout(() => {
                    setPwMsg({ text: '', ok: false });
                  }, 3000);
                }
              } catch (err) {
                console.error('Password change error:', err);
                setPwMsg({ text: 'Network error: ' + (err.message || 'Please try again.'), ok: false });
              } finally {
                setPwSaving(false);
              }
            }}
          >
            {pwSaving ? 'Changing Password…' : 'Change Password'}
          </button>
        </section>

        {/* ── Logout ──────────────────────────────────── */}
        <section className="pp-section">
          <h2 className="pp-sec-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Session Management
          </h2>
          <p style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
            Logging out will end your current session. You'll need to log in again to access your account.
            Remember: Only one active login session is allowed per user account.
          </p>
          <button
            className="cp-btn"
            style={{ 
              marginTop: 12,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#b91c1c'}
            onMouseOut={(e) => e.target.style.background = '#dc2626'}
            onClick={async () => {
              try {
                console.log('Logging out...');
                // Call logout endpoint to clear session
                await fetch(`${API}/deva/auth/logout`, {
                  method: 'POST',
                  headers: authHeaders(),
                });
              } catch (err) {
                console.error('Logout error:', err);
              } finally {
                // Clear local storage and redirect to login
                if (onLogout) {
                  onLogout();
                }
              }
            }}
          >
            Logout
          </button>
        </section>

      </div>

      {/* ── Edit Profile Modal ──────────────────────── */}
      {editMode && (
        <div className="pp-modal-overlay" onClick={closeEditMode}>
          <div className="pp-modal" onClick={e => e.stopPropagation()}>
            <div className="pp-modal-header">
              <h3>Edit Profile</h3>
              <button className="pp-modal-close" onClick={closeEditMode}>✕</button>
            </div>

            <div className="pp-modal-body">
              <div style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#1e40af',
                fontSize: '13px',
                borderLeft: '4px solid #3b82f6',
              }}>
                ℹ️ <strong>Editable fields:</strong> Email and Mobile Number only<br/>
                Name and Designation are fixed in the system and cannot be changed.
              </div>

              {editMsg.text && (
                <div style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: editMsg.ok ? '#dcfce7' : '#fee2e2',
                  color: editMsg.ok ? '#166534' : '#991b1b',
                  fontSize: '13px',
                  fontWeight: 500,
                }}>
                  {editMsg.text}
                </div>
              )}

              <div className="pp-edit-form">
                <div className="pp-form-group" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '12px' }}>
                  <label className="pp-dc-label" style={{ color: '#666', fontSize: '13px' }}>Full Name (Read-only)</label>
                  <div className="pp-input" style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}>
                    {profile.name}
                  </div>
                </div>

                <div className="pp-form-group" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '12px' }}>
                  <label className="pp-dc-label" style={{ color: '#666', fontSize: '13px' }}>Designation (Read-only)</label>
                  <div className="pp-input" style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}>
                    {profile.designation}
                  </div>
                </div>

                <div className="pp-form-group">
                  <label className="pp-dc-label">Mobile Number</label>
                  <input
                    type="tel"
                    className="pp-input"
                    value={editForm.mobile}
                    onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))}
                    placeholder="Enter your mobile number"
                    maxLength="15"
                  />
                </div>

                <div className="pp-form-group">
                  <label className="pp-dc-label">Email Address</label>
                  <input
                    type="email"
                    className="pp-input"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Enter your email address"
                  />
                </div>
              </div>
            </div>

            <div className="pp-modal-footer">
              <button
                className="pp-btn-cancel"
                onClick={closeEditMode}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                className="pp-btn-save"
                onClick={saveProfileChanges}
                disabled={editSaving}
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ProfilePage;

