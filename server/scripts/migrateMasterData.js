require('dotenv').config();
const mongoose = require('mongoose');
const { connect } = require('../src/db');
const Setting = require('../src/models/Setting');
const Section = require('../src/models/Section');
const Course = require('../src/models/Course');
const Faculty = require('../src/models/Faculty');
const Workload = require('../src/models/Workload');
const CourseAllocation = require('../src/models/CourseAllocation');

const DEFAULT_SECTIONS = {
  I: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  II: Array.from({ length: 22 }, (_, i) => String(i + 1)),
  III: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  IV: Array.from({ length: 9 }, (_, i) => String(i + 1))
};

const normalizeSections = (raw) => {
  const base = { ...DEFAULT_SECTIONS };
  if (!raw || typeof raw !== 'object') return base;
  Object.keys(base).forEach((year) => {
    const list = Array.isArray(raw[year]) ? raw[year] : base[year];
    const cleaned = Array.from(new Set(list.map(v => String(v).trim()).filter(Boolean)));
    base[year] = cleaned.length ? cleaned : base[year];
  });
  return base;
};

async function migrate() {
  await connect();
  console.log('Connected to DB. Starting migration...');

  // 1. Migrate Sections
  console.log('Migrating sections...');
  const settingDoc = await Setting.findOne({ key: 'sections_config' }).lean();
  let sectionsConfig = DEFAULT_SECTIONS;
  if (settingDoc?.value) {
    try {
      sectionsConfig = normalizeSections(JSON.parse(settingDoc.value));
    } catch (e) {
      console.error('Error parsing sections_config, using defaults');
    }
  }

  const sectionMap = {}; // { 'I-1': ObjectId }
  
  for (const year of Object.keys(sectionsConfig)) {
    for (const name of sectionsConfig[year]) {
      let section = await Section.findOne({ year, name });
      if (!section) {
        section = await Section.create({
          name,
          year,
          department: 'CSE',
          status: 'Active',
          sectionType: 'Regular',
          isDeleted: false
        });
      }
      sectionMap[`${year}-${name}`] = section._id;
    }
  }
  console.log(`Created/verified ${Object.keys(sectionMap).length} sections.`);

  // 2. Fetch mapping for Course and Faculty
  console.log('Fetching Faculty and Course mappings...');
  const faculties = await Faculty.find({}).lean();
  const facultyMap = {};
  faculties.forEach(f => { facultyMap[f.empId] = f._id; });

  const courses = await Course.find({}).lean();
  const courseMap = {};
  courses.forEach(c => { courseMap[c.courseId] = c._id; });

  // 3. Migrate Workloads
  console.log('Migrating Workloads...');
  const workloads = await Workload.find({}).lean();
  let workloadUpdates = 0;
  for (const wl of workloads) {
    const facultyId = facultyMap[wl.empId];
    const courseId = courseMap[wl.courseId];
    let sectionRef = sectionMap[`${wl.year}-${wl.section}`];

    // If section not found (e.g. invalid old data), create it
    if (!sectionRef && wl.year && wl.section) {
      const section = await Section.create({ name: wl.section, year: wl.year, department: 'CSE' });
      sectionRef = section._id;
      sectionMap[`${wl.year}-${wl.section}`] = sectionRef;
    }

    if (facultyId && courseId && sectionRef) {
      await Workload.updateOne(
        { _id: wl._id },
        { $set: { faculty: facultyId, course: courseId, sectionRef } }
      );
      workloadUpdates++;
    } else {
      console.warn(`Workload missing references: empId=${wl.empId}, courseId=${wl.courseId}, year=${wl.year}, section=${wl.section}`);
    }
  }
  console.log(`Updated ${workloadUpdates} Workloads.`);

  // 4. Migrate Allocations
  console.log('Migrating Course Allocations...');
  const allocations = await CourseAllocation.find({}).lean();
  let allocUpdates = 0;
  for (const alloc of allocations) {
    const courseId = courseMap[alloc.courseId];
    let sectionRef = sectionMap[`${alloc.year}-${alloc.section}`];

    if (!sectionRef && alloc.year && alloc.section) {
      const section = await Section.create({ name: alloc.section, year: alloc.year, department: 'CSE' });
      sectionRef = section._id;
      sectionMap[`${alloc.year}-${alloc.section}`] = sectionRef;
    }

    if (courseId && sectionRef) {
      const updateData = { course: courseId, sectionRef };

      // Update faculty refs in slots
      const migrateSlots = (slots) => {
        if (!Array.isArray(slots)) return slots;
        return slots.map(s => {
          if (s && s.empId && facultyMap[s.empId]) {
            s.faculty = facultyMap[s.empId];
          }
          return s;
        });
      };

      if (alloc.lectureSlots) updateData.lectureSlots = migrateSlots(alloc.lectureSlots);
      if (alloc.tutorialSlots) updateData.tutorialSlots = migrateSlots(alloc.tutorialSlots);
      if (alloc.practicalSlots) updateData.practicalSlots = migrateSlots(alloc.practicalSlots);

      if (alloc.lectureSlot && alloc.lectureSlot.empId && facultyMap[alloc.lectureSlot.empId]) {
        updateData.lectureSlot = alloc.lectureSlot;
        updateData.lectureSlot.faculty = facultyMap[alloc.lectureSlot.empId];
      }

      await CourseAllocation.updateOne({ _id: alloc._id }, { $set: updateData });
      allocUpdates++;
    }
  }
  console.log(`Updated ${allocUpdates} Course Allocations.`);

  console.log('Migration Complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
