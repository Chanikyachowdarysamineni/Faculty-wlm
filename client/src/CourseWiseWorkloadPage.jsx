import React, { useState, useEffect, useMemo } from 'react';
import API from './config';
import { useAcademicPeriod } from './AcademicPeriodContext';
import GlobalPeriodSelector from './components/GlobalPeriodSelector';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { exportAsCSV, exportAsExcel, exportAsPDF } from './utils/exportUtils';
import { useNavigate } from 'react-router-dom';
import './WorkloadPage.css';

const CourseWiseWorkloadPage = () => {
  const { selectedAcademicYearId, selectedSemester, selectedAcademicYear } = useAcademicPeriod();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('All');

  // Editable state
  const [editMap, setEditMap] = useState({});
  const [unsaved, setUnsaved] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedAcademicYearId, selectedSemester]);

  const fetchData = async () => {
    if (!selectedAcademicYearId || !selectedSemester) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/deva/course-workload-plan`, {
        headers: authJsonHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to fetch data');
      
      setData(json.data || []);
      setEditMap({});
      setUnsaved(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (courseOfferingId, field, value) => {
    setEditMap(prev => ({
      ...prev,
      [courseOfferingId]: {
        ...(prev[courseOfferingId] || {}),
        [field]: value === '' ? '' : Number(value)
      }
    }));
    setUnsaved(true);
  };

  const getRowVal = (row, field) => {
    let val = row[field];
    if (editMap[row.courseOfferingId] && editMap[row.courseOfferingId][field] !== undefined) {
      val = editMap[row.courseOfferingId][field];
    }
    return val === 0 ? '' : val;
  };

  const calculateTotals = (row) => {
    const tpBatches = getRowVal(row, 'tpBatches');
    const noOfSections = getRowVal(row, 'noOfSections');
    const L = row.L;
    const T = row.T;
    const P = row.P;
    
    const totalL = L * noOfSections;
    const totalT = T * tpBatches * noOfSections;
    const totalP = P * tpBatches * noOfSections;
    const total = totalL + totalT + totalP;

    return { totalL, totalT, totalP, total };
  };

  const handleSave = async () => {
    const items = Object.entries(editMap).map(([courseOfferingId, updates]) => ({
      courseOfferingId,
      ...updates
    }));

    if (items.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`${API}/deva/course-workload-plan/bulk/update`, {
        method: 'PUT',
        headers: authJsonHeaders(),
        body: JSON.stringify({ items })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save');
      
      // Update local data with saved changes
      const updatedData = data.map(row => {
        if (editMap[row.courseOfferingId]) {
          const newRow = { ...row, ...editMap[row.courseOfferingId] };
          const totals = calculateTotals(newRow);
          return { ...newRow, ...totals };
        }
        return row;
      });
      
      setData(updatedData);
      setEditMap({});
      setUnsaved(false);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const displayData = useMemo(() => {
    let result = data;
    if (programFilter !== 'All') {
      result = result.filter(r => (r.program || '') === programFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        (r.subjectName || '').toLowerCase().includes(q) ||
        (r.subjectCode || '').toLowerCase().includes(q) ||
        (r.program || '').toLowerCase().includes(q)
      );
    }
    // Sort by program, then year, then subject code
    return result.sort((a, b) => {
      if (a.program !== b.program) return (a.program || '').localeCompare(b.program || '');
      if (a.year !== b.year) return (a.year || '').localeCompare(b.year || '');
      return (a.subjectCode || '').localeCompare(b.subjectCode || '');
    });
  }, [data, search, programFilter, editMap]);

  // Extract unique programs dynamically from data
  const availablePrograms = useMemo(() => {
    const programs = new Set(data.map(r => r.program).filter(Boolean));
    return Array.from(programs).sort();
  }, [data]);

  // Export Columns definition
  const getExportColumns = () => [
    { header: 'Program', value: r => r.program },
    { header: 'Sl. No.', value: (_, i) => i + 1 },
    { header: 'Year', value: r => r.year },
    { header: 'Sem', value: r => r.semester },
    { header: 'Course Name', value: r => r.subjectName },
    { header: 'Short Form in the Time-Table', value: r => r.shortName },
    { header: 'Subject Code', value: r => r.subjectCode },
    { header: 'Course Type', value: r => r.courseType },
    { header: 'L', value: r => r.L },
    { header: 'T', value: r => r.T },
    { header: 'P', value: r => r.P },
    { header: 'C', value: r => r.C },
    { header: 'T&P Batches', value: r => getRowVal(r, 'tpBatches') },
    { header: 'No of Sections', value: r => getRowVal(r, 'noOfSections') },
    { header: 'Student Strength', value: r => getRowVal(r, 'studentStrength') },
    { header: 'Total L', value: r => calculateTotals(r).totalL },
    { header: 'Total T', value: r => calculateTotals(r).totalT },
    { header: 'Total P', value: r => calculateTotals(r).totalP },
    { header: 'Total', value: r => calculateTotals(r).total }
  ];

  const handleExport = (type) => {
    const config = {
      fileName: `Course_Wise_Workload_${selectedAcademicYear}_${selectedSemester}`,
      title: `Course Wise Workload - ${selectedAcademicYear} - ${selectedSemester}`,
      columns: getExportColumns(),
      rows: displayData.map((row, i) => ({ ...row, __idx: i }))
    };
    if (type === 'excel') exportAsExcel(config);
  };

  return (
    <div className="wl-wrapper">
      <div className="wl-topbar">
        <div className="wl-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="wl-btn wl-btn-forms" onClick={() => navigate('/')}>
            ← Back
          </button>
          <h2 className="wl-heading">Course Wise Workload Details</h2>
          <span className="wl-count-badge">{displayData.length} courses</span>
        </div>
        
        <div className="wl-topbar-right">
          <GlobalPeriodSelector />
          <div className="wl-search-wrap" style={{ marginLeft: '12px' }}>
            <select 
              className="wl-search" 
              style={{ width: '130px', marginRight: '8px' }}
              value={programFilter} 
              onChange={e => setProgramFilter(e.target.value)}
            >
              <option value="All">All Programs</option>
              {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
             <input className="wl-search" placeholder="Search courses..." 
               value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="wl-btn wl-btn-export" onClick={() => handleExport('excel')} disabled={displayData.length === 0}>
            ⬇ Export Excel
          </button>
          {unsaved && (
            <button className="wl-btn wl-btn-add" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px', color: '#64748b' }}>Loading courses...</div>
      ) : error ? (
        <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>
      ) : (
        <div className="wl-table-container" style={{ marginTop: '16px', overflowX: 'auto', width: '100%' }}>
          <table className="wl-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>Program</th>
                <th>Sl. No.</th>
                <th>Year</th>
                <th>Sem</th>
                <th>Course Name</th>
                <th>Short Form</th>
                <th>Subject Code</th>
                <th>Course Type</th>
                <th>L</th>
                <th>T</th>
                <th>P</th>
                <th>C</th>
                <th>T&P Batches</th>
                <th>No of Sections</th>
                <th>Student Strength</th>
                <th>Total L</th>
                <th>Total T</th>
                <th>Total P</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, i) => {
                const totals = calculateTotals(row);
                const hasEdits = !!editMap[row.courseOfferingId];
                
                return (
                  <tr key={row.courseOfferingId} className={hasEdits ? 'wl-tr-modified' : (i % 2 === 0 ? 'wl-tr-even' : 'wl-tr-odd')} style={hasEdits ? { backgroundColor: '#f0fdf4' } : {}}>
                    <td><span className="wl-badge-prog">{row.program}</span></td>
                    <td>{i + 1}</td>
                    <td><span className="wl-year-pill">{row.year}</span></td>
                    <td>{row.semester}</td>
                    <td style={{ fontWeight: 500 }}>{row.subjectName}</td>
                    <td>{row.shortName}</td>
                    <td className="wl-td-code">{row.subjectCode}</td>
                    <td>{row.courseType}</td>
                    <td className="wl-td-num">{row.L}</td>
                    <td className="wl-td-num">{row.T}</td>
                    <td className="wl-td-num">{row.P}</td>
                    <td className="wl-td-num wl-td-c">{row.C}</td>
                    <td className="wl-td-num">
                      <input 
                        type="number" 
                        min="0"
                        className="wl-cw-input"
                        value={getRowVal(row, 'tpBatches')}
                        onChange={(e) => handleEdit(row.courseOfferingId, 'tpBatches', e.target.value)}
                      />
                    </td>
                    <td className="wl-td-num">
                      <input 
                        type="number" 
                        min="0"
                        className="wl-cw-input"
                        value={getRowVal(row, 'noOfSections')}
                        onChange={(e) => handleEdit(row.courseOfferingId, 'noOfSections', e.target.value)}
                      />
                    </td>
                    <td className="wl-td-num">
                      <input 
                        type="number" 
                        min="0"
                        className="wl-cw-input"
                        value={getRowVal(row, 'studentStrength')}
                        onChange={(e) => handleEdit(row.courseOfferingId, 'studentStrength', e.target.value)}
                      />
                    </td>
                    <td className="wl-td-num wl-td-total">{totals.totalL}</td>
                    <td className="wl-td-num wl-td-total">{totals.totalT}</td>
                    <td className="wl-td-num wl-td-total">{totals.totalP}</td>
                    <td className="wl-td-num" style={{ fontWeight: 600, color: '#0369a1' }}>{totals.total}</td>
                  </tr>
                );
              })}
              {displayData.length === 0 && (
                <tr>
                  <td colSpan="19" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    No courses found for the selected academic period.
                  </td>
                </tr>
              )}
            </tbody>
            {displayData.length > 0 && (() => {
              // Compute column-wise totals
              let sumL = 0, sumT = 0, sumP = 0, sumC = 0;
              let sumTpBatches = 0, sumNoOfSections = 0, sumStudentStrength = 0;
              let sumTotalL = 0, sumTotalT = 0, sumTotalP = 0, sumTotal = 0;
              displayData.forEach(row => {
                const totals = calculateTotals(row);
                sumL += Number(row.L) || 0;
                sumT += Number(row.T) || 0;
                sumP += Number(row.P) || 0;
                sumC += Number(row.C) || 0;
                sumTpBatches += Number(getRowVal(row, 'tpBatches')) || 0;
                sumNoOfSections += Number(getRowVal(row, 'noOfSections')) || 0;
                sumStudentStrength += Number(getRowVal(row, 'studentStrength')) || 0;
                sumTotalL += Number(totals.totalL) || 0;
                sumTotalT += Number(totals.totalT) || 0;
                sumTotalP += Number(totals.totalP) || 0;
                sumTotal += Number(totals.total) || 0;
              });
              return (
                <tfoot>
                  <tr style={{ backgroundColor: '#1e40af', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>
                      TOTAL ({displayData.length} courses)
                    </td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}></td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumL}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumT}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumP}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumC}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumTpBatches || ''}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumNoOfSections || ''}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a' }}>{sumStudentStrength || ''}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a', color: '#bfdbfe' }}>{sumTotalL}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a', color: '#bfdbfe' }}>{sumTotalT}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a', color: '#bfdbfe' }}>{sumTotalP}</td>
                    <td style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #1e3a8a', color: '#fde68a', fontSize: '0.9rem' }}>{sumTotal}</td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}
    </div>
  );
};

export default CourseWiseWorkloadPage;
