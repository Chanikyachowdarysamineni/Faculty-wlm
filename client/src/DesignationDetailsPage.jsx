/**
 * DesignationDetailsPage.jsx
 * Dedicated Page for Designation-Wise Faculty Workload & Capacity Details
 * 100% Database-Driven, Period-Aware, with Sorting, Filtering, and Export
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAcademicPeriod } from './AcademicPeriodContext';
import GlobalPeriodSelector from './components/GlobalPeriodSelector';
import { exportAsCSV, exportAsExcel } from './utils/exportUtils';
import API from './config';
import { useToast } from './Toast';
import './DesignationDetailsPage.css';

const DesignationDetailsPage = () => {
  const { designationId } = useParams();
  const navigate = useNavigate();
  const { selectedAcademicYear, selectedSemester } = useAcademicPeriod();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [designationData, setDesignationData] = useState(null);

  // Table controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('sNo');
  const [sortDir, setSortDir] = useState('asc');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch designation workload details from API
  const fetchDesignationDetails = useCallback(async () => {
    if (!designationId) return;
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('wlm_token') || localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedAcademicYear) params.append('academicYear', selectedAcademicYear);
      if (selectedSemester) params.append('semester', selectedSemester);

      const res = await fetch(`${API}/deva/designations/${designationId}/workload-details?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load designation workload details.');
      }

      setDesignationData(json.data);
    } catch (err) {
      console.error('Error fetching designation details:', err);
      setError(err.message || 'Error loading designation details.');
      showToast.error(err.message || 'Error loading designation details.');
    } finally {
      setLoading(false);
    }
  }, [designationId, selectedAcademicYear, selectedSemester]);

  useEffect(() => {
    fetchDesignationDetails();
  }, [fetchDesignationDetails]);

  // Handle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const designation = designationData?.designation || {};
  const summary = designationData?.summary || {
    totalFaculty: 0,
    totalAssignedHours: 0,
    totalCapacity: 0,
    remainingCapacity: 0,
    isOverloaded: false
  };
  const rawFaculty = designationData?.faculty || [];

  // Filter and sort faculty records
  const processedFaculty = useMemo(() => {
    let result = [...rawFaculty];

    // Search by name or empId
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(f =>
        String(f.name || '').toLowerCase().includes(q) ||
        String(f.empId || '').toLowerCase().includes(q) ||
        String(f.email || '').toLowerCase().includes(q) ||
        String(f.mobile || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'Overload') {
      result = result.filter(f => f.status === 'Overload' || (f.remainingCapacity ?? 0) < 0);
    } else if (statusFilter === 'Normal') {
      result = result.filter(f => f.status === 'Normal' && (f.remainingCapacity ?? 0) <= 0);
    } else if (statusFilter === 'Available') {
      result = result.filter(f => (f.remainingCapacity ?? 0) > 0);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'sNo') {
        aVal = Number(a.sNo || 0);
        bVal = Number(b.sNo || 0);
      } else if (sortField === 'assignedHours' || sortField === 'capacity' || sortField === 'remainingCapacity') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rawFaculty, searchQuery, statusFilter, sortField, sortDir]);

  // Pagination
  const totalRecords = processedFaculty.length;
  const effectivePageSize = pageSize === 'ALL' ? totalRecords || 1 : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize));
  const paginatedFaculty = useMemo(() => {
    if (pageSize === 'ALL') return processedFaculty;
    const start = (currentPage - 1) * effectivePageSize;
    return processedFaculty.slice(start, start + effectivePageSize);
  }, [processedFaculty, currentPage, effectivePageSize, pageSize]);

  // Export columns definition (12 columns)
  const exportColumns = useMemo(() => [
    { header: 'S.No.', value: (r) => r.sNo },
    { header: 'Employee ID', value: (r) => r.empId },
    { header: 'Faculty Name', value: (r) => r.name },
    { header: 'Designation', value: (r) => r.designation || designation.name },
    { header: 'Mobile Number', value: (r) => r.mobile || '—' },
    { header: 'Email', value: (r) => r.email || '—' },
    { header: 'Joining Date', value: (r) => r.joiningDate || '—' },
    { header: 'Relieving Date', value: (r) => r.relievingDate || '—' },
    { header: 'Assigned Workload (h)', value: (r) => r.assignedHours },
    { header: 'Capacity (h)', value: (r) => r.capacity },
    { header: 'Remaining Capacity (h)', value: (r) => r.remainingCapacity },
    { header: 'Status', value: (r) => r.status }
  ], [designation.name]);

  const handleExportCSV = () => {
    const safeName = (designation.name || 'Designation').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeName}_Workload_${selectedAcademicYear || 'AY'}_${selectedSemester || 'SEM'}`;
    exportAsCSV({
      fileName,
      columns: exportColumns,
      rows: processedFaculty
    });
    showToast.success(`Exported ${processedFaculty.length} records to CSV.`);
  };

  const handleExportExcel = () => {
    const safeName = (designation.name || 'Designation').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeName}_Workload_${selectedAcademicYear || 'AY'}_${selectedSemester || 'SEM'}`;
    exportAsExcel({
      fileName,
      sheetName: safeName.slice(0, 31),
      columns: exportColumns,
      rows: processedFaculty
    });
    showToast.success(`Exported ${processedFaculty.length} records to Excel.`);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return ' ⇅';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="dd-container">
      {/* ── Top Bar ── */}
      <div className="dd-topbar">
        <div className="dd-topbar-left">
          <button
            type="button"
            className="dd-back-btn"
            onClick={() => {
              try { sessionStorage.setItem('wlm_dash_mode', 'admin'); } catch {}
              navigate('/dashboard');
            }}
            title="Return to Dashboard"
          >
            ← Back to Dashboard
          </button>
          <div className="dd-title-wrap">
            <div className="dd-title-icon">🏛️</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 className="dd-title">{designation.name || 'Designation Details'}</h1>
                <span className="dd-badge dd-badge-primary">
                  {summary.totalFaculty} {summary.totalFaculty === 1 ? 'Faculty' : 'Faculty Members'}
                </span>
                {summary.isOverloaded && (
                  <span className="dd-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    ⚠ Overloaded
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Designation ID: <code style={{ fontSize: '11px', color: '#4f46e5' }}>{designationId}</code>
              </div>
            </div>
          </div>
        </div>

        <div className="dd-topbar-right">
          <span className="dd-badge dd-badge-period">
            📅 {selectedAcademicYear || '2026-2027'} • {selectedSemester || 'ODD'} Semester
          </span>
          <GlobalPeriodSelector />
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="dd-summary-grid">
        <div className="dd-stat-card">
          <div className="dd-stat-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
            👥
          </div>
          <div className="dd-stat-info">
            <span className="dd-stat-label">Total Faculty</span>
            <span className="dd-stat-value">{loading ? '...' : summary.totalFaculty}</span>
            <span className="dd-stat-desc">Distinct active faculty in period</span>
          </div>
        </div>

        <div className="dd-stat-card">
          <div className="dd-stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            ⏱️
          </div>
          <div className="dd-stat-info">
            <span className="dd-stat-label">Total Assigned</span>
            <span className="dd-stat-value">{loading ? '...' : `${summary.totalAssignedHours}h`}</span>
            <span className="dd-stat-desc">Cumulative workload hours (L+T+P)</span>
          </div>
        </div>

        <div className="dd-stat-card">
          <div className="dd-stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            📊
          </div>
          <div className="dd-stat-info">
            <span className="dd-stat-label">Total Capacity</span>
            <span className="dd-stat-value">{loading ? '...' : `${summary.totalCapacity}h`}</span>
            <span className="dd-stat-desc">Maximum approved capacity</span>
          </div>
        </div>

        <div className="dd-stat-card">
          <div
            className="dd-stat-icon"
            style={{
              background: summary.remainingCapacity < 0 ? '#fee2e2' : '#dcfce7',
              color: summary.remainingCapacity < 0 ? '#dc2626' : '#16a34a'
            }}
          >
            {summary.remainingCapacity < 0 ? '⚠' : '✓'}
          </div>
          <div className="dd-stat-info">
            <span className="dd-stat-label">Remaining Capacity</span>
            <span
              className="dd-stat-value"
              style={{
                color: summary.remainingCapacity < 0 ? '#dc2626' : summary.remainingCapacity === 0 ? '#16a34a' : '#0284c7'
              }}
            >
              {loading ? '...' : `${summary.remainingCapacity}h`}
            </span>
            <span className="dd-stat-desc">
              {summary.remainingCapacity < 0
                ? 'Over capacity limit by ' + Math.abs(summary.remainingCapacity) + 'h'
                : 'Available balance across faculty'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter / Controls Bar ── */}
      <div className="dd-controls-bar">
        <div className="dd-search-wrap">
          <input
            type="text"
            className="dd-search-input"
            placeholder="Search by faculty name or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="dd-search-clear"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="dd-filter-group">
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Status:</label>
          <select
            className="dd-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="Normal">Normal (At Capacity)</option>
            <option value="Available">Available (Under Capacity)</option>
            <option value="Overload">Overload (Exceeding Capacity)</option>
          </select>

          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginLeft: '8px' }}>Rows:</label>
          <select
            className="dd-select"
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
              setPageSize(val);
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value="ALL">All ({totalRecords})</option>
          </select>

          <button type="button" className="dd-btn-export" onClick={handleExportCSV} title="Export current list to CSV">
            📄 CSV
          </button>
          <button type="button" className="dd-btn-export" onClick={handleExportExcel} title="Export current list to Excel">
            📊 Excel
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="dd-table-card">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Loading designation faculty details...</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              Fetching live workload and capacity from database
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠</div>
            <div style={{ fontWeight: 600 }}>{error}</div>
            <button
              type="button"
              className="dd-back-btn"
              onClick={fetchDesignationDetails}
              style={{ marginTop: '16px' }}
            >
              ↻ Try Again
            </button>
          </div>
        ) : paginatedFaculty.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#334155' }}>
              No faculty records found for {designation.name || 'this designation'}.
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter.'
                : 'No faculty members are currently assigned under this designation for the selected academic context.'}
            </div>
          </div>
        ) : (
          <div className="dd-table-scroll">
            <table className="dd-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('sNo')}>S.No.{getSortIcon('sNo')}</th>
                  <th onClick={() => handleSort('empId')}>Emp ID{getSortIcon('empId')}</th>
                  <th onClick={() => handleSort('name')}>Faculty Name{getSortIcon('name')}</th>
                  <th onClick={() => handleSort('designation')}>Designation{getSortIcon('designation')}</th>
                  <th onClick={() => handleSort('mobile')}>Mobile{getSortIcon('mobile')}</th>
                  <th onClick={() => handleSort('email')}>Email{getSortIcon('email')}</th>
                  <th onClick={() => handleSort('joiningDate')}>Joining Date{getSortIcon('joiningDate')}</th>
                  <th onClick={() => handleSort('relievingDate')}>Relieving Date{getSortIcon('relievingDate')}</th>
                  <th onClick={() => handleSort('assignedHours')} style={{ textAlign: 'center' }}>
                    Assigned Hours{getSortIcon('assignedHours')}
                  </th>
                  <th onClick={() => handleSort('capacity')} style={{ textAlign: 'center' }}>
                    Capacity{getSortIcon('capacity')}
                  </th>
                  <th onClick={() => handleSort('remainingCapacity')} style={{ textAlign: 'center' }}>
                    Remaining{getSortIcon('remainingCapacity')}
                  </th>
                  <th onClick={() => handleSort('status')} style={{ textAlign: 'center' }}>
                    Status{getSortIcon('status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedFaculty.map((f, idx) => {
                  const isOver = f.status === 'Overload' || (f.remainingCapacity ?? 0) < 0;
                  const isFull = (f.remainingCapacity ?? 0) === 0 && (f.capacity ?? 0) > 0;
                  return (
                    <tr key={f.empId || idx}>
                      <td style={{ color: '#64748b', fontWeight: 600 }}>{f.sNo}</td>
                      <td>
                        <span className="dd-empid-pill">{f.empId}</span>
                      </td>
                      <td>
                        <span className="dd-fac-name">{f.name}</span>
                      </td>
                      <td style={{ color: '#475569' }}>{f.designation || designation.name || '—'}</td>
                      <td style={{ color: '#64748b', fontFamily: 'monospace' }}>{f.mobile || '—'}</td>
                      <td style={{ color: '#64748b' }}>{f.email || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{f.joiningDate || '—'}</td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{f.relievingDate || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>
                        {f.assignedHours}h
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                        {f.capacity}h
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: isOver ? '#dc2626' : isFull ? '#16a34a' : '#0284c7'
                        }}
                      >
                        {f.remainingCapacity}h
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`dd-status-badge ${
                            isOver ? 'dd-status-overload' : isFull ? 'dd-status-normal' : 'dd-status-available'
                          }`}
                        >
                          {isOver ? '⚠ Overload' : isFull ? '✓ Normal' : '⏳ Available'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Bar ── */}
        {!loading && totalRecords > 0 && pageSize !== 'ALL' && (
          <div className="dd-pagination-bar">
            <div className="dd-pagination-info">
              Showing {(currentPage - 1) * effectivePageSize + 1} to{' '}
              {Math.min(currentPage * effectivePageSize, totalRecords)} of {totalRecords} faculty records
            </div>

            <div className="dd-pagination-btns">
              <button
                type="button"
                className="dd-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '12.5px', color: '#475569' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="dd-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignationDetailsPage;
