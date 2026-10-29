import React, { createContext, useContext, useState, useCallback } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Faculty, Courses, Allocations data
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [sectionsConfig, setSectionsConfig] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);
  
  // Academic Context
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYearState] = useState(() => {
    return localStorage.getItem('selectedAcademicYear') || '';
  });

  const setSelectedAcademicYear = useCallback((year) => {
    localStorage.setItem('selectedAcademicYear', year);
    setSelectedAcademicYearState(year);
  }, []);
  
  // Semester Context
  const [selectedSemester, setSelectedSemesterState] = useState(() => {
    return localStorage.getItem('selectedSemester') || 'ODD';
  });

  const setSelectedSemester = useCallback((semester) => {
    localStorage.setItem('selectedSemester', semester);
    setSelectedSemesterState(semester);
  }, []);

  // Sync with AcademicPeriodContext events
  React.useEffect(() => {
    const handlePeriodChange = (e) => {
      if (e?.detail) {
        if (e.detail.yearName) setSelectedAcademicYearState(e.detail.yearName);
        if (e.detail.semester) setSelectedSemesterState(e.detail.semester);
      }
    };
    window.addEventListener('academicPeriodChanged', handlePeriodChange);
    return () => window.removeEventListener('academicPeriodChanged', handlePeriodChange);
  }, []);

  // Connect WebSocket and listen for real-time updates
  React.useEffect(() => {
    const token = localStorage.getItem('wlm_token');
    if (token) {
      const wsClient = require('./utils/WebSocketClient').default;
      wsClient.connect();
    }

    const handleRealtime = (e) => {
      const msg = e?.detail;
      if (!msg) return;

      if (msg.type === 'sections_updated') {
        window.dispatchEvent(new CustomEvent('wlm:sections_reload'));
      }
      if (msg.type === 'academic_period_updated') {
        window.dispatchEvent(new CustomEvent('wlm:academic_period_reload'));
      }
      if (msg.type === 'allocations_updated' || msg.type === 'allocations_reload') {
        window.dispatchEvent(new CustomEvent('wlm:allocations_reload'));
      }
      if (msg.type === 'workload_updated' || msg.type === 'workloads_reload') {
        window.dispatchEvent(new CustomEvent('wlm:workloads_reload'));
      }
      if (msg.type === 'settings_updated') {
        window.dispatchEvent(new CustomEvent('wlm:settings_reload'));
      }
      if (msg.type === 'courses_updated') {
        window.dispatchEvent(new CustomEvent('wlm:courses_reload'));
      }
      if (msg.type === 'faculty_updated') {
        window.dispatchEvent(new CustomEvent('wlm:faculty_reload'));
      }
      if (msg.type === 'admin_management_updated' || msg.type === 'user_updated') {
        window.dispatchEvent(new CustomEvent('wlm:admin_management_reload'));
      }
      if (msg.type === 'submissions_updated') {
        window.dispatchEvent(new CustomEvent('wlm:submissions_reload'));
      }
    };

    window.addEventListener('wlm:realtime', handleRealtime);
    return () => {
      window.removeEventListener('wlm:realtime', handleRealtime);
    };
  }, []);

  const value = {
    faculty,
    setFaculty,
    courses,
    setCourses,
    allocations,
    setAllocations,
    sectionsConfig,
    setSectionsConfig,
    designations,
    setDesignations,
    systemConfig,
    setSystemConfig,
    academicYears,
    setAcademicYears,
    selectedAcademicYear,
    setSelectedAcademicYear,
    selectedSemester,
    setSelectedSemester,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useSharedData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useSharedData must be used within a DataProvider');
  }
  return context;
};

