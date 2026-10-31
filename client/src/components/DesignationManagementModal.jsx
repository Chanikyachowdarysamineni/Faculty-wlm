import React, { useState, useEffect } from 'react';
import { exportAsCSV, exportAsExcel } from '../utils/exportUtils';
import API from '../config';
import { authJsonHeaders } from '../utils/apiFetchAll';
import { useToast } from '../Toast';
import { FieldError } from './FieldError';
import { MESSAGES, formatApiError } from '../utils/messages';
import './DesignationManagementModal.css';

const DesignationManagementModal = ({ onClose, onUpdated, isStandalone }) => {
  const { showToast } = useToast();
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [category, setCategory] = useState('FACULTY');
  const [editId, setEditId] = useState(null);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    fetchDesignations();
  }, []);

  const handleExport = (format) => {
    if (!designations || designations.length === 0) {
      showToast.warning('No designations available to export.');
      return;
    }

    const columns = [
      { header: 'Order', key: 'order' },
      { header: 'Designation Name', key: 'name' },
      { header: 'Workload Eligibility', value: (row) => row.category === 'TA_INSTRUCTOR' ? 'TA / Instructor (R2-R4 Only)' : 'Regular Faculty' },
      { header: 'Status', value: (row) => row.isEnabled === false ? 'Disabled' : 'Active' },
      { header: 'Created At', value: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '' }
    ];

    const payload = {
      fileName: 'Designations',
      title: 'Designations Export',
      columns,
      rows: designations,
      sheetName: 'Designations'
    };

    if (format === 'csv') return exportAsCSV(payload);
    if (format === 'excel') return exportAsExcel(payload);
  };

  const fetchDesignations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/deva/designations/admin`, { headers: authJsonHeaders() });
      const data = await res.json();
      if (data.success) {
        setDesignations(data.data);
      } else {
        showToast.error(formatApiError(data, 'Failed to fetch designations.'));
      }
    } catch (err) {
      console.error('Failed to fetch admin designations', err);
      showToast.error(MESSAGES.NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Designation name is required.');
      return;
    }

    setIsSaving(true);
    setNameError('');

    try {
      const payload = { name: name.trim(), order: Number(order) || 0, category };
      const url = editId ? `${API}/deva/designations/${editId}` : `${API}/deva/designations`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authJsonHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setName('');
        setOrder('');
        setCategory('FACULTY');
        setEditId(null);
        showToast.success(editId ? 'Designation updated successfully.' : 'Designation created successfully.');
        fetchDesignations();
        window.dispatchEvent(new CustomEvent('wlm:designations_reload'));
        if (onUpdated) onUpdated();
      } else {
        if (data.message && data.message.toLowerCase().includes('already exists')) {
          setNameError(data.message);
        }
        showToast.error(formatApiError(data, 'Error saving designation.'));
      }
    } catch (err) {
      console.error(err);
      showToast.error(formatApiError(err, MESSAGES.NETWORK_ERROR));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (d) => {
    setEditId(d._id);
    setName(d.name);
    setOrder(d.order ?? '');
    setCategory(d.category || 'FACULTY');
    setNameError('');
  };

  const handleDelete = async (id, desigName) => {
    if (!window.confirm(`Are you sure you want to delete or disable designation "${desigName || 'this designation'}"?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API}/deva/designations/${id}`, {
        method: 'DELETE',
        headers: authJsonHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.data?.deactivated) {
          showToast.warning(data.data.message || 'Designation disabled because active faculty members are using it.');
        } else {
          showToast.success('Designation deleted successfully.');
        }
        fetchDesignations();
        window.dispatchEvent(new CustomEvent('wlm:designations_reload'));
        if (onUpdated) onUpdated();
      } else {
        showToast.error(formatApiError(data, 'Error deleting designation.'));
      }
    } catch (err) {
      console.error(err);
      showToast.error(formatApiError(err, MESSAGES.NETWORK_ERROR));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setName('');
    setOrder('');
    setCategory('FACULTY');
    setNameError('');
  };

  const content = (
    <>
      <div className="dmm-header" style={isStandalone ? { display: 'none' } : {}}>
        <h3>Manage Designations</h3>
        {!isStandalone && <button className="dmm-close" onClick={onClose}>✕</button>}
      </div>
      
      <form className="dmm-form" onSubmit={handleSave} style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column' }}>
          <input 
            type="text" 
            placeholder="Designation Name *" 
            value={name} 
            aria-invalid={!!nameError}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }} 
            required 
          />
          <FieldError error={nameError} />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ flex: 2, minWidth: '220px' }}
          title="Workload eligibility rule for this designation"
        >
          <option value="FACULTY">Regular Faculty (Main, Supporting, R2-R4)</option>
          <option value="TA_INSTRUCTOR">TA / Instructor (R2, R3, R4 Only)</option>
        </select>
        <input 
          type="number" 
          placeholder="Order (Optional)" 
          value={order} 
          onChange={(e) => setOrder(e.target.value)} 
          style={{ width: '90px' }}
        />
        <button type="submit" className="dmm-btn-save" disabled={isSaving}>
          {isSaving ? 'Saving...' : (editId ? 'Update' : 'Add')}
        </button>
        {editId && <button type="button" className="dmm-btn-cancel" disabled={isSaving} onClick={handleCancel}>Cancel</button>}
      </form>

      <div className="dmm-list-wrap">
        {loading ? (
          <p style={{ padding: '12px' }}>Loading...</p>
        ) : (
          <table className="dmm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Workload Eligibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designations.map(d => (
                <tr key={d._id}>
                  <td>{d.order}</td>
                  <td>
                    <strong>{d.name}</strong>
                    {d.isEnabled === false && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Disabled</span>
                    )}
                  </td>
                  <td>
                    {d.category === 'TA_INSTRUCTOR' ? (
                      <span className="dmm-badge-ta" title="Eligible for R2, R3, R4 only">TA / Instructor (R2-R4 Only)</span>
                    ) : (
                      <span className="dmm-badge-faculty" title="Eligible for Main, Supporting, and R2-R4">Regular Faculty</span>
                    )}
                  </td>
                  <td>
                    <button className="dmm-action-btn edit" disabled={isSaving || isDeleting} onClick={() => handleEdit(d)}>Edit</button>
                    <button className="dmm-action-btn delete" disabled={isSaving || isDeleting} onClick={() => handleDelete(d._id, d.name)}>Delete</button>
                  </td>
                </tr>
              ))}
              {designations.length === 0 && (
                <tr><td colSpan="4" style={{textAlign: 'center', padding: '12px'}}>No designations found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  if (isStandalone) {
    return <div className="dmm-standalone">{content}</div>;
  }

  return (
    <div className="dmm-overlay" onClick={onClose}>
      <div className="dmm-modal" onClick={e => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
};

export default DesignationManagementModal;
