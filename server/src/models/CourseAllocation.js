/**
 * models/CourseAllocation.js
 *
 * Stores the structured L / T / P faculty assignments for each
 * Course × Year × Section combination.
 *
 * lectureSlot   — single main faculty for Lecture (auto-fetched)
 * tutorialSlots — up to 4 (index 0 = main faculty auto, 1-3 manual)
 * practicalSlots— up to 4 (index 0 = main faculty auto, 1-3 manual)
 */
'use strict';

const { mongoose } = require('../db');

const facultySlotSchema = new mongoose.Schema(
  {
    empId:       { type: String, default: '' },
    empName:     { type: String, default: '' },
    designation: { type: String, default: '' },
    hours:       { type: Number, default: 0 },
  },
  { _id: false }
);

const courseAllocationSchema = new mongoose.Schema(
  {
    courseId:       { type: Number, required: true },
    subjectCode:    { type: String, required: true },
    subjectName:    { type: String, required: true },
    shortName:      { type: String, default: '' },
    program:        { type: String, default: '' },
    year:           { type: String, required: true },
    section:        { type: String, required: true },
    fixedL:         { type: Number, default: 0 },
    fixedT:         { type: Number, default: 0 },
    fixedP:         { type: Number, default: 0 },
    C:              { type: Number, default: 0 },

    // Lecture: array (index 0 = main faculty; mirrors lectureSlot for backward compat)
    lectureSlots:   { type: [facultySlotSchema], default: () => [] },

    // Legacy single lecture slot (kept for backward compatibility)
    lectureSlot:    { type: facultySlotSchema, default: () => ({}) },

    // Tutorial: array of up to 4 slots
    tutorialSlots:  { type: [facultySlotSchema], default: () => [] },

    // Practical: array of up to 4 slots
    practicalSlots: { type: [facultySlotSchema], default: () => [] },

    createdBy:      { type: String, default: '' },
  },
  { timestamps: true, collection: 'allocations' }
);

courseAllocationSchema.index({ courseId: 1, year: 1, section: 1 }, { unique: true });
courseAllocationSchema.index({ year: 1, section: 1 });
courseAllocationSchema.index({ courseId: 1, year: 1 });
courseAllocationSchema.index({ 'lectureSlot.empId': 1 });
courseAllocationSchema.index({ 'lectureSlots.empId': 1 });
courseAllocationSchema.index({ 'tutorialSlots.empId': 1 });
courseAllocationSchema.index({ 'practicalSlots.empId': 1 });

module.exports = mongoose.model('CourseAllocation', courseAllocationSchema);
