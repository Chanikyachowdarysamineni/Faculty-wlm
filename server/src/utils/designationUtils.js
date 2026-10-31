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

let designationsCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

const invalidateDesignationCache = () => {
  designationsCache = null;
  lastCacheTime = 0;
};

const getDesignationsFromDb = async () => {
  const now = Date.now();
  if (designationsCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return designationsCache;
  }
  try {
    const Designation = require('../models/Designation');
    designationsCache = await Designation.find().lean();
    lastCacheTime = now;
    return designationsCache;
  } catch (err) {
    return designationsCache || [];
  }
};

const getDesignationCategory = async (rawDesignation) => {
  if (!rawDesignation) return 'FACULTY';
  const clean = String(rawDesignation).trim().toLowerCase();
  const docs = await getDesignationsFromDb();
  const found = docs.find(d => String(d.name || '').trim().toLowerCase() === clean);
  if (found && found.category) {
    return found.category;
  }
  return isTADesignation(rawDesignation) ? 'TA_INSTRUCTOR' : 'FACULTY';
};

const isTaDesignationAsync = async (rawDesignation) => {
  const category = await getDesignationCategory(rawDesignation);
  return category === 'TA_INSTRUCTOR';
};

const syncFacultyDesignationIds = async () => {
  try {
    const Designation = require('../models/Designation');
    const Faculty = require('../models/Faculty');
    const designations = await Designation.find().lean();
    if (!designations || !designations.length) return;

    for (const d of designations) {
      // Ensure category is set on designation
      if (!d.category) {
        const cat = isTADesignation(d.name) ? 'TA_INSTRUCTOR' : 'FACULTY';
        await Designation.updateOne({ _id: d._id }, { $set: { category: cat } });
      }

      await Faculty.updateMany(
        { 
          $and: [
            {
              $or: [
                { designation: d.name },
                { designation: { $regex: new RegExp(`^${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
              ]
            },
            {
              $or: [{ designationId: null }, { designationId: { $exists: false } }]
            }
          ]
        },
        { $set: { designationId: d._id } }
      );
    }
    invalidateDesignationCache();
  } catch (err) {
    console.warn('[designationUtils] syncFacultyDesignationIds error:', err.message);
  }
};

module.exports = {
  TA_DESIGNATIONS,
  matchTaDesignation,
  isTADesignation,
  getDefaultCapacity,
  syncFacultyDesignationIds,
  invalidateDesignationCache,
  getDesignationsFromDb,
  getDesignationCategory,
  isTaDesignationAsync
};
