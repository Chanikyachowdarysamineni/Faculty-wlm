import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './config';
import { fetchJsonWithRetry } from './utils/apiFetchAll';
import { useAcademicPeriod } from './AcademicPeriodContext';
import './CourseLoadsPage.css';
import './WorkloadPage.css'; // Use workload styling

const CourseLoadsPage = () => {
  const navigate = useNavigate();
  const { selectedAcademicYear, selectedSemester } = useAcademicPeriod();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [filters, setFilters] = useState({
    academicYear: selectedAcademicYear,
    semesterType: selectedSemester,
    program: '',
    year: '',
    search: ''
  });
  
  const [availableFilters, setAvailableFilters] = useState({
    academicYears: [],
    semesterTypes: [],
    programs: [],
    yearsPerProgram: {},
    allYears: []
  });

  const [data, setData] = useState([]);

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
    if (e.shiftKey || e.altKey) {
      tableContainerRef.current.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  const toRoman = (val) => {
    const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': 'I', 'II': 'II', 'III': 'III', 'IV': 'IV' };
    return map[String(val)] || val;
  };

  const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '1': 1, '2': 2, '3': 3, '4': 4 };

  // Load available filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const token = localStorage.getItem('wlm_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const res = await fetchJsonWithRetry(`${API}/deva/course-loads/filters`, { headers });
        if (res && res.success) {
          const payload = res.data.data || res.data; // Handle double-wrapping if present
          const progs = Array.from(new Set(payload.programs || [])).sort();
          const yppRaw = payload.yearsPerProgram || {};
          
          const ypp = {};
          const programList = progs.length > 0 ? progs : ['B.Tech', 'M.Tech'];
          for (const prog of programList) {
            let yrList = (yppRaw[prog] || []).map(toRoman).filter(y => y && y !== 'M.Tech' && y !== 'Other');
            if (yrList.length === 0) {
              yrList = prog === 'M.Tech' ? ['I', 'II'] : ['I', 'II', 'III', 'IV'];
            }
            ypp[prog] = Array.from(new Set(yrList)).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
          }

          const ayList = Array.from(new Set(Object.values(ypp).flat()))
            .filter(y => y && y !== 'M.Tech' && y !== 'Other')
            .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));

          setAvailableFilters({
            academicYears: payload.academicYears || [],
            semesterTypes: payload.semesterTypes || [],
            programs: programList,
            yearsPerProgram: ypp,
            allYears: ayList.length > 0 ? ayList : ['I', 'II', 'III', 'IV']
          });
          
          setFilters(prev => ({
            ...prev,
            academicYear: payload.academicYears && payload.academicYears.includes(selectedAcademicYear) 
              ? selectedAcademicYear 
              : ((payload.academicYears && payload.academicYears[0]) || ''),
            semesterType: payload.semesterTypes && payload.semesterTypes.includes(selectedSemester)
              ? selectedSemester
              : ((payload.semesterTypes && payload.semesterTypes[0]) || ''),
          }));
        }
      } catch (err) {
        console.error('Failed to load filters', err);
      }
    };
    loadFilters();
  }, [selectedAcademicYear, selectedSemester]);

  // Load data
  const loadData = useCallback(async () => {
    if (!filters.academicYear || !filters.semesterType) return;
    
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('wlm_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const queryParams = new URLSearchParams();
      if (filters.academicYear) queryParams.append('academicYear', filters.academicYear);
      if (filters.semesterType) queryParams.append('semesterType', filters.semesterType);
      if (filters.program) queryParams.append('program', filters.program);
      if (filters.year) queryParams.append('year', filters.year);
      if (filters.search) queryParams.append('search', filters.search);
      
      const res = await fetch(`${API}/deva/course-loads?${queryParams.toString()}`, { headers });
      const json = await res.json();
      
      if (res.ok && json.success) {
        const fetchedData = json.data || [];
        setData(fetchedData);
        // Discover any programs or years in loaded data and merge
        const dataProgs = fetchedData.map(p => p.program).filter(Boolean);
        const dataYears = fetchedData.flatMap(p => (p.years || []).map(y => toRoman(y.year)))
          .filter(y => y && y !== 'M.Tech' && y !== 'Other');

        if (dataProgs.length > 0 || dataYears.length > 0) {
          setAvailableFilters(prev => {
            const mergedPrograms = Array.from(new Set([...prev.programs, ...dataProgs])).sort();
            const mergedAllYears = Array.from(new Set([...prev.allYears.map(toRoman), ...dataYears]))
              .filter(y => y && y !== 'M.Tech' && y !== 'Other')
              .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));

            const updatedYpp = { ...prev.yearsPerProgram };
            fetchedData.forEach(p => {
              if (p.program && Array.isArray(p.years)) {
                const pYears = p.years.map(y => toRoman(y.year)).filter(y => y && y !== 'M.Tech' && y !== 'Other');
                const existing = updatedYpp[p.program] || [];
                updatedYpp[p.program] = Array.from(new Set([...existing, ...pYears]))
                  .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
              }
            });

            return {
              ...prev,
              programs: mergedPrograms,
              yearsPerProgram: updatedYpp,
              allYears: mergedAllYears.length > 0 ? mergedAllYears : ['I', 'II', 'III', 'IV']
            };
          });
        }
      } else {
        setError(json.message || 'Failed to fetch course loads');
      }
    } catch (err) {
      setError('Network error loading course loads');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      if (field === 'program' && newFilters.program !== prev.program) {
        newFilters.year = ''; // cascade reset year
      }
      return newFilters;
    });
  };

  const displayYears = useMemo(() => {
    if (filters.program) {
      if (availableFilters.yearsPerProgram && availableFilters.yearsPerProgram[filters.program]?.length > 0) {
        return availableFilters.yearsPerProgram[filters.program]
          .map(toRoman)
          .filter(y => y && y !== 'M.Tech' && y !== 'Other')
          .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
      }
      if (filters.program === 'M.Tech') return ['I', 'II'];
      if (filters.program === 'B.Tech') return ['I', 'II', 'III', 'IV'];
    }
    if (availableFilters.allYears && availableFilters.allYears.length > 0) {
      return availableFilters.allYears
        .map(toRoman)
        .filter(y => y && y !== 'M.Tech' && y !== 'Other')
        .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
    }
    const unionedYears = new Set();
    Object.values(availableFilters.yearsPerProgram || {}).forEach(yrList => {
      (yrList || []).forEach(y => {
        const rom = toRoman(y);
        if (rom && rom !== 'M.Tech' && rom !== 'Other') unionedYears.add(rom);
      });
    });
    const res = Array.from(unionedYears).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
    return res.length > 0 ? res : ['I', 'II', 'III', 'IV'];
  }, [filters.program, availableFilters]);

  return (
    <div className="course-loads-page">
      <div className="clp-header-sticky">
        <div className="clp-topbar">
          <button className="clp-back-btn" onClick={() => navigate('/dashboard')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Dashboard
          </button>
          <h1>Course Loads</h1>
        </div>

        <div className="clp-filters">
          <div className="clp-filter-group">
            <label>Academic Year</label>
            <select value={filters.academicYear} onChange={e => handleFilterChange('academicYear', e.target.value)}>
              {availableFilters.academicYears.map(ay => (
                <option key={ay} value={ay}>{ay}</option>
              ))}
            </select>
          </div>

          <div className="clp-filter-group">
            <label>Semester Type</label>
            <select value={filters.semesterType} onChange={e => handleFilterChange('semesterType', e.target.value)}>
              {availableFilters.semesterTypes.map(st => (
                <option key={st} value={st}>
                  {st.charAt(0).toUpperCase() + st.slice(1).toLowerCase()} Semester
                </option>
              ))}
            </select>
          </div>

          <div className="clp-filter-group">
            <label>Program</label>
            <select value={filters.program} onChange={e => handleFilterChange('program', e.target.value)}>
              <option value="">All Programs</option>
              {availableFilters.programs.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="clp-filter-group">
            <label>Year</label>
            <select 
              value={filters.year} 
              onChange={e => handleFilterChange('year', e.target.value)}
            >
              <option value="">All Years</option>
              {displayYears.map(y => (
                <option key={y} value={y}>{toRoman(y)} Year</option>
              ))}
            </select>
          </div>

          <div className="clp-filter-group clp-search-group">
            <label>Search</label>
            <input 
              type="text" 
              placeholder="Code or Name..." 
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>

          {/* Mouse scroll buttons */}
          <div className="clp-filter-group" style={{ justifyContent: 'flex-end' }}>
            <label>🖱️ Table Scroll</label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => scrollHorizontal(-350)}
                title="Scroll table left (or drag with mouse)"
                style={{ padding: '8px 10px', fontSize: '13px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                ◀ Left
              </button>
              <button
                type="button"
                onClick={() => scrollHorizontal(350)}
                title="Scroll table right (or drag with mouse)"
                style={{ padding: '8px 10px', fontSize: '13px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Right ▶
              </button>
              <button
                type="button"
                onClick={() => scrollVertical(-250)}
                title="Scroll table up (or drag with mouse)"
                style={{ padding: '8px 10px', fontSize: '13px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                ▲ Top
              </button>
              <button
                type="button"
                onClick={() => scrollVertical(250)}
                title="Scroll table down (or drag with mouse)"
                style={{ padding: '8px 10px', fontSize: '13px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Bottom ▼
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="clp-content">
        {loading ? (
          <div className="clp-loading">Loading course loads...</div>
        ) : error ? (
          <div className="clp-error">{error}</div>
        ) : data.length === 0 ? (
          <div className="clp-empty">No courses found for this selection.</div>
        ) : (
          <div style={{ width: '100%' }}>
            <div className="clp-summary-header" style={{ marginBottom: '14px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong>Completeness Summary: </strong>
                {data.length} Program(s) | {data.reduce((acc, p) => acc + p.years.length, 0)} Year(s) | {data.reduce((acc, p) => acc + p.years.reduce((yAcc, y) => yAcc + y.courses.length, 0), 0)} Total Course(s)
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>💡 Tip: Click and drag table with mouse in any direction, or use mouse wheel with Shift</span>
            </div>
            <div
              ref={tableContainerRef}
              className="wl-table-container clp-table-scroll-container"
              style={{
                overflow: 'auto',
                maxHeight: 'calc(100vh - 280px)',
                minHeight: '380px',
                width: '100%',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>PROGRAM</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center' }}>SL. NO.</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>YEAR</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>SEM</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>COURSE NAME</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>COURSE CODE</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>SECTIONS ALLOCATED</th>
                    <th style={{ position: 'sticky', top: 0, background: '#1e3a8a', color: '#ffffff', zIndex: 11, padding: '12px 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>SECTIONS NOT ALLOCATED</th>
                  </tr>
                </thead>
                <tbody>
                  {data.flatMap(progGroup => 
                    progGroup.years.flatMap(yearGroup => 
                      yearGroup.courses.map(course => ({
                        program: progGroup.program,
                        year: yearGroup.year,
                        ...course
                      }))
                    )
                  ).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'wl-tr-even' : 'wl-tr-odd'}>
                      <td><span className="wl-badge-prog">{row.program}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>{i + 1}</td>
                      <td><span className="wl-year-pill">{toRoman(row.year)} Year</span></td>
                      <td>
                        <span className="clp-sem-pill">
                          {row.semester ? (row.semester.charAt(0).toUpperCase() + row.semester.slice(1).toLowerCase()) : (filters.semesterType ? (filters.semesterType.charAt(0).toUpperCase() + filters.semesterType.slice(1).toLowerCase()) : '—')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.courseName}</td>
                      <td><span className="wl-td-code">{row.courseCode}</span></td>
                      <td>
                        {row.allocatedSections && row.allocatedSections.length > 0 ? (
                          <div className="clp-badge-wrap">
                            {row.allocatedSections.map(sec => (
                              <span key={sec} className="clp-sec-pill clp-sec-pill-allocated" title={`Section ${sec} Allocated`}>
                                {sec}
                              </span>
                            ))}
                            <span className="clp-sec-count">({row.allocatedSections.length})</span>
                          </div>
                        ) : (
                          <span className="clp-empty-text">None</span>
                        )}
                      </td>
                      <td>
                        {row.notAllocatedSections && row.notAllocatedSections.length > 0 ? (
                          <div className="clp-badge-wrap">
                            {row.notAllocatedSections.map(sec => (
                              <span key={sec} className="clp-sec-pill clp-sec-pill-not-allocated" title={`Section ${sec} Not Allocated`}>
                                {sec}
                              </span>
                            ))}
                            <span className="clp-sec-count">({row.notAllocatedSections.length})</span>
                          </div>
                        ) : (
                          <span className="clp-all-allocated-badge">All Allocated ✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseLoadsPage;
