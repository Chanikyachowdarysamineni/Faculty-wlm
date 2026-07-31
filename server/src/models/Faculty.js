/**
 * models/Faculty.js
 */
'use strict';

const { mongoose } = require('../db');

const facultySchema = new mongoose.Schema(
  {
    slNo:        { type: Number },
    empId:       { type: String, required: true, unique: true, trim: true },
    name:        { type: String, required: true, trim: true },
    department:  { type: String, default: 'CSE' },
    designation: { type: String, required: true, trim: true },
    mobile:      { type: String, default: '' },
    email:       { type: String, default: '' },
    passwordHash:{ type: String, default: null },
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
    allocated: { type: Number, default: 0 },
    remaining: { type: Number, default: 18 },
    workloadPercentage: { type: Number, default: 0 },
    status: { type: String, default: 'Available' },
    updatedBy: { type: String, default: 'System' },
  },
  { timestamps: true, collection: 'faculty' }
);

module.exports = mongoose.model('Faculty', facultySchema);
