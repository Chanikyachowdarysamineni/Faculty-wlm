'use strict';

/**
 * utils/courseUtils.js
 *
 * Course utilities for canonical year normalization, derivation, and course type handling.
 */

/**
 * Normalizes year format (numeric, Roman numeral, or programme-specific) to canonical form.
 * Supports B.Tech (I, II, III, IV), M.Tech (M.Tech_I, M.Tech_II), and extended years (V, VI).
 * @param {string|number} year - The raw year value
 * @returns {string} The canonical normalized year string
 */
const normalizeYear = (year) => {
  if (year === null || year === undefined) return '';
  const trimmed = String(year).trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();

  // M.Tech / MTech canonical mapping
  if (
    upper === 'M.TECH_I' || upper === 'MTECH_I' || upper === 'M.TECH-I' ||
    upper === 'MTECH I' || upper === 'M.TECH 1' || upper === 'MTECH_1' || upper === 'MTECH 1ST'
  ) {
    return 'M.Tech_I';
  }
  if (
    upper === 'M.TECH_II' || upper === 'MTECH_II' || upper === 'M.TECH-II' ||
    upper === 'MTECH II' || upper === 'M.TECH 2' || upper === 'MTECH_2' || upper === 'MTECH 2ND'
  ) {
    return 'M.Tech_II';
  }

  // Handle standard Roman numerals and numbers
  if (upper === 'I' || upper === '1' || upper === '1ST' || upper === '1ST YEAR' || upper === 'YEAR 1' || upper === 'YEAR I') return 'I';
  if (upper === 'II' || upper === '2' || upper === '2ND' || upper === '2ND YEAR' || upper === 'YEAR 2' || upper === 'YEAR II') return 'II';
  if (upper === 'III' || upper === '3' || upper === '3RD' || upper === '3RD YEAR' || upper === 'YEAR 3' || upper === 'YEAR III') return 'III';
  if (upper === 'IV' || upper === '4' || upper === '4TH' || upper === '4TH YEAR' || upper === 'YEAR 4' || upper === 'YEAR IV') return 'IV';
  if (upper === 'V' || upper === '5' || upper === '5TH' || upper === '5TH YEAR' || upper === 'YEAR 5' || upper === 'YEAR V') return 'V';
  if (upper === 'VI' || upper === '6' || upper === '6TH' || upper === '6TH YEAR' || upper === 'YEAR 6' || upper === 'YEAR VI') return 'VI';

  return trimmed;
};

/**
 * Derives year of study from subject code or subject title if year field is missing.
 * Supports patterns like:
 * - Batch prefix + dept + level: 25CS101 (I), 25CS203 (II), 25CS301 (III), 25CS401 (IV)
 * - Dept + level: CS101 (I), CS201 (II), CSE301 (III), IT401 (IV)
 * - Roman numeral suffixes: MATHS-II (II), PHYSICS I (I)
 * @param {string} subjectCode - Course subject code (e.g. '25CS201', 'CS301')
 * @returns {string} Canonical year ('I', 'II', 'III', 'IV', etc.)
 */
const deriveYearFromCode = (subjectCode) => {
  if (!subjectCode) return 'I';

  const code = String(subjectCode).toUpperCase().trim();

  // Pattern 1: Batch prefix + dept letters + digit (e.g., 25CS101, 24IT203, 23EC301, 22ME401)
  const batchMatch = code.match(/\d{2}[A-Z]+(\d)/);
  if (batchMatch && batchMatch[1]) {
    const digit = batchMatch[1];
    if (digit === '0' || digit === '1') return 'I';
    if (digit === '2') return 'II';
    if (digit === '3') return 'III';
    if (digit === '4') return 'IV';
    if (digit === '5') return 'V';
    if (digit === '6') return 'VI';
  }

  // Pattern 2: Dept letters + level digit (e.g., CS101, CSE201, IT305, ME410)
  const deptMatch = code.match(/^[A-Z]+-?(\d)\d{2}/);
  if (deptMatch && deptMatch[1]) {
    const digit = deptMatch[1];
    if (digit === '1') return 'I';
    if (digit === '2') return 'II';
    if (digit === '3') return 'III';
    if (digit === '4') return 'IV';
    if (digit === '5') return 'V';
    if (digit === '6') return 'VI';
  }

  // Pattern 3: Explicit Roman numeral suffix in code (e.g., MATH-II, CHE-I, ENG-III)
  const romanMatch = code.match(/[_\s-](VI|V|IV|III|II|I)\b/);
  if (romanMatch && romanMatch[1]) {
    return romanMatch[1];
  }

  return 'I'; // Default fallback
};

/**
 * Resolves the course year dynamically from a course document or object.
 * Priority: explicit `year` field normalized > derived from `subjectCode` > fallback 'I'
 * @param {object} course - Course document or object
 * @returns {string} Normalized canonical year (e.g. 'I', 'II', 'III', 'IV')
 */
const resolveCourseYear = (course) => {
  if (!course) return 'I';

  const explicitYear = course.year !== undefined && course.year !== null
    ? String(course.year).trim()
    : '';

  if (explicitYear) {
    const normalized = normalizeYear(explicitYear);
    if (normalized) return normalized;
  }

  return deriveYearFromCode(course.subjectCode);
};

/**
 * Normalizes course type to a standard key for consistent processing.
 * Maps variations of "Department Elective" to 'DE', "Mandatory" to 'MANDATORY', etc.
 * @param {string} courseType - The raw course type string
 * @returns {string} The normalized key ('DE', 'MANDATORY', or 'OTHER')
 */
const normalizeCourseTypeKey = (courseType = '') => {
  const normalized = String(courseType || '').trim().toLowerCase();
  if (normalized === 'de' || normalized === 'department elective') return 'DE';
  if (normalized === 'mandatory') return 'MANDATORY';
  return 'OTHER';
};

module.exports = {
  normalizeYear,
  deriveYearFromCode,
  resolveCourseYear,
  normalizeCourseTypeKey,
};
