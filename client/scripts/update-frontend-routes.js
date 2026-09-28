const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'CoursesPage.jsx',
  'FacultyFormPage.jsx',
  'MySubmissionsPage.jsx',
  'MyWorkloadPage.jsx',
  'WorkloadPage.jsx'
].map(f => path.join(__dirname, '..', 'src', f));

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Update useSharedData imports
  content = content.replace(
    /,\s*selectedSemester\s*\}\s*=\s*useSharedData/g,
    `, selectedSemester, selectedAcademicYear } = useSharedData`
  );

  // Update fetch calls string interpolations
  content = content.replace(
    /\?semester=\$\{selectedSemester\}/g,
    `?semester=\${selectedSemester}&academicYear=\${selectedAcademicYear}`
  );
  content = content.replace(
    /\&semester=\$\{selectedSemester\}/g,
    `&semester=\${selectedSemester}&academicYear=\${selectedAcademicYear}`
  );

  // Update fetchAllPages params
  content = content.replace(
    /\{\s*semester:\s*selectedSemester\s*\}/g,
    `{ semester: selectedSemester, academicYear: selectedAcademicYear }`
  );
  content = content.replace(
    /\{\s*empId:\s*String\(currentUser\.id\),\s*semester:\s*selectedSemester\s*\}/g,
    `{ empId: String(currentUser.id), semester: selectedSemester, academicYear: selectedAcademicYear }`
  );

  // Update POST / PUT bodies
  content = content.replace(
    /semester:\s*selectedSemester,/g,
    `semester: selectedSemester, academicYear: selectedAcademicYear,`
  );

  // Update dependency arrays
  content = content.replace(
    /\[(.*?)selectedSemester(.*?)\]/g,
    (match, p1, p2) => {
      if (match.includes('selectedAcademicYear')) return match;
      return `[${p1}selectedSemester, selectedAcademicYear${p2}]`;
    }
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${path.basename(file)}`);
});
