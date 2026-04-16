/**
 * scripts/populate-course-years.js
 * 
 * Populates missing year field in courses collection based on subject code pattern
 * Run: node populate-course-years.js
 */

'use strict';

const mongoose = require('mongoose');
const Course = require('../src/models/Course');

const normalizeYear = (year) => {
  const trimmed = String(year || '').trim().toUpperCase();
  if (trimmed === 'I' || trimmed === '1') return 'I';
  if (trimmed === 'II' || trimmed === '2') return 'II';
  if (trimmed === 'III' || trimmed === '3') return 'III';
  if (trimmed === 'IV' || trimmed === '4') return 'IV';
  if (trimmed === 'M.TECH') return 'M.Tech';
  return trimmed;
};

const deriveYearFromCode = (subjectCode) => {
  if (!subjectCode) return 'I';
  
  const code = String(subjectCode).toUpperCase().trim();
  
  // Extract year digit from course code
  // Format: [YY][DEPT][XXX] where XXX first digit indicates year
  const match = code.match(/\d{2}[A-Z]+(\d)/);
  if (match && match[1]) {
    const yearDigit = match[1];
    if (yearDigit === '0') return 'I';
    if (yearDigit === '1') return 'I';
    if (yearDigit === '2') return 'II';
    if (yearDigit === '3') return 'III';
    if (yearDigit === '4') return 'IV';
  }
  
  // M.Tech pattern
  const mtechMatch = code.match(/\d+/);
  if (mtechMatch) {
    const firstDigit = mtechMatch[0][0];
    if (firstDigit === '5' || firstDigit === '6') return 'M.Tech';
  }
  
  return 'I';
};

(async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wlm-local';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find courses with missing or empty year
    const coursesWithEmptyYear = await Course.find({
      $or: [
        { year: { $exists: false } },
        { year: '' },
        { year: null }
      ]
    });

    console.log(`📊 Found ${coursesWithEmptyYear.length} courses with missing year`);

    let updated = 0;
    for (const course of coursesWithEmptyYear) {
      const derivedYear = deriveYearFromCode(course.subjectCode);
      console.log(`  • ${course.subjectCode} → Year ${derivedYear}`);
      
      await Course.updateOne(
        { _id: course._id },
        { $set: { year: derivedYear } }
      );
      updated++;
    }

    console.log(`\n✅ Updated ${updated} courses with derived years`);

    // Also normalize existing years to canonical format
    const allCourses = await Course.find({});
    let normalized = 0;
    
    for (const course of allCourses) {
      if (course.year) {
        const normalizedYear = normalizeYear(course.year);
        if (normalizedYear !== course.year) {
          console.log(`  • ${course.subjectCode}: "${course.year}" → "${normalizedYear}"`);
          await Course.updateOne(
            { _id: course._id },
            { $set: { year: normalizedYear } }
          );
          normalized++;
        }
      }
    }

    console.log(`✅ Normalized ${normalized} courses to canonical year format`);
    console.log('\n🎉 Course years population complete!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
