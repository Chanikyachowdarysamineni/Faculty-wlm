import React, { useState, useEffect, useCallback } from 'react';
import API from './config';

const PAGE_SIZE = 50;

const AuditLogPage = () => {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [pagination,  setPagination]  = useState({ page: 1, totalPages: 1, total: 0 });

  const [filters, setFilters] = useState({ action: '', entity: '', actorEmpId: '', from: '', to: '' });

  const token = () => localStorage.getItem('wlm_token') || '';

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page });
      if (filters.action)     params.set('action',     filters.action);
      if (filters.entity)     params.set('entity',     filters.entity);
      if (filters.actorEmpId) params.set('actorEmpId', filters.actorEmpId);
      if (filters.from)       params.set('from',       filters.from);
      if (filters.to)         params.set('to',         filters.to);

      const res  = await fetch(`${API}/deva/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load audit logs.');
      setLogs(Array.isArray(data.data) ? data.data : []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs(1);
  }, []); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' });
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20, color: '#1e293b' }}>
        Audit Log Viewer
      </h2>

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <input
          name="action"
          placeholder="Action (e.g. UPDATE)"
          value={filters.action}
          onChange={handleFilterChange}
          style={inputStyle}
        />
        <input
          name="entity"
          placeholder="Entity (e.g. Faculty)"
          value={filters.entity}
          onChange={handleFilterChange}
          style={inputStyle}
        />
        <input
          name="actorEmpId"
          placeholder="Actor Emp ID"
          value={filters.actorEmpId}
          onChange={handleFilterChange}
          style={inputStyle}
        />
        <input
          name="from"
          type="datetime-local"
          value={filters.from}
          onChange={handleFilterChange}
          style={inputStyle}
          title="From date"
        />
        <input
          name="to"
          type="datetime-local"
          value={filters.to}
          onChange={handleFilterChange}
          style={inputStyle}
          title="To date"
        />
        <button type="submit" style={btnStyle}>Search</button>
        <button
          type="button"
          style={{ ...btnStyle, background: '#e2e8f0', color: '#374151' }}
          onClick={() => {
            setFilters({ action: '', entity: '', actorEmpId: '', from: '', to: '' });
            setTimeout(() => fetchLogs(1), 0);
          }}
        >
          Clear
        </button>
      </form>

      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {loading ? 'Loading…' : `${pagination.total.toLocaleString()} total records — page ${pagination.page} of ${pagination.totalPages}`}
        </span>
        <button style={{ ...btnStyle, padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => fetchLogs(pagination.page)}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.855rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              {['Timestamp', 'Actor (Emp ID)', 'Role', 'Action', 'Entity', 'Entity ID', 'IP'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{formatDate(log.createdAt)}</td>
                  <td style={tdStyle}>{log.actorEmpId || '—'}</td>
                  <td style={tdStyle}>{log.actorRole || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: actionColor(log.action).bg,
                      color: actionColor(log.action).color,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={tdStyle}>{log.entity || '—'}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>
                    {log.entityId || '—'}
                  </td>
                  <td style={{ ...tdStyle, color: '#9ca3af', fontSize: '0.78rem' }}>{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            style={{ ...btnStyle, padding: '6px 14px' }}
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
          >
            ← Prev
          </button>
          <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#64748b' }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            style={{ ...btnStyle, padding: '6px 14px' }}
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchLogs(pagination.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  padding: '7px 11px',
  borderRadius: 7,
  border: '1px solid #d1d5db',
  fontSize: '0.875rem',
  minWidth: 160,
  outline: 'none',
};

const btnStyle = {
  padding: '7px 16px',
  borderRadius: 7,
  border: 'none',
  background: '#6b74e8',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const thStyle = {
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: '0.8rem',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '9px 14px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const actionColor = (action = '') => {
  const a = String(action).toUpperCase();
  if (a.includes('DELETE') || a.includes('REMOVE'))  return { bg: '#fee2e2', color: '#b91c1c' };
  if (a.includes('CREATE') || a.includes('REGISTER')) return { bg: '#dcfce7', color: '#15803d' };
  if (a.includes('UPDATE') || a.includes('EDIT'))    return { bg: '#fef9c3', color: '#92400e' };
  if (a.includes('LOGIN') || a.includes('LOGOUT'))   return { bg: '#eff6ff', color: '#1d4ed8' };
  return { bg: '#f1f5f9', color: '#475569' };
};

export default AuditLogPage;

