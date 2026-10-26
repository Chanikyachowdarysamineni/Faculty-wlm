'use strict';

const TA_DESIGNATIONS = [
  'Teaching Associate',
  'Teaching Assistant',
  'Teaching Assistant-I',
  'Teaching Assistant-II',
  'Teaching Instructor',
];

const matchTaDesignation = (rawDesignation) => {
  if (!rawDesignation) return null;
  const clean = String(rawDesignation).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (
    clean === 'teaching assistant ii' ||
    clean === 'teaching assistant 2' ||
    clean === 'ta ii' ||
    clean === 'ta 2' ||
    clean === 'ta-ii' ||
    clean === 'teaching assistant-ii'
  ) {
    return 'Teaching Assistant-II';
  }
  if (
    clean === 'teaching assistant i' ||
    clean === 'teaching assistant 1' ||
    clean === 'ta i' ||
    clean === 'ta 1' ||
    clean === 'ta-i' ||
    clean === 'teaching assistant-i'
  ) {
    return 'Teaching Assistant-I';
  }
  if (clean === 'teaching assistant' || clean === 'ta') {
    return 'Teaching Assistant';
  }
  if (clean === 'teaching associate' || clean === 'teaching assoc' || clean === 't assoc' || clean.includes('teaching associate')) {
    return 'Teaching Associate';
  }
  if (clean === 'teaching instructor' || clean === 'instructor' || clean === 'ti' || clean.includes('teaching instructor')) {
    return 'Teaching Instructor';
  }
  return null;
};

const isTADesignation = (designation = '') => {
  return matchTaDesignation(designation) !== null;
};

const getDefaultCapacity = (designation = '') => {
  return isTADesignation(designation) ? 12 : 18;
};

module.exports = { TA_DESIGNATIONS, matchTaDesignation, isTADesignation, getDefaultCapacity };
