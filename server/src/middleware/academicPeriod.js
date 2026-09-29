const mongoose = require('mongoose');
const AcademicYear = require('../models/AcademicYear');
const AcademicYearSemester = require('../models/AcademicYearSemester');

/**
 * Resolves the academic year and semester from request params.
 * Accepts:
 *   - academicYearId (MongoDB ObjectId) — preferred (sent by global fetch interceptor)
 *   - academicYear (string name like "2026-2027") — fallback, resolved via DB lookup
 *   - semester (ODD | EVEN) — required for semester resolution
 *
 * Attaches req.academicPeriod = { academicYear, academicYearSemester } to request.
 * Always tries to resolve the semester — routes can call req.getSemesterId() safely.
 * Soft-fails: never blocks a request with 400 even if context is incomplete.
 */
const requireAcademicPeriod = async (req, res, next) => {
  try {
    const yearId = req.query.academicYearId || req.body.academicYearId;
    const yearName = req.query.academicYear || req.body.academicYear;
    const semType = req.query.semester || req.body.semester;

    // If nothing is provided, pass through without scoping
    if (!yearId && !yearName) {
      req.academicPeriod = null;
      return next();
    }

    let academicYear = null;

    // Resolve by ObjectId first (preferred, sent by interceptor)
    if (yearId && mongoose.Types.ObjectId.isValid(yearId)) {
      academicYear = await AcademicYear.findById(yearId).lean();
    }

    // Fallback: resolve by name string (e.g. "2026-2027")
    if (!academicYear && yearName) {
      academicYear = await AcademicYear.findOne({ name: yearName }).lean();
    }

    if (!academicYear) {
      req.academicPeriod = null;
      return next();
    }

    // Resolve semester
    let academicYearSemester = null;
    if (semType && ['ODD', 'EVEN'].includes(semType)) {
      academicYearSemester = await AcademicYearSemester.findOne({
        academicYearId: academicYear._id,
        semesterType: semType
      }).lean();
    }

    // If semester still not found, try to get the default (first) semester for this year
    if (!academicYearSemester) {
      academicYearSemester = await AcademicYearSemester.findOne({
        academicYearId: academicYear._id
      }).lean();
    }

    req.academicPeriod = { academicYear, academicYearSemester };

    // Helper: safely get semester ObjectId or null
    req.getSemesterId = () => academicYearSemester?._id || null;

    // Helper: generate query filter matching both new structure and legacy data
    req.getPeriodFilter = () => {
      const yearNameStr = academicYear.name;
      const semStr = academicYearSemester ? academicYearSemester.semesterType : (semType );
      const sid = req.getSemesterId();
      if (sid) {
        return {
          $or: [
            { academicYearSemesterId: sid },
            { academicYear: yearNameStr, semester: semStr }
          ]
        };
      }
      return { academicYear: yearNameStr, semester: semStr };
    };

    // Prevent write operations on closed/archived periods
    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (isWriteMethod) {
      if (academicYear.status === 'ARCHIVED') {
        return res.status(403).json({
          success: false,
          message: 'This academic year is archived and is read-only.'
        });
      }
      if (academicYearSemester && academicYearSemester.status === 'CLOSED') {
        return res.status(403).json({
          success: false,
          message: 'This semester is closed and is read-only.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('requireAcademicPeriod Error:', error);
    req.academicPeriod = null;
    next(); // Soft-fail — never block a request
  }
};

module.exports = requireAcademicPeriod;
