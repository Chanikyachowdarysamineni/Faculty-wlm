import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FacultyPage          from './FacultyPage';
import CoursesPage          from './CoursesPage';
import SectionManagementPage from './SectionManagementPage';
import WorkloadPage         from './WorkloadPage';
import AllocationPage       from './AllocationPage';
import ExtraFacultyPage     from './ExtraFacultyPage';
import FacultyFormPage      from './FacultyFormPage';
import MySubmissionsPage    from './MySubmissionsPage';
import MyWorkloadPage       from './MyWorkloadPage';
import ProfilePage          from './ProfilePage';
import AuditLogPage         from './AuditLogPage';
import OverloadedFacultyModal from './OverloadedFacultyModal';
import API                  from './config';
import { fetchAllPages, fetchJsonWithRetry }    from './utils/apiFetchAll';
import { fetchSectionsConfig } from './utils/sectionsApi';
import { logAuthDiagnostics } from './utils/authDiagnostics';
import { useSharedData } from './DataContext';
import './Dashboard.css';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    colorClass: 'nav-color-green',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'faculty',
    label: 'Faculty',
    colorClass: 'nav-color-blue',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'courses',
    label: 'Courses',
    colorClass: 'nav-color-yellow',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    key: 'sections',
    label: 'Sections',
    colorClass: 'nav-color-indigo',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="3"/>
        <path d="M11 7H21M11 12H21M11 17H21"/>
        <circle cx="8" cy="12" r="3"/>
        <circle cx="8" cy="19" r="3"/>
      </svg>
    ),
  },
  {
    key: 'workload',
    label: 'Work Load',
    colorClass: 'nav-color-orange',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    key: 'allocation',
    label: 'Allocation',
    colorClass: 'nav-color-teal',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'extrafaculty',
    label: 'Extra Faculty',
    colorClass: 'nav-color-cyan',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
  {
    key: 'facultyform',
    label: 'Faculty Form',
    colorClass: 'nav-color-cyan',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    key: 'myworkload',
    label: 'My Workload',
    colorClass: 'nav-color-orange',
    facultyOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    key: 'mysubmissions',
    label: 'My Submission',
    colorClass: 'nav-color-purple',
    facultyOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: 'auditlogs',
    label: 'Audit Logs',
    colorClass: 'nav-color-purple',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

const getWorkloadTarget = (designation = '') => {
  const d = String(designation).toLowerCase();
  if (d.includes('dean') || d.includes('hod')) return 14;
  if (d.includes('professor') && !d.includes('asst') && !d.includes('assoc') && !d.includes('assistant')) return 14;
  if (d.includes('assoc')) return 16;
  if (d.includes('sr. asst') || d.includes('senior level')) return 16;
  if (d.includes('contract') || d === 'cap' || d.includes('internal cap') || d === 'ta' || d.includes('teaching instructor')) return 18;
  return 16;
};

const toPct = (value) => Math.max(0, Math.min(100, value));

const AUTO_REFRESH_MS = 60000;

const Dashboard = ({ user, onLogout, remainingSeconds = 1800 }) => {
  const publicUrl = process.env.PUBLIC_URL || '';
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashMode, setDashMode] = useState(null);

  // Helper to format session time
  const formatSessionTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Shared state across pages ──────────────────
  const [formEnabled,  setFormEnabled]  = useState(true);
  const [editEnabled,  setEditEnabled]  = useState(true);
  const [submissions,  setSubmissions]  = useState([]);

  const handleNewSubmission    = sub  => setSubmissions(prev => [...prev, sub]);
  const handleDelSubmission    = id   => setSubmissions(prev => prev.filter(s => s.id !== id));
  const handleUpdateSubmission = sub  => setSubmissions(prev => prev.map(s => s.id === sub.id ? sub : s));

  const isAdmin = dashMode ? (dashMode === 'admin') : (user.role === 'admin' || user.canAccessAdmin === true);

  const token = () => {
    const t = localStorage.getItem('wlm_token');
    if (!t) {
      console.error('[Dashboard] No token in localStorage - user may not be authenticated');
      logAuthDiagnostics();
    }
    return t || '';
  };
  const authHeaders = useCallback(() => {
    const t = token();
    const headers = { Authorization: `Bearer ${t}` };
    if (!t) {
      console.warn('[Dashboard] Creating Authorization header with empty token');
    }
    return headers;
  }, []);

  // Use shared data context
  const { setFaculty, setCourses, setAllocations, setSectionsConfig: setSharedSectionsConfig } = useSharedData();

  const [dashboardData, setDashboardData] = useState({
    loading: false,
    error: '',
    faculty: [],
    allocations: [],
    courses: [],
  });
  const [dashboardLastSyncedAt, setDashboardLastSyncedAt] = useState(null);
  const [submissionsLastSyncedAt, setSubmissionsLastSyncedAt] = useState(null);
  const [dashboardSyncError, setDashboardSyncError] = useState('');
  const [submissionsSyncError, setSubmissionsSyncError] = useState('');
  const [sectionsConfig, setSectionsConfig] = useState(null);
  const [sectionYear, setSectionYear] = useState('I');
  const [masterData, setMasterData] = useState({ faculty: [], courses: [] });
  const [showOverloadedModal, setShowOverloadedModal] = useState(false);

  const formatSyncedAt = useCallback((date) => {
    if (!date) return 'Not synced yet';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  const refreshSubmissions = useCallback(async () => {
    if (!user?.id) return;
    const headers = { Authorization: `Bearer ${token()}` };

    // Validate token before making requests
    if (!headers.Authorization.replace('Bearer ', '').trim()) {
      console.error('[refreshSubmissions] No valid token available');
      setSubmissionsSyncError('Authentication failed. Please log in again.');
      return;
    }

    if (isAdmin) {
      try {
        const data = await fetchAllPages('/deva/submissions', {}, { headers });
        if (!data.success) {
          setSubmissionsSyncError(data.message || 'Failed to refresh submissions.');
          return;
        }
        setSubmissions(Array.isArray(data.data) ? data.data : []);
        setSubmissionsSyncError('');
        setSubmissionsLastSyncedAt(new Date());
      } catch {
        setSubmissionsSyncError('Failed to refresh submissions.');
      }
      return;
    }

    try {
      const result = await fetchJsonWithRetry(`${API}/deva/submissions/by-faculty/${user.id}`, { 
        headers,
        silentMode: true // Suppress logs for expected 404 (no submission yet)
      });
      const data = result.data || {};
      
      // 404 is expected if the faculty hasn't submitted yet � just ignore it
      if (result.status === 404) {
        setSubmissions([]);
        setSubmissionsSyncError('');
        setSubmissionsLastSyncedAt(new Date());
        return;
      }
      
      if (result.success && data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
        setSubmissions(list);
        setSubmissionsSyncError('');
        setSubmissionsLastSyncedAt(new Date());
      } else {
        setSubmissionsSyncError(result.message || data.message || 'Failed to refresh submissions.');
      }
    } catch {
      setSubmissionsSyncError('Failed to refresh submissions.');
    }
  }, [user, isAdmin]);

  // Fetch submissions + toggle settings from the server
  useEffect(() => {
    if (!user?.id) return;
    const headers = { Authorization: `Bearer ${token()}` };

    const refreshSettings = async () => {
      const [formResult, editResult] = await Promise.all([
        fetchJsonWithRetry(`${API}/deva/settings/form-status`, { headers }),
        fetchJsonWithRetry(`${API}/deva/settings/edit-status`, { headers }),
      ]);
      const formData = formResult.data || {};
      const editData = editResult.data || {};

      if (formResult.success && typeof formData.formEnabled === 'boolean') {
        setFormEnabled(formData.formEnabled);
      }
      if (editResult.success && typeof editData.editEnabled === 'boolean') {
        setEditEnabled(editData.editEnabled);
      }
    };

    // For non-admin: Fetch submissions ONCE on mount (no repeated refresh)
    if (!isAdmin) {
      refreshSubmissions();
      refreshSettings();
      return;
    }

    // For admin: Setup auto-refresh interval for submissions
    refreshSubmissions();
    refreshSettings();

    const id = setInterval(() => {
      refreshSubmissions();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(id);
  }, [user, isAdmin, refreshSubmissions]);

  const refreshDashboardData = useCallback(async () => {
    if (!isAdmin) return;
    
    // Validate token before making requests
    const headers = authHeaders();
    if (!headers.Authorization.replace('Bearer ', '').trim()) {
      console.error('[refreshDashboardData] No valid token available');
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Authentication failed. Please log in again.',
      }));
      return;
    }

    setDashboardData(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const [fReq, aReq, cReq] = await Promise.allSettled([
        fetchAllPages('/deva/faculty', {}, { headers }),
        fetchAllPages('/deva/allocations', {}, { headers }),
        fetchAllPages('/deva/courses', {}, { headers }),
      ]);

      const nextData = {};
      const errors = [];
      let successCount = 0;

      if (fReq.status === 'fulfilled' && fReq.value?.success) {
        nextData.faculty = Array.isArray(fReq.value.data) ? fReq.value.data : [];
        successCount += 1;
      } else {
        errors.push(
          (fReq.status === 'fulfilled' && fReq.value?.message) || 'Faculty data refresh failed.'
        );
      }

      if (aReq.status === 'fulfilled' && aReq.value?.success) {
        nextData.allocations = Array.isArray(aReq.value.data) ? aReq.value.data : [];
        successCount += 1;
      } else {
        errors.push(
          (aReq.status === 'fulfilled' && aReq.value?.message) || 'Allocations data refresh failed.'
        );
      }

      if (cReq.status === 'fulfilled' && cReq.value?.success) {
        nextData.courses = Array.isArray(cReq.value.data) ? cReq.value.data : [];
        successCount += 1;
      } else {
        errors.push(
          (cReq.status === 'fulfilled' && cReq.value?.message) || 'Courses data refresh failed.'
        );
      }

      setDashboardData(prev => ({
        ...prev,
        ...nextData,
        loading: false,
        error: successCount === 0 ? 'Could not load live dashboard data.' : '',
      }));

      // Also update shared context
      if (nextData.faculty) setFaculty(nextData.faculty);
      if (nextData.allocations) setAllocations(nextData.allocations);
      if (nextData.courses) setCourses(nextData.courses);

      if (successCount > 0) {
        setDashboardLastSyncedAt(new Date());
      }

      if (successCount === 0) {
        setDashboardSyncError('Could not load live dashboard data.');
      } else if (errors.length > 0) {
        setDashboardSyncError('Some dashboard data could not be refreshed. Showing latest available data.');
      } else {
        setDashboardSyncError('');
      }
    } catch {
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: prev.faculty.length || prev.allocations.length || prev.courses.length
          ? ''
          : 'Could not load live dashboard data.',
      }));
      setDashboardSyncError('Could not refresh dashboard data. Showing latest available data.');
    }
  }, [isAdmin, authHeaders]);

  useEffect(() => {
    if (!isAdmin || activeNav !== 'dashboard') return;
    refreshDashboardData();
    const id = setInterval(refreshDashboardData, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [isAdmin, activeNav, refreshDashboardData]);

  const refreshMasterData = useCallback(async () => {
    if (!user?.id) return;
    
    // Validate token before making requests
    const headers = authHeaders();
    if (!headers.Authorization.replace('Bearer ', '').trim()) {
      console.error('[refreshMasterData] No valid token available');
      setDashboardSyncError('Authentication failed. Please log in again.');
      return;
    }

    try {
      const [fReq, cReq] = await Promise.allSettled([
        fetchAllPages('/deva/faculty', {}, { headers }),
        fetchAllPages('/deva/courses', {}, { headers }),
      ]);

      const facultyOk = fReq.status === 'fulfilled' && fReq.value?.success;
      const coursesOk = cReq.status === 'fulfilled' && cReq.value?.success;
      const hasAnySuccess = facultyOk || coursesOk;

      setMasterData(prev => ({
        faculty: facultyOk ? (Array.isArray(fReq.value.data) ? fReq.value.data : []) : prev.faculty,
        courses: coursesOk ? (Array.isArray(cReq.value.data) ? cReq.value.data : []) : prev.courses,
      }));

      // Also update shared context
      if (facultyOk) setFaculty(Array.isArray(fReq.value.data) ? fReq.value.data : []);
      if (coursesOk) setCourses(Array.isArray(cReq.value.data) ? cReq.value.data : []);

      if (hasAnySuccess) {
        setDashboardLastSyncedAt(new Date());
        if (facultyOk && coursesOk) {
          setDashboardSyncError('');
        } else {
          setDashboardSyncError('Some dashboard data could not be refreshed. Showing latest available data.');
        }
      } else {
        setDashboardSyncError('Could not refresh dashboard data. Showing latest available data.');
      }
    } catch {
      setDashboardSyncError('Could not refresh dashboard data. Showing latest available data.');
    }
  }, [user?.id, authHeaders]);

  useEffect(() => {
    refreshMasterData();
  }, [refreshMasterData]);

  useEffect(() => {
    if (activeNav !== 'dashboard' || isAdmin) return;
    refreshMasterData();
    const id = setInterval(refreshMasterData, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [activeNav, isAdmin, refreshMasterData]);

  const fetchSections = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const sections = await fetchSectionsConfig();
      setSectionsConfig(sections || null);
      setSharedSectionsConfig(sections || null);
    } catch {
      setSectionsConfig(null);
      setSharedSectionsConfig(null);
    }
  }, [isAdmin, setSharedSectionsConfig]);

  useEffect(() => {
    if (!isAdmin || activeNav !== 'dashboard') return;
    fetchSections();
  }, [isAdmin, activeNav, fetchSections]);

  const [integrityData, setIntegrityData] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityError, setIntegrityError] = useState('');

  const fetchIntegrity = useCallback(async () => {
    if (!isAdmin) return;
    
    // Validate token before making requests
    const headers = authHeaders();
    if (!headers.Authorization.replace('Bearer ', '').trim()) {
      console.error('[fetchIntegrity] No valid token available');
      setIntegrityError('Authentication failed. Please log in again.');
      return;
    }

    setIntegrityLoading(true);
    setIntegrityError('');
    try {
      const res = await fetch(`${API}/deva/stats/integrity`, { 
        method: 'GET',
        headers 
      });
      const data = await res.json();
      if (data.success) {
        setIntegrityData(data.data);
      } else {
        setIntegrityError(data.message || 'Failed to load integrity report.');
      }
    } catch {
      setIntegrityError('Failed to load integrity report.');
    } finally {
      setIntegrityLoading(false);
    }
  }, [isAdmin, authHeaders]);

  useEffect(() => {
    if (isAdmin && activeNav === 'dashboard') fetchIntegrity();
  }, [isAdmin, activeNav, fetchIntegrity]);

  const [sectionModal, setSectionModal] = useState(null); // null | { mode: 'add'|'rename'|'delete', section?: string, input: string }

  const openAddSection = () => setSectionModal({ mode: 'add', input: '' });
  const openRenameSection = (section) => setSectionModal({ mode: 'rename', section, input: section });
  const openDeleteSection = (section) => setSectionModal({ mode: 'delete', section, input: '' });
  const closeSectionModal = () => setSectionModal(null);

  const confirmSectionModal = async () => {
    if (!sectionModal) return;
    const { mode, section, input } = sectionModal;
    closeSectionModal();

    if (mode === 'add') {
      if (!input.trim()) return;
      const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(sectionYear)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ section: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.warn('Section add failed:', data?.message);
        return;
      }
      setSectionsConfig(data?.data || null);
      setSharedSectionsConfig(data?.data || null);
    } else if (mode === 'rename') {
      if (!input.trim() || input.trim() === section) return;
      const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(sectionYear)}/${encodeURIComponent(section)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ newSection: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.warn('Section rename failed:', data?.message);
        return;
      }
      setSectionsConfig(data?.data || null);
      setSharedSectionsConfig(data?.data || null);
    } else if (mode === 'delete') {
      const res = await fetch(`${API}/deva/settings/sections/${encodeURIComponent(sectionYear)}/${encodeURIComponent(section)}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSectionsConfig(data.data || null);
        setSharedSectionsConfig(data.data || null);
      }
    }
  };
  // ───────────────────────────────────────────────
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.adminOnly)  return isAdmin;
    if (item.facultyOnly) return !isAdmin;
    return true;
  });

  const mySubmission = submissions.find(s => s.empId === user.id);

  const liveFaculty = isAdmin ? dashboardData.faculty : masterData.faculty;
  const liveCourses = isAdmin ? dashboardData.courses : masterData.courses;

  const dashboardComputed = useMemo(() => {
    if (!isAdmin) {
      return {
        courseRows: [],
        facultySummary: [],
        availableFaculty: [],
        fullyLoadedFaculty: [],
        overloadedFaculty: [],
        pendingCourses: [],
        pendingTotalHours: 0,
        pendingFacultyNeeded: 0,
      };
    }

    const allocationDocs = dashboardData.allocations || [];
    const facultyMap = new Map((liveFaculty || []).map(f => [f.empId, f]));

    const facultyLoadMap = {};
    (liveFaculty || []).forEach(f => {
      const capacity = getWorkloadTarget(f.designation);
      facultyLoadMap[f.empId] = {
        empId: f.empId,
        name: f.name,
        designation: f.designation,
        capacity,
        assignedHours: 0,
        lectureHours: 0,
        tutorialHours: 0,
        practicalHours: 0,
        courseKeys: new Set(),
      };
    });

    const getSlots = (a, type) => {
      if (type === 'L') {
        if (Array.isArray(a.lectureSlots) && a.lectureSlots.length > 0) return a.lectureSlots;
        return a.lectureSlot?.empId ? [a.lectureSlot] : [];
      }
      return type === 'T' ? (a.tutorialSlots || []) : (a.practicalSlots || []);
    };

    const courseRows = allocationDocs.map((a) => {
      const fixedL = Number(a.fixedL || 0);
      const fixedT = Number(a.fixedT || 0);
      const fixedP = Number(a.fixedP || 0);
      const totalWeeklyHours = fixedL + fixedT + fixedP;

      const typeInfo = {
        L: { hours: fixedL, slots: getSlots(a, 'L') },
        T: { hours: fixedT, slots: getSlots(a, 'T') },
        P: { hours: fixedP, slots: getSlots(a, 'P') },
      };

      const assignedByType = { L: [], T: [], P: [] };
      const pendingByType = { L: 0, T: 0, P: 0 };

      ['L', 'T', 'P'].forEach((type) => {
        const { hours, slots } = typeInfo[type];
        if (hours <= 0) return;

        const uniqueAssigned = Array.from(
          new Map(
            slots
              .filter(s => s?.empId)
              .map(s => {
                const f = facultyMap.get(s.empId);
                return [s.empId, { empId: s.empId, name: s.empName || f?.name || s.empId }];
              })
          ).values()
        );

        assignedByType[type] = uniqueAssigned;

        if (uniqueAssigned.length === 0) {
          pendingByType[type] = hours;
        } else {
          const split = hours / uniqueAssigned.length;
          uniqueAssigned.forEach((member) => {
            if (!facultyLoadMap[member.empId]) {
              const fallbackCapacity = getWorkloadTarget('');
              facultyLoadMap[member.empId] = {
                empId: member.empId,
                name: member.name,
                designation: '',
                capacity: fallbackCapacity,
                assignedHours: 0,
                lectureHours: 0,
                tutorialHours: 0,
                practicalHours: 0,
                courseKeys: new Set(),
              };
            }
            facultyLoadMap[member.empId].assignedHours += split;
            if (type === 'L') facultyLoadMap[member.empId].lectureHours += split;
            if (type === 'T') facultyLoadMap[member.empId].tutorialHours += split;
            if (type === 'P') facultyLoadMap[member.empId].practicalHours += split;
            facultyLoadMap[member.empId].courseKeys.add(`${a.courseId}__${a.section}`);
          });
        }
      });

      const requiredTypes = ['L', 'T', 'P'].filter(type => typeInfo[type].hours > 0).length;
      const assignedTypes = ['L', 'T', 'P'].filter(type => typeInfo[type].hours > 0 && assignedByType[type].length > 0).length;
      const completionPct = requiredTypes === 0 ? 100 : Math.round((assignedTypes / requiredTypes) * 100);
      const pendingTotal = pendingByType.L + pendingByType.T + pendingByType.P;

      const assignedFacultyNames = Array.from(
        new Set(['L', 'T', 'P'].flatMap(type => assignedByType[type].map(m => m.name)))
      );

      return {
        key: `${a.courseId}__${a.section}`,
        courseName: a.subjectName,
        section: a.section,
        year: a.year,
        L: fixedL,
        T: fixedT,
        P: fixedP,
        totalWeeklyHours,
        assignedByType,
        assignedFacultyNames,
        pendingByType,
        pendingTotal,
        completionPct,
        missingTypes: ['L', 'T', 'P'].filter(t => pendingByType[t] > 0),
      };
    });

    const facultySummary = Object.values(facultyLoadMap)
      .map((f) => {
        const assignedHours = Number(f.assignedHours.toFixed(2));
        const pendingLoad = Number((f.capacity - assignedHours).toFixed(2));
        const remainingLoad = Number(Math.max(0, pendingLoad).toFixed(2));
        const pctRaw = f.capacity > 0 ? (assignedHours / f.capacity) * 100 : 0;
        const loadPct = toPct(pctRaw);
        const overloaded = assignedHours > f.capacity;
        const fullyLoaded = !overloaded && remainingLoad === 0;
        const nearCapacity = !overloaded && !fullyLoaded && loadPct >= 85;

        return {
          empId: f.empId,
          name: f.name,
          designation: f.designation,
          capacity: f.capacity,
          assignedHours,
          pendingLoad,
          overloadStatus: overloaded ? 'Overload' : 'Normal',
          remainingLoad,
          courseCount: f.courseKeys.size,
          lectureHours: Number(f.lectureHours.toFixed(2)),
          tutorialHours: Number(f.tutorialHours.toFixed(2)),
          practicalHours: Number(f.practicalHours.toFixed(2)),
          loadPct,
          statusTone: overloaded ? 'over' : (fullyLoaded ? 'full' : (nearCapacity ? 'near' : 'normal')),
        };
      })
      .sort((a, b) => b.assignedHours - a.assignedHours);

    const availableFaculty = facultySummary.filter(f => f.remainingLoad > 0 && f.statusTone !== 'over');
    const fullyLoadedFaculty = facultySummary.filter(f => f.statusTone === 'full');
    const overloadedFaculty = facultySummary.filter(f => f.statusTone === 'over');
    const pendingCourses = courseRows.filter(c => c.pendingTotal > 0);

    return {
      courseRows,
      facultySummary,
      availableFaculty,
      fullyLoadedFaculty,
      overloadedFaculty,
      pendingCourses,
      pendingTotalHours: pendingCourses.reduce((s, c) => s + c.pendingTotal, 0),
      pendingFacultyNeeded: pendingCourses.reduce((s, c) => s + c.missingTypes.length, 0),
    };
  }, [isAdmin, dashboardData.allocations, liveFaculty]);

  // Compute faculty-specific stats
  const getMyStats = useMemo(() => {
    if (isAdmin) {
      // Admin stats
      return [
        {
          label: 'Total Faculty',
          value: liveFaculty.length,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          ),
          color: '#6b74e8', bg: '#eef0fd',
        },
        {
          label: 'Overloaded Faculty',
          value: dashboardComputed.overloadedFaculty.length,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          ),
          color: '#ec4899', bg: '#fce7f3',
        },
      ];
    }

    // Faculty stats - show faculty-specific metrics based on submissions and form status
    const myCourseCount = mySubmission?.courses ? mySubmission.courses.length : 0;

    return [
      {
        label: 'My Courses',
        value: myCourseCount,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        ),
        color: '#22c55e', bg: '#dcfce7',
      },
      {
        label: 'Total Submissions',
        value: submissions.length,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M20 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/>
          </svg>
        ),
        color: '#3b82f6', bg: '#dbeafe',
      },
    ];
  }, [isAdmin, mySubmission, submissions.length, dashboardComputed.overloadedFaculty.length, liveFaculty.length]);

  const stats = getMyStats;

  // ─────────────────────────────────────────────────────────
  // Role picker — shown only for canAccessAdmin users before they choose
  // ─────────────────────────────────────────────────────────
  if (user.canAccessAdmin && dashMode === null) {
    const initials = user.name ? user.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'U';
    return (
      <div className="rp-overlay">
        {/* Animated background blobs */}
        <div className="rp-blob rp-blob-1" />
        <div className="rp-blob rp-blob-2" />
        <div className="rp-blob rp-blob-3" />

        <div className="rp-container">
          {/* Brand header */}
          <div className="rp-brand">
            <img src={`${publicUrl}/logo.webp`} alt="Logo" className="rp-brand-logo" />
            <div>
              <div className="rp-brand-name">Faculty Workload Management</div>
              <div className="rp-brand-sub">Vignan Foundation For Science Technology & Research � CSE Department</div>
            </div>
          </div>

          {/* User greeting */}
          <div className="rp-greeting">
            <div className="rp-avatar">{initials}</div>
            <h1 className="rp-welcome">Welcome back, <span className="rp-name-hl">{user.name || 'User'}</span></h1>
            <p className="rp-sub">You have dual-access privileges. Select your dashboard to continue.</p>
          </div>

          {/* Role cards */}
          <div className="rp-cards">
            {/* Admin card */}
            <button className="rp-card rp-card-admin" onClick={() => setDashMode('admin')}>
              <div className="rp-card-glow" />
              <div className="rp-card-icon-wrap rp-icon-admin">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div className="rp-card-badge rp-badge-admin">ADMIN</div>
              <h3 className="rp-card-title">Admin Dashboard</h3>
              <p className="rp-card-desc">Manage faculty, courses, workloads, view all submissions and control form settings.</p>
              <ul className="rp-card-perks">
                <li><span className="rp-perk-dot rp-dot-admin" />Manage Faculty &amp; Courses</li>
                <li><span className="rp-perk-dot rp-dot-admin" />View All Submissions</li>
                <li><span className="rp-perk-dot rp-dot-admin" />Control Form &amp; Edit Access</li>
                <li><span className="rp-perk-dot rp-dot-admin" />Workload Assignment</li>
              </ul>
              <div className="rp-card-cta rp-cta-admin">Enter Admin Dashboard →</div>
            </button>

            {/* Faculty card */}
            <button className="rp-card rp-card-faculty" onClick={() => setDashMode('faculty')}>
              <div className="rp-card-glow" />
              <div className="rp-card-icon-wrap rp-icon-faculty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <div className="rp-card-badge rp-badge-faculty">FACULTY</div>
              <h3 className="rp-card-title">Faculty Dashboard</h3>
              <p className="rp-card-desc">Submit your course preferences, view your submissions and track your workload.</p>
              <ul className="rp-card-perks">
                <li><span className="rp-perk-dot rp-dot-faculty" />Submit Course Preferences</li>
                <li><span className="rp-perk-dot rp-dot-faculty" />View My Submission</li>
                <li><span className="rp-perk-dot rp-dot-faculty" />Edit Preferences (if enabled)</li>
                <li><span className="rp-perk-dot rp-dot-faculty" />View Personal Profile</li>
              </ul>
              <div className="rp-card-cta rp-cta-faculty">Enter Faculty Dashboard →</div>
            </button>
          </div>

          {/* Footer */}
          <div className="rp-footer">
            <span className="rp-footer-id">ID: {user.id}</span>
            <button className="rp-logout-btn" onClick={onLogout}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-wrapper">

      {/* Top bar */}
      <header className="dash-topbar">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen(p => !p)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="dash-topbar-brand">
          <img src={`${publicUrl}/logo.webp`} alt="Logo" className="dash-logo-mark" />
          <div className="dash-brand">
            <span className="dash-site-name">Faculty Work Load Management</span>
            <span className="dash-breadcrumb">
              {isAdmin
                ? <span className="dash-role-badge dash-role-admin">
                    Admin
                    {user.canAccessAdmin && (
                      <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.75 }}>(dual-access)</span>
                    )}
                  </span>
                : <span className="dash-role-badge dash-role-faculty">Faculty &middot; {user.id}</span>
              }
            </span>
          </div>
        </div>

        <div className="dash-topbar-right">
          {user.canAccessAdmin && (
            <button
              className="dash-switch-btn"
              title="Switch between Admin and Faculty dashboard"
              onClick={() => { setDashMode(null); setActiveNav('dashboard'); }}
            >
              Switch
            </button>
          )}
          <button className="dash-logout-btn" onClick={onLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="dash-layout">
        {/* Sidebar */}
        <aside className={`dash-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
          <nav className="sidebar-nav">
            {visibleNav.map((item) => (
              <button
                key={item.key}
                className={`sidebar-nav-btn ${item.colorClass}${activeNav === item.key ? ' active' : ''}`}
                onClick={() => setActiveNav(item.key)}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
                {item.key === 'mysubmissions' && mySubmission && (
                  <span className="dash-nav-badge">1</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className={`sidebar-nav-btn nav-color-rainbow${activeNav === 'profile' ? ' active' : ''}`}
              onClick={() => setActiveNav('profile')}
              title={!sidebarOpen ? 'Profile' : undefined}
            >
              <span className="sidebar-nav-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span className="sidebar-nav-label">Profile</span>
            </button>
          </div>
        </aside>

        {/* Mobile overlay — closes sidebar when tapping outside */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* Page content */}
        <div className="dash-page">

      {activeNav === 'faculty'        ? <FacultyPage isAdmin={isAdmin} /> :
       activeNav === 'courses'        ? <CoursesPage isAdmin={isAdmin} /> :
       activeNav === 'sections'       ? <SectionManagementPage /> :
       activeNav === 'workload'       ? <WorkloadPage submissions={submissions} /> :
       activeNav === 'allocation'     ? <AllocationPage isAdmin={isAdmin} /> :
        activeNav === 'extrafaculty'   ? <ExtraFacultyPage /> :
       activeNav === 'myworkload'     ? <MyWorkloadPage currentUser={user} /> :
       activeNav === 'facultyform'    ? (
         <FacultyFormPage
           formEnabled={formEnabled}
           setFormEnabled={setFormEnabled}
           editEnabled={editEnabled}
           setEditEnabled={setEditEnabled}
           submissions={submissions}
           onSubmit={handleNewSubmission}
           onUpdateSubmission={handleUpdateSubmission}
           onDeleteSubmission={handleDelSubmission}
           isAdmin={isAdmin}
           currentUser={user}
         />
       ) :
       activeNav === 'mysubmissions'  ? (
         <MySubmissionsPage
           currentUser={user}
           submissions={submissions}
           editEnabled={editEnabled}
           onUpdateSubmission={handleUpdateSubmission}
           onNavigateToForm={() => setActiveNav('facultyform')}
         />
       ) :
       activeNav === 'profile'        ? (
         <ProfilePage user={user} submissions={submissions} onLogout={onLogout} />
       ) :
       activeNav === 'auditlogs'     ? <AuditLogPage /> :
       /* ── Dashboard overview ── */
       <main className="dash-main">
        <h1 className="dash-heading">
          {isAdmin ? 'Admin Overview' : `Welcome, ${user.name || 'Faculty'}`}
        </h1>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: `${remainingSeconds < 300 ? '14px' : '12px'} 16px`,
          background: remainingSeconds < 300 
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
            : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          border: `2px solid ${remainingSeconds < 300 ? '#f59e0b' : '#93c5fd'}`,
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          color: remainingSeconds < 300 ? '#92400e' : '#1e40af',
          boxShadow: remainingSeconds < 300 
            ? '0 4px 12px rgba(245, 158, 11, 0.2)' 
            : '0 2px 8px rgba(59, 130, 246, 0.1)',
          transition: 'all 0.3s ease',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: remainingSeconds < 300 ? '16px' : '14px' }}>
              {remainingSeconds < 300 
                ? '?? Session ending soon' 
                : '? Active session'}
            </span>
          </span>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '6px 12px',
            background: remainingSeconds < 300 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)',
            borderRadius: '6px',
            fontSize: remainingSeconds < 300 ? '14px' : '13px',
          }}>
            Time remaining: 
            <strong style={{ 
              fontFamily: 'monospace', 
              fontSize: remainingSeconds < 300 ? '15px' : '14px',
              letterSpacing: '1px',
            }}>
              {formatSessionTime(remainingSeconds)}
            </strong>
          </span>
        </div>

          <div className="dash-sync-row">
            <span className="dash-sync-pill">Dashboard sync: {formatSyncedAt(dashboardLastSyncedAt)}</span>
            <span className="dash-sync-pill">Submissions sync: {formatSyncedAt(submissionsLastSyncedAt)}</span>
            <button
              className="dash-sync-retry"
              onClick={() => {
                refreshSubmissions();
                if (isAdmin) {
                  refreshDashboardData();
                  fetchSections();
                } else {
                  refreshMasterData();
                }
              }}
            >
              ? Retry Sync
            </button>
          </div>

          {(dashboardSyncError || submissionsSyncError) && (
            <div className="dash-live-warning dash-live-warning-row">
              <span>?? {dashboardSyncError || submissionsSyncError}</span>
              <button
                className="dash-inline-retry"
                onClick={() => {
                  refreshSubmissions();
                  if (isAdmin) {
                    refreshDashboardData();
                    fetchSections();
                  } else {
                    refreshMasterData();
                  }
                }}
              >
                Retry
              </button>
            </div>
          )}

        {isAdmin && dashboardData.error && (
          <div className="dash-live-warning">{dashboardData.error}</div>
        )}

        {isAdmin && dashboardData.loading && (
          <div className="dash-live-note">Refreshing dashboard data�</div>
        )}



        {/* ── Stat cards ── */}
        <div className="dash-cards">
          {stats.map((s) => (
            <div
              className="dash-card"
              key={s.label}
              style={{
                cursor: isAdmin && s.label === 'Overloaded Faculty' ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (isAdmin && s.label === 'Overloaded Faculty') {
                  setShowOverloadedModal(true);
                }
              }}
              title={isAdmin && s.label === 'Overloaded Faculty' ? 'Click to view and manage overloaded faculty' : ''}
            >
              <div className="dash-card-icon" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <div className="dash-card-info">
                <span className="dash-card-value" style={{ color: s.color }}>{s.value}</span>
                <span className="dash-card-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overloaded Faculty Modal */}
        {isAdmin && <OverloadedFacultyModal isOpen={showOverloadedModal} onClose={() => setShowOverloadedModal(false)} />}

        {isAdmin ? (
          <>
            <div className="dash-table-card" style={{ marginTop: '24px' }}>
              <div className="dash-table-header">
                <span className="dash-table-title">Overloaded Faculty Alert</span>
                <span className="dash-table-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {dashboardComputed.overloadedFaculty.length} overloaded
                </span>
              </div>
              <div className="dash-alert-wrap">
                {dashboardComputed.overloadedFaculty.length === 0
                  ? <span className="dash-muted">No overloads detected.</span>
                  : dashboardComputed.overloadedFaculty.map(f => (
                    <div key={f.empId} className="dash-overload-row">
                      <strong>{f.name} ({f.empId})</strong>
                      <span>Assigned {f.assignedHours}h / Capacity {f.capacity}h</span>
                      <span className="dash-over-badge">Excess {Math.abs(f.pendingLoad).toFixed(2)}h</span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Faculty Dashboard Content */}

            {/* Quick Actions Row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Available Courses */}
              <div className="faculty-compact-card">
                <div className="faculty-compact-header">
                  <span className="faculty-compact-title">?? Available</span>
                </div>
                <div className="faculty-compact-value" style={{ color: '#3b82f6' }}>
                  {liveCourses.length}
                </div>
                <div className="faculty-compact-label">Courses</div>
              </div>

              {/* Faculty Form */}
              <div className="faculty-compact-card">
                <div className="faculty-compact-header">
                  <span className="faculty-compact-title">?? Form</span>
                </div>
                <div className="faculty-compact-value" style={{ color: formEnabled ? '#8b5cf6' : '#d1d5db' }}>
                  {formEnabled ? '? Open' : '? Closed'}
                </div>
                <div className="faculty-compact-label">Status</div>
              </div>

              {/* My Submissions */}
              <div className="faculty-compact-card">
                <div className="faculty-compact-header">
                  <span className="faculty-compact-title">? Submissions</span>
                </div>
                <div className="faculty-compact-value" style={{ color: '#a855f7' }}>
                  {submissions.length}
                </div>
                <div className="faculty-compact-label">Submitted</div>
              </div>
            </div>

            {/* System Information */}
            <div className="faculty-dashboard-card">
              <div className="faculty-dashboard-header">
                <span className="faculty-dashboard-title">?? System Information</span>
              </div>
              <div className="dash-alert-wrap">
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.9rem', color: '#666', padding: '12px 16px' }}>
                  <span><strong>Employee ID:</strong></span>
                  <span>{user.id}</span>
                  <span><strong>Name:</strong></span>
                  <span>{user.name}</span>
                  <span><strong>Role:</strong></span>
                  <span>Faculty</span>
                  <span><strong>Form Status:</strong></span>
                  <span>{formEnabled ? '?? Open' : '?? Closed'}</span>
                  <span><strong>Edit Status:</strong></span>
                  <span>{editEnabled ? '?? Allowed' : '?? Not Allowed'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>}
        </div>{/* end dash-page */}
      </div>{/* end dash-layout */}
      {/* -- Section management modal -- */}
      {sectionModal && (
        <div className="cp-overlay" onClick={closeSectionModal}>
          <div className="cp-modal cp-modal-sm" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="cp-modal-head">
              <h3>
                {sectionModal.mode === 'add' && `Add Section � ${sectionYear}`}
                {sectionModal.mode === 'rename' && `Rename Section '${sectionModal.section}'`}
                {sectionModal.mode === 'delete' && `Delete Section '${sectionModal.section}'`}
              </h3>
              <button className="cp-modal-x" onClick={closeSectionModal}>?</button>
            </div>
            <div className="cp-modal-body">
              {sectionModal.mode === 'delete' ? (
                <p style={{ margin: 0 }}>
                  Remove section <strong>{sectionModal.section}</strong> from <strong>{sectionYear}</strong>? This cannot be undone.
                </p>
              ) : (
                <input
                  autoFocus
                  className="cp-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder={sectionModal.mode === 'add' ? 'Section name / number�' : 'New section name�'}
                  value={sectionModal.input}
                  onChange={e => setSectionModal(prev => ({ ...prev, input: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') confirmSectionModal(); if (e.key === 'Escape') closeSectionModal(); }}
                />
              )}
            </div>
            <div className="cp-modal-foot">
              <button className="cp-btn cp-btn-cancel" onClick={closeSectionModal}>Cancel</button>
              {sectionModal.mode === 'delete'
                ? <button className="cp-btn cp-btn-danger" onClick={confirmSectionModal}>Yes, Delete</button>
                : <button className="cp-btn cp-btn-save" onClick={confirmSectionModal}>
                    {sectionModal.mode === 'add' ? 'Add' : 'Rename'}
                  </button>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;


