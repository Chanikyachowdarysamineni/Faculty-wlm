import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [yearFilter, setYearFilter] = useState('All');
  const [systemPrograms, setSystemPrograms] = useState([]);
  const [systemYearsPerProgram, setSystemYearsPerProgram] = useState({});

  const toRoman = (val) => {
    const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': 'I', 'II': 'II', 'III': 'III', 'IV': 'IV' };
    return map[String(val)] || val;
  };

  const toNum = (val) => {
    const map = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4', '1': '1', '2': '2', '3': '3', '4': '4' };
    return map[String(val)] || String(val);
  };

  const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '1': 1, '2': 2, '3': 3, '4': 4 };

  // Fetch available programs and years configuration on mount
  useEffect(() => {
    const fetchConfigAndFilters = async () => {
      try {
        const token = localStorage.getItem('wlm_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        fetch(`${API}/deva/config`, { headers })
          .then(r => r.json())
          .then(json => {
            if (json.success && json.data?.programs) {
              const activeProgs = json.data.programs.filter(p => p.isActive).map(p => p.value);
              if (activeProgs.length > 0) {
                setSystemPrograms(prev => Array.from(new Set([...prev, ...activeProgs])).sort());
              }
            }
          })
          .catch(() => {});

        fetch(`${API}/deva/course-loads/filters`, { headers })
          .then(r => r.json())
          .then(json => {
            if (json.success && json.data) {
              const payload = json.data.data || json.data;
              if (payload.programs && payload.programs.length > 0) {
                setSystemPrograms(prev => Array.from(new Set([...prev, ...payload.programs])).sort());
              }
              if (payload.yearsPerProgram) {
                const cleanYpp = {};
                for (const [prog, yrs] of Object.entries(payload.yearsPerProgram)) {
                  let mapped = (yrs || []).map(toRoman).filter(y => y && y !== 'M.Tech' && y !== 'Other');
                  if (prog === 'M.Tech') {
                    mapped = mapped.filter(y => y === 'I' || y === 'II');
                    if (mapped.length === 0) mapped = ['I', 'II'];
                  } else if (prog === 'B.Tech') {
                    if (mapped.length === 0) mapped = ['I', 'II', 'III', 'IV'];
                  }
                  cleanYpp[prog] = Array.from(new Set(mapped)).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
                }
                setSystemYearsPerProgram(prev => ({ ...prev, ...cleanYpp }));
              }
            }
          })
          .catch(() => {});
      } catch (err) {
        // ignore
      }
    };
    fetchConfigAndFilters();
  }, []);

  // Editable state
  const [editMap, setEditMap] = useState({});
  const [unsaved, setUnsaved] = useState(false);

  // Mouse scroll handling & container ref
  const tableContainerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);

  const scrollHorizontal = (offset) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollVertical = (offset) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (['INPUT', 'SELECT', 'BUTTON', 'A', 'TEXTAREA'].includes(e.target.tagName)) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - (tableContainerRef.current?.offsetLeft || 0);
    startYRef.current = e.pageY - (tableContainerRef.current?.offsetTop || 0);
    scrollLeftRef.current = tableContainerRef.current?.scrollLeft || 0;
    scrollTopRef.current = tableContainerRef.current?.scrollTop || 0;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grabbing';
      tableContainerRef.current.style.userSelect = 'none';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (tableContainerRef.current.offsetLeft || 0);
    const y = e.pageY - (tableContainerRef.current.offsetTop || 0);
    const walkX = (x - startXRef.current) * 1.5;
    const walkY = (y - startYRef.current) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftRef.current - walkX;
    tableContainerRef.current.scrollTop = scrollTopRef.current - walkY;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current && tableContainerRef.current) {
      isDraggingRef.current = false;
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleWheel = (e) => {
    if (!tableContainerRef.current) return;
    // Shift + wheel or Alt + wheel or horizontal wheel delta
    if (e.shiftKey || e.altKey) {
      tableContainerRef.current.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedAcademicYearId, selectedSemester]);

  // Real-time synchronization
  useEffect(() => {
    const handleReload = () => {
      fetchData();
    };
    window.addEventListener('wlm:workloads_reload', handleReload);
    window.addEventListener('wlm:courses_reload', handleReload);
    return () => {
      window.removeEventListener('wlm:workloads_reload', handleReload);
      window.removeEventListener('wlm:courses_reload', handleReload);
    };
  }, [selectedAcademicYearId, selectedSemester]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYearId) params.append('academicYearId', selectedAcademicYearId);
      if (selectedAcademicYear) params.append('academicYear', selectedAcademicYear);
      if (selectedSemester) params.append('semester', selectedSemester);

      const res = await fetch(`${API}/deva/course-workload-plan?${params.toString()}`, {
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
      const params = new URLSearchParams();
      if (selectedAcademicYearId) params.append('academicYearId', selectedAcademicYearId);
      if (selectedAcademicYear) params.append('academicYear', selectedAcademicYear);
      if (selectedSemester) params.append('semester', selectedSemester);

      const res = await fetch(`${API}/deva/course-workload-plan/bulk/update?${params.toString()}`, {
        method: 'PUT',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          academicYear: selectedAcademicYear,
          semester: selectedSemester,
          items
        })
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

  // Extract unique programs dynamically from data and system config
  const availablePrograms = useMemo(() => {
    const programs = new Set([
      ...systemPrograms,
      ...data.map(r => r.program).filter(Boolean)
    ]);
    const list = Array.from(programs).sort();
    return list.length > 0 ? list : ['B.Tech', 'M.Tech'];
  }, [data, systemPrograms]);

  // Extract available years based on programFilter
  const availableYears = useMemo(() => {
    if (programFilter && programFilter !== 'All') {
      let progYears = systemYearsPerProgram[programFilter];
      if (programFilter === 'M.Tech') {
        const dataMTechYears = data
          .filter(r => r.program === 'M.Tech')
          .map(r => toRoman(r.year))
          .filter(y => y === 'I' || y === 'II');
        const base = (progYears || ['I', 'II']).map(toRoman).filter(y => y === 'I' || y === 'II');
        const combined = Array.from(new Set([...base, ...dataMTechYears])).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
        return combined.length > 0 ? combined : ['I', 'II'];
      }
      if (programFilter === 'B.Tech') {
        const dataBTechYears = data
          .filter(r => r.program === 'B.Tech' || !r.program)
          .map(r => toRoman(r.year))
          .filter(y => ['I', 'II', 'III', 'IV'].includes(y));
        const base = (progYears || ['I', 'II', 'III', 'IV']).map(toRoman).filter(y => ['I', 'II', 'III', 'IV'].includes(y));
        const combined = Array.from(new Set([...base, ...dataBTechYears])).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
        return combined.length > 0 ? combined : ['I', 'II', 'III', 'IV'];
      }
      const dataProgYears = data
        .filter(r => r.program === programFilter)
        .map(r => toRoman(r.year))
        .filter(y => y && y !== 'M.Tech' && y !== 'Other');
      const base = (progYears || []).map(toRoman).filter(y => y && y !== 'M.Tech' && y !== 'Other');
      return Array.from(new Set([...base, ...dataProgYears])).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
    }
    const allYears = new Set(['I', 'II', 'III', 'IV']);
    Object.values(systemYearsPerProgram).forEach(list => {
      (list || []).forEach(y => {
        const rom = toRoman(y);
        if (rom && rom !== 'M.Tech' && rom !== 'Other') allYears.add(rom);
      });
    });
    data.forEach(r => {
      const rom = toRoman(r.year);
      if (rom && rom !== 'M.Tech' && rom !== 'Other') allYears.add(rom);
    });
    return Array.from(allYears).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
  }, [programFilter, data, systemYearsPerProgram]);

  const displayData = useMemo(() => {
    let result = [...data];
    if (programFilter && programFilter !== 'All') {
      result = result.filter(r => (r.program || '') === programFilter);
    }
    if (yearFilter && yearFilter !== 'All') {
      result = result.filter(r => {
        const rYear = String(r.year || '');
        return rYear === String(yearFilter) || toNum(rYear) === toNum(yearFilter) || toRoman(rYear) === toRoman(yearFilter);
      });
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r => 
        (r.subjectName || '').toLowerCase().includes(q) ||
        (r.subjectCode || '').toLowerCase().includes(q) ||
        (r.program || '').toLowerCase().includes(q) ||
        (r.shortName || '').toLowerCase().includes(q)
      );
    }
    // Sort by program, then year, then subject code
    return result.sort((a, b) => {
      if (a.program !== b.program) return (a.program || '').localeCompare(b.program || '');
      const ya = romanOrder[toRoman(a.year)] || 99;
      const yb = romanOrder[toRoman(b.year)] || 99;
      if (ya !== yb) return ya - yb;
      return (a.subjectCode || '').localeCompare(b.subjectCode || '');
    });
  }, [data, search, programFilter, yearFilter, editMap]);

  // Export Columns definition
  const getExportColumns = () => [
    { header: 'Program', value: r => r.program },
    { header: 'Sl. No.', value: (r, i) => r.__isTotal ? '' : i + 1 },
    { header: 'Year', value: r => r.__isTotal ? '' : `${toRoman(r.year)} Year` },
    { header: 'Sem', value: r => r.__isTotal ? '' : r.semester },
    { header: 'Course Name', value: r => r.__isTotal ? '' : r.subjectName },
    { header: 'Short Form in the Time-Table', value: r => r.__isTotal ? '' : r.shortName },
    { header: 'Subject Code', value: r => r.__isTotal ? '' : r.subjectCode },
    { header: 'Course Type', value: r => r.__isTotal ? '' : r.courseType },
    { header: 'L', value: r => r.L },
    { header: 'T', value: r => r.T },
    { header: 'P', value: r => r.P },
    { header: 'C', value: r => r.C },
    { header: 'T&P Batches', value: r => r.__isTotal ? r.tpBatches : getRowVal(r, 'tpBatches') },
    { header: 'No of Sections', value: r => r.__isTotal ? r.noOfSections : getRowVal(r, 'noOfSections') },
    { header: 'Student Strength', value: r => r.__isTotal ? r.studentStrength : getRowVal(r, 'studentStrength') },
    { header: 'Total L', value: r => r.__isTotal ? r.totalL : calculateTotals(r).totalL },
    { header: 'Total T', value: r => r.__isTotal ? r.totalT : calculateTotals(r).totalT },
    { header: 'Total P', value: r => r.__isTotal ? r.totalP : calculateTotals(r).totalP },
    { header: 'Total', value: r => r.__isTotal ? r.total : calculateTotals(r).total }
  ];

  const handleExport = (type) => {
    // Compute column-wise totals exactly matching the UI footer row
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

    const totalRow = {
      __isTotal: true,
      program: `TOTAL (${displayData.length} courses)`,
      L: sumL,
      T: sumT,
      P: sumP,
      C: sumC,
      tpBatches: sumTpBatches || '',
      noOfSections: sumNoOfSections || '',
      studentStrength: sumStudentStrength || '',
      totalL: sumTotalL,
      totalT: sumTotalT,
      totalP: sumTotalP,
      total: sumTotal,
    };

    const config = {
      fileName: `Course_Wise_Workload_${selectedAcademicYear}_${selectedSemester}`,
      title: `Course Wise Workload - ${selectedAcademicYear} - ${selectedSemester}`,
      columns: getExportColumns(),
      rows: [...displayData, totalRow]
    };
    if (type === 'excel') exportAsExcel(config);
    else if (type === 'csv') exportAsCSV(config);
    else if (type === 'pdf') exportAsPDF(config);
  };

  return (
    <div className="wl-wrapper">
      <div className="wl-topbar">
        <div className="wl-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="wl-btn wl-btn-forms" onClick={() => {
            try { sessionStorage.setItem('wlm_dash_mode', 'admin'); } catch {}
            navigate('/dashboard');
          }}>
            ← Back to Dashboard
          </button>
          <h2 className="wl-heading">Course Wise Workload Details</h2>
          <span className="wl-count-badge">{displayData.length} courses</span>
        </div>
        
        <div className="wl-topbar-right">
          <GlobalPeriodSelector />
          <div className="wl-search-wrap" style={{ marginLeft: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select 
              className="wl-search" 
              style={{ width: '135px' }}
              value={programFilter} 
              onChange={e => {
                setProgramFilter(e.target.value);
                setYearFilter('All');
              }}
            >
              <option value="All">All Programs</option>
              {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select 
              className="wl-search" 
              style={{ width: '115px' }}
              value={yearFilter} 
              onChange={e => setYearFilter(e.target.value)}
            >
              <option value="All">All Years</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{toRoman(y)} Year</option>
              ))}
            </select>

            <input 
              className="wl-search" 
              style={{ width: '180px' }}
              placeholder="Search courses..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          {/* Scroll controls for mouse users */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '8px', border: '1px solid #cbd5e1', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>🖱️ Scroll:</span>
            <button
              type="button"
              className="wl-btn"
              onClick={() => scrollHorizontal(-350)}
              title="Scroll table left (or drag with mouse)"
              style={{ padding: '4px 8px', fontSize: '12px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}
            >
              ◀ Left
            </button>
            <button
              type="button"
              className="wl-btn"
              onClick={() => scrollHorizontal(350)}
              title="Scroll table right (or drag with mouse)"
              style={{ padding: '4px 8px', fontSize: '12px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}
            >
              Right ▶
            </button>
            <button
              type="button"
              className="wl-btn"
              onClick={() => scrollVertical(-250)}
              title="Scroll table up (or drag with mouse)"
              style={{ padding: '4px 8px', fontSize: '12px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}
            >
              ▲ Top
            </button>
            <button
              type="button"
              className="wl-btn"
              onClick={() => scrollVertical(250)}
              title="Scroll table down (or drag with mouse)"
              style={{ padding: '4px 8px', fontSize: '12px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}
            >
              Bottom ▼
            </button>
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
        <div
          ref={tableContainerRef}
          className="wl-table-container cww-scroll-container"
          style={{
            marginTop: '16px',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 210px)',
            minHeight: '400px',
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            cursor: 'grab',
            position: 'relative'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          <table className="wl-table" style={{ whiteSpace: 'nowrap', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e3a8a' }}>
              <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Program</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Sl. No.</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Year</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Sem</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Course Name</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Short Form</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Subject Code</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Course Type</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>L</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>T</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>P</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>C</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>T&P Batches</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>No of Sections</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Student Strength</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Total L</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Total T</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Total P</th>
                <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11 }}>Total</th>
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
                    <td><span className="wl-year-pill">{toRoman(row.year)} Year</span></td>
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
                <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 9, backgroundColor: '#ffffff' }}>
                  <tr style={{ backgroundColor: '#ffffff', color: '#000000', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 -2px 6px rgba(0,0,0,0.06)' }}>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000' }}>
                      TOTAL ({displayData.length} courses)
                    </td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff' }}></td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumL}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumT}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumP}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumC}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumTpBatches || ''}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumNoOfSections || ''}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumStudentStrength || ''}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumTotalL}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumTotalT}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 700 }}>{sumTotalP}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#ffffff', color: '#000000', fontWeight: 800, fontSize: '0.95rem' }}>{sumTotal}</td>
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
