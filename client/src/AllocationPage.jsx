/**
 * AllocationPage.jsx
 *
 * Faculty Workload Allocation Grid
 *  - Rows  = Course � Type (L / T / P) � sub-rows (L ? 1 row; T & P ? always 4 rows)
 *  - Cols  = Sections (dynamic, admin can add)
 *  - Auto-fill: selecting L-Row-1 faculty instantly copies to T-Row-1 & P-Row-1
 *               for the SAME course + section (still manually overridable)
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import API from './config';
import './AllocationPage.css';
import { exportAsCSV, exportAsExcel, exportAsPDF } from './utils/exportUtils';
import { fetchAllPages, fetchJsonWithRetry, authJsonHeaders } from './utils/apiFetchAll';
import { useSharedData } from './DataContext';
import {
  DEFAULT_SECTIONS,
  fetchSectionsConfig,
} from './utils/sectionsApi';
import { refetchAllocationData, validateAllocation } from './utils/allocationHelpers';

// -- Constants -----------------------------------------------------------------
const PROGRAMS    = ['B.Tech'];
const YEARS_BTECH = ['I', 'II', 'III', 'IV'];

const TYPE_LABEL = { L: 'Lecture', T: 'Tutorial', P: 'Practical' };

const getWorkloadTarget = (designation = '') => {
  const d = String(designation).toLowerCase();
  if (d.includes('dean') || d.includes('hod')) return 14;
  if (d.includes('professor') && !d.includes('asst') && !d.includes('assoc') && !d.includes('assistant')) return 14;
  if (d.includes('assoc')) return 16;
  if (d.includes('sr. asst') || d.includes('senior level')) return 16;
  if (d.includes('contract') || d === 'cap' || d.includes('internal cap') || d === 'ta' || d.includes('teaching instructor')) return 18;
  return 16;
};

const isTADesignation = (designation = '') => {
  const value = String(designation || '').trim().toLowerCase();
  return value === 'ta' || value.includes('teaching assistant');
};

/**
 * Sub-row count per type:
 *  L ? always 1 row  (single main-faculty slot)
 *  T ? always 4 rows (if course has tutorial hours)
 *  P ? always 4 rows (if course has practical hours)
 *  Returns 0 when the course has no hours for that type (skips the block).
 */
const typeRowCount = (course, type) => {
  const n = course[type];
  if (!n || n === 0) return 0;
  if (type === 'L') return 1;
  return 4; // T and P always get 4 rows
};

const authHeader = () => ({
  ...authJsonHeaders(),
});

