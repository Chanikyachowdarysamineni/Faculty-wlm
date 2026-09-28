'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const AcademicYear = require('../src/models/AcademicYear');
const AcademicYearSemester = require('../src/models/AcademicYearSemester');
const Course = require('../src/models/Course');
const Workload = require('../src/models/Workload');
const CourseAllocation = require('../src/models/CourseAllocation');
const Submission = require('../src/models/Submission');
const FacultyCapacity = require('../src/models/FacultyCapacity');
const Setting = require('../src/models/Setting');

async function migrate() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deva';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const DEFAULT_YEAR = '2026-2027';

  // 1. Create Default Academic Year
  let academicYear = await AcademicYear.findOne({ name: DEFAULT_YEAR });
  if (!academicYear) {
    academicYear = await AcademicYear.create({
      name: DEFAULT_YEAR,
      isCurrent: true,
      status: 'ACTIVE',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-06-30')
    });
    console.log(`Created Academic Year: ${DEFAULT_YEAR}`);
  } else {
    console.log(`Academic Year ${DEFAULT_YEAR} already exists.`);
  }

  // 2. Create ODD and EVEN Semesters
  const formEnabledOdd = await Setting.findOne({ key: 'form_enabled_ODD' }).then(doc => doc ? doc.value === 'true' : false);
  const editEnabledOdd = await Setting.findOne({ key: 'edit_enabled_ODD' }).then(doc => doc ? doc.value === 'true' : false);
  const formEnabledEven = await Setting.findOne({ key: 'form_enabled_EVEN' }).then(doc => doc ? doc.value === 'true' : false);
  const editEnabledEven = await Setting.findOne({ key: 'edit_enabled_EVEN' }).then(doc => doc ? doc.value === 'true' : false);

  const semesters = [
    { type: 'ODD', formEnabled: formEnabledOdd, editEnabled: editEnabledOdd, status: 'ACTIVE' },
    { type: 'EVEN', formEnabled: formEnabledEven, editEnabled: editEnabledEven, status: 'NOT_STARTED' }
  ];

  for (const sem of semesters) {
    const existing = await AcademicYearSemester.findOne({ academicYearId: academicYear._id, semesterType: sem.type });
    if (!existing) {
      await AcademicYearSemester.create({
        academicYearId: academicYear._id,
        semesterType: sem.type,
        status: sem.status,
        formEnabled: sem.formEnabled,
        editEnabled: sem.editEnabled
      });
      console.log(`Created ${sem.type} Semester for ${DEFAULT_YEAR}`);
    } else {
      console.log(`${sem.type} Semester for ${DEFAULT_YEAR} already exists.`);
    }
  }

  // 3. Update Existing Records to use DEFAULT_YEAR (if not already set or if set to "2023-2024" in Workloads)
  const modelsToUpdate = [
    { name: 'Course', model: Course },
    { name: 'Workload', model: Workload },
    { name: 'CourseAllocation', model: CourseAllocation },
    { name: 'Submission', model: Submission },
    { name: 'FacultyCapacity', model: FacultyCapacity }
  ];

  for (const item of modelsToUpdate) {
    const result = await item.model.updateMany(
      { $or: [{ academicYear: { $exists: false } }, { academicYear: '2023-2024' }, { academicYear: null }] },
      { $set: { academicYear: DEFAULT_YEAR } }
    );
    console.log(`Migrated ${item.name}: Updated ${result.modifiedCount} records to ${DEFAULT_YEAR}.`);
  }

  console.log('Migration completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
