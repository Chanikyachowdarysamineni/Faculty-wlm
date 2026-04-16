// ─────────────────────────────────────────────────────────
//  Centralised application data
//  NOTE: faculty data is fetched live from /api/faculty.
//  This array is intentionally empty to avoid shipping PII.
// ─────────────────────────────────────────────────────────

// eslint-disable-next-line import/prefer-default-export
export const faculty = [
  // Removed: real names and mobile numbers should not be in the client bundle.
  // The app fetches faculty from GET /api/faculty instead.
];

// courses: program = 'B.Tech' | 'M.Tech'
//          courseType = 'Mandatory' | 'Department Elective'
//          year = 'I' | 'II' | 'III' | 'IV' | '' (M.Tech has no year column)
//          L,T,P = Lecture / Tutorial / Practical hours  C = Credits (fixed)
export const courses = [
  // ── B.Tech ▸ Mandatory ───────────────────────────────────────
  { id:1,  program:'B.Tech', courseType:'Mandatory',           year:'I',   subjectCode:'25CS102', subjectName:'Problem Solving through Python',        shortName:'PSP',     L:2, T:0, P:2,  C:3  },
  { id:2,  program:'B.Tech', courseType:'Mandatory',           year:'II',  subjectCode:'24CS209', subjectName:'Design and Analysis of Algorithms',      shortName:'DAA',     L:3, T:0, P:2,  C:4  },
  { id:3,  program:'B.Tech', courseType:'Mandatory',           year:'II',  subjectCode:'22CS207', subjectName:'Operating Systems',                      shortName:'OS',      L:2, T:0, P:2,  C:3  },
  { id:4,  program:'B.Tech', courseType:'Mandatory',           year:'II',  subjectCode:'24CS207', subjectName:'Full Stack Development',                 shortName:'FSD',     L:0, T:2, P:2,  C:2  },
  { id:5,  program:'B.Tech', courseType:'Mandatory',           year:'II',  subjectCode:'24CS201', subjectName:'Field Projects',                         shortName:'FP',      L:0, T:0, P:2,  C:1  },
  { id:6,  program:'B.Tech', courseType:'Mandatory',           year:'III', subjectCode:'22CS407', subjectName:'Cryptography and Network Security',       shortName:'CNS',     L:2, T:0, P:2,  C:3  },
  { id:7,  program:'B.Tech', courseType:'Mandatory',           year:'III', subjectCode:'22CS311', subjectName:'Parallel and Distributed Computing',      shortName:'PDC',     L:2, T:2, P:0,  C:3  },
  { id:8,  program:'B.Tech', courseType:'Mandatory',           year:'III', subjectCode:'22CS307', subjectName:'Software Engineering',                   shortName:'SE',      L:2, T:0, P:2,  C:3  },
  { id:9,  program:'B.Tech', courseType:'Mandatory',           year:'III', subjectCode:'22CS305', subjectName:'Industry Interface Course',               shortName:'IIC',     L:1, T:0, P:0,  C:1  },
  { id:10, program:'B.Tech', courseType:'Mandatory',           year:'III', subjectCode:'22CS308', subjectName:'Inter-Disciplinary Project – Phase II',   shortName:'IDP-II',  L:0, T:0, P:2,  C:2  },
  { id:11, program:'B.Tech', courseType:'Mandatory',           year:'IV',  subjectCode:'22CS404', subjectName:'Project Work',                           shortName:'PROJECT', L:0, T:2, P:22, C:12 },
  { id:12, program:'B.Tech', courseType:'Mandatory',           year:'II',  subjectCode:'24SA201', subjectName:'UHV',                                    shortName:'BG',      L:0, T:0, P:2,  C:1  },
  // ── B.Tech ▸ Department Elective ─────────────────────────────
  { id:13, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS801', subjectName:'Advanced Data Structures',               shortName:'ADS',     L:2, T:2, P:2,  C:4  },
  { id:14, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS802', subjectName:'Advanced JAVA Programming',              shortName:'AJP',     L:2, T:2, P:2,  C:4  },
  { id:15, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS804', subjectName:'Deep Learning',                          shortName:'DL',      L:2, T:2, P:2,  C:4  },
  { id:16, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS805', subjectName:'Digital Image Processing',               shortName:'DIP',     L:2, T:2, P:2,  C:4  },
  { id:17, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS806', subjectName:'Machine Learning',                       shortName:'ML',      L:2, T:2, P:2,  C:4  },
  { id:18, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS807', subjectName:'Mobile Ad-hoc Networks',                 shortName:'MAN',     L:2, T:2, P:2,  C:4  },
  { id:19, program:'B.Tech', courseType:'Department Elective', year:'III', subjectCode:'22CS808', subjectName:'Mobile Application Development',         shortName:'MAD',     L:2, T:2, P:2,  C:4  },
  // ── M.Tech ▸ Mandatory ───────────────────────────────────────
  { id:20, program:'M.Tech', courseType:'Mandatory',           year:'',    subjectCode:'25CSB105', subjectName:'Cloud Computing',                       shortName:'CC',      L:2, T:2, P:2,  C:4  },
  { id:21, program:'M.Tech', courseType:'Mandatory',           year:'',    subjectCode:'25CSB106', subjectName:'Big Data and Analytics',                shortName:'BDA',     L:2, T:2, P:2,  C:4  },
  // ── M.Tech ▸ Department Elective ─────────────────────────────
  { id:22, program:'M.Tech', courseType:'Department Elective', year:'',    subjectCode:'25CSB803', subjectName:'Deep Learning',                         shortName:'DL',      L:3, T:0, P:2,  C:4  },
  { id:23, program:'M.Tech', courseType:'Department Elective', year:'',    subjectCode:'25CSB806', subjectName:'Full Stack Development',                shortName:'FSD',     L:3, T:0, P:2,  C:4  },
];

// ── Derived stats ─────────────────────────────────────────
export const getDepartments = () => [...new Set(faculty.map(f => f.designation))];

export const getFacultyByDept = () => {
  const desigs = [...new Set(faculty.map(f => f.designation))];
  return desigs.map(d => ({ department: d, count: faculty.filter(f => f.designation === d).length }));
};

export const getCoursesByDept = () => {
  const programs = [...new Set(courses.map(c => c.program))];
  return programs.map(p => ({ department: p, count: courses.filter(c => c.program === p).length }));
};


