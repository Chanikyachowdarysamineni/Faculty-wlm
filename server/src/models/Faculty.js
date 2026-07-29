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
    weeklyCapacityHours: { type: Number, default: 30, min: 0 },
    updatedBy: { type: String, default: 'System' },
  },
  { timestamps: true, collection: 'faculty' }
);

module.exports = mongoose.model('Faculty', facultySchema);
