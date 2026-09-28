/**
 * models/FacultyCapacity.js
 */
'use strict';

const { mongoose } = require('../db');

const facultyCapacitySchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, trim: true, index: true },
    semester: { type: String, enum: ['ODD', 'EVEN'], required: true },
    academicYear: { type: String, required: true},
    capacity: { 
      type: Number, 
      default: 18, 
      min: [1, 'Capacity must be at least 1'], 
      max: [60, 'Capacity cannot exceed 60'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value'
      }
    },
    // The following fields are populated by recalculateCapacity dynamically
    // based on workloads in this specific semester
    allocated: { type: Number, default: 0 },
    remaining: { type: Number, default: 18 },
    workloadPercentage: { type: Number, default: 0 },
    status: { type: String, default: 'Available' },
    updatedBy: { type: String, default: '' }
  },
  { timestamps: true, collection: 'faculty_capacities' }
);

// Enforce one capacity record per faculty per semester
facultyCapacitySchema.index({ empId: 1, academicYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('FacultyCapacity', facultyCapacitySchema);
