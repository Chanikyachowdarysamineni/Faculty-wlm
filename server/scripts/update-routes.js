const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'courses.js',
  'workloads.js',
  'allocations.js',
  'submissions.js',
  'stats.js',
  'facultyCapacity.js'
].map(f => path.join(__dirname, '..', 'src', 'routes', f));

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping ${file}`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');

  // Add filter.academicYear in GET routes
  // Pattern 1: filter.semester = req.query.semester === 'ODD' ? ...
  content = content.replace(
    /filter\.semester\s*=\s*req\.query\.semester\s*===\s*'ODD'\s*\?\s*\{\s*\$in:\s*\['ODD',\s*null\]\s*\}\s*:\s*req\.query\.semester;/g,
    `filter.semester = req.query.semester === 'ODD' ? { $in: ['ODD', null] } : req.query.semester;\n    if (req.query.academicYear) filter.academicYear = req.query.academicYear;`
  );
  
  content = content.replace(
    /const semesterFilter = semester === 'ODD' \? \{ \$in: \['ODD', null\] \} : semester;/g,
    `const semesterFilter = semester === 'ODD' ? { $in: ['ODD', null] } : semester;\n    const academicYear = req.query.academicYear || req.body.academicYear;`
  );

  content = content.replace(
    /const baseCourseFilter = \{ isDeleted: \{ \$ne: true \}, semester: semesterFilter \};/g,
    `const baseCourseFilter = { isDeleted: { $ne: true }, semester: semesterFilter, ...(academicYear && { academicYear }) };`
  );

  content = content.replace(
    /const baseSubmissionFilter = \{ isDeleted: \{ \$ne: true \}, semester: semesterFilter \};/g,
    `const baseSubmissionFilter = { isDeleted: { $ne: true }, semester: semesterFilter, ...(academicYear && { academicYear }) };`
  );

  content = content.replace(
    /const baseWorkloadFilter = \{ isDeleted: \{ \$ne: true \}, semester: semesterFilter \};/g,
    `const baseWorkloadFilter = { isDeleted: { $ne: true }, semester: semesterFilter, ...(academicYear && { academicYear }) };`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
