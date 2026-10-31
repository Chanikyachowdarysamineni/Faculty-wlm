export const isTADesignation = (designation = '', category = null) => {
  if (category === 'TA_INSTRUCTOR') return true;
  if (category === 'FACULTY') return false;
  const value = String(designation || '').trim().toLowerCase();
  return value === 'ta' || 
         value === 'ti' ||
         value.includes('teaching assistant') || 
         value.includes('teaching associate') || 
         value.includes('teaching instructor');
};

export const getDefaultCapacity = (designation = '', category = null) => {
  return isTADesignation(designation, category) ? 12 : 18;
};
