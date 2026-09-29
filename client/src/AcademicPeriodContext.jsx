import React, { createContext, useContext, useState, useEffect } from 'react';
import API_BASE_URL from './config';

const AcademicPeriodContext = createContext();

export const useAcademicPeriod = () => useContext(AcademicPeriodContext);

export const AcademicPeriodProvider = ({ children, currentUser }) => {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [academicYearSemesterId, setAcademicYearSemesterId] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch/re-fetch whenever user logs in or out
  useEffect(() => {
    const token = localStorage.getItem('wlm_token');
    if (token && currentUser) {
      fetchAcademicYears();
    } else if (!currentUser) {
      // User logged out — reset state
      setLoading(false);
    }
  // eslint-disable-next-line
  }, [currentUser]);

  // Fallback: also watch storage events (cross-tab login)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'wlm_token' && e.newValue) {
        fetchAcademicYears();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchAcademicYears = async () => {
    const token = localStorage.getItem('wlm_token');
    if (!token) { setLoading(false); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/deva/academic-years`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        // e.g. 401 — user is not authenticated yet, bail out silently
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        setAcademicYears(data.data);

        // Find current or fallback to first
        let currentYear = data.data.find(y => y.isCurrent) || data.data[0];

        // Try to restore from localStorage (must match a real ObjectId from DB)
        const savedYearId = localStorage.getItem('selectedAcademicYearId');
        if (savedYearId) {
          const found = data.data.find(y => String(y.id || y._id) === savedYearId);
          if (found) currentYear = found;
        }

        let savedSem = localStorage.getItem('selectedSemester');
        const activeSem = (currentYear.semesters || []).find(s => s.isCurrent || s.status === 'ACTIVE') || (currentYear.semesters || [])[0];
        if (!savedSem || !(currentYear.semesters || []).some(s => s.semesterType === savedSem)) {
          savedSem = activeSem ? activeSem.semesterType : '';
        }
        const yearId = String(currentYear.id || currentYear._id);

        setSelectedAcademicYearId(yearId);
        setSelectedAcademicYear(currentYear.name);
        setSelectedSemester(savedSem);

        // Persist resolved ObjectId so interceptor always sends correct ID
        localStorage.setItem('selectedAcademicYearId', yearId);
        localStorage.setItem('selectedSemester', savedSem);

        updateSemesterId(yearId, savedSem, currentYear.semesters);
      }
    } catch (error) {
      console.error('Failed to fetch academic years:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSemesterId = (yearId, semType, semestersList = []) => {
    if (!semestersList.length) {
      const yearObj = academicYears.find(y => String(y.id || y._id) === yearId);
      if (yearObj) semestersList = yearObj.semesters || [];
    }
    const semObj = semestersList.find(s => s.semesterType === semType);
    if (semObj) setAcademicYearSemesterId(String(semObj.id || semObj._id));
  };

  const changeAcademicPeriod = (yearId, semester) => {
    const yearObj = academicYears.find(y => String(y.id || y._id) === yearId);
    if (yearObj) {
      const id = String(yearObj.id || yearObj._id);
      setSelectedAcademicYearId(id);
      setSelectedAcademicYear(yearObj.name);
      setSelectedSemester(semester);
      updateSemesterId(id, semester, yearObj.semesters);

      localStorage.setItem('selectedAcademicYearId', id);
      localStorage.setItem('selectedSemester', semester);
    }
  };

  const periodContext = {
    academicYears,
    selectedAcademicYearId,
    selectedAcademicYear,
    selectedSemester,
    academicYearSemesterId,
    changeAcademicPeriod,
    fetchAcademicYears,
    loading
  };

  return (
    <AcademicPeriodContext.Provider value={periodContext}>
      {children}
    </AcademicPeriodContext.Provider>
  );
};
