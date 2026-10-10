import React, { useState, useEffect } from 'react';
import API from './config';
import { useSharedData } from './DataContext';
import { useToast } from './Toast';
import { authJsonHeaders } from './utils/apiFetchAll';

const ManageCourseTypesModal = ({ onClose }) => {
  const { systemConfig, setSystemConfig } = useSharedData();
  const { showToast } = useToast();
  
  const [courseTypes, setCourseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTypeName, setNewTypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/deva/course-types`, { headers: authJsonHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setCourseTypes(data.data || []);
      } else {
        showToast({ type: 'error', message: data.message || 'Failed to fetch course types' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Error loading course types' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTypes(); }, []);

  const syncContext = (updatedTypes) => {
    if (systemConfig) {
      setSystemConfig({ ...systemConfig, courseTypes: updatedTypes.map(t => ({ value: t.name, label: t.label || t.name, isActive: t.isActive })) });
    }
  };

  const handleAdd = async () => {
    if (!newTypeName.trim()) {
      showToast({ type: 'warning', message: 'Please enter a course type name.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/deva/course-types`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ name: newTypeName.trim(), label: newTypeName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewTypeName('');
        await fetchTypes();
        showToast({ type: 'success', message: `Added "${newTypeName.trim()}" successfully` });
      } else {
        showToast({ type: 'error', message: data.message || 'Failed to add course type' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Network error while adding course type' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (ct) => {
    try {
      const res = await fetch(`${API}/deva/course-types/${encodeURIComponent(ct.id)}`, {
        method: 'PUT',
        headers: authJsonHeaders(),
        body: JSON.stringify({ isActive: !ct.isActive })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = courseTypes.map(t => t.id === ct.id ? { ...t, isActive: !ct.isActive } : t);
        setCourseTypes(updated);
        syncContext(updated);
        showToast({ type: 'success', message: `"${ct.name}" is now ${!ct.isActive ? 'active' : 'hidden'}` });
      } else {
        showToast({ type: 'error', message: data.message || 'Failed to update status' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Network error while updating status' });
    }
  };

  const startEdit = (ct) => { setEditingId(ct.id); setEditName(ct.name); };

  const saveEdit = async (ct) => {
    if (!editName.trim()) { showToast({ type: 'warning', message: 'Name cannot be empty.' }); return; }
    if (editName.trim() === ct.name) { setEditingId(null); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/deva/course-types/${encodeURIComponent(ct.id)}`, {
        method: 'PUT',
        headers: authJsonHeaders(),
        body: JSON.stringify({ name: editName.trim(), label: editName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingId(null);
        await fetchTypes();
        showToast({ type: 'success', message: `Renamed to "${editName.trim()}". All existing courses/workloads updated.` });
      } else {
        showToast({ type: 'error', message: data.message || 'Failed to rename course type' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Network error while renaming' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ct) => {
    if (ct.usageCount > 0) {
      showToast({ type: 'warning', message: `Cannot delete "${ct.name}" — used by ${ct.usageCount} course(s). Deactivate it instead.` });
      return;
    }
    setDeleteTarget(ct);
  };

  const confirmDelete = async () => {
    const ct = deleteTarget;
    setDeleteTarget(null);
    setSaving(true);
    try {
      const res = await fetch(`${API}/deva/course-types/${encodeURIComponent(ct.id)}`, {
        method: 'DELETE',
        headers: authJsonHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = courseTypes.filter(t => t.id !== ct.id);
        setCourseTypes(updated);
        syncContext(updated);
        showToast({ type: 'success', message: `"${ct.name}" deleted successfully` });
      } else {
        showToast({ type: 'error', message: data.message || 'Failed to delete course type' });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Network error while deleting' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="cp-modal" onClick={e => e.stopPropagation()} style={{ width: '620px', maxWidth: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="cp-modal-head">
          <h3>Manage Course Types</h3>
          <button className="cp-modal-x" onClick={onClose}>x</button>
        </div>
        
        <div className="cp-modal-body" style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9rem' }}
              placeholder="New course type name..."
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              disabled={saving}
            />
            <button className="cp-btn cp-btn-save" onClick={handleAdd} disabled={saving || !newTypeName.trim()}>
              {saving ? 'Saving...' : 'Add Type'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#888' }}>Loading course types...</div>
          ) : courseTypes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#888', border: '1px dashed #ccc', borderRadius: '6px' }}>
              No course types found. Add one above.
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="cp-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th>Name</th>
                    <th style={{ width: '72px', textAlign: 'center' }}>Usage</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courseTypes.map((ct, idx) => (
                    <tr key={ct.id}>
                      <td style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>{idx + 1}</td>
                      <td>
                        {editingId === ct.id ? (
                          <input 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEdit(ct)}
                            autoFocus
                            style={{ padding: '4px 8px', width: '100%', border: '1px solid #1a73e8', borderRadius: '4px' }}
                          />
                        ) : (
                          <span style={{ fontWeight: ct.isActive ? '500' : 'normal', color: ct.isActive ? 'inherit' : '#aaa', textDecoration: ct.isActive ? 'none' : 'line-through' }}>
                            {ct.name}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: ct.usageCount > 0 ? '#e8f5e9' : '#f5f5f5', color: ct.usageCount > 0 ? '#2e7d32' : '#777', padding: '2px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: ct.usageCount > 0 ? '600' : '400' }}>
                          {ct.usageCount}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleToggleActive(ct)}
                          disabled={saving}
                          style={{
                            border: 'none', background: ct.isActive ? '#e6f4ea' : '#fce8e6',
                            color: ct.isActive ? '#137333' : '#c5221f',
                            padding: '4px 10px', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '0.82rem', fontWeight: '600'
                          }}
                        >
                          {ct.isActive ? 'Active' : 'Hidden'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {editingId === ct.id ? (
                          <>
                            <button onClick={() => saveEdit(ct)} disabled={saving} style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '8px', fontWeight: '600' }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ color: '#666', border: 'none', background: 'none', cursor: 'pointer' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(ct)} disabled={saving} style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                            <button 
                              onClick={() => handleDelete(ct)} 
                              disabled={saving}
                              style={{ color: ct.usageCount > 0 ? '#bbb' : '#d93025', border: 'none', background: 'none', cursor: ct.usageCount > 0 || saving ? 'not-allowed' : 'pointer' }}
                              title={ct.usageCount > 0 ? `Cannot delete - used by ${ct.usageCount} course(s)` : 'Delete'}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {deleteTarget && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', background: '#fff8e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', color: '#7b5800' }}>
              Delete "{deleteTarget.name}"? This cannot be undone.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="cp-btn cp-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="cp-btn cp-btn-danger" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCourseTypesModal;
