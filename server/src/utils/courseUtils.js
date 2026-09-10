'use strict';

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
  normalizeCourseTypeKey
};
