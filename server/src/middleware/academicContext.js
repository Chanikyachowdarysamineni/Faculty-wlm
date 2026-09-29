'use strict';

const AcademicYear = require('../models/AcademicYear');

/**
 * Middleware to resolve the selected academic year and semester from query or body.
 * If not provided, defaults to the current academic year and 'ODD' semester.
 */
const resolveAcademicContext = async (req, res, next) => {
  try {
    let academicYear = req.query.academicYear || req.body.academicYear;
    let semester = req.query.semester || req.body.semester ;

    if (!academicYear) {
      const currentYear = await AcademicYear.findOne({ isCurrent: true }).lean();
      academicYear = currentYear ? currentYear.name : null;
    }

    req.academicContext = { academicYear, semester };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolveAcademicContext };
