import React from 'react';
import { useAcademicPeriod } from '../AcademicPeriodContext';
import './GlobalPeriodSelector.css';

const GlobalPeriodSelector = () => {
  const { 
    academicYears, 
    selectedAcademicYearId, 
    selectedSemester, 
    changeAcademicPeriod 
  } = useAcademicPeriod();

  if (!academicYears || academicYears.length === 0) return null;

  // Get semesters for the currently selected year (from DB, not hardcoded)
  const selectedYear = academicYears.find(y => String(y.id || y._id) === String(selectedAcademicYearId));
  const availableSemesters = selectedYear?.semesters || [];

  return (
    <div className="global-period-selector">
      <div className="selector-group">
        <label htmlFor="academic-year-select">Academic Year</label>
        <select 
          id="academic-year-select"
          value={selectedAcademicYearId}
          onChange={(e) => changeAcademicPeriod(e.target.value, selectedSemester)}
        >
          {academicYears.map(year => (
            <option key={year.id || year._id} value={year.id || year._id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>

      <div className="selector-group">
        <label htmlFor="semester-select">Semester</label>
        <select
          id="semester-select"
          value={selectedSemester}
          onChange={(e) => changeAcademicPeriod(selectedAcademicYearId, e.target.value)}
        >
          {availableSemesters.length > 0
            ? availableSemesters.map(sem => (
                <option key={sem.id || sem._id} value={sem.semesterType}>
                  {sem.semesterType}
                </option>
              ))
            : /* fallback if no semesters configured yet */
              ['ODD', 'EVEN'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))
          }
        </select>
      </div>
    </div>
  );
};

export default GlobalPeriodSelector;
