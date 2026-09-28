/**
 * models/Submission.js
 */
'use strict';

const { mongoose } = require('../db');

const submissionSchema = new mongoose.Schema(
  {
    empId:       { type: String, required: true, trim: true },
    empName:     { type: String, required: true },
    designation: { type: String, required: true },
    mobile:      { type: String, default: '' },
    prefs:       [{ type: Number }],   // ordered array of courseIds (up to 5)
    semester:    { type: String, enum: ['ODD', 'EVEN'], default: 'ODD' },
  },
  { timestamps: true, collection: 'submissions' }
);

submissionSchema.index({ empId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
