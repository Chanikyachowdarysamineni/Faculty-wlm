import React, { useState, useEffect, useCallback } from 'react';
import API from '../config';
import { authJsonHeaders } from '../utils/apiFetchAll';
import { useToast } from '../Toast';
import { MESSAGES, formatApiError } from '../utils/messages';
import { useAcademicPeriod } from '../AcademicPeriodContext';

const AdminManagement = ({ user }) => {
  const { showToast } = useToast();
  const { selectedAcademicYear, selectedSemester, selectedAcademicYearId } = useAcademicPeriod();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingEmpId, setUpdatingEmpId] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (selectedAcademicYear) query.append('academicYear', selectedAcademicYear);
      if (selectedSemester) query.append('semester', selectedSemester);
      if (selectedAcademicYearId) query.append('academicYearId', selectedAcademicYearId);

      const url = `${API}/deva/admin-management/users${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...authJsonHeaders(),
          'x-academic-year': selectedAcademicYear || '',
          'x-semester': selectedSemester || '',
          ...(selectedAcademicYearId ? { 'x-academic-year-id': selectedAcademicYearId } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Deduplicate records by empId to guarantee every faculty member appears exactly once
        const seen = new Map();
        (data.data || []).forEach(u => {
          const key = String(u.empId || '').trim();
          if (key && !seen.has(key)) {
            seen.set(key, u);
          }
        });
        setUsers(Array.from(seen.values()));
      } else {
        showToast.error(formatApiError(data, 'Failed to load faculty list.'));
      }
    } catch (err) {
      console.error(err);
      showToast.error(MESSAGES.NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear, selectedSemester, selectedAcademicYearId, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Real-time synchronization
  useEffect(() => {
    const handleReload = () => { fetchUsers(); };
    window.addEventListener('wlm:faculty_reload', handleReload);
    window.addEventListener('wlm:academic_period_reload', handleReload);
    window.addEventListener('wlm:admin_management_reload', handleReload);
    return () => {
      window.removeEventListener('wlm:faculty_reload', handleReload);
      window.removeEventListener('wlm:academic_period_reload', handleReload);
      window.removeEventListener('wlm:admin_management_reload', handleReload);
    };
  }, [fetchUsers]);

  const handleToggleAdmin = async (empId, currentStatus) => {
    const currentEmpId = user?.id || user?.empId;
    if (currentEmpId && empId === currentEmpId) {
      return showToast.warning('You cannot change your own administrator status.');
    }
    
    const makeAdmin = !currentStatus;
    if (!window.confirm(`Are you sure you want to ${makeAdmin ? 'grant administrator privileges to' : 'remove administrator privileges from'} user ${empId}?`)) return;

    setUpdatingEmpId(empId);
    try {
      const res = await fetch(`${API}/deva/admin-management/toggle-admin`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ empId, makeAdmin })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        showToast.success(data.message || (makeAdmin ? 'Admin privilege granted successfully.' : 'Admin privilege removed successfully.'));
        fetchUsers();
      } else {
        showToast.error(formatApiError(data, 'Error updating administrator status.'));
      }
    } catch (err) {
      console.error(err);
      showToast.error(formatApiError(err, MESSAGES.NETWORK_ERROR));
    } finally {
      setUpdatingEmpId(null);
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
            Manage system administrator privileges for active faculty members in {selectedAcademicYear || 'current academic year'} ({selectedSemester || 'active semester'}).
          </p>
        </div>
        {!loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
              Eligible Faculty: <strong>{filteredUsers.length}</strong>{filteredUsers.length !== users.length && ` (of ${users.length})`}
            </div>
            <div style={{ background: '#ecfdf5', color: '#047857', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
              Administrators: <strong>{users.filter(u => u.isEffectiveAdmin).length}</strong>
            </div>
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
    </div>
  );
};

export default AdminManagement;
