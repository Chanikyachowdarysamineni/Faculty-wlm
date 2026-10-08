export const isTADesignation = (designation = '') => {
  const value = String(designation || '').trim().toLowerCase();
  return value === 'ta' || 
         value.includes('teaching assistant') || 
         value.includes('teaching associate') || 
         value.includes('teaching instructor');
};

export const getDefaultCapacity = (designation = '') => {
  return isTADesignation(designation) ? 12 : 18;
};
