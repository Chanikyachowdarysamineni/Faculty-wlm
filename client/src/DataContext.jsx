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

