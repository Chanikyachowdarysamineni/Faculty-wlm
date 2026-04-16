import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import Toast from './Toast';
import './CapacityManagementPage.css';

const CapacityManagementPage = () => {
  const { currentUser } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('empName'); // empName, empId, designation, currentCapacity, assigned

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ empId: '', capacityHours: '' });
  const [errors, setErrors] = useState({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  const authHeader = () => authJsonHeaders();
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Fetch all faculties
  const fetchFaculties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPages('/deva/faculty', {}, { headers: authHeader() });
      if (data.success) setFaculties(data.data || []);
    } catch (err) {
      console.error('Error fetching faculties:', err);
      showToast('⚠ Failed to load faculties.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all workloads to get capacity info
  const fetchWorkloads = useCallback(async () => {
    try {
      const data = await fetchAllPages('/deva/workloads', {}, { headers: authHeader() });
      if (data.success) setWorkloads(data.data || []);
    } catch (err) {
      console.error('Error fetching workloads:', err);
    }
  }, []);

  useEffect(() => {
    fetchFaculties();
    fetchWorkloads();
  }, [fetchFaculties, fetchWorkloads]);

  // Calculate capacity summary per faculty
  const capacitySummary = useMemo(() => {
    const map = {};
    workloads.forEach((w) => {
      if (!map[w.empId]) {
        const fac = faculties.find(f => f.empId === w.empId);
        map[w.empId] = {
          empId: w.empId,
          empName: w.empName || '',
          designation: w.designation || '',
          department: w.department || '',
          capacityHours: Number(w.capacityHours) || 0,
          assignedHours: 0,
          workloadCount: 0,
        };
      }
      map[w.empId].assignedHours += Number(w.manualL || 0) + Number(w.manualT || 0) + Number(w.manualP || 0);
      map[w.empId].workloadCount += 1;
    });
    return map;
  }, [workloads, faculties]);

  // Filter and sort
  const filtered = useMemo(() => {
    let list = Object.values(capacitySummary);
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(f =>
        f.empId.toLowerCase().includes(q) ||
        f.empName.toLowerCase().includes(q) ||
        f.designation.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'empName') return a.empName.localeCompare(b.empName);
      if (sortBy === 'empId') return a.empId.localeCompare(b.empId);
      if (sortBy === 'designation') return a.designation.localeCompare(b.designation);
      if (sortBy === 'currentCapacity') return (b.capacityHours || 0) - (a.capacityHours || 0);
      if (sortBy === 'assigned') return (b.assignedHours || 0) - (a.assignedHours || 0);
      return 0;
    });
    return list;
  }, [capacitySummary, search, sortBy]);

  // Open add form
  const openAdd = () => {
    setForm({ empId: '', capacityHours: '' });
    setEditTarget(null);
    setErrors({});
    setShowForm(true);
  };

  // Open edit form
  const openEdit = (cap) => {
    setForm({ empId: cap.empId, capacityHours: String(cap.capacityHours || '') });
    setEditTarget(cap.empId);
    setErrors({});
    setShowForm(true);
  };

  // Validate form
  const validate = () => {
    const e = {};
    if (!form.empId) e.empId = 'Select faculty.';
    if (!form.capacityHours || Number(form.capacityHours) <= 0) {
      e.capacityHours = 'Capacity hours must be greater than 0.';
    }
    return e;
  };

  // Save (create or update)
  const saveCapacity = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/deva/workloads/faculty/${form.empId}/capacity`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacityHours: Number(form.capacityHours) }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(`⚠ ${data.message || (editTarget ? 'Update failed.' : 'Setup failed.')}`);
        return;
      }
      showToast(editTarget ? '✓ Capacity updated successfully!' : '✓ Capacity assigned successfully!');
      await fetchWorkloads();
      setShowForm(false);
    } catch (err) {
      console.error('Error saving capacity:', err);
      showToast('⚠ Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete capacity (reset to 0)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/deva/workloads/faculty/${deleteTarget.empId}/capacity`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacityHours: 0 }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(`⚠ ${data.message || 'Delete failed.'}`);
        return;
      }
      await fetchWorkloads();
      showToast('✓ Capacity removed.');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting capacity:', err);
      showToast('⚠ Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return <div className="cp-error">Access denied. Admin only.</div>;
  }

  return (
    <div className="cp-container">
      <Toast message={toast} />

      {/* Header */}
      <div className="cp-header">
        <h1>📚 Faculty Capacity Management</h1>
        <p className="cp-subtitle">Set, update, and manage workload capacity hours for all faculty members</p>
      </div>

      {/* Toolbar */}
      <div className="cp-toolbar">
        <input
          type="text"
          placeholder="Search by name, ID, or designation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="cp-search"
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="cp-sort">
          <option value="empName">Sort by Name</option>
          <option value="empId">Sort by ID</option>
          <option value="designation">Sort by Designation</option>
          <option value="currentCapacity">Sort by Capacity (High→Low)</option>
          <option value="assigned">Sort by Assigned Hours (High→Low)</option>
        </select>
        <button className="cp-btn cp-btn-add" onClick={openAdd}>
          ➕ Add Capacity
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="cp-loading">Loading faculties...</div>
      ) : filtered.length === 0 ? (
        <div className="cp-empty">No faculties found.</div>
      ) : (
        /* Table */
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Employee ID</th>
                <th>Faculty Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th className="cp-th-num">Capacity (hrs)</th>
                <th className="cp-th-num">Assigned (hrs)</th>
                <th className="cp-th-num">Workloads</th>
                <th className="cp-th-num">Remaining</th>
                <th className="cp-th-status">Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cap, i) => {
                const remaining = cap.capacityHours - cap.assignedHours;
                const isOverloaded = cap.assignedHours > cap.capacityHours;
                const statusColor = !cap.capacityHours ? '#999' : isOverloaded ? '#dc2626' : '#16a34a';
                const statusText = !cap.capacityHours ? '—' : isOverloaded ? '⚠ OVERLOAD' : '✓ Normal';

                return (
                  <tr key={cap.empId} style={{ background: isOverloaded ? '#fee2e2' : undefined }}>
                    <td className="cp-td-sl">{i + 1}</td>
                    <td className="cp-td-id">{cap.empId}</td>
                    <td className="cp-td-name">{cap.empName}</td>
                    <td className="cp-td-designation">{cap.designation}</td>
                    <td className="cp-td-dept">{cap.department}</td>
                    <td className="cp-td-num">{cap.capacityHours || '—'}</td>
                    <td className="cp-td-num" style={{ fontWeight: isOverloaded ? 600 : 400 }}>
                      {cap.assignedHours}
                    </td>
                    <td className="cp-td-num">{cap.workloadCount}</td>
                    <td className="cp-td-num" style={{ color: statusColor, fontWeight: 600 }}>
                      {cap.capacityHours ? remaining : '—'}
                    </td>
                    <td className="cp-td-status" style={{ color: statusColor }}>
                      {statusText}
                    </td>
                    <td className="cp-actions">
                      <button
                        className="cp-action cp-edit-btn"
                        onClick={() => openEdit(cap)}
                        title="Edit capacity"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="cp-action cp-del-btn"
                        onClick={() => setDeleteTarget(cap)}
                        title="Remove capacity"
                        disabled={!cap.capacityHours}
                      >
                        🗑️ Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="cp-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2>{editTarget ? '✏️ Edit Capacity' : '➕ Add Capacity'}</h2>
              <button className="cp-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="cp-modal-body">
              <div className="cp-form-group">
                <label>Faculty Member *</label>
                <select
                  value={form.empId}
                  onChange={e => setForm(p => ({ ...p, empId: e.target.value }))}
                  disabled={!!editTarget}
                  className="cp-input"
                >
                  <option value="">-- Select Faculty --</option>
                  {faculties.map(f => (
                    <option key={f.empId} value={f.empId}>
                      {f.empId} - {f.name} ({f.designation})
                    </option>
                  ))}
                </select>
                {errors.empId && <span className="cp-error-text">{errors.empId}</span>}
              </div>

              <div className="cp-form-group">
                <label>Capacity Hours (per week) *</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={form.capacityHours}
                  onChange={e => setForm(p => ({ ...p, capacityHours: e.target.value }))}
                  placeholder="e.g., 16, 18, 20"
                  className="cp-input"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Typical values: Associate Prof (14h), Assistant Prof (16h), Contract/CAP (18h)
                </small>
                {errors.capacityHours && <span className="cp-error-text">{errors.capacityHours}</span>}
              </div>

              {editTarget && (
                <div className="cp-info-box">
                  <p>
                    <strong>Current Status:</strong><br />
                    {(() => {
                      const current = capacitySummary[editTarget];
                      if (!current) return 'No data';
                      const remaining = current.capacityHours - current.assignedHours;
                      return `Assigned: ${current.assignedHours}h / Capacity: ${current.capacityHours}h / Remaining: ${remaining}h`;
                    })()}
                  </p>
                </div>
              )}
            </div>

            <div className="cp-modal-footer">
              <button className="cp-btn cp-btn-cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="cp-btn cp-btn-save" onClick={saveCapacity} disabled={saving}>
                {saving ? 'Saving...' : editTarget ? 'Update Capacity' : 'Add Capacity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="cp-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h2>🗑️ Remove Capacity</h2>
              <button className="cp-modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="cp-modal-body">
              <p>
                Remove capacity hours for <strong>{deleteTarget.empName}</strong> ({deleteTarget.empId})?
                <br />
                All {deleteTarget.workloadCount} workload(s) will have unlimited capacity.
              </p>
            </div>
            <div className="cp-modal-footer">
              <button className="cp-btn cp-btn-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="cp-btn cp-btn-danger" onClick={confirmDelete} disabled={saving}>
                {saving ? 'Removing...' : 'Remove Capacity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapacityManagementPage;