// -- CellPicker ----------------------------------------------------------------
// ENHANCED: UI Constraints for Allocation Rules
//  - R1 (rowIdx=0) in T/P types: READ-ONLY, auto-filled from L.R1
//  - R2, R3, R4 (rowIdx >= 1): Only allow Supporting Faculty or TA
//  - Lock badges show which slots are auto-filled or workload-driven
const CellPicker = ({ courseId, section, type, rowIdx, empId, isAuto, isAdmin, onSelect, facultyStatusMap = {}, facultyList = [], mainFacultyMap = {}, taWorkloadMap = {} }) => {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  // RULE 1: R1 in T/P is locked if mainFacultyMap exists (auto-filled from L.R1)
  const mainKey = `${courseId}__${section}`;
  const isR1Locked = rowIdx === 0 && (type === 'T' || type === 'P') && mainFacultyMap[mainKey]?.empId;

  // RULE 2: TA-driven slots are locked (R2-R4 auto-assigned from workload)
  const taLockKey = `${courseId}__${section}__${type}__${rowIdx}`;
  const isTALocked = taWorkloadMap[taLockKey] && empId === taWorkloadMap[taLockKey];

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = useMemo(() =>
    facultyList.filter(f => {
      const textMatch =
        !search ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.empId.includes(search);
      if (!textMatch) return false;

      // R2-R4: Only show Supporting Faculty and TA
      if (rowIdx >= 1) {
        const isSupportingOrTA = f.role && (f.role === 'Supporting Faculty' || f.role === 'TA');
        const isCurrent = f.empId === empId;
        if (!isSupportingOrTA && !isCurrent) return false;
      }

      const info = facultyStatusMap[f.empId] || {
        capacity: getWorkloadTarget(f.designation),
        assignedHours: 0,
        remaining: getWorkloadTarget(f.designation),
      };
      const hasCapacity = (info.remaining || 0) > 0;
      const isCurrent = f.empId === empId;
      return hasCapacity || isCurrent;
    }),
  [search, empId, facultyStatusMap, facultyList, rowIdx]);

  const chosen = facultyList.find(f => f.empId === empId);
  const shortN = chosen ? chosen.name.trim().split(/\s+/).slice(-2).join(' ') : '';

  const getStatusText = (emp) => {
    const info = facultyStatusMap[emp.empId] || {
      capacity: getWorkloadTarget(emp.designation),
      assignedHours: 0,
      remaining: getWorkloadTarget(emp.designation),
    };
    if ((info.assignedHours || 0) > (info.capacity || 0)) return { label: 'Overloaded', tone: 'over' };
    if ((info.remaining || 0) <= 0) return { label: 'Fully Loaded', tone: 'full' };
    return { label: 'Available', tone: 'available' };
  };

  const getLockBadge = () => {
    if (isR1Locked) return { icon: '🔒', title: 'R1 is locked from L.R1 assignment. Edit Lecture Row 1.' };
    if (isTALocked) return { icon: '🔒', title: 'This TA slot is locked from Workload assignment.' };
    return null;
  };
  const lockBadge = getLockBadge();

  if (!isAdmin) {
    return (
      <div className="ap-cell-readonly">
        {shortN || <span className="ap-cell-dash">�</span>}
        {isAuto && <span className="ap-auto-badge" title="Auto-filled">?</span>}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`ap-cell-wrap${isAuto ? ' ap-cell-is-auto' : ''}`}>
      <div
        className={`ap-cell-display${chosen ? ' ap-cell-filled' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={chosen ? chosen.name : 'Click to assign faculty'}
      >
        {chosen
          ? <span className="ap-cell-name">{shortN}</span>
          : <span className="ap-cell-empty">�</span>}
        {isAuto && <span className="ap-auto-badge" title="Auto-filled from L Row 1">?</span>}
      </div>

      {open && (
        <div className="ap-dropdown">
          <input
            autoFocus
            className="ap-dd-search"
            placeholder="Search name or ID�"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="ap-dd-list">
            <div
              className="ap-dd-item ap-dd-clear"
              onMouseDown={() => { onSelect(''); setOpen(false); setSearch(''); }}
            >
              ? Clear
            </div>
            {filtered.map(f => (
              <div
                key={f.empId}
                className={`ap-dd-item${f.empId === empId ? ' ap-dd-selected' : ''}`}
                onMouseDown={() => { onSelect(f.empId); setOpen(false); setSearch(''); }}
              >
                <span className="ap-dd-name">{f.name}</span>
                <span className={`ap-dd-status ap-dd-status-${getStatusText(f).tone}`}>{getStatusText(f).label}</span>
                <span className="ap-dd-id">[{f.empId}]</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="ap-dd-empty">No faculty match "{search}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};



// -- AllocationPage -------------------------------------------------------------
const AllocationPage = ({ isAdmin = true }) => {
  const { faculty: contextFaculty, courses: contextCourses } = useSharedData();
  
  const [allocations,   setAllocations]   = useState([]);
  const [allocMap,      setAllocMap]      = useState({});
  const [activeProgram, setActiveProgram] = useState('B.Tech');
  const [activeYear,    setActiveYear]    = useState('I');
  const [sections,      setSections]      = useState([...DEFAULT_SECTIONS['I']]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [unsaved,       setUnsaved]       = useState(false);
  const [toast,         setToast]         = useState('');
  const [apiError,      setApiError]      = useState('');
  const [lastSyncedAt,  setLastSyncedAt]  = useState(null);
  const [sectionsConfig, setSectionsConfig] = useState(DEFAULT_SECTIONS);
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);
  const persistTimersRef = useRef({});

  // Sync shared context data to local state
  useEffect(() => {
    if (contextFaculty && contextFaculty.length > 0) {
      setFacultyList(contextFaculty);
    }
    if (contextCourses && contextCourses.length > 0) {
      setCourseList(contextCourses);
    }
  }, [contextFaculty, contextCourses]);

  // yearKey must be defined before any hook that uses it
  const yearKey = activeYear;

  const markSynced = useCallback(() => setLastSyncedAt(new Date()), []);

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Workloads for auto-populating faculty details
  const [workloads, setWorkloads] = useState([]);
  const [workloadsLoading, setWorkloadsLoading] = useState(false);
  const fetchWorkloads = useCallback(async () => {
    setWorkloadsLoading(true);
    try {
      const result = await fetchAllPages('/deva/workloads', { year: yearKey }, { headers: authHeader() });
      if (!result.success) {
        setWorkloads([]);
        console.error('Failed to fetch workloads:', result.message);
        return { success: false, message: result.message || 'Failed to load workloads.' };
      }
      
      // Ensure we have an array of workloads
      const workloadData = Array.isArray(result.data) ? result.data : [];
      setWorkloads(workloadData);
      
      // Detailed logging for debugging
      console.log('? Fetched Workloads:', {
        totalCount: workloadData.length,
        year: yearKey,
        breakdown: {
          mainFaculty: workloadData.filter(w => w.facultyRole === 'Main Faculty').length,
          supportingFaculty: workloadData.filter(w => w.facultyRole === 'Supporting Faculty').length,
          ta: workloadData.filter(w => w.facultyRole === 'TA').length,
        },
        sampleData: workloadData.slice(0, 3),
        allData: workloadData,
      });
      
      return { success: true };
    } catch (error) {
      setWorkloads([]);
      console.error('Error fetching workloads:', error);
      return { success: false, message: 'Failed to load workloads.' };
    } finally {
      setWorkloadsLoading(false);
    }
  }, [yearKey]);

  // Main faculty mapping for auto-fill (from backend)
  const [mainFacultyMap, setMainFacultyMap] = useState({});
  const fetchMainFaculty = useCallback(async () => {
    try {
      const url = `${API}/deva/workloads/main-faculty?year=${encodeURIComponent(yearKey)}`;
      const result = await fetchJsonWithRetry(url, { headers: authHeader() });
      if (!result.success || !result.data?.success) {
        setMainFacultyMap({});
        return { success: false, message: result.message || result.data?.message || 'Failed to load main faculty map.' };
      }
      setMainFacultyMap(result.data.data || {});
      return { success: true };
    } catch {
      setMainFacultyMap({});
      return { success: false, message: 'Failed to load main faculty map.' };
    }
  }, [yearKey]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadSectionsConfig = useCallback(async () => {
    try {
      const cfg = await fetchSectionsConfig();
      setSectionsConfig(cfg);
    } catch {
      setSectionsConfig(DEFAULT_SECTIONS);
    }
  }, []);

  useEffect(() => { loadSectionsConfig(); }, [loadSectionsConfig]);

  const yearCourses = useMemo(() =>
    courseList.filter(c => c.program === 'B.Tech' && c.year === activeYear),
  [activeYear, courseList]);

  // Maps `courseId__section__T__rowIdx` / `__P__rowIdx` ? empId for TA workloads with allocationRow
  const taWorkloadMap = useMemo(() => {
    const m = {};
    const taWorkloads = workloads.filter(w => w.facultyRole === 'TA');
    
    console.log('?? Building TA Workload Map:', {
      totalWorkloads: workloads.length,
      taWorkloadsCount: taWorkloads.length,
      taWorkloadsSample: taWorkloads.slice(0, 5),
    });
    
    taWorkloads.forEach(w => {
      if (w.allocationRow != null && w.empId) {
        const rowIdx = Number(w.allocationRow);
        const course = yearCourses.find(c => c.id === Number(w.courseId));
        if (!course || rowIdx < 1 || rowIdx > 3) {
          console.warn('?? Skipping TA - invalid course or row:', { 
            empId: w.empId, 
            courseId: w.courseId, 
            rowIdx, 
            courseFound: !!course 
          });
          return;
        }
        if (course.T > 0) {
          const tKey = `${w.courseId}__${w.section}__T__${rowIdx}`;
          m[tKey] = w.empId;
          console.log('? Added TA to Tutorial slot:', { key: tKey, empId: w.empId });
        }
        if (course.P > 0) {
          const pKey = `${w.courseId}__${w.section}__P__${rowIdx}`;
          m[pKey] = w.empId;
          console.log('? Added TA to Practical slot:', { key: pKey, empId: w.empId });
        }
      }
    });
    
    console.log('?? Final TA Workload Map:', { mapSize: Object.keys(m).length, map: m });
    return m;
  }, [workloads, yearCourses]);

  const facultyStatusMap = useMemo(() => {
    const summary = {};
    facultyList.forEach((f) => {
      summary[f.empId] = {
        capacity: getWorkloadTarget(f.designation),
        assignedHours: 0,
        remaining: getWorkloadTarget(f.designation),
      };
    });

    yearCourses.forEach((course) => {
      sections.forEach((sec) => {
        ['L', 'T', 'P'].forEach((type) => {
          const hours = Number(course[type] || 0);
          if (hours <= 0) return;

          const rowCount = typeRowCount(course, type);
          const assignedEmpIds = Array.from(
            new Set(
              Array.from({ length: rowCount }, (_, i) => allocMap[`${course.id}__${sec}__${type}__${i}`]).filter(Boolean)
            )
          );

          if (assignedEmpIds.length === 0) return;

          const split = hours / assignedEmpIds.length;
          assignedEmpIds.forEach((empId) => {
            if (!summary[empId]) {
              summary[empId] = { capacity: getWorkloadTarget(''), assignedHours: 0, remaining: getWorkloadTarget('') };
            }
            summary[empId].assignedHours += split;
          });
        });
      });
    });

    Object.keys(summary).forEach((empId) => {
      summary[empId].assignedHours = Number(summary[empId].assignedHours.toFixed(2));
      summary[empId].remaining = Number((summary[empId].capacity - summary[empId].assignedHours).toFixed(2));
    });

    return summary;
  }, [allocMap, yearCourses, sections, facultyList]);

  // -- Fetch from server ----------------------------------------------------
  const fetchAllocations = useCallback(async ({ withLoader = true } = {}) => {
    if (withLoader) setLoading(true);
    try {
      const data = await fetchAllPages('/deva/allocations', {}, { headers: authHeader() });
      if (!data.success) {
        console.error('? Failed to fetch allocations:', data.message);
        return { success: false, message: data.message || 'Could not load allocations.' };
      }
      
      // Ensure we have an array
      const allocArray = Array.isArray(data.data) ? data.data : [];
      setAllocations(allocArray);
      
      // COMPREHENSIVE LOGGING - Validate all allocations are loaded
      const allocStats = {
        totalAllocations: allocArray.length,
        withLectureSlots: allocArray.filter(a => a.lectureSlots?.length > 0 || a.lectureSlot?.empId).length,
        withTutorialSlots: allocArray.filter(a => a.tutorialSlots?.length > 0).length,
        withPracticalSlots: allocArray.filter(a => a.practicalSlots?.length > 0).length,
        totalFacultyAssignments: allocArray.reduce((sum, a) => {
          let count = 0;
          if (a.lectureSlots?.length > 0) count += a.lectureSlots.filter(s => s?.empId).length;
          if (a.lectureSlot?.empId) count += 1;
          if (a.tutorialSlots?.length > 0) count += a.tutorialSlots.filter(s => s?.empId).length;
          if (a.practicalSlots?.length > 0) count += a.practicalSlots.filter(s => s?.empId).length;
          return sum + count;
        }, 0),
      };
      
      console.log('? ALL ALLOCATIONS LOADED:', {
        ...allocStats,
        serverStats: data.stats || {},
        sampleAllocations: allocArray.slice(0, 3),
        allAllocations: allocArray,
      });
      
      return { success: true };
    } catch (error) {
      console.error('? Error fetching allocations:', error);
      return { success: false, message: 'Could not load allocations.' };
    } finally {
      if (withLoader) setLoading(false);
    }
  }, []);

  const refreshAllocationReadData = useCallback(async ({ withLoader = true } = {}) => {
    if (withLoader) setLoading(true);
    setApiError('');

    const [allocRes, workloadRes, mainFacultyRes] = await Promise.all([
      fetchAllocations({ withLoader: false }),
      fetchWorkloads(),
      fetchMainFaculty(),
    ]);

    const failed = [allocRes, workloadRes, mainFacultyRes].find((result) => !result?.success);
    if (failed) {
      setApiError(failed.message || 'Failed to refresh allocation data.');
    } else {
      markSynced();
    }

    if (withLoader) setLoading(false);
  }, [fetchAllocations, fetchWorkloads, fetchMainFaculty, markSynced]);

  useEffect(() => {
    refreshAllocationReadData({ withLoader: true });
  }, [refreshAllocationReadData]);

  useEffect(() => {
    const id = setInterval(() => {
      refreshAllocationReadData({ withLoader: false });
    }, 15000);
    return () => clearInterval(id);
  }, [refreshAllocationReadData]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) refreshAllocationReadData({ withLoader: false });
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [refreshAllocationReadData]);

  // -- Build allocMap from server data --------------------------------------
  useEffect(() => {
    const map = {};
    const allocationsByYear = allocations.filter(a => a.year === yearKey);
    
    console.log('?? Building allocMap from allocations:', {
      totalAllocations: allocations.length,
      allocationsForYear: allocationsByYear.length,
      year: yearKey,
    });
    
    allocationsByYear.forEach(a => {
      // CRITICAL: Get ALL lecture slots (both array and legacy singular slot)
      const lSlots =
        a.lectureSlots && a.lectureSlots.length > 0
          ? a.lectureSlots
          : a.lectureSlot?.empId ? [a.lectureSlot] : [];
      
      // Process ALL lecture slots - don't skip any
      lSlots.forEach((sl, i) => {
        if (sl.empId) {
          const key = `${a.courseId}__${a.section}__L__${i}`;
          map[key] = sl.empId;
          console.log('? Added Lecture slot:', { key, empId: sl.empId, empName: sl.empName });
        }
      });
      
      // Process ALL tutorial slots - no filtering
      (a.tutorialSlots || []).forEach((sl, i) => {
        if (sl.empId) {
          const key = `${a.courseId}__${a.section}__T__${i}`;
          map[key] = sl.empId;
          console.log('? Added Tutorial slot:', { key, slot: i + 1, empId: sl.empId });
        }
      });
      
      // Process ALL practical slots - no filtering
      (a.practicalSlots || []).forEach((sl, i) => {
        if (sl.empId) {
          const key = `${a.courseId}__${a.section}__P__${i}`;
          map[key] = sl.empId;
          console.log('? Added Practical slot:', { key, slot: i + 1, empId: sl.empId });
        }
      });
    });
    
    // ALWAYS override L/T/P Row 0 (main faculty) from mainFacultyMap (workload is source of truth)
    Object.entries(mainFacultyMap).forEach(([key, val]) => {
      if (val.empId) {
        const [courseId, section] = key.split('__');
        const course = yearCourses.find(c => c.id === parseInt(courseId));
        map[`${key}__L__0`] = val.empId;
        if (course?.T > 0) map[`${key}__T__0`] = val.empId;
        if (course?.P > 0) map[`${key}__P__0`] = val.empId;
        console.log('? Applied Main Faculty from workload:', { key, empId: val.empId });
      }
    });
    
    // Overlay TA workload row assignments (source of truth for R2-R4 TA slots)
    Object.entries(taWorkloadMap).forEach(([key, empId]) => {
      if (empId) {
        map[key] = empId;
        console.log('? Applied TA from workload:', { key, empId });
      }
    });
    
    console.log('?? FINAL ALLOCMAP STATS:', {
      totalMappings: Object.keys(map).length,
      map,
      mappedByType: {
        lecture: Object.keys(map).filter(k => k.includes('__L__')).length,
        tutorial: Object.keys(map).filter(k => k.includes('__T__')).length,
        practical: Object.keys(map).filter(k => k.includes('__P__')).length,
      },
    });
    
    setAllocMap(map);
    setUnsaved(false);
  }, [allocations, yearKey, mainFacultyMap, taWorkloadMap, yearCourses]);

  // -- Reset sections when year/program changes ------------------------------
  useEffect(() => {
    setSections([...(sectionsConfig[yearKey] || DEFAULT_SECTIONS[yearKey] || ['1'])]);
  }, [yearKey, sectionsConfig]);

  useEffect(() => () => {
    Object.values(persistTimersRef.current).forEach((id) => clearTimeout(id));
    persistTimersRef.current = {};
  }, []);

  // -- isAutoFilled: T/P row-0 equals L row-0; or T/P row >= 1 mirrors opposite type; or TA workload-driven --
  const isAutoFilled = useCallback((courseId, section, type, rowIdx) => {
    if (rowIdx === 0) {
      // R1 for T/P is auto-filled if it matches the main faculty workload assignment
      const mainKey = `${courseId}__${section}`;
      const workloadEmpId = mainFacultyMap[mainKey]?.empId;
      const currentEmpId = allocMap[`${courseId}__${section}__${type}__0`];
      return !!workloadEmpId && currentEmpId === workloadEmpId;
    }
    // R2-R4: check if this slot is auto-driven by a TA workload
    if ((type === 'T' || type === 'P') && rowIdx >= 1) {
      const allocKey = `${courseId}__${section}__${type}__${rowIdx}`;
      const currentEmpId = allocMap[allocKey];
      if (taWorkloadMap[allocKey] && currentEmpId === taWorkloadMap[allocKey]) return true;
      // T?P mirror badge (manual mirror)
      const mirrorType = type === 'T' ? 'P' : 'T';
      const mirrorEmpId = allocMap[`${courseId}__${section}__${mirrorType}__${rowIdx}`];
      return !!(currentEmpId && currentEmpId === mirrorEmpId);
    }
    return false;
  }, [allocMap, mainFacultyMap, taWorkloadMap]);

  // -- Build faculty slot object, prefer details from assigned workloads --
  const toSlot = useCallback((empId, courseId, section) => {
    if (!empId) return { empId: '', empName: '', designation: '', hours: 0 };
    
    // Try to find a matching workload for this slot
    // IMPORTANT: Filter by ALL criteria to get the exact workload entry
    const wl = workloads.find(w => 
      w.empId === empId && 
      w.courseId === courseId && 
      w.year === yearKey && 
      w.section === section
    );
    
    if (wl) {
      console.log('? Workload found for slot:', { empId, courseId, section, workload: wl });
      return { empId: wl.empId, empName: wl.empName, designation: wl.designation, hours: 0 };
    }
    
    // Log if workload not found but details exist separately
    const allWorkloadsForEmp = workloads.filter(w => w.empId === empId);
    if (allWorkloadsForEmp.length > 0) {
      console.warn('?? No exact match for slot, but faculty has other workloads:', { 
        empId, 
        courseId, 
        section, 
        otherWorkloads: allWorkloadsForEmp 
      });
    }
    
    // Fallback to static faculty list
    const f = facultyList.find(ff => ff.empId === empId);
    return f
      ? { empId: f.empId, empName: f.name, designation: f.designation, hours: 0 }
      : { empId, empName: empId, designation: '', hours: 0 };
  }, [workloads, yearKey, facultyList]);

  const persistAllocationForCombo = useCallback(async (courseId, section, sourceMap) => {
    const course = yearCourses.find(c => c.id === courseId);
    if (!course) return { success: false, message: 'Course not found for allocation save.' };

    const collectSlots = (type) =>
      Array.from({ length: typeRowCount(course, type) }, (_, i) =>
        toSlot(sourceMap[`${courseId}__${section}__${type}__${i}`] || '', courseId, section)
      );

    const lectureSlots = collectSlots('L');
    const tutorialSlots = collectSlots('T');
    const practicalSlots = collectSlots('P');

    try {
      const res = await fetch(`${API}/deva/allocations`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          courseId,
          subjectCode: course.subjectCode,
          subjectName: course.subjectName,
          shortName: course.shortName,
          program: course.program,
          year: yearKey,
          section,
          fixedL: course.L,
          fixedT: course.T,
          fixedP: course.P,
          C: course.C,
          lectureSlots,
          lectureSlot: lectureSlots[0] || { empId: '', empName: '', designation: '', hours: 0 },
          tutorialSlots,
          practicalSlots,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { success: false, message: data?.message || 'Could not persist allocation.' };
      }

      // ✅ REAL-TIME UPDATE: Refetch the allocation to ensure UI reflects latest server data
      const refetchResult = await refetchAllocationData(courseId, yearKey, section);
      if (!refetchResult.success) {
        console.warn('⚠️  Allocation saved but refetch failed. UI may show stale data.');
      } else {
        console.log('✅ Allocation synced in real-time:', refetchResult.data);
      }

      return { success: true };
    } catch (e) {
      console.error('Error persisting allocation:', e);
      return { success: false, message: 'Could not persist allocation.' };
    }
  }, [yearCourses, yearKey, toSlot]);

  const queueAutoPersist = useCallback((courseId, section, sourceMap) => {
    const key = `${courseId}__${section}`;
    if (persistTimersRef.current[key]) {
      clearTimeout(persistTimersRef.current[key]);
    }

    persistTimersRef.current[key] = setTimeout(async () => {
      const result = await persistAllocationForCombo(courseId, section, sourceMap);
      if (!result.success) {
        setApiError(result.message || 'Could not auto-save allocation.');
        setUnsaved(true);
        return;
      }
      setApiError('');
      setUnsaved(false);
      markSynced();
    }, 350);
  }, [persistAllocationForCombo, markSynced]);

  // -- Main setter � auto-fill logic lives here ------------------------------
  const setFacultyAlloc = useCallback((courseId, section, type, rowIdx, empId) => {
    // ALWAYS prevent manual override for main slots (L/T/P Row 0) if mainFacultyMap exists
    const mainKey = `${courseId}__${section}`;
    if (rowIdx === 0 && mainFacultyMap[mainKey]?.empId) {
      // Do not allow manual change for R1 of any type - workload is the source of truth
      showToast('?? Main faculty slot (R1) is locked to workload assignment');
      return;
    }
    // Prevent manual override for TA workload-driven slots (R2-R4)
    if (rowIdx >= 1 && (type === 'T' || type === 'P')) {
      const taKey = `${courseId}__${section}__${type}__${rowIdx}`;
      if (taWorkloadMap[taKey]) {
        showToast('?? This TA slot is auto-assigned from the Workload module. Update the workload assignment to change it.');
        return;
      }
    }
    let nextSnapshot = null;
    setAllocMap(prev => {
      const next = { ...prev };

      const rowKey = `${courseId}__${section}__${type}__${rowIdx}`;
      const currentEmpId = next[rowKey] || '';

      // R2, R3, R4: only Supporting Faculty and TA (by workload assignment) allowed
      if (rowIdx >= 1 && empId) {
        const wlEntry = workloads.find(
          w => w.empId === empId &&
               Number(w.courseId) === Number(courseId) &&
               String(w.section) === String(section) &&
               (w.facultyRole === 'Supporting Faculty' || w.facultyRole === 'TA')
        );
        if (!wlEntry) {
          showToast('? R2, R3, R4 can only be assigned to Supporting Faculty or TA (must be assigned in Workloads first).');
          nextSnapshot = null;
          return prev;
        }
        // TA role: only Tutorial/Practical type allowed
        if (wlEntry.facultyRole === 'TA') {
          if (type !== 'T' && type !== 'P') {
            showToast('? TA can be assigned only in R2, R3, or R4 of Tutorial/Practical.');
            nextSnapshot = null;
            return prev;
          }
          // The mirror key (T?P same row) is always allowed � skip duplicate check for it
          const mirrorType = type === 'T' ? 'P' : 'T';
          const mirrorKey = `${courseId}__${section}__${mirrorType}__${rowIdx}`;
          const taRowKeys = [
            ...Array.from({ length: 4 }, (_, i) => `${courseId}__${section}__T__${i}`),
            ...Array.from({ length: 4 }, (_, i) => `${courseId}__${section}__P__${i}`),
          ];
          const duplicateTa = taRowKeys.some((key) => key !== rowKey && key !== mirrorKey && next[key] === empId);
          if (duplicateTa) {
            showToast('? Duplicate TA assignment is not allowed for the same subject and section.');
            nextSnapshot = null;
            return prev;
          }
        }
      }

      next[`${courseId}__${section}__${type}__${rowIdx}`] = empId;

      // ✅ AUTO-FILL RULE 1: When L.R1 is set, automatically populate T.R1 and P.R1
      if (type === 'L' && rowIdx === 0) {
        const course = courseList.find(c => c.id === courseId);
        if (course?.T > 0) {
          next[`${courseId}__${section}__T__0`] = empId;
          console.log('✅ AUTO-FILL: L.R1 → T.R1', { courseId, section, empId });
        }
        if (course?.P > 0) {
          next[`${courseId}__${section}__P__0`] = empId;
          console.log('✅ AUTO-FILL: L.R1 → P.R1', { courseId, section, empId });
        }
      }

      // ✅ MIRROR RULE 2: When T.R2-R4 or P.R2-R4 is set, mirror to the opposite type
      if ((type === 'T' || type === 'P') && rowIdx >= 1) {
        const mirrorType = type === 'T' ? 'P' : 'T';
        const mirrorKey = `${courseId}__${section}__${mirrorType}__${rowIdx}`;
        const course = courseList.find(c => c.id === courseId);
        // Mirror only if the target type exists for this course and mirror slot is not TA-locked
        if ((mirrorType === 'T' ? course?.T : course?.P) > 0 && !taWorkloadMap[mirrorKey]) {
          // Only auto-mirror if the mirror slot is currently empty or has the same person (no overwrite)
          if (!next[mirrorKey] || next[mirrorKey] === empId || empId === '') {
            next[mirrorKey] = empId;
            console.log(`✅ MIRROR: ${type}.R${rowIdx + 1} → ${mirrorType}.R${rowIdx + 1}`, { empId });
          }
        }
      }
      nextSnapshot = next;
      return next;
    });
    setUnsaved(true);
    if (nextSnapshot) {
      queueAutoPersist(courseId, section, nextSnapshot);
    }
  }, [mainFacultyMap, taWorkloadMap, courseList, queueAutoPersist, facultyList, workloads]);

  // -- Save all --------------------------------------------------------------
  const saveAll = async () => {
    setSaving(true);
    const combos = new Set();
    yearCourses.forEach(course => {
      sections.forEach(sec => {
        const hasData = ['L', 'T', 'P'].some(type =>
          Array.from({ length: typeRowCount(course, type) }, (_, i) =>
            allocMap[`${course.id}__${sec}__${type}__${i}`]
          ).some(Boolean)
        );
        if (hasData) combos.add(`${course.id}__${sec}`);
      });
    });

    const errors = [];
    for (const combo of combos) {
      const [courseIdStr, section] = combo.split('__');
      const courseId = parseInt(courseIdStr);
      const course   = yearCourses.find(c => c.id === courseId);
      if (!course) continue;

      const collectSlots = (type) =>
        Array.from({ length: typeRowCount(course, type) }, (_, i) =>
          toSlot(allocMap[`${courseId}__${section}__${type}__${i}`] || '', courseId, section)
        );

      const lectureSlots   = collectSlots('L');
      const tutorialSlots  = collectSlots('T');
      const practicalSlots = collectSlots('P');

      try {
        const res  = await fetch(`${API}/deva/allocations`, {
          method:  'POST',
          headers: authHeader(),
          body:    JSON.stringify({
            courseId,
            subjectCode: course.subjectCode,
            subjectName: course.subjectName,
            shortName:   course.shortName,
            program:     course.program,
            year:        yearKey,
            section,
            fixedL: course.L,
            fixedT: course.T,
            fixedP: course.P,
            C:      course.C,
            lectureSlots,
            lectureSlot:    lectureSlots[0] || { empId: '', empName: '', designation: '', hours: 0 },
            tutorialSlots,
            practicalSlots,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          errors.push(data?.message || 'Unknown error');
        }
      } catch (e) {
        errors.push(e.message);
      }
    }

    setSaving(false);
    if (errors.length) {
      showToast(`Saved with ${errors.length} error(s).`);
    } else {
      showToast('All allocations saved ?');
      setUnsaved(false);
      await refreshAllocationReadData({ withLoader: false });
    }
  };



  const allocationExportRows = useMemo(() => {
    const rows = [];
    let skippedCount = 0;
    
    yearCourses.forEach((course) => {
      sections.forEach((section) => {
        ['L', 'T', 'P'].forEach((type) => {
          const rowsCount = typeRowCount(course, type);
          for (let i = 0; i < rowsCount; i += 1) {
            const key = `${course.id}__${section}__${type}__${i}`;
            const empId = allocMap[key] || '';
            if (!empId) {
              skippedCount += 1;
              continue;
            }
            const fac = facultyList.find(f => f.empId === empId);
            rows.push({
              program: course.program,
              year: yearKey,
              section,
              subjectCode: course.subjectCode,
              subjectName: course.subjectName,
              shortName: course.shortName,
              type,
              slot: i + 1,
              fixedHours: course[type] || 0,
              empId,
              facultyName: fac?.name || empId,
              designation: fac?.designation || '',
            });
          }
        });
      });
    });
    
    // Validation logging
    console.log('?? Allocation Export Rows Generation:', {
      totalRowsGenerated: rows.length,
      skippedEmptySlots: skippedCount,
      byType: {
        lecture: rows.filter(r => r.type === 'L').length,
        tutorial: rows.filter(r => r.type === 'T').length,
        practical: rows.filter(r => r.type === 'P').length,
      },
      sampleRows: rows.slice(0, 5),
    });
    
    return rows;
  }, [yearCourses, sections, allocMap, yearKey, facultyList]);

  const allocationExportColumns = [
    { header: 'Program', key: 'program' },
    { header: 'Year', key: 'year' },
    { header: 'Section', key: 'section' },
    { header: 'Subject Code', key: 'subjectCode' },
    { header: 'Subject Name', key: 'subjectName' },
    { header: 'Short Name', key: 'shortName' },
    { header: 'Type', key: 'type' },
    { header: 'Row', key: 'slot' },
    { header: 'Fixed Hours', key: 'fixedHours' },
    { header: 'Emp ID', key: 'empId' },
    { header: 'Faculty Name', key: 'facultyName' },
    { header: 'Designation', key: 'designation' },
  ];

  const exportAllocations = (format) => {
    if (!allocationExportRows.length) {
      showToast('No allocation rows to export for current filters.');
      return;
    }
    const baseName = `allocations_${activeProgram}_${yearKey}`;
    const payload = {
      fileName: baseName,
      title: `Allocation Export (${activeProgram} ${yearKey})`,
      columns: allocationExportColumns,
      rows: allocationExportRows,
      sheetName: 'Allocations',
    };
    if (format === 'csv') return exportAsCSV(payload);
    if (format === 'excel') return exportAsExcel(payload);
    exportAsPDF(payload);
  };

  const colCount = 3 + sections.length;

  if (loading) return <div className="ap-loading">Loading allocations�</div>;

  return (
    <div className="ap-wrapper">

      {/* -- Top bar -- */}
      <div className="ap-topbar">
        <div className="ap-topbar-left">
          <h2 className="ap-heading">Faculty Workload Allocation</h2>
          {unsaved && <span className="ap-unsaved-badge">? Unsaved changes</span>}
          <span className="ap-sync-meta">Last synced: {formatSyncedAt(lastSyncedAt)}</span>
        </div>
        <div className="ap-topbar-right">
          {isAdmin && (
            <>
              <button
                className="ap-btn ap-btn-export"
                onClick={() => refreshAllocationReadData({ withLoader: false })}
              >
                ? Retry Sync
              </button>
              <button
                className="ap-btn ap-btn-save"
                onClick={saveAll}
                disabled={saving || !unsaved}
              >
                {saving ? 'Saving�' : '?? Save All'}
              </button>
              <button
                className="ap-btn ap-btn-export"
                onClick={() => exportAllocations('csv')}
                disabled={allocationExportRows.length === 0}
              >
                ? CSV
              </button>
              <button
                className="ap-btn ap-btn-export"
                onClick={() => exportAllocations('excel')}
                disabled={allocationExportRows.length === 0}
              >
                ? Excel
              </button>
              <button
                className="ap-btn ap-btn-export"
                onClick={() => exportAllocations('pdf')}
                disabled={allocationExportRows.length === 0}
              >
                ? PDF
              </button>
            </>
          )}
        </div>
      </div>

      {apiError && (
        <div className="ap-error-banner">
          <span>?? {apiError}</span>
          <button className="ap-error-retry" onClick={() => refreshAllocationReadData({ withLoader: true })}>Retry</button>
        </div>
      )}

      {/* -- Program tabs -- */}
      <div className="ap-prog-tabs">
        {PROGRAMS.map(p => (
          <button
            key={p}
            className={`ap-prog-tab${activeProgram === p ? ' active' : ''}`}
            onClick={() => { setActiveProgram(p); if (p === 'B.Tech') setActiveYear('I'); }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* -- Year tabs (B.Tech only) -- */}
      {activeProgram === 'B.Tech' && (
        <div className="ap-year-tabs">
          {YEARS_BTECH.map(y => (
            <button
              key={y}
              className={`ap-year-tab${activeYear === y ? ' active' : ''}`}
              onClick={() => setActiveYear(y)}
            >
              {y} Year
            </button>
          ))}
        </div>
      )}

      {/* -- Section bar -- */}
      <div className="ap-section-bar">
        <span className="ap-section-label">Sections:</span>
        {sections.map((s, i) => (
          <span key={`${s}-${i}`} className="ap-section-pill">
            Sec {i + 1} ({s})
          </span>
        ))}
      </div>

      {/* -- Legend -- */}
      <div className="ap-legend">
        <span className="ap-leg-item"><span className="ap-leg-dot ap-leg-dot-L" />L � Lecture</span>
        <span className="ap-leg-item"><span className="ap-leg-dot ap-leg-dot-T" />T � Tutorial</span>
        <span className="ap-leg-item"><span className="ap-leg-dot ap-leg-dot-P" />P � Practical</span>
        <span className="ap-leg-item"><span className="ap-leg-dot ap-leg-dot-auto" />? Auto-filled (L R1 ? T/P R1 &amp; T?P same row)</span>
        <span className="ap-leg-item"><span className="ap-leg-star">?</span> Main Faculty (L Row 1)</span>
      </div>

      {isAdmin && (
        <div className="ap-autofill-notice">
          ?? <strong>R1</strong> (Main Faculty) is locked to workload assignment. Selecting faculty in <strong>L R1</strong> auto-fills
          <strong> T R1</strong> and <strong>P R1</strong> instantly.
          &nbsp;|&nbsp; <strong>R2, R3, R4</strong> are reserved for <strong>Supporting Faculty</strong> and <strong>TA</strong> only.
          &nbsp;|&nbsp; Assigning a TA in <strong>T R2/R3/R4</strong> automatically mirrors to the same <strong>P row</strong> (and vice-versa).
        </div>
      )}

      {/* -- Allocation Grid -- */}
      <div className="ap-grid-wrap">
        {yearCourses.length === 0 ? (
          <div className="ap-empty">
            No courses found for {activeYear} Year.
          </div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr className="ap-thead-row">
                <th className="ap-th ap-th-course">Course</th>
                <th className="ap-th ap-th-type">Type</th>
                <th className="ap-th ap-th-row">Row</th>
                {sections.map((s, i) => (
                  <th key={`${s}-${i}`} className="ap-th ap-th-sec">
                    Section {i + 1}
                    <span className="ap-sec-letter"> ({s})</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {yearCourses.map((course, ci) => {
                const types     = ['L', 'T', 'P'].filter(t => typeRowCount(course, t) > 0);
                const totalRows = types.reduce((sum, t) => sum + typeRowCount(course, t), 0);
                const rows      = [];
                let courseFirst = true;

                types.forEach((type) => {
                  const rowCount = typeRowCount(course, type);
                  for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
                    const isFirstOfType   = rowIdx === 0;
                    const isFirstOfCourse = courseFirst && isFirstOfType;
                    if (isFirstOfCourse) courseFirst = false;
                    const isMainL = type === 'L' && rowIdx === 0;

                    rows.push(
                      <tr
                        key={`${course.id}-${type}-${rowIdx}`}
                        className={[
                          'ap-tr',
                          `ap-tr-${type.toLowerCase()}`,
                          isFirstOfType   ? 'ap-tr-type-first'   : '',
                          isFirstOfCourse ? 'ap-tr-course-first' : '',
                          rowIdx === rowCount - 1 ? 'ap-tr-type-last' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {/* Course cell � one per course, rowSpan = all type rows */}
                        {isFirstOfCourse && (
                          <td rowSpan={totalRows} className="ap-td-course">
                            <div className="ap-course-code">{course.subjectCode}</div>
                            <div className="ap-course-name">{course.subjectName}</div>
                            <div className="ap-course-meta">
                              <span className="ap-credit-badge">C:{course.C}</span>
                              {course.L > 0 && <span className="ap-hrs-badge ap-hrs-L">L{course.L}</span>}
                              {course.T > 0 && <span className="ap-hrs-badge ap-hrs-T">T{course.T}</span>}
                              {course.P > 0 && <span className="ap-hrs-badge ap-hrs-P">P{course.P}</span>}
                            </div>
                          </td>
                        )}

                        {/* Type badge � one per type group, rowSpan = sub-rows of that type */}
                        {isFirstOfType && (
                          <td rowSpan={rowCount} className={`ap-td-type ap-td-type-${type.toLowerCase()}`}>
                            <span className={`ap-type-badge ap-type-${type.toLowerCase()}`}>{type}</span>
                            <div className="ap-type-label">{TYPE_LABEL[type]}</div>
                          </td>
                        )}

                        {/* Row number + main-faculty badge */}
                        <td className={`ap-td-rownum ap-rownum-${type.toLowerCase()}`}>
                          <span className="ap-rownum">R{rowIdx + 1}</span>
                          {isMainL && <span className="ap-main-badge">? Main</span>}
                        </td>

                        {/* Faculty cells � one per section */}
                        {sections.map((section, si) => {
                          const empId = allocMap[`${course.id}__${section}__${type}__${rowIdx}`] || '';
                          const auto  = isAutoFilled(course.id, section, type, rowIdx);
                          // R2-R4: build list from workload entries (TA/Supporting Faculty) for this exact course+section.
                          // Use facultyList for display data; fall back to workload's own stored data so
                          // TAs not in the Faculty collection still appear.
                          const effectiveFacultyList = rowIdx >= 1
                            ? workloads
                                .filter(w =>
                                  Number(w.courseId) === Number(course.id) &&
                                  String(w.section) === String(section) &&
                                  (w.facultyRole === 'Supporting Faculty' || w.facultyRole === 'TA')
                                )
                                .map(w => {
                                  const fl = facultyList.find(f => f.empId === w.empId);
                                  return fl || { empId: w.empId, name: w.empName, designation: w.designation };
                                })
                                // deduplicate in case multiple rows for same faculty
                                .filter((f, idx, arr) => arr.findIndex(x => x.empId === f.empId) === idx)
                            : facultyList;
                          return (
                            <td
                              key={`${section}-${si}`}
                              className={`ap-td-cell${auto ? ' ap-td-auto' : ''}`}
                            >
                              <CellPicker
                                courseId={course.id}
                                section={section}
                                type={type}
                                rowIdx={rowIdx}
                                empId={empId}
                                isAuto={auto}
                                isAdmin={isAdmin}
                                facultyStatusMap={facultyStatusMap}
                                facultyList={effectiveFacultyList}
                                mainFacultyMap={mainFacultyMap}
                                taWorkloadMap={taWorkloadMap}
                                onSelect={(eid) => setFacultyAlloc(course.id, section, type, rowIdx, eid)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                });

                // Spacer row between courses
                if (ci < yearCourses.length - 1) {
                  rows.push(
                    <tr key={`spacer-${course.id}`} className="ap-tr-spacer">
                      <td colSpan={colCount} />
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>

      {saving && <div className="ap-saving-indicator">Saving�</div>}
      {workloadsLoading && <div className="ap-saving-indicator">Syncing workloads�</div>}
      {toast  && <div className="ap-toast">{toast}</div>}
    </div>
  );
};

export default AllocationPage;

