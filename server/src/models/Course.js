/**
 * models/Course.js
 */
'use strict';

const { mongoose } = require('../db');

const courseSchema = new mongoose.Schema(
  {
    courseId:    { type: Number, required: true, unique: true },   // matches client id
    program:     { type: String, required: true, enum: ['B.Tech', 'M.Tech'] },
    courseType:  { type: String, required: true },
    year:        { type: String, default: '' },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    shortName:   { type: String, required: true },
    L:             { type: Number, default: 0 },
    T:             { type: Number, default: 0 },
    P:             { type: Number, default: 0 },
    C:             { type: Number, default: 0 },
    mainFacultyId: { type: String, default: '' },
  },
  { timestamps: true, collection: 'courses' }
);

courseSchema.index({ subjectCode: 1 }, { unique: true });

module.exports = mongoose.model('Course', courseSchema);
