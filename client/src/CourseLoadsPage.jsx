import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    yearsPerProgram: {}
  });

  const [data, setData] = useState([]);

  // Load available filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const token = localStorage.getItem('wlm_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const res = await fetchJsonWithRetry(`${API}/deva/course-loads/filters`, { headers });
        if (res && res.success) {
          const payload = res.data.data || res.data; // Handle double-wrapping if present
          setAvailableFilters({
            academicYears: payload.academicYears || [],
            semesterTypes: payload.semesterTypes || [],
            programs: payload.programs || [],
            yearsPerProgram: payload.yearsPerProgram || {}
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
        setData(json.data || []);
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

  const toRoman = (val) => {
    const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
    return map[val] || val;
  };

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
              disabled={!filters.program}
              title={!filters.program ? 'Select a program first' : ''}
            >
              <option value="">All Years</option>
              {(availableFilters.yearsPerProgram[filters.program] || []).map(y => (
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
          <div className="wl-table-container" style={{ marginTop: '16px', overflowX: 'auto', width: '100%' }}>
            <div className="clp-summary-header" style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
              <strong>Completeness Summary: </strong>
              {data.length} Program(s) | {data.reduce((acc, p) => acc + p.years.length, 0)} Year(s) | {data.reduce((acc, p) => acc + p.years.reduce((yAcc, y) => yAcc + y.courses.length, 0), 0)} Total Course(s)
            </div>
            <table className="wl-table" style={{ whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th>PROGRAM</th>
                  <th>SL. NO.</th>
                  <th>YEAR</th>
                  <th>SEM</th>
                  <th>COURSE NAME</th>
                  <th>COURSE CODE</th>
                  <th>SECTIONS ALLOCATED</th>
                  <th>SECTIONS NOT ALLOCATED</th>
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
                    <td>{i + 1}</td>
                    <td><span className="wl-year-pill">{toRoman(row.year)}</span></td>
                    <td>{filters.semesterType}</td>
                    <td style={{ fontWeight: 500 }}>{row.courseName}</td>
                    <td className="wl-td-code">{row.courseCode}</td>
                    <td className="clp-list clp-allocated">
                      {`{${row.allocatedSections.join(', ')}}`}
                    </td>
                    <td className="clp-list clp-not-allocated">
                      {`{${row.notAllocatedSections.join(', ')}}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseLoadsPage;
