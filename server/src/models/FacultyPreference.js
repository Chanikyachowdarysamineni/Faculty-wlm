/**
 * models/FacultyPreference.js
 * 
 * Stores faculty course preferences for workload assignment filtering
 * - One record per faculty
 * - Contains array of preferred courseIds
 * - Tracks submission status and timestamp
 */

'use strict';

const { mongoose } = require('../db');

const facultyPreferenceSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    // Array of courseIds that faculty prefers
    preferredCourseIds: [
      {
        type: Number,
        ref: 'Course',
      },
    ],
    // Tracks if faculty has submitted preferences through form
    isSubmitted: {
      type: Boolean,
      default: false,
    },
    // Timestamp of last submission
    submittedAt: {
      type: Date,
      default: null,
    },
    // Additional preferences metadata
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { 
    timestamps: true,
    collection: 'faculty_preferences',
  }
);

// Index for efficient querying
facultyPreferenceSchema.index({ empId: 1 }, { unique: true });
facultyPreferenceSchema.index({ isSubmitted: 1 });

module.exports = mongoose.model('FacultyPreference', facultyPreferenceSchema);
