import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import './MyWorkloadPage.css';

const authHeader = () => ({
  ...authJsonHeaders(),
});

const getWorkloadTarget = (designation = '') => {
  const d = designation.toLowerCase();
  if (d.includes('dean') || d.includes('hod')) return 14;
  if (d.includes('professor') && !d.includes('asst') && !d.includes('assoc') && !d.includes('assistant')) return 14;
  if (d.includes('assoc')) return 16;
  if (d.includes('sr. asst') || d.includes('senior level')) return 16;
  if (d.includes('contract') || d === 'cap' || d.includes('internal cap') || d === 'ta' || d.includes('teaching instructor')) return 18;
  return 16;
};

const TYPE_COLOR = { L: '#6b74e8', T: '#16a34a', P: '#f59e0b' };
const TYPE_BG    = { L: '#eef0fd', T: '#dcfce7', P: '#fef9c3' };
const YEAR_COLOR = { I: '#6b74e8', II: '#22c55e', III: '#f59e0b', IV: '#ec4899', 'M.Tech': '#06b6d4' };
const AUTO_REFRESH_MS = 60000;

const MyWorkloadPage = ({ currentUser }) => {
  const [workloads, setWorkloads] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');
  const [apiError,  setApiError]  = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  const fetchWorkloads = useCallback(async ({ withLoader = true } = {}) => {
    if (withLoader) setLoading(true);
    setApiError('');
    try {
      const params = currentUser?.id ? { empId: String(currentUser.id) } : {};
      const data = await fetchAllPages('/deva/workloads', params, { headers: authHeader() });
      if (!data.success) {
        const msg = data.message || 'Failed to load workloads.';
        setApiError(msg);
        showToast(msg);
        return;
      }
      // Backend filters visibility for faculty users, but frontend also filters as safety check
      const visibleWorkloads = (data.data || []).filter(w => w.isVisible !== false);
      setWorkloads(visibleWorkloads);
      setLastSyncedAt(new Date());
    } catch {
      const msg = 'Network error. Could not load workloads.';
      setApiError(msg);
      showToast(msg);
    } finally {
      if (withLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchWorkloads({ withLoader: true }); }, [fetchWorkloads]);

  useEffect(() => {
    const id = setInterval(() => { fetchWorkloads({ withLoader: false }); }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchWorkloads]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) fetchWorkloads({ withLoader: false });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchWorkloads]);

  // ── Derived summary ────────────────────────────
  const totalL = workloads.reduce((s, w) => s + (w.manualL ?? w.fixedL ?? 0), 0);
  const totalT = workloads.reduce((s, w) => s + (w.manualT ?? w.fixedT ?? 0), 0);
  const totalP = workloads.reduce((s, w) => s + (w.manualP ?? w.fixedP ?? 0), 0);
  const totalHrs = totalL + totalT + totalP;
  const designation = workloads[0]?.designation || '';
  const target = getWorkloadTarget(designation);
  const pct = target ? Math.min(100, Math.round((totalHrs / target) * 100)) : 0;

  const grouped = workloads.reduce((acc, w) => {
    const key = w.year || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {});

  const yearOrder = ['I', 'II', 'III', 'IV', 'M.Tech', 'Other'];
  const sortedYears = Object.keys(grouped).sort(
    (a, b) => yearOrder.indexOf(a) - yearOrder.indexOf(b)
  );

  return (
    <div className="mwl-wrapper">

      {/* ── Header ── */}
      <div className="mwl-header">
        <div>
          <h2 className="mwl-title">My Assigned Workload</h2>
          <p className="mwl-subtitle">
            {currentUser?.name || 'Faculty'} &nbsp;·&nbsp; ID: {currentUser?.id}
          </p>
          <p className="mwl-sync-meta">Last synced: {formatSyncedAt(lastSyncedAt)}</p>
        </div>
        <button className="mwl-refresh-btn" onClick={() => fetchWorkloads({ withLoader: true })} title="Refresh">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Retry Sync
        </button>
      </div>

      {loading && (
        <div className="mwl-sync-meta" style={{ marginBottom: 10 }}>
          Syncing latest workload data...
        </div>
      )}

      {apiError && (
        <div className="mwl-error-banner">
          <span>⚠️ {apiError}</span>
          <button className="mwl-error-retry" onClick={() => fetchWorkloads({ withLoader: true })}>Retry</button>
        </div>
      )}

      {workloads.length === 0 ? (
        <div className="mwl-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <p>No workload has been assigned to you yet.</p>
          <span>Check back after the admin assigns courses.</span>
        </div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className="mwl-summary">
            <div className="mwl-sum-card">
              <span className="mwl-sum-val mwl-val-total">{workloads.length}</span>
              <span className="mwl-sum-label">Courses Assigned</span>
            </div>
            {[
              { key: 'L', label: 'Lecture Hrs',  val: totalL },
              { key: 'T', label: 'Tutorial Hrs', val: totalT },
              { key: 'P', label: 'Practical Hrs', val: totalP },
            ].map(({ key, label, val }) => (
              <div className="mwl-sum-card" key={key} style={{ borderTop: `3px solid ${TYPE_COLOR[key]}` }}>
                <span className="mwl-sum-val" style={{ color: TYPE_COLOR[key] }}>{val}</span>
                <span className="mwl-sum-label">{label}</span>
              </div>
            ))}
            <div className="mwl-sum-card mwl-sum-total-hrs">
              <span className="mwl-sum-val mwl-val-hrs">{totalHrs}</span>
              <span className="mwl-sum-label">Total Hrs / Week</span>
            </div>
          </div>

          {/* ── Workload target bar ── */}
          {designation && (
            <div className="mwl-target-bar-wrap">
              <div className="mwl-target-meta">
                <span className="mwl-target-label">
                  AICTE Workload Target ({designation})
                </span>
                <span className={`mwl-target-pct ${totalHrs >= target ? 'mwl-pct-ok' : 'mwl-pct-low'}`}>
                  {totalHrs} / {target} hrs &nbsp;({pct}%)
                </span>
              </div>
              <div className="mwl-target-bar-bg">
                <div
                  className={`mwl-target-bar-fill ${totalHrs >= target ? 'mwl-bar-ok' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Per-year groups ── */}
          {sortedYears.map(year => (
            <div key={year} className="mwl-year-group">
              <div className="mwl-year-heading">
                <span
                  className="mwl-year-badge"
                  style={{
                    background: `${(YEAR_COLOR[year] || '#64748b')}18`,
                    color: YEAR_COLOR[year] || '#64748b',
                    border: `1.5px solid ${YEAR_COLOR[year] || '#64748b'}40`,
                  }}
                >
                  {year === 'M.Tech' ? 'M.Tech' : `Year ${year}`}
                </span>
                <span className="mwl-year-count">{grouped[year].length} course{grouped[year].length !== 1 ? 's' : ''}</span>
              </div>

              <div className="mwl-table-wrap">
                <table className="mwl-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Subject Code</th>
                      <th>Subject Name</th>
                      <th>Program</th>
                      <th>Section</th>
                      <th>L</th>
                      <th>T</th>
                      <th>P</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[year].map((w, i) => {
                      const l = w.manualL ?? w.fixedL ?? 0;
                      const t = w.manualT ?? w.fixedT ?? 0;
                      const p = w.manualP ?? w.fixedP ?? 0;
                      return (
                        <tr key={w.id}>
                          <td className="mwl-td-idx">{i + 1}</td>
                          <td>
                            <span className="mwl-code-badge">{w.subjectCode}</span>
                          </td>
                          <td className="mwl-td-name">
                            <span className="mwl-subj-name">{w.subjectName}</span>
                            {w.shortName && (
                              <span className="mwl-short-name">{w.shortName}</span>
                            )}
                          </td>
                          <td>
                            <span className="mwl-prog-badge">{w.program}</span>
                          </td>
                          <td>
                            <span className="mwl-sec-badge">Sec {w.section}</span>
                          </td>
                          {[['L', l], ['T', t], ['P', p]].map(([type, hrs]) => (
                            <td key={type} className="mwl-td-hrs">
                              {hrs > 0
                                ? <span className="mwl-hrs-chip"
                                    style={{ background: TYPE_BG[type], color: TYPE_COLOR[type] }}>
                                    {hrs}
                                  </span>
                                : <span className="mwl-hrs-nil">—</span>}
                            </td>
                          ))}
                          <td>
                            <span className="mwl-total-chip">{l + t + p}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {toast && <div className="mwl-toast">{toast}</div>}
    </div>
  );
};

export default MyWorkloadPage;

