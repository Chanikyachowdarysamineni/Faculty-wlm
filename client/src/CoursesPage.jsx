import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAcademicPeriod } from './AcademicPeriodContext';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { exportAsCSV, exportAsExcel } from './utils/exportUtils';
import { useToast } from './Toast';
import { useSharedData } from './DataContext';
import ManageCourseTypesModal from './ManageCourseTypesModal';
import './CoursesPage.css';

// const PROGRAMS removed
// const COURSE_TYPES removed
// const YEARS_BTECH removed
// YEAR_OPTIONS removed

const emptyCourseForm = {
  program: '', courseType: '', year: '',
  subjectCode: '', subjectName: '', shortName: '',
  L: 0, T: 0, P: 0, C: 0,
  // 'Other' free-text companions
  programOther: '', courseTypeOther: '', yearOther: '',
  allowedSectionsText: '', // For comma-separated section strings
};

// ── CoursesPage ────────────────────────────────────────────────
const CoursesPage = ({ isAdmin = true }) => {
  const { selectedAcademicYearId, selectedSemester, selectedAcademicYear } = useAcademicPeriod();

  const { courses: contextCourses, setCourses: setContextCourses, systemConfig, setSystemConfig } = useSharedData();

  // ── Data state ──
  const [courseList, setCourseList] = useState(contextCourses || []);
  const [loadingCourses, setLoadingCourses] = useState(!contextCourses);

  // Sync shared context data to local state
  useEffect(() => {
    if (contextCourses) {
      setCourseList(contextCourses);
      setLoadingCourses(false);
    }
  }, [contextCourses]);

  const activeYearsRaw = (systemConfig?.years || []).filter(y => y.isActive && y.value !== 'M.Tech').map(y => y.value);
  const distinctCourseYears = Array.from(new Set((courseList || []).map(c => c.year).filter(y => y && y !== 'M.Tech')));
  const allKnownYears = Array.from(new Set([...activeYearsRaw, ...distinctCourseYears]));

  const YEAR_OPTIONS = allKnownYears.length > 0
    ? [...allKnownYears.filter(y => y !== 'M.Tech').map(y => ({ value: y, label: `${y} Year` })), { value: '__other__', label: 'Others' }]
    : [{ value: '__other__', label: 'Others' }];

  const activeCourseTypes = (systemConfig?.courseTypes || [])
    .filter(c => c && c.isActive !== false)
    .map(c => typeof c === 'string' ? c : (c.value || c.name || c.label))
    .filter(Boolean);
  const distinctCourseTypes = Array.from(new Set((courseList || []).map(c => c.courseType).filter(Boolean)));
  const COURSE_TYPES = Array.from(new Set([...activeCourseTypes, ...distinctCourseTypes])).filter(Boolean);

  const configPrograms = (systemConfig?.programs || []).filter(c => c.isActive).map(c => c.value);
  const distinctCoursePrograms = Array.from(new Set((courseList || []).map(c => c.program).filter(Boolean)));
  const PROGRAMS = useMemo(() => {
    return Array.from(new Set([...configPrograms, ...distinctCoursePrograms])).filter(Boolean);
  }, [configPrograms, distinctCoursePrograms]);
  const YEARS = allKnownYears.filter(y => y !== 'Other' && y !== 'M.Tech');

  // ── Filters ──
  const [activeProgram, setActiveProgram] = useState('');
  const [activeYear, setActiveYear] = useState('');
  const [search, setSearch] = useState('');

  // Keep activeProgram valid if PROGRAMS update
  useEffect(() => {
    if (PROGRAMS.length > 0 && (!activeProgram || !PROGRAMS.includes(activeProgram))) {
      setActiveProgram(PROGRAMS[0]);
    }
  }, [PROGRAMS, activeProgram]);

  // Dynamic years available for the active program
  const programYears = useMemo(() => {
    const progEffective = activeProgram || PROGRAMS[0] || 'B.Tech';
    const coursesYears = courseList
      .filter(c => c.program === progEffective || (!c.program && progEffective === (PROGRAMS[0] || 'B.Tech')))
      .map(c => c.year)
      .filter(y => y && y !== 'M.Tech');
    const distinctInProg = Array.from(new Set(coursesYears));

    let baseYears = progEffective === 'M.Tech' ? ['I', 'II'] : ['I', 'II', 'III', 'IV'];
    const combined = Array.from(new Set([...baseYears, ...distinctInProg])).filter(Boolean);
    const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
    return combined.sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
  }, [courseList, activeProgram, PROGRAMS]);

  // Keep activeYear valid if programYears update
  useEffect(() => {
    if (programYears.length > 0 && !programYears.includes(activeYear)) {
      setActiveYear(programYears[0]);
    }
  }, [programYears, activeYear]);

  // ── Course modal ──
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [deleteCourse, setDeleteCourse] = useState(null);
  const [showManageTypes, setShowManageTypes] = useState(false);

  // ── Toast ──
  const { showToast } = useToast();

  const authHeaders = () => ({
    ...authJsonHeaders()
  });

  // ── Fetch courses from API ──
  const fetchCourses = useCallback(async () => {
    try {
      setLoadingCourses(true);
      const data = await fetchAllPages('/deva/courses', { semester: selectedSemester, academicYear: selectedAcademicYear }, { headers: authHeaders() });
      if (data?.success && Array.isArray(data.data)) {
        setCourseList(data.data);
        setContextCourses(data.data);
      } else {
        showToast('Failed to refresh courses list');
      }
    } catch (error) {
      showToast('Error loading courses');
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  }, [setContextCourses, showToast, selectedSemester, selectedAcademicYear]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // ── Re-fetch systemConfig to refresh COURSE_TYPES after modal changes or on mount ──
  const refreshSystemConfig = useCallback(async () => {
    try {
      const [resConfig, resTypes] = await Promise.allSettled([
        fetch(`${API}/deva/config`, { headers: authJsonHeaders() }),
        fetch(`${API}/deva/course-types/active`, { headers: authJsonHeaders() })
      ]);
      let updated = null;
      if (resConfig.status === 'fulfilled' && resConfig.value.ok) {
        const data = await resConfig.value.json();
        if (data.success && data.data) {
          updated = data.data;
        }
      }
      if (resTypes.status === 'fulfilled' && resTypes.value.ok) {
        const tData = await resTypes.value.json();
        if (tData.success && Array.isArray(tData.data) && tData.data.length > 0) {
          const mappedTypes = tData.data.map(t => ({
            value: t.name || t.id || t.value,
            label: t.label || t.name || t.value,
            isActive: t.isActive !== false
          }));
          updated = { ...(updated || {}), courseTypes: mappedTypes };
        }
      }
      if (updated) {
        setSystemConfig(prev => ({ ...(prev || {}), ...updated }));
      }
    } catch (err) {
      console.error('Failed to refresh system config:', err);
    }
  }, [setSystemConfig]);

  useEffect(() => {
    refreshSystemConfig();
  }, [refreshSystemConfig]);

  // ── Derived lists ──
  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase();
    const romanToNum = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
    const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
    const progEffective = activeProgram || PROGRAMS[0] || 'B.Tech';
    const yearEffective = activeYear || programYears[0] || 'I';
    return courseList.filter(c => {
      const progMatch = c.program === progEffective || (!c.program && progEffective === (PROGRAMS[0] || 'B.Tech'));
      const yearMatch = c.year === yearEffective ||
        romanToNum[c.year] === yearEffective ||
        numToRoman[c.year] === yearEffective;
      const searchMatch = !q ||
        (c.subjectCode && c.subjectCode.toLowerCase().includes(q)) ||
        (c.subjectName && c.subjectName.toLowerCase().includes(q)) ||
        (c.shortName && c.shortName.toLowerCase().includes(q));
      return progMatch && yearMatch && searchMatch;
    });
  }, [courseList, activeProgram, activeYear, search, PROGRAMS, programYears]);

  // Filter to show only B.Tech by default (remove M.Tech display)
  const displayCourses = useMemo(() => {
    return filteredCourses;
  }, [filteredCourses]);



  // ── Export handler ──
  const handleExport = (format) => {
    const columns = [
      { header: 'S.No.', key: 'sno' },
      { header: 'Course Code', key: 'subjectCode' },
      { header: 'Course Name', key: 'subjectName' },
      { header: 'Short Name', key: 'shortName' },
      { header: 'Course Type', key: 'courseType' },
      { header: 'L', key: 'L' },
      { header: 'T', key: 'T' },
      { header: 'P', key: 'P' },
      { header: 'C', key: 'C' },
    ];
    const rows = filteredCourses.map((c, i) => ({
      sno: i + 1,
      subjectCode: c.subjectCode,
      subjectName: c.subjectName,
      shortName: c.shortName,
      courseType: c.courseType,
      L: c.L,
      T: c.T,
      P: c.P,
      C: c.C,
    }));
    const fileName = 'courses_' + activeProgram + '_' + activeYear + '_' + Date.now();
    if (format === 'csv') {
      exportAsCSV({ fileName, columns, rows });
    } else {
      exportAsExcel({ fileName, columns, rows });
    }
  };

  // ── Course CRUD handlers ──
  const openAddCourse = () => {
    const defaultType = COURSE_TYPES.length > 0 ? COURSE_TYPES[0] : '';
    setCourseForm({ ...emptyCourseForm, program: activeProgram, year: activeYear, courseType: defaultType });
    setEditCourse(null);
    setShowCourseModal(true);
  };

  const openEditCourse = (c) => {
    setCourseForm({
      ...c,
      allowedSectionsText: Array.isArray(c.allowedSections) ? c.allowedSections.join(', ') : ''
    });
    setEditCourse(c);
    setShowCourseModal(true);
  };

  const saveCourse = async () => {
    const f = courseForm;
    if (!f.subjectCode.trim() || !f.subjectName.trim() || !f.shortName.trim()) {
      showToast('Please fill in Subject Code, Name and Short Name.'); return;
    }
    if (!f.courseType) {
      showToast('Please select Course Type.'); return;
    }
    if (f.courseType === '__other__' && !f.courseTypeOther.trim()) {
      showToast('Please type Course Type.'); return;
    }
    if (f.year === '__other__' && !f.yearOther.trim()) {
      showToast('Please type Year / Department.'); return;
    }
    // Resolve 'Other' free-text values
    const resolvedProgram = f.program === '__other__' ? f.programOther.trim() || 'Other' : f.program;
    const resolvedCourseType = f.courseType === '__other__' ? f.courseTypeOther.trim() || 'Other' : f.courseType;
    const resolvedYear = f.year === '__other__' ? f.yearOther.trim() || 'Other' : f.year;
    const payload = {
      program: resolvedProgram,
      courseType: resolvedCourseType,
      year: resolvedYear,
      subjectCode: f.subjectCode.trim(),
      subjectName: f.subjectName.trim(),
      shortName: f.shortName.trim(),
      L: +f.L,
      T: +f.T,
      P: +f.P,
      C: +f.C,
      allowedSections: f.allowedSectionsText
        ? f.allowedSectionsText.split(',').map(s => s.trim()).filter(Boolean)
        : []
    };
    try {
      // Build URL with academic period query params so the server middleware can resolve context
      const qp = new URLSearchParams();
      if (selectedAcademicYearId) qp.set('academicYearId', selectedAcademicYearId);
      if (selectedSemester) qp.set('semester', selectedSemester);
      const qs = qp.toString() ? `?${qp.toString()}` : '';
      const baseUrl = editCourse ? `${API}/deva/courses/${editCourse.id}` : `${API}/deva/courses`;
      const res = await fetch(
        `${baseUrl}${qs}`,
        {
          method: editCourse ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data?.errors?.length ? data.errors.map(e => typeof e === 'string' ? e : (e.msg || e.message || JSON.stringify(e))).join(' | ') : (data?.message || 'Could not save course.');
        showToast(errMsg);
        return;
      }

      // Refresh the course list from server to ensure consistency
      await fetchCourses();
      showToast(editCourse ? 'Course updated successfully.' : 'Course added successfully.');
      setShowCourseModal(false);
      setCourseForm({ ...emptyCourseForm });
      setEditCourse(null);
    } catch (error) {
      showToast('Network error while saving course.');
      console.error('Error saving course:', error);
    }
  };

  const confirmDeleteCourse = async () => {
    try {
      const res = await fetch(`${API}/deva/courses/${deleteCourse.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || 'Could not delete course.');
        return;
      }

      // Refresh the course list from server
      await fetchCourses();
      showToast('Course deleted successfully.');
      setDeleteCourse(null);
    } catch (error) {
      showToast('Network error while deleting course.');
      console.error('Error deleting course:', error);
    }
  };

  // ── helpers ──
  const courseCredits = (courseId) =>
    courseList.find(c => c.id === +courseId)?.C ?? '—';

  const colCount = isAdmin ? 10 : 9;

  if (loadingCourses) {
    return <div className="cp-wrapper"><div className="cp-empty-state">Loading courses…</div></div>;
  }

  // ═══════════════════════════════════════════
  return (
    <div className="cp-wrapper">

      {/* ── Page topbar ── */}
      <div className="cp-topbar">
        <div className="cp-topbar-left">
          <h2 className="cp-heading">Courses</h2>
          <span className="cp-count-badge">{courseList.length} total</span>
        </div>
        <div className="cp-topbar-right">
          <div className="cp-search-wrap">
            <svg className="cp-search-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="cp-search"
              placeholder="Search code, name, short name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="cp-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          {isAdmin && (
            <div className="cp-export-buttons">
              <button className="cp-btn cp-export-csv" onClick={() => handleExport('csv')} title="Export filtered courses as CSV" style={{ marginRight: '5px' }}>CSV</button>
              <button className="cp-btn cp-export-excel" onClick={() => handleExport('excel')} title="Export filtered courses as Excel">Excel</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Program tabs ── */}
      <div className="cp-program-tabs">
        {PROGRAMS.map(p => (
          <button
            key={p}
            className={`cp-prog-tab${activeProgram === p ? ' active' : ''}`}
            onClick={() => { setActiveProgram(p); setSearch(''); }}
          >
            {p}
            <span className="cp-prog-count">
              {courseList.filter(c => c.program === p || (!c.program && p === PROGRAMS[0])).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Program year tabs ── */}
      <div className="cp-year-tabs">
        {programYears.map(y => {
          const romanToNum = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
          const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
          const cnt = courseList.filter(
            c => (c.program === activeProgram || (!c.program && activeProgram === PROGRAMS[0])) &&
              (c.year === y || romanToNum[c.year] === y || numToRoman[c.year] === y)
          ).length;
          return (
            <button
              key={y}
              className={`cp-year-tab${activeYear === y ? ' active' : ''}`}
              onClick={() => { setActiveYear(y); setSearch(''); }}
            >
              <span className="cp-year-tab-label">{y} Year</span>
              {cnt > 0 && <span className="cp-year-tab-badge">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════
          SECTION 1 — Fixed Curriculum
      ════════════════════════════════════════ */}
      <div className="cp-section">
        <div className="cp-section-header">
          <div className="cp-section-meta">
            <span className="cp-badge cp-badge-fixed">📌 Fixed Curriculum</span>
            <span className="cp-section-sub">
              {activeProgram}
              {` · ${activeYear} Year`}
              {` · ${filteredCourses.length} course${filteredCourses.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="cp-btn" onClick={() => setShowManageTypes(true)} style={{ background: '#f8f9fa', color: '#1a73e8', border: '1px solid #dadce0' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Manage Course Types
              </button>
              <button className="cp-btn cp-btn-add" onClick={openAddCourse}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Course
              </button>
            </div>
          )}
        </div>

        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th className="cp-th-sno">S.No.</th>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Course Short Name</th>
                <th>Course Type</th>
                <th className="cp-th-num">L</th>
                <th className="cp-th-num">T</th>
                <th className="cp-th-num">P</th>
                <th className="cp-th-num cp-th-c">C</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayCourses.length === 0 ? (
                <tr><td colSpan={colCount} className="cp-td-empty">No courses found for {activeProgram} {activeYear} Year</td></tr>
              ) : filteredCourses.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'cp-tr-even' : 'cp-tr-odd'}>
                  <td className="cp-td-sno">{i + 1}</td>
                  <td className="cp-td-code">{c.subjectCode}</td>
                  <td className="cp-td-name">{c.subjectName}</td>
                  <td><span className="cp-short-pill">{c.shortName}</span></td>
                  <td>{c.courseType}</td>
                  <td className="cp-td-num">{c.L}</td>
                  <td className="cp-td-num">{c.T}</td>
                  <td className="cp-td-num">{c.P}</td>
                  <td className="cp-td-num cp-td-c">{c.C}</td>
                  {isAdmin && (
                    <td>
                      <div className="cp-actions">
                        <button className="cp-action cp-edit-btn" onClick={() => openEditCourse(c)}>✎ Edit</button>
                        <button className="cp-action cp-del-btn" onClick={() => setDeleteCourse(c)}>✕ Del</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MODAL — Add / Edit Course
      ════════════════════════════════════════ */}
      {showCourseModal && (
        <div className="cp-overlay" onClick={() => setShowCourseModal(false)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-head">
              <h3>{editCourse ? 'Edit Course' : 'Add New Course'}</h3>
              <button className="cp-modal-x" onClick={() => setShowCourseModal(false)}>✕</button>
            </div>
            <div className="cp-modal-body">
              <div className="cp-form-grid">
                {/* Program */}
                <div className="cp-fg">
                  <label>Program</label>
                  <select value={courseForm.program}
                    onChange={e => setCourseForm(p => ({ ...p, program: e.target.value, year: p.year }))}>
                    {PROGRAMS.map(pr => <option key={pr}>{pr}</option>)}
                    <option value="__other__">Other…</option>
                  </select>
                  {courseForm.program === '__other__' && (
                    <input
                      className="cp-other-input"
                      placeholder="Type program name…"
                      value={courseForm.programOther}
                      onChange={e => setCourseForm(p => ({ ...p, programOther: e.target.value }))}
                    />
                  )}
                </div>
                {/* Course Type */}
                <div className="cp-fg">
                  <label>Course Type</label>
                  <select value={courseForm.courseType || COURSE_TYPES[0] || ''}
                    onChange={e => setCourseForm(p => ({ ...p, courseType: e.target.value }))}>
                    {Array.from(new Set([
                      ...COURSE_TYPES,
                      ...(courseForm.courseType && courseForm.courseType !== '__other__' ? [courseForm.courseType] : [])
                    ])).map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__other__">Other…</option>
                  </select>
                  {courseForm.courseType === '__other__' && (
                    <input
                      className="cp-other-input"
                      placeholder="Type course type…"
                      value={courseForm.courseTypeOther}
                      onChange={e => setCourseForm(p => ({ ...p, courseTypeOther: e.target.value }))}
                    />
                  )}
                </div>
                {/* Year */}
                <div className="cp-fg">
                  <label>Year</label>
                  <select value={courseForm.year}
                    onChange={e => setCourseForm(p => ({ ...p, year: e.target.value }))}>
                    {YEAR_OPTIONS.filter(opt => {
                      if (opt.value === '__other__') return true;
                      if (courseForm.program === 'M.Tech') {
                        return opt.value === 'I' || opt.value === 'II';
                      }
                      return opt.value !== 'M.Tech';
                    }).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  {courseForm.year === '__other__' && (
                    <input
                      className="cp-other-input"
                      placeholder="Type Year / Department…"
                      value={courseForm.yearOther}
                      onChange={e => setCourseForm(p => ({ ...p, yearOther: e.target.value }))}
                    />
                  )}
                </div>
                {/* Subject Code */}
                <div className="cp-fg">
                  <label>Subject Code *</label>
                  <input value={courseForm.subjectCode} placeholder="e.g. 22CS207"
                    onChange={e => setCourseForm(p => ({ ...p, subjectCode: e.target.value }))} />
                </div>
                {/* Short Name */}
                <div className="cp-fg">
                  <label>Short Name *</label>
                  <input value={courseForm.shortName} placeholder="e.g. OS"
                    onChange={e => setCourseForm(p => ({ ...p, shortName: e.target.value }))} />
                </div>
                {/* Subject Name — full width */}
                <div className="cp-fg cp-fg-full">
                  <label>Subject Name *</label>
                  <input value={courseForm.subjectName} placeholder="e.g. Operating Systems"
                    onChange={e => setCourseForm(p => ({ ...p, subjectName: e.target.value }))} />
                </div>
                {/* L */}
                <div className="cp-fg">
                  <label>L — Lecture hrs</label>
                  <input type="number" min="0" value={courseForm.L}
                    onChange={e => setCourseForm(p => ({ ...p, L: e.target.value }))} />
                </div>
                {/* T */}
                <div className="cp-fg">
                  <label>T — Tutorial hrs</label>
                  <input type="number" min="0" value={courseForm.T}
                    onChange={e => setCourseForm(p => ({ ...p, T: e.target.value }))} />
                </div>
                {/* P */}
                <div className="cp-fg">
                  <label>P — Practical hrs</label>
                  <input type="number" min="0" value={courseForm.P}
                    onChange={e => setCourseForm(p => ({ ...p, P: e.target.value }))} />
                </div>
                {/* C — fixed but editable in curriculum */}
                <div className="cp-fg">
                  <label>C — Credits <span className="cp-label-note">(fixed)</span></label>
                  <input type="number" min="0" value={courseForm.C}
                    onChange={e => setCourseForm(p => ({ ...p, C: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="cp-modal-foot">
              <button className="cp-btn cp-btn-cancel" onClick={() => setShowCourseModal(false)}>Cancel</button>
              <button className="cp-btn cp-btn-save" onClick={saveCourse}>
                {editCourse ? 'Save Changes' : 'Add Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Course confirm ── */}
      {deleteCourse && (
        <div className="cp-overlay" onClick={() => setDeleteCourse(null)}>
          <div className="cp-modal cp-modal-confirm" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-head">
              <h3>Delete Course</h3>
              <button className="cp-modal-x" onClick={() => setDeleteCourse(null)}>✕</button>
            </div>
            <p className="cp-confirm-text">
              Remove <strong>{deleteCourse.subjectName}</strong> ({deleteCourse.subjectCode}) and all its workload sessions? This cannot be undone.
            </p>
            <div className="cp-modal-foot">
              <button className="cp-btn cp-btn-cancel" onClick={() => setDeleteCourse(null)}>Cancel</button>
              <button className="cp-btn cp-btn-danger" onClick={confirmDeleteCourse}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {showManageTypes && (
        <ManageCourseTypesModal onClose={() => { setShowManageTypes(false); refreshSystemConfig(); }} />
      )}
    </div>
  );
};

export default CoursesPage;

