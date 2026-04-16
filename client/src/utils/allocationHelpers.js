/**
 * allocationHelpers.js
 * Enhanced helpers for allocation state management and refetching
 */

import API from '../config';
import { authJsonHeaders } from './apiFetchAll';

const authHeader = () => ({ ...authJsonHeaders() });

/**
 * Refetch allocation immediately after assignment
 * Ensures UI shows latest data from server
 */
export const refetchAllocationData = async (courseId, year, section) => {
  try {
    const url = `${API}/deva/allocations?courseId=${courseId}&year=${encodeURIComponent(year)}&section=${encodeURIComponent(section)}`;
    const response = await fetch(url, { headers: authHeader() });
    const data = await response.json();
    
    if (!response.ok || !data?.success) {
      console.error('Failed to refetch allocation:', data?.message);
      return { success: false, data: null };
    }
    
    // Return the allocation record for this course/year/section
    const allocation = Array.isArray(data.data) ? data.data[0] : data.data;
    return { success: true, data: allocation };
  } catch (error) {
    console.error('Error refetching allocation:', error);
    return { success: false, data: null };
  }
};

/**
 * Validate allocation payload before submission
 * Enforces R1 rules, R2-R4 constraints, etc.
 */
export const validateAllocation = ({
  courseId, year, section,
  lectureSlots, tutorialSlots, practicalSlots,
  mainFacultyMap, taWorkloadMap, facultyList
}) => {
  const errors = [];

  // Validate required fields
  if (!courseId || !year || !section) {
    errors.push('Missing courseId, year, or section');
    return { valid: false, errors };
  }

  // Validate R1 is not TA
  const lR1 = lectureSlots?.[0];
  if (lR1?.empId) {
    const fac = facultyList.find(f => f.empId === lR1.empId);
    if (fac && (fac.role === 'TA' || fac.designation?.toLowerCase()?.includes('ta'))) {
      errors.push('Lecture R1 must be Main Faculty, not TA');
    }
  }

  // Validate T/P R1are not TA
  const tR1 = tutorialSlots?.[0];
  if (tR1?.empId) {
    const fac = facultyList.find(f => f.empId === tR1.empId);
    if (fac && (fac.role === 'TA' || fac.designation?.toLowerCase()?.includes('ta'))) {
      errors.push('Tutorial R1 must be Main Faculty, not TA');
    }
  }

  const pR1 = practicalSlots?.[0];
  if (pR1?.empId) {
    const fac = facultyList.find(f => f.empId === pR1.empId);
    if (fac && (fac.role === 'TA' || fac.designation?.toLowerCase()?.includes('ta'))) {
      errors.push('Practical R1 must be Main Faculty, not TA');
    }
  }

  // Validate R2-R4: only Supporting Faculty or TA allowed
  const validateRoles = (slots, type) => {
    (slots || []).forEach((slot, idx) => {
      if (!slot?.empId || idx === 0) return; // Skip R1
      const fac = facultyList.find(f => f.empId === slot.empId);
      if (fac && fac.role !== 'Supporting Faculty' && fac.role !== 'TA') {
        errors.push(`${type} R${idx + 1} must be Supporting Faculty or TA, not ${fac.role}`);
      }
    });
  };

  validateRoles(tutorialSlots, 'Tutorial');
  validateRoles(practicalSlots, 'Practical');

  return { valid: errors.length === 0, errors };
};

/**
 * Build allocation payload with auto-fill and mirror logic
 * Applied already on backend, but useful for UI state management
 */
export const buildAllocationPayload = ({ courseId, year, section, lectureSlots, tutorialSlots, practicalSlots, courseData }) => {
  const payload = {
    courseId,
    year,
    section,
    subjectCode: courseData?.subjectCode || '',
    subjectName: courseData?.subjectName || '',
    shortName: courseData?.shortName || '',
    program: courseData?.program || 'B.Tech',
    fixedL: courseData?.L || 0,
    fixedT: courseData?.T || 0,
    fixedP: courseData?.P || 0,
    C: courseData?.C || 0,
    lectureSlots: lectureSlots || [],
    lectureSlot: (lectureSlots || [])[0] || { empId: '', empName: '', designation: '', hours: 0 },
    tutorialSlots: tutorialSlots || [],
    practicalSlots: practicalSlots || [],
  };

  return payload;
};

/**
 * Extract empId from allocationMap for a given cell
 */
export const getAllocationMapKey = (courseId, section, type, rowIdx) => {
  return `${courseId}__${section}__${type}__${rowIdx}`;
};

/**
 * Check if a slot is auto-filled (from L.R1 or workload)
 */
export const isSlotAutoFilled = (courseId, section, type, rowIdx, allocMap, mainFacultyMap, taWorkloadMap) => {
  const key = getAllocationMapKey(courseId, section, type, rowIdx);
  
  // R1 in T/P is auto-filled from main faculty
  if (rowIdx === 0 && (type === 'T' || type === 'P')) {
    const mainKey = `${courseId}__${section}`;
    const mainEmpId = mainFacultyMap[mainKey]?.empId;
    const currentEmpId = allocMap[key];
    return !!(mainEmpId && currentEmpId === mainEmpId);
  }

  // R2-R4: check if driven by TA workload
  if (rowIdx >= 1 && (type === 'T' || type === 'P')) {
    const taEmpId = taWorkloadMap[key];
    const currentEmpId = allocMap[key];
    return !!(taEmpId && currentEmpId === taEmpId);
  }

  return false;
};
