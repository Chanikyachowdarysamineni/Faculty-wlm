
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'Dashboard.jsx');
let content = fs.readFileSync(file, 'utf8');

// Update DataContext imports
content = content.replace(
  /selectedSemester, setSelectedSemester/g,
  `selectedSemester, setSelectedSemester, academicYears, setAcademicYears, selectedAcademicYear, setSelectedAcademicYear`
);

// Add fetchAcademicYears effect
const fetchAcademicYearsEffect = `
  useEffect(() => {
    const fetchAY = async () => {
      try {
        const headers = { Authorization: \`Bearer \${token()}\` };
        const res = await fetch(\`\${API}/deva/academic-years\`, { headers });
        const json = await res.json();
        if (json.success) setAcademicYears(json.data);
      } catch (err) {
        console.error('Failed to fetch academic years', err);
      }
    };
    fetchAY();
  }, [setAcademicYears]);
`;
content = content.replace(
  /const isAdmin = dashMode/g,
  `${fetchAcademicYearsEffect}\n  const isAdmin = dashMode`
);

// Update dependencies
content = content.replace(
  /\[user, isAdmin, selectedSemester\]/g,
  `[user, isAdmin, selectedSemester, selectedAcademicYear]`
);
content = content.replace(
  /\[user\?\.id, authHeaders, selectedSemester\]/g,
  `[user?.id, authHeaders, selectedSemester, selectedAcademicYear]`
);
content = content.replace(
  /\[isAdmin, authHeaders, selectedSemester,/g,
  `[isAdmin, authHeaders, selectedSemester, selectedAcademicYear,`
);
content = content.replace(
  /\[isAdmin, authHeaders, dashboardLastSyncedAt, selectedSemester\]/g,
  `[isAdmin, authHeaders, dashboardLastSyncedAt, selectedSemester, selectedAcademicYear]`
);

// Update query string interpolations
content = content.replace(
  /\?semester=\$\{selectedSemester\}/g,
  `?semester=\${selectedSemester}&academicYear=\${selectedAcademicYear}`
);

// Update params objects
content = content.replace(
  /\{ semester: selectedSemester \}/g,
  `{ semester: selectedSemester, academicYear: selectedAcademicYear }`
);
content = content.replace(
  /\{ empId: user\.id, semester: selectedSemester \}/g,
  `{ empId: user.id, semester: selectedSemester, academicYear: selectedAcademicYear }`
);

// Add the UI dropdown in dash-topbar-right
const uiDropdown = `
          <div className="dash-semester-toggle" style={{ display: 'flex', alignItems: 'center', marginRight: '16px', background: 'rgba(255,255,255,0.1)', padding: '2px', borderRadius: '8px' }}>
            <select 
              value={selectedAcademicYear} 
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', cursor: 'pointer', padding: '6px 10px', fontSize: '14px', fontWeight: '500' }}
            >
              {academicYears.length > 0 ? academicYears.map(y => (
                <option key={y._id} value={y.name} style={{ color: '#000' }}>{y.name}</option>
              )) : <option value="2026-2027" style={{ color: '#000' }}>2026-2027</option>}
            </select>
          </div>
`;
content = content.replace(
  /<div className="dash-semester-toggle" style=\{\{ display: 'flex'/g,
  uiDropdown + '\n          <div className="dash-semester-toggle" style={{ display: \'flex\''
);

fs.writeFileSync(file, content, 'utf8');
console.log('Updated Dashboard.jsx');
