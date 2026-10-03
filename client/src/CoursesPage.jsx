import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAcademicPeriod } from './AcademicPeriodContext';
import API from './config';
import { fetchAllPages, authJsonHeaders } from './utils/apiFetchAll';
import { exportAsCSV, exportAsExcel } from './utils/exportUtils';
import { useToast } from './Toast';
import { useSharedData } from './DataContext';
import './CoursesPage.css';

// const PROGRAMS removed
// const COURSE_TYPES removed
// const YEARS_BTECH removed
// YEAR_OPTIONS removed

const emptyCourseForm = {
  program: 'B.Tech', courseType: 'Mandatory', year: 'I',
  subjectCode: '', subjectName: '', shortName: '',
  L: 0, T: 0, P: 0, C: 0,
  // 'Other' free-text companions
  programOther: '', courseTypeOther: '', yearOther: '',
  allowedSectionsText: '', // For comma-separated section strings
};

// ── CoursesPage ────────────────────────────────────────────────
const CoursesPage = ({ isAdmin = true }) => {
  const { selectedAcademicYearId, selectedSemester, selectedAcademicYear } = useAcademicPeriod();

  const { courses: contextCourses, setCourses: setContextCourses, systemConfig} = useSharedData();

  const activeYearsRaw = (systemConfig?.years || []).filter(y => y.isActive).map(y => y.value);
  const YEAR_OPTIONS = activeYearsRaw.length > 0 
    ? [...systemConfig.years.filter(y => y.isActive).map(y => ({ value: y.value, label: `${y.value} Year` })), { value: '__other__', label: 'Others' }] 
    : [ { value: 'I', label: 'I Year' }, { value: 'II', label: 'II Year' }, { value: 'III', label: 'III Year' }, { value: 'IV', label: 'IV Year' }, { value: '__other__', label: 'Others' } ];
  
  const COURSE_TYPES = (systemConfig?.courseTypes || []).filter(c => c.isActive).map(c => c.value).length > 0 ? (systemConfig?.courseTypes || []).filter(c => c.isActive).map(c => c.value) : ['Mandatory', 'Department Elective', 'Open Elective', 'Minors', 'Honours'];
  const configPrograms = (systemConfig?.programs || []).filter(c => c.isActive).map(c => c.value);
  const PROGRAMS = configPrograms.length > 0 ? Array.from(new Set([...configPrograms, 'M.Tech'])) : ['B.Tech', 'M.Tech'];
  const YEARS = activeYearsRaw.length > 0 ? activeYearsRaw.filter(y => y !== 'Other') : ['I', 'II', 'III', 'IV'];
  
  // ── Data state ──
  const [courseList, setCourseList]   = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Sync shared context data to local state
  useEffect(() => {
    if (contextCourses) {
      setCourseList(contextCourses);
      setLoadingCourses(false);
    }
  }, [contextCourses]);

  // ── Filters ──
  const [activeProgram, setActiveProgram] = useState('B.Tech');
  const [activeYear,    setActiveYear]    = useState('I');   // B.Tech year tab
  const [search,        setSearch]        = useState('');

  // ── Course modal ──
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse,      setEditCourse]      = useState(null);
  const [courseForm,      setCourseForm]      = useState(emptyCourseForm);
  const [deleteCourse,    setDeleteCourse]    = useState(null);

  // ── Toast ──
  const { showToast } = useToast();

  const authHeaders = () => ({
    ...authJsonHeaders()});

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
  }, [authHeaders, setContextCourses, showToast, selectedAcademicYear]);

  // ── Derived lists ──
  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase();
    return courseList.filter(c =>
      c.program === activeProgram &&
      c.year === activeYear &&
      (!q || c.subjectCode.toLowerCase().includes(q) ||
             c.subjectName.toLowerCase().includes(q) ||
             c.shortName.toLowerCase().includes(q))
    );
  }, [courseList, activeProgram, activeYear, search]);

  // Filter to show only B.Tech by default (remove M.Tech display)
  const displayCourses = useMemo(() => {
    return filteredCourses;
  }, [filteredCourses]);



  // ── Export handler ──
  const handleExport = (format) => {
    const columns = [
      { header: 'S.No.',       key: 'sno' },
      { header: 'Course Code', key: 'subjectCode' },
      { header: 'Course Name', key: 'subjectName' },
      { header: 'Short Name',  key: 'shortName' },
      { header: 'Course Type', key: 'courseType' },
      { header: 'L',           key: 'L' },
      { header: 'T',           key: 'T' },
      { header: 'P',           key: 'P' },
      { header: 'C',           key: 'C' },
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
    setCourseForm({ ...emptyCourseForm, program: activeProgram, year: activeYear });
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
    const resolvedProgram    = f.program     === '__other__' ? f.programOther.trim()    || 'Other' : f.program;
    const resolvedCourseType = f.courseType  === '__other__' ? f.courseTypeOther.trim() || 'Other' : f.courseType;
    const resolvedYear       = f.year        === '__other__' ? f.yearOther.trim()       || 'Other' : f.year;
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
        : []};
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
          body: JSON.stringify(payload)}
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data?.errors?.length ? data.errors.join(' | ') : (data?.message || 'Could not save course.');
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
        headers: authHeaders()});
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
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
              <button className="cp-btn cp-export-csv" onClick={() => handleExport('csv')} title="Export filtered courses as CSV" style={{marginRight: '5px'}}>CSV</button>
              <button className="cp-btn cp-export-excel" onClick={() => handleExport('excel')} title="Export filtered courses as Excel">Excel</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Program tabs ── B.Tech only */}
      <div className="cp-program-tabs">
        {PROGRAMS.map(p => (
          <button
            key={p}
            className={`cp-prog-tab${activeProgram === p ? ' active' : ''}`}
            onClick={() => { setActiveProgram(p); setActiveYear('I'); setSearch(''); }}
          >
            {p}
            <span className="cp-prog-count">
              {courseList.filter(c => c.program === p).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── B.Tech year tabs ── */}
      {true && (
        <div className="cp-year-tabs">
          {(activeProgram === 'M.Tech' ? ['I', 'II'] : YEARS).map(y => {
            const cnt = displayCourses.filter(
              c => c.program === activeProgram && c.year === y
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
      )}

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
          <button className="cp-btn cp-btn-add" onClick={openAddCourse}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Course
          </button>
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
                      <button className="cp-action cp-del-btn"  onClick={() => setDeleteCourse(c)}>✕ Del</button>
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
                  <select value={courseForm.courseType}
                    onChange={e => setCourseForm(p => ({ ...p, courseType: e.target.value }))}>
                    {COURSE_TYPES.map(t => <option key={t}>{t}</option>)}
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
                {(courseForm.program === 'B.Tech' || courseForm.program === 'M.Tech' || courseForm.program === '__other__') && (
                  <div className="cp-fg">
                    <label>Year</label>
                    <select value={courseForm.year}
                      onChange={e => setCourseForm(p => ({ ...p, year: e.target.value }))}>
                      {YEAR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
                )}
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
    </div>
  );
};

export default CoursesPage;

