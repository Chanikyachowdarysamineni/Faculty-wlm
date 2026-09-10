/**
 * models/Course.js
 */
'use strict';

const { mongoose } = require('../db');

const courseSchema = new mongoose.Schema(
  {
    courseId:    { type: Number, required: true, unique: true },   // matches client id
    program:     { type: String, required: true },
    courseType:  { type: String, required: true },
    year:        { type: String, default: '' },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    shortName:   { type: String, required: true },

    L:             { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    T:             { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    P:             { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    C:             { type: Number, default: 0, min: 0, max: 50, validate: { validator: Number.isInteger } },
    mainFacultyId: { type: String, default: '' },
    isDeleted:     { type: Boolean, default: false },
    allowedSections: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'courses' }
);

courseSchema.pre('save', function (next) {
  if (this.subjectCode) {
    this.subjectCode = this.subjectCode.toUpperCase().trim();
  }
  next();
});

// Identical courses are allowed, so no unique index on subjectCode/courseType is needed

module.exports = mongoose.model('Course', courseSchema);
