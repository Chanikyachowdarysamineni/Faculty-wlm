import React, { useState, useEffect } from 'react';
import { exportAsCSV, exportAsExcel } from '../utils/exportUtils';
import API from '../config';
import { authJsonHeaders } from '../utils/apiFetchAll';
import './DesignationManagementModal.css';

const DesignationManagementModal = ({ onClose, onUpdated, isStandalone }) => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchDesignations();
  }, []);

  
  const handleExport = (format) => {
    if (!designations || designations.length === 0) {
      alert('No designations to export.');
      return;
    }

    const columns = [
      { header: 'Order', key: 'order' },
      { header: 'Designation Name', key: 'name' },
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
      }
    } catch (err) {
      console.error('Failed to fetch admin designations', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const payload = { name: name.trim(), order: Number(order) || 0 };
      const url = editId ? `${API}/deva/designations/${editId}` : `${API}/deva/designations`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authJsonHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setName('');
        setOrder('');
        setEditId(null);
        fetchDesignations();
        if (onUpdated) onUpdated();
      } else {
        alert(data.message || 'Error saving designation');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving designation');
    }
  };

  const handleEdit = (d) => {
    setEditId(d._id);
    setName(d.name);
    setOrder(d.order);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this designation?')) return;
    try {
      const res = await fetch(`${API}/deva/designations/${id}`, {
        method: 'DELETE',
        headers: authJsonHeaders()
      });
      const data = await res.json();
      if (data.success) {
        fetchDesignations();
        if (onUpdated) onUpdated();
      } else {
        alert(data.message || 'Error deleting designation');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting designation');
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setName('');
    setOrder('');
  };

  const content = (
    <>
      <div className="dmm-header" style={isStandalone ? { display: 'none' } : {}}>
        <h3>Manage Designations</h3>
        {!isStandalone && <button className="dmm-close" onClick={onClose}>✕</button>}
      </div>
      
      <form className="dmm-form" onSubmit={handleSave}>
        <input 
          type="text" 
          placeholder="Designation Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />
        <input 
          type="number" 
          placeholder="Order (Optional)" 
          value={order} 
          onChange={(e) => setOrder(e.target.value)} 
        />
        <button type="submit" className="dmm-btn-save">{editId ? 'Update' : 'Add'}</button>
        {editId && <button type="button" className="dmm-btn-cancel" onClick={handleCancel}>Cancel</button>}
      </form>

      <div className="dmm-list-wrap">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="dmm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designations.map(d => (
                <tr key={d._id}>
                  <td>{d.order}</td>
                  <td>{d.name}</td>
                  <td>
                    <button className="dmm-action-btn edit" onClick={() => handleEdit(d)}>Edit</button>
                    <button className="dmm-action-btn delete" onClick={() => handleDelete(d._id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {designations.length === 0 && (
                <tr><td colSpan="3" style={{textAlign: 'center'}}>No designations found.</td></tr>
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
