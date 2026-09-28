const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'Dashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

// Add the import for AcademicYearManagementPage
if (!content.includes('import AcademicYearManagementPage')) {
  content = content.replace(
    /import ProfilePage from '\.\/ProfilePage';/,
    `import ProfilePage from './ProfilePage';\nimport AcademicYearManagementPage from './AcademicYearManagementPage';`
  );
}

// Add academic-years to NAV_ITEMS
const newNavItem = `
  {
    key: 'academic-years',
    label: 'Academic Years',
    colorClass: 'nav-color-indigo',
    adminOnly: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },`;

if (!content.includes("key: 'academic-years'")) {
  content = content.replace(
    /const NAV_ITEMS = \[/,
    `const NAV_ITEMS = [${newNavItem}`
  );
}

// Add the component rendering in dash-content
const componentRender = `
            {activeNav === 'academic-years' && isAdmin && (
              <AcademicYearManagementPage />
            )}`;

if (!content.includes("activeNav === 'academic-years'")) {
  content = content.replace(
    /\{activeNav === 'dashboard' && \(/,
    `${componentRender}\n            {activeNav === 'dashboard' && (`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Updated Dashboard.jsx to include AcademicYearManagementPage');
