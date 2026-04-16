/**
 * utils/facultyPreferencesApi.js
 *
 * Utility functions for fetching and managing faculty course preferences
 * Used by WorkloadPage and AllocationPage to filter courses dynamically
 */

import API from '../config';
import { authJsonHeaders } from './apiFetchAll';

const authHeader = () => authJsonHeaders();

/**
 * Fetch faculty preferences from API
 * @param {string} empId - Employee ID of faculty
 * @returns {Promise} { empId, preferredCourseIds, isSubmitted, submittedAt, notes }
 */
export const fetchFacultyPreferences = async (empId) => {
  try {
    const response = await fetch(
      `${API}/deva/faculty-preferences/${encodeURIComponent(empId)}`,
      {
        method: 'GET',
        headers: authHeader(),
      }
    );

    // Handle 404: Faculty doesn't exist or no preferences yet - return empty preferences
    if (response.status === 404) {
      return {
        empId,
        preferredCourseIds: [],
        isSubmitted: false,
        submittedAt: null,
        notes: '',
      };
    }

    if (!response.ok) {
      console.error(`Failed to fetch preferences: ${response.statusText} (${response.status})`);
      return {
        empId,
        preferredCourseIds: [],
        isSubmitted: false,
        submittedAt: null,
        notes: '',
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('Faculty preferences fetch unsuccessful:', data.message);
      return {
        empId,
        preferredCourseIds: [],
        isSubmitted: false,
        submittedAt: null,
        notes: '',
      };
    }

    return data.data || {
      empId,
      preferredCourseIds: [],
      isSubmitted: false,
      submittedAt: null,
      notes: '',
    };
  } catch (err) {
    console.warn('Warning: Unable to fetch faculty preferences (will show all courses):', err.message);
    // Return empty preferences on error (will show all courses)
    return {
      empId,
      preferredCourseIds: [],
      isSubmitted: false,
      submittedAt: null,
      notes: '',
    };
  }
};

/**
 * Fetch filtered courses for a faculty
 * - If faculty has submitted preferences, returns only preferred courses
 * - If faculty has not submitted preferences, returns all available courses
 *
 * @param {string} empId - Employee ID of faculty
 * @param {string} year - (optional) Filter by year (I, II, III, IV)
 * @param {string} courseType - (optional) Filter by course type
 * @returns {Promise} { empId, hasPreferences, preferredCourseIds, courses, totalCount, message }
 */
export const fetchFilteredCourses = async (empId, year = '', courseType = '') => {
  try {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (courseType) params.append('courseType', courseType);

    const url = `${API}/deva/faculty-preferences/${encodeURIComponent(empId)}/courses${params.toString() ? `?${params}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: authHeader(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch courses: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('Course fetch unsuccessful:', data.message);
      return {
        empId,
        hasPreferences: false,
        preferredCourseIds: [],
        courses: [],
        totalCount: 0,
        message: 'Failed to fetch courses',
      };
    }

    return data.data || {
      empId,
      hasPreferences: false,
      preferredCourseIds: [],
      courses: [],
      totalCount: 0,
    };
  } catch (err) {
    console.error('Error fetching filtered courses:', err);
    return {
      empId,
      hasPreferences: false,
      preferredCourseIds: [],
      courses: [],
      totalCount: 0,
      message: `Error: ${err.message}`,
    };
  }
};

/**
 * Save faculty course preferences
 * @param {string} empId - Employee ID
 * @param {array} preferredCourseIds - Array of course IDs
 * @param {string} notes - (optional) Notes/reason for preferences
 * @returns {Promise} { empId, preferredCourseIds, isSubmitted, submittedAt, notes, message }
 */
export const saveFacultyPreferences = async (empId, preferredCourseIds, notes = '') => {
  try {
    const response = await fetch(`${API}/deva/faculty-preferences`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        empId,
        preferredCourseIds,
        notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save preferences: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Unknown error');
    }

    return data.data;
  } catch (err) {
    console.error('Error saving faculty preferences:', err);
    throw err;
  }
};

/**
 * Update faculty course preferences
 * @param {string} empId - Employee ID
 * @param {array} preferredCourseIds - (optional) Updated array of course IDs
 * @param {string} notes - (optional) Updated notes
 * @returns {Promise} { empId, preferredCourseIds, isSubmitted, submittedAt, notes, message }
 */
export const updateFacultyPreferences = async (empId, preferredCourseIds = null, notes = null) => {
  try {
    const body = {};
    if (preferredCourseIds !== null) {
      body.preferredCourseIds = preferredCourseIds;
    }
    if (notes !== null) {
      body.notes = notes;
    }

    const response = await fetch(
      `${API}/deva/faculty-preferences/${encodeURIComponent(empId)}`,
      {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update preferences: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Unknown error');
    }

    return data.data;
  } catch (err) {
    console.error('Error updating faculty preferences:', err);
    throw err;
  }
};

/**
 * Clear/delete faculty preferences
 * @param {string} empId - Employee ID
 * @returns {Promise} { empId, message }
 */
export const clearFacultyPreferences = async (empId) => {
  try {
    const response = await fetch(
      `${API}/deva/faculty-preferences/${encodeURIComponent(empId)}`,
      {
        method: 'DELETE',
        headers: authHeader(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to clear preferences: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Unknown error');
    }

    return data.data;
  } catch (err) {
    console.error('Error clearing faculty preferences:', err);
    throw err;
  }
};

/**
 * Filter courses based on preferences
 * Helper function to apply preference filtering on client-side if needed
 *
 * @param {array} allCourses - Array of all available courses
 * @param {array} preferredCourseIds - Array of preferred course IDs
 * @param {boolean} hasPreferences - Whether faculty has submitted preferences
 * @returns {array} Filtered courses
 */
export const filterCoursesByPreference = (allCourses, preferredCourseIds, hasPreferences) => {
  if (!hasPreferences || !preferredCourseIds || preferredCourseIds.length === 0) {
    return allCourses;
  }

  return allCourses.filter((course) =>
    preferredCourseIds.includes(Number(course.id) || Number(course.courseId))
  );
};

/**
 * Check if faculty has preferences submitted
 * @param {object} preferences - Faculty preferences object from API
 * @returns {boolean} Whether preferences are submitted and valid
 */
export const hasFacultySubmittedPreferences = (preferences) => {
  return (
    preferences &&
    preferences.isSubmitted === true &&
    Array.isArray(preferences.preferredCourseIds) &&
    preferences.preferredCourseIds.length > 0
  );
};

export default {
  fetchFacultyPreferences,
  fetchFilteredCourses,
  saveFacultyPreferences,
  updateFacultyPreferences,
  clearFacultyPreferences,
  filterCoursesByPreference,
  hasFacultySubmittedPreferences,
};
