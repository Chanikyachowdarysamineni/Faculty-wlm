import React, { useState, useEffect } from 'react';
import API from '../config';
import { authJsonHeaders } from '../utils/apiFetchAll';

const AdminManagement = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/deva/admin-management/users`, { headers: authJsonHeaders() });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleToggleAdmin = async (empId, currentStatus) => {
    const currentEmpId = user?.id || user?.empId;
    if (currentEmpId && empId === currentEmpId) {
      return showToast('You cannot change your own admin status.');
    }
    
    const makeAdmin = !currentStatus;
    if (!window.confirm(`Are you sure you want to ${makeAdmin ? 'grant admin privileges to' : 'remove admin privileges from'} user ${empId}?`)) return;

    try {
      const res = await fetch(`${API}/deva/admin-management/toggle-admin`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ empId, makeAdmin })
      });
      const data = await res.json();
      
      if (data.success) {
        showToast(data.message || 'Status updated');
        fetchUsers();
      } else {
        showToast(data.message || 'Error updating status');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating status');
    }
  };

  const filteredUsers = users.filter(u => 
    String(u.empId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(u.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(u.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ background: '#fff', color: '#1e293b', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '20px', fontWeight: '700' }}>Admin Management</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage system administrator privileges for active faculty members.
          </p>
        </div>
        {!loading && (
          <div style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
            Total Faculty: <strong>{filteredUsers.length}</strong>{filteredUsers.length !== users.length && ` (of ${users.length})`}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading faculty records...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search by S.No, Emp ID, Name, Designation, or Dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '440px',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px'
              }}
            />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', width: '60px' }}>S.No.</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Emp ID</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Name of the Faculty</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Designation</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Department</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Admin Status</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No faculty records found matching &quot;{searchTerm}&quot;.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.empId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', color: '#64748b' }}>{u.slNo || idx + 1}</td>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#334155' }}>{u.empId}</td>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{u.name}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{u.designation}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{u.department || 'CSE'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {u.isEffectiveAdmin ? (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                          Admin
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}>
                          Faculty
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {u.isEnvAdmin ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>System Configured</span>
                      ) : (user && u.empId === (user.id || user.empId)) ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Current User</span>
                      ) : (
                        <button
                          onClick={() => handleToggleAdmin(u.empId, u.isEffectiveAdmin)}
                          style={{
                            background: u.isEffectiveAdmin ? '#ef4444' : '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {u.isEffectiveAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#334155', color: '#fff', padding: '10px 20px', borderRadius: '4px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 9999
        }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
