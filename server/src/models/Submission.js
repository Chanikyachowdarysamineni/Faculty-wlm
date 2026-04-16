/**
 * models/Submission.js
 */
'use strict';

const { mongoose } = require('../db');

const submissionSchema = new mongoose.Schema(
  {
    empId:       { type: String, required: true, unique: true, trim: true },
    empName:     { type: String, required: true },
    designation: { type: String, required: true },
    mobile:      { type: String, default: '' },
    prefs:       [{ type: Number }],   // ordered array of courseIds (up to 5)
  },
  { timestamps: true, collection: 'submissions' }
);

module.exports = mongoose.model('Submission', submissionSchema);
