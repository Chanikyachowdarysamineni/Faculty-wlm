'use strict';

/**
 * utils/academicPeriodUtils.js
 *
 * Centralized business logic for academic period dates, semester boundaries,
 * and faculty eligibility based on joiningDate and relievingDate.
 */

const parseAcademicYearRange = (yearName) => {
  if (!yearName) return null;
  const str = String(yearName).trim();
  const match = str.match(/^(\d{4})\s*[-–/]\s*(\d{4})$/);
  if (match) {
    return { startYear: parseInt(match[1], 10), endYear: parseInt(match[2], 10) };
  }
  const single = str.match(/^(\d{4})$/);
  if (single) {
    const y = parseInt(single[1], 10);
    return { startYear: y, endYear: y + 1 };
  }
  return null;
};

/**
 * Resolves precise start and end Date objects for an academic period.
 * Consistent across Faculty, Workload, Allocation, Preferences, Dashboard, and Reports.
 *
 * @param {Object} params
 * @param {Object|string} params.academicYear - AcademicYear doc or string name (e.g. '2026-2027')
 * @param {string} [params.semesterType] - 'ODD' | 'EVEN'
 * @param {Object} [params.academicYearSemester] - AcademicYearSemester doc (if available)
 * @returns {{ periodStart: Date, periodEnd: Date, semester: string, academicYearName: string }}
 */
const getSemesterPeriodDates = ({ academicYear, semesterType, academicYearSemester } = {}) => {
  const yearName = typeof academicYear === 'string'
    ? academicYear
    : (academicYear?.name || '');
  const sem = String(semesterType || academicYearSemester?.semesterType || 'ODD').toUpperCase();

  const range = parseAcademicYearRange(yearName);
  const startYear = range ? range.startYear : new Date().getFullYear();
  const endYear = range ? range.endYear : startYear + 1;

  let periodStart = null;
  let periodEnd = null;

  if (sem === 'ODD') {
    // ODD Semester: July through December of startYear
    periodStart = academicYearSemester?.startDate
      ? new Date(academicYearSemester.startDate)
      : (academicYear?.startDate ? new Date(academicYear.startDate) : new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0))); // July 1

    periodEnd = academicYearSemester?.endDate
      ? new Date(academicYearSemester.endDate)
      : new Date(Date.UTC(startYear, 11, 31, 23, 59, 59, 999)); // Dec 31
  } else if (sem === 'EVEN') {
    // EVEN Semester: January through May/June of endYear
    periodStart = academicYearSemester?.startDate
      ? new Date(academicYearSemester.startDate)
      : new Date(Date.UTC(endYear, 0, 1, 0, 0, 0, 0)); // Jan 1

    periodEnd = academicYearSemester?.endDate
      ? new Date(academicYearSemester.endDate)
      : (academicYear?.endDate ? new Date(academicYear.endDate) : new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999))); // June 30
  } else {
    // Full Academic Year
    periodStart = academicYear?.startDate
      ? new Date(academicYear.startDate)
      : new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0));

    periodEnd = academicYear?.endDate
      ? new Date(academicYear.endDate)
      : new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999));
  }

  return {
    periodStart,
    periodEnd,
    semester: sem,
    academicYearName: yearName,
  };
};

/**
 * Determines whether a faculty member is eligible for employment/allocation
 * in the specified period boundaries based on joiningDate and relievingDate.
 *
 * Rules:
 * - If joiningDate > periodEnd: faculty joined after the period ended -> not eligible
 * - If relievingDate < periodStart: faculty was relieved before the period started -> not eligible
 * - Otherwise: faculty was active during at least part of the period -> eligible
 *
 * @param {Object} faculty - Faculty document
 * @param {Date|string} periodStart - Period start date
 * @param {Date|string} periodEnd - Period end date
 * @returns {boolean}
 */
const isFacultyEligibleForPeriod = (faculty, periodStart, periodEnd) => {
  if (!faculty || faculty.isDeleted) return false;

  const pStart = periodStart ? new Date(periodStart) : null;
  const pEnd = periodEnd ? new Date(periodEnd) : null;

  if (pEnd && faculty.joiningDate) {
    const jDate = new Date(faculty.joiningDate);
    if (jDate > pEnd) return false;
  }

  if (pStart && faculty.relievingDate) {
    const rDate = new Date(faculty.relievingDate);
    if (rDate < pStart) return false;
  }

  return true;
};

/**
 * Builds MongoDB $and clauses for filtering faculty active within periodStart and periodEnd.
 *
 * @param {Date|string} periodStart
 * @param {Date|string} periodEnd
 * @returns {Array<Object>} Array of query conditions to be placed in $and
 */
const buildFacultyDateFilter = (periodStart, periodEnd) => {
  const clauses = [];

  if (periodEnd) {
    clauses.push({
      $or: [
        { joiningDate: { $lte: new Date(periodEnd) } },
        { joiningDate: null },
        { joiningDate: { $exists: false } },
      ],
    });
  }

  if (periodStart) {
    clauses.push({
      $or: [
        { relievingDate: { $gte: new Date(periodStart) } },
        { relievingDate: null },
        { relievingDate: { $exists: false } },
      ],
    });
  }

  return clauses;
};

/**
 * Validates joiningDate and relievingDate consistency.
 *
 * @param {string|Date} joiningDate
 * @param {string|Date} relievingDate
 * @returns {{ valid: boolean, message?: string }}
 */
const validateEmploymentDates = (joiningDate, relievingDate) => {
  if (joiningDate && isNaN(new Date(joiningDate).getTime())) {
    return { valid: false, message: 'Invalid joining date format.' };
  }
  if (relievingDate && isNaN(new Date(relievingDate).getTime())) {
    return { valid: false, message: 'Invalid relieving date format.' };
  }
  if (joiningDate && relievingDate) {
    const j = new Date(joiningDate);
    const r = new Date(relievingDate);
    if (r < j) {
      return { valid: false, message: 'Relieving date cannot be earlier than joining date.' };
    }
  }
  return { valid: true };
};

module.exports = {
  parseAcademicYearRange,
  getSemesterPeriodDates,
  isFacultyEligibleForPeriod,
  buildFacultyDateFilter,
  validateEmploymentDates,
};
