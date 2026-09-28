import React, { useState, useEffect } from 'react';
import API from './config';
import { useSharedData } from './DataContext';
import './AcademicYearManagementPage.css'; // Optional styling

const AcademicYearManagementPage = () => {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newYear, setNewYear] = useState({ name: '', startDate: '', endDate: '' });
  
  const [editingId, setEditingId] = useState(null);
  const [editYear, setEditYear] = useState({ name: '', startDate: '', endDate: '' });
  
  const { academicYears, setAcademicYears } = useSharedData();
  
  const fetchYears = async () => {
    try {
      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/academic-years`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setYears(json.data);
        setAcademicYears(json.data);
      } else {
        setError(json.message || 'Failed to fetch academic years');
      }
    } catch (err) {
      setError('An error occurred while fetching');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchYears();
  }, []);
  
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/academic-years`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newYear)
      });
      const json = await res.json();
      if (json.success) {
        setNewYear({ name: '', startDate: '', endDate: '' });
        setShowAddForm(false);
        fetchYears();
      } else {
        alert(json.message || 'Failed to add academic year');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };
  
  const handleSetCurrent = async (id) => {
    try {
      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/academic-years/${id}/status`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isCurrent: true })
      });
      const json = await res.json();
      if (json.success) {
        fetchYears();
      } else {
        alert(json.message || 'Failed to update academic year status');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };

  const handleEdit = (year) => {
    setEditingId(year._id);
    setEditYear({ 
      name: year.name, 
      startDate: year.startDate ? year.startDate.split('T')[0] : '', 
      endDate: year.endDate ? year.endDate.split('T')[0] : '' 
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/academic-years/${editingId}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editYear)
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        fetchYears();
      } else {
        alert(json.message || 'Failed to update academic year');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this academic year?')) return;
    try {
      const token = localStorage.getItem('wlm_token');
      const res = await fetch(`${API}/deva/academic-years/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        fetchYears();
      } else {
        alert(json.message || 'Failed to delete academic year');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };
  
  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#000000' }}>Academic Year Management</h2>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add New Year'}
        </button>
      </div>
      
      {showAddForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>Name (e.g. 2027-2028)</label>
              <input type="text" className="form-input" required value={newYear.name} onChange={e => setNewYear({...newYear, name: e.target.value})} placeholder="YYYY-YYYY" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>Start Date</label>
              <input type="date" className="form-input" required value={newYear.startDate} onChange={e => setNewYear({...newYear, startDate: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>End Date</label>
              <input type="date" className="form-input" required value={newYear.endDate} onChange={e => setNewYear({...newYear, endDate: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-success">Save</button>
          </div>
        </form>
      )}
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Year Name</th>
              <th>Status</th>
              <th>Semesters</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {years.map(y => editingId === y._id ? (
              <tr key={`edit-${y._id}`}>
                <td colSpan="6" style={{ padding: '15px', background: '#f8fafc' }}>
                  <form onSubmit={handleUpdate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>Name</label>
                      <input type="text" className="form-input" required value={editYear.name} onChange={e => setEditYear({...editYear, name: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>Start Date</label>
                      <input type="date" className="form-input" required value={editYear.startDate} onChange={e => setEditYear({...editYear, startDate: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748b' }}>End Date</label>
                      <input type="date" className="form-input" required value={editYear.endDate} onChange={e => setEditYear({...editYear, endDate: e.target.value})} />
                    </div>
                    <button type="submit" className="btn btn-success">Save</button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={y._id}>
                <td style={{ fontWeight: '500', color: '#000000' }}>{y.name} {y.isCurrent && <span style={{ background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', marginLeft: '8px' }}>CURRENT</span>}</td>
                <td><span className={`status-badge status-${y.status.toLowerCase()}`}>{y.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                    {y.semesters?.map(s => (
                      <span key={s._id} style={{ fontSize: '12px', background: '#f1f5f9', color: '#000000', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        {s.semesterType} (Form: {s.formEnabled ? 'ON' : 'OFF'}, Edit: {s.editEnabled ? 'ON' : 'OFF'})
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ color: '#475569' }}>{new Date(y.startDate).toLocaleDateString()}</td>
                <td style={{ color: '#475569' }}>{new Date(y.endDate).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!y.isCurrent && (
                      <button className="btn btn-sm btn-outline" onClick={() => handleSetCurrent(y._id)}>
                        Set Current
                      </button>
                    )}
                    <button className="btn btn-sm" style={{ background: '#3b82f6', color: '#fff', padding: '4px 8px' }} onClick={() => handleEdit(y)}>Edit</button>
                    {!y.isCurrent && (
                      <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', padding: '4px 8px' }} onClick={() => handleDelete(y._id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {years.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No academic years found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AcademicYearManagementPage;
