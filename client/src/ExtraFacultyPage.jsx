import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';
import './ExtraFacultyPage.css';

const ExtraFacultyPage = () => {
  const { faculty: contextFaculty } = useSharedData();
  
  const [loading, setLoading] = useState(true);
  const [facultyList, setFacultyList] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Sync shared context data to local state
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      setFacultyList(contextFaculty);
    }
  }, [contextFaculty]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const headers = authJsonHeaders();
      const [wRes] = await Promise.all([
        fetchAllPages('/deva/workloads', {}, { headers }),
      ]);
      setWorkloads(wRes.success ? (wRes.data || []) : []);
      if (!wRes.success) {
        setFetchError(wRes.message || 'Some details could not be fetched.');
      }
    } catch (error) {
      setFetchError(error?.message || 'Could not fetch extra faculty details.');
      setWorkloads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const extraFacultyRows = useMemo(() => {
    const masterEmpIds = new Set((facultyList || []).map((f) => String(f.empId || '').trim()));
    const map = {};

    (workloads || []).forEach((w) => {
      const empId = String(w.empId || '').trim();
      if (!empId || masterEmpIds.has(empId)) return;
      const nameKey = String(w.empName || '').trim().toLowerCase();
      const uniqueKey = `${empId}__${nameKey || 'unknown'}`;

      if (!map[uniqueKey]) {
        map[uniqueKey] = {
          empId,
          empName: w.empName || '—',
          designation: w.designation || '—',
          mobile: w.mobile || '—',
          department: w.department || 'CSE',
          entryCount: 0,
          totalHours: 0,
          courseNames: new Set(),
          years: new Set(),
          details: [],
        };
      }

      map[uniqueKey].entryCount += 1;
      map[uniqueKey].totalHours += Number(w.manualL || 0) + Number(w.manualT || 0) + Number(w.manualP || 0);
      if (w.subjectName) map[uniqueKey].courseNames.add(w.subjectName);
      if (w.year) map[uniqueKey].years.add(w.year);
      map[uniqueKey].details.push({
        subjectName: w.subjectName || '—',
        year: w.year || '—',
        section: w.section || '—',
        role: w.facultyRole || 'Main Faculty',
        hours: Number(w.manualL || 0) + Number(w.manualT || 0) + Number(w.manualP || 0),
      });
    });

    return Object.values(map)
      .map((row) => ({
        ...row,
        totalHours: Number(row.totalHours.toFixed(2)),
        courses: Array.from(row.courseNames),
        yearList: Array.from(row.years),
        detailPreview: row.details.slice(0, 2).map((d) => `${d.subjectName} (${d.year}-${d.section}) [${d.role}]`).join(' | '),
      }))
      .sort((a, b) => a.empName.localeCompare(b.empName));
  }, [facultyList, workloads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return extraFacultyRows;
    return extraFacultyRows.filter((row) => (
      row.empId.toLowerCase().includes(q) ||
      row.empName.toLowerCase().includes(q) ||
      row.designation.toLowerCase().includes(q) ||
      row.mobile.toLowerCase().includes(q) ||
      row.department.toLowerCase().includes(q)
    ));
  }, [extraFacultyRows, search]);

  if (loading) {
    return <div className="efp-wrapper"><div className="efp-empty">Loading extra faculty…</div></div>;
  }

  return (
    <div className="efp-wrapper">
      <div className="efp-topbar">
        <div>
          <h2 className="efp-title">Extra Faculty Details</h2>
          <div className="efp-sub">Faculty present in workload records but not in master faculty list</div>
        </div>
        <div className="efp-actions">
          <input
            className="efp-search"
            placeholder="Search by emp ID, name, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="efp-refresh" onClick={loadData}>↻ Refresh</button>
          <span className="efp-count">{filtered.length} records</span>
        </div>
      </div>

      {fetchError && <div className="efp-error">⚠ {fetchError}</div>}

      <div className="efp-table-wrap">
        <table className="efp-table">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Mobile</th>
              <th>Department</th>
              <th>Entries</th>
              <th>Total Hrs</th>
              <th>Years</th>
              <th>Courses</th>
              <th>Recent Assigned Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="efp-empty-row">No extra faculty records found.</td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={`${row.empId}-${row.empName}`}>
                <td>{row.empId}</td>
                <td>{row.empName}</td>
                <td>{row.designation}</td>
                <td>{row.mobile}</td>
                <td>{row.department}</td>
                <td>{row.entryCount}</td>
                <td>{row.totalHours}</td>
                <td>{row.yearList.join(', ') || '—'}</td>
                <td title={row.courses.join(', ')}>{row.courses.slice(0, 2).join(', ')}{row.courses.length > 2 ? ` +${row.courses.length - 2}` : ''}</td>
                <td title={row.details.map((d) => `${d.subjectName} | ${d.year}-${d.section} | ${d.role} | ${d.hours}h`).join('\n')}>{row.detailPreview || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExtraFacultyPage;

