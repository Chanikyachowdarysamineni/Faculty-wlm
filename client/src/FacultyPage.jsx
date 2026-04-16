import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';
import './FacultyPage.css';

const EMPTY_FORM = { empId: '', name: '', designation: '', mobile: '', email: '' };

// Designation options extracted from faculty data
const DESIGNATION_OPTIONS = [
  'Professor & Dean, SOCI',
  'Professor & HOD',
  'Associate Professor',
  'Assistant Professor',
  'Assistant Professor (Contract)',
  'CAP',
  'Teaching Associate',
  'Teaching Instructor',
];

const FacultyPage = ({ isAdmin = false }) => {
  const { faculty: contextFaculty, setFaculty } = useSharedData();
  
  const [list, setList]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, obj = edit
  const [form, setForm]           = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast]         = useState('');
  const [isDragMode,  setIsDragMode]  = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);
  const [syncing, setSyncing]     = useState(false);

  // Helper: Deduplicate faculty records by empId, keeping most recent
  const deduplicateList = useCallback((data) => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const seen = new Map();
    data.forEach(f => {
      const key = String(f.empId).trim();
      if (!seen.has(key) || (f.updatedAt && (!seen.get(key).updatedAt || new Date(f.updatedAt) > new Date(seen.get(key).updatedAt)))) {
        seen.set(key, f);
      }
    });
    return Array.from(seen.values());
  }, []);

  // Helper: Build auth headers
  const authHeaders = useCallback(() => ({
    ...authJsonHeaders(),
  }), []);

  // Helper: Refetch fresh faculty data from server
  const refetchFaculty = useCallback(async () => {
    try {
      setSyncing(true);
      const response = await fetchAllPages('/deva/faculty', {}, { headers: authHeaders() });
      if (response?.success && Array.isArray(response.data)) {
        const deduplicated = deduplicateList(response.data);
        setList(deduplicated);
        setFaculty(deduplicated);
        console.log('[FacultyPage] Fresh data fetched from server - ' + deduplicated.length + ' unique records');
      } else {
        console.warn('[FacultyPage] Refetch returned invalid data:', response);
      }
    } catch (err) {
      console.error('[FacultyPage] Error refetching faculty data:', err);
    } finally {
      setSyncing(false);
    }
  }, [authHeaders, deduplicateList, setFaculty]);

  // Sync shared context data to local state and deduplicate
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      const deduplicated = deduplicateList(contextFaculty);
      setList(deduplicated);
      setLoading(false);
    }
  }, [contextFaculty, deduplicateList]);

  // ── Drag-and-drop reorder ──────────────────────────────
  const handleDragStart = (e, idx) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIdx.current !== idx) setDragOverIdx(idx);
  };

  const handleDrop = async (e, idx) => {
    e.preventDefault();
    const src = dragSrcIdx.current;
    if (src === null || src === idx) { setDragOverIdx(null); return; }
    const updated = [...list];
    const [moved] = updated.splice(src, 1);
    updated.splice(idx, 0, moved);
    const reordered = updated.map((f, i) => ({ ...f, slNo: i + 1 }));
    setList(reordered);
    setFaculty(reordered);
    setDragOverIdx(null);
    dragSrcIdx.current = null;

    try {
      await Promise.all(
        reordered.map((f) =>
          fetch(`${API}/deva/faculty/${encodeURIComponent(f.empId)}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ slNo: f.slNo }),
          })
        )
      );
      showToast('Order saved successfully.');
    } catch {
      showToast('Order updated locally but could not save to server.');
    }
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  };

  const toggleDragMode = () => {
    setIsDragMode(prev => {
      if (!prev) setSearch(''); // clear search so full list is shown
      return !prev;
    });
    setDragOverIdx(null);
  };

  // ── Search filter ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.empId.toLowerCase().includes(q)
    );
  }, [list, search]);

  // ── Toast helper ───────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── Open Add modal ─────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  // ── Open Edit modal ────────────────────────────────────
  const openEdit = (f) => {
    setEditTarget(f);
    setForm({ ...f });
    setShowModal(true);
  };

  // ── Save (Add / Edit) ──────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.empId.trim() || !form.name.trim()) return;
    const payload = {
      empId: form.empId.trim(),
      name: form.name.trim(),
      designation: form.designation.trim(),
      mobile: form.mobile || '',
      email: form.email || '',
      department: form.department || 'CSE',
    };
    try {
      setSyncing(true);
      console.log('[FacultyPage] Saving faculty:', { isEdit: !!editTarget, payload });
      const res = await fetch(
        editTarget ? `${API}/deva/faculty/${encodeURIComponent(editTarget.empId)}` : `${API}/deva/faculty`,
        {
          method: editTarget ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      console.log('[FacultyPage] Response:', { status: res.status, ok: res.ok, success: data?.success, message: data?.message, receivedData: !!data?.data });
      if (!res.ok || !data?.success) {
        console.error('[FacultyPage] Save failed:', { status: res.status, message: data?.message });
        showToast(data?.message || 'Could not save faculty record.');
        return;
      }
      const serverFaculty = data?.data;
      if (!serverFaculty || !serverFaculty.empId) {
        console.error('[FacultyPage] Invalid response data:', serverFaculty);
        showToast('Server returned invalid faculty data.');
        return;
      }
      // After successful save, refetch all data to ensure consistency
      await refetchFaculty();
      showToast(editTarget ? 'Faculty updated successfully.' : 'Faculty added successfully.');
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditTarget(null);
    } catch (err) {
      console.error('[FacultyPage] Error saving faculty:', err.message, err);
      showToast('Network error while saving faculty record.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      setSyncing(true);
      console.log('[FacultyPage] Deleting faculty:', { empId: deleteConfirm.empId });
      const res = await fetch(`${API}/deva/faculty/${encodeURIComponent(deleteConfirm.empId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      console.log('[FacultyPage] Delete response:', { status: res.status, ok: res.ok, success: data?.success, message: data?.message });
      if (!res.ok || !data?.success) {
        console.error('[FacultyPage] Delete failed:', { status: res.status, message: data?.message });
        showToast(data?.message || 'Could not delete faculty record.');
        return;
      }
      // After successful delete, refetch all data to ensure consistency
      await refetchFaculty();
      setDeleteConfirm(null);
      showToast('Faculty record deleted successfully.');
    } catch (err) {
      console.error('[FacultyPage] Error deleting faculty:', err.message, err);
      showToast('Network error while deleting faculty record.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Sl.No', 'Employee ID', 'Name of the Faculty', 'Designation', 'Mobile No', 'Email'];
    const rows = list.map(f => [f.slNo, f.empId, `"${f.name}"`, `"${f.designation}"`, f.mobile, f.email]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'faculty_list.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as faculty_list.csv');
  };

  if (loading) {
    return <div className="fp-wrapper"><div className="fp-empty">Loading faculty list…</div></div>;
  }

  return (
    <div className="fp-wrapper">

      {/* ── Header bar ── */}
      <div className="fp-topbar">
        <div className="fp-topbar-left">
          <h2 className="fp-heading">Faculty List</h2>
          <span className="fp-count-badge">{list.length} Members</span>
        </div>
        <div className="fp-topbar-right">
          {/* Search */}
          <div className="fp-search-wrap">
            <svg className="fp-search-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="fp-search"
              placeholder={isDragMode ? 'Search disabled in reorder mode' : 'Search by name or employee ID…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={isDragMode}
              style={isDragMode ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            />
            {search && (
              <button className="fp-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {/* Reorder toggle */}
          <button
            className={`fp-btn ${isDragMode ? 'fp-btn-drag-done' : 'fp-btn-reorder'}`}
            onClick={toggleDragMode}
            title={isDragMode ? 'Exit reorder mode' : 'Drag rows to reorder faculty positions'}
          >
            {isDragMode ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Done Reordering
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Reorder
              </>
            )}
          </button>

          {/* Download */}
          {isAdmin && (
            <button className="fp-btn fp-btn-export" onClick={exportCSV}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
          )}

          {/* Add Faculty */}
          <button className="fp-btn fp-btn-add" onClick={openAdd}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Faculty
          </button>
        </div>
      </div>

      {/* ── Drag mode banner ── */}
      {isDragMode && (
        <div className="fp-drag-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
          </svg>
          Drag mode active — grab the <strong>⠿</strong> handle on any row and drop it to reorder. Click <strong>Done Reordering</strong> when finished.
        </div>
      )}

      {/* ── Search result count ── */}
      {search && !isDragMode && (
        <p className="fp-result-info">
          Showing <strong>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''} for &quot;{search}&quot;
        </p>
      )}

      {/* ── Table ── */}
      <div className="fp-table-wrap">
        <table className="fp-table">
          <thead>
            <tr>
              {isDragMode && <th className="fp-th-grip" title="Drag to reorder">⠿</th>}
              <th>Emp ID</th>
              <th>Name of the Faculty</th>
              <th>Designation</th>
              <th>Mobile No</th>
              <th>Email</th>
              {!isDragMode && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(isDragMode ? list : filtered).length === 0 ? (
              <tr><td colSpan={isDragMode ? 7 : 7} className="fp-empty">No records found.</td></tr>
            ) : (
              (isDragMode ? list : filtered).map((f, i) => (
                <tr
                  key={f.empId}
                  className={[
                    i % 2 === 0 ? 'fp-row-even' : 'fp-row-odd',
                    isDragMode ? 'fp-row-draggable' : '',
                    isDragMode && dragOverIdx === i ? 'fp-row-dragover' : '',
                  ].filter(Boolean).join(' ')}
                  draggable={isDragMode}
                  onDragStart={isDragMode ? e => handleDragStart(e, i) : undefined}
                  onDragOver={isDragMode ? e => handleDragOver(e, i) : undefined}
                  onDrop={isDragMode ? e => handleDrop(e, i) : undefined}
                  onDragEnd={isDragMode ? handleDragEnd : undefined}
                >
                  {isDragMode && (
                    <td className="fp-td-grip">
                      <span className="fp-grip-icon" title="Drag to reorder">⠿</span>
                    </td>
                  )}
                  <td className="fp-td-empid">{f.empId}</td>
                  <td className="fp-td-name">{f.name}</td>
                  <td>
                    <span className={`fp-desig-badge ${getDesigClass(f.designation)}`}>
                      {f.designation}
                    </span>
                  </td>
                  <td>{f.mobile}</td>
                  <td className="fp-td-email">{f.email || '—'}</td>
                  {!isDragMode && (
                    <td className="fp-td-actions">
                      <button className="fp-action-btn fp-edit" onClick={() => openEdit(f)} title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </button>
                      <button className="fp-action-btn fp-delete" onClick={() => setDeleteConfirm(f)} title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fp-overlay" onClick={() => setShowModal(false)}>
          <div className="fp-modal" onClick={e => e.stopPropagation()}>
            <div className="fp-modal-header">
              <h3>{editTarget ? 'Edit Faculty' : 'Add Faculty'}</h3>
              <button className="fp-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="fp-modal-form" onSubmit={handleSave}>
              <div className="fp-form-grid">
                <div className="fp-form-group">
                  <label>Employee ID *</label>
                  <input value={form.empId} onChange={e => setForm({...form, empId: e.target.value})}
                    placeholder="e.g. 1234" required disabled={!isAdmin && !!editTarget} />
                </div>
                <div className="fp-form-group fp-form-full">
                  <label>Name of Faculty *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Dr. John Smith" required />
                </div>
                <div className="fp-form-group fp-form-full">
                  <label>Designation *</label>
                  <select value={form.designation} onChange={e => setForm({...form, designation: e.target.value})}
                    required>
                    <option value="">Select Designation</option>
                    {DESIGNATION_OPTIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="fp-form-group">
                  <label>Mobile No</label>
                  <input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})}
                    placeholder="e.g. 9876543210" />
                </div>
                <div className="fp-form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="e.g. john@example.com" />
                </div>
              </div>
              <div className="fp-modal-actions">
                <button type="button" className="fp-btn fp-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="fp-btn fp-btn-add">{editTarget ? 'Update' : 'Add Faculty'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="fp-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="fp-modal fp-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="fp-modal-header">
              <h3>Confirm Delete</h3>
              <button className="fp-modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p className="fp-confirm-text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong> (ID: {deleteConfirm.empId})?
            </p>
            <div className="fp-modal-actions">
              <button className="fp-btn fp-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="fp-btn fp-btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="fp-toast">{toast}</div>}
    </div>
  );
};

// designation → color class helper
const getDesigClass = (d = '') => {
  const dl = d.toLowerCase();
  if (dl.includes('professor & dean') || dl.includes('hod')) return 'fp-desig-dean';
  if (dl.includes('assoc'))          return 'fp-desig-assoc';
  if (dl.includes('sr.'))            return 'fp-desig-senior';
  if (dl.includes('senior level'))   return 'fp-desig-senior';
  if (dl.includes('entry level'))    return 'fp-desig-entry';
  if (dl.includes('contract'))       return 'fp-desig-contract';
  if (dl.includes('cap') || dl === 'cap') return 'fp-desig-cap';
  if (dl.includes('ta') || dl === 'ta')   return 'fp-desig-ta';
  if (dl.includes('teaching'))       return 'fp-desig-ta';
  if (dl.includes('internal'))       return 'fp-desig-cap';
  return 'fp-desig-default';
};

export default FacultyPage;

