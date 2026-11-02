'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');

const coursesRouter = require('../../src/routes/courses');
const courseWorkloadPlanRouter = require('../../src/routes/courseWorkloadPlan');
const workloadsRouter = require('../../src/routes/workloads');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');
const Course = require('../../src/models/Course');
const CourseOffering = require('../../src/models/CourseOffering');
const CourseWorkloadPlan = require('../../src/models/CourseWorkloadPlan');
const Workload = require('../../src/models/Workload');
const CourseAllocation = require('../../src/models/CourseAllocation');
const FacultyCapacity = require('../../src/models/FacultyCapacity');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');

const app = express();
app.use(express.json());
app.use('/deva/courses', coursesRouter);
app.use('/deva/course-workload-plan', courseWorkloadPlanRouter);
app.use('/deva/workloads', workloadsRouter);

describe('Course Updates & Course-Wise Workload Details Synchronization Tests', () => {
  const TEST_EMP_ID = 'TEST_CWW_FAC_88';
  const ADMIN_EMP_ID = 'TEST_CWW_ADMIN_88';
  const ACADEMIC_YEAR = '2026-2027';
  const SEMESTER = 'EVEN';
  const COURSE_ID = 98877;
  const SUBJECT_CODE = '26CS_SYNC_TEST';

  let adminToken;
  let testAy;
  let testSem;
  let testCourse;
  let testFaculty;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    testAy = await AcademicYear.findOne({ name: ACADEMIC_YEAR }).lean() || await AcademicYear.findOne({}).lean();
    testSem = await AcademicYearSemester.findOne({ academicYearId: testAy._id, semesterType: SEMESTER }).lean()
      || await AcademicYearSemester.findOne({ semesterType: SEMESTER }).lean();

    let admin = await User.findOne({ role: 'admin', isDeleted: { $ne: true } }).lean();
    if (!admin) {
      admin = await User.create({
        empId: ADMIN_EMP_ID,
        role: 'admin',
        canAccessAdmin: true
      });
    }

    adminToken = signToken({
      id: admin.empId,
      empId: admin.empId,
      role: 'admin',
      canAccessAdmin: true,
      tokenVersion: admin.tokenVersion || 0
    });

    // Clean up any existing test records
    await Course.deleteMany({ courseId: COURSE_ID });
    await CourseOffering.deleteMany({ courseId: { $in: await Course.find({ courseId: COURSE_ID }).distinct('_id') } });
    await Workload.deleteMany({ courseId: COURSE_ID });
    await CourseAllocation.deleteMany({ courseId: COURSE_ID });
    await Faculty.deleteMany({ empId: TEST_EMP_ID });
    await FacultyCapacity.deleteMany({ empId: TEST_EMP_ID });

    // Create test faculty
    testFaculty = await Faculty.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Sync Test Faculty',
      designation: 'Associate Professor',
      department: 'CSE',
      email: 'synctest@example.com',
      mobile: '9876543210',
      capacity: 12,
      isDeleted: false
    });

    // Create initial test course with L=2, T=0, P=2, C=3
    testCourse = await Course.create({
      courseId: COURSE_ID,
      subjectCode: SUBJECT_CODE,
      subjectName: 'Distributed Systems & Cloud',
      shortName: 'DSC',
      program: 'B.Tech',
      year: 'III',
      courseType: 'Mandatory',
      L: 2,
      T: 0,
      P: 2,
      C: 3,
      department: 'CSE',
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
      isDeleted: false
    });

    // Create linked CourseOffering
    const offering = await CourseOffering.create({
      academicYearSemesterId: testSem._id,
      courseId: testCourse._id,
      credits: 3,
      L: 2,
      T: 0,
      P: 2,
      status: 'Active'
    });

    // Create workload plan with 2 sections and 4 batches
    await CourseWorkloadPlan.findOneAndUpdate(
      { academicYearId: testAy._id, semesterType: SEMESTER, courseOfferingId: offering._id },
      { $set: { noOfSections: 2, tpBatches: 4, studentStrength: 120 } },
      { upsert: true, new: true }
    );

    // Assign Main Faculty workload (fixedL=2, fixedT=0, fixedP=2, manualL=2, manualT=0, manualP=2)
    await Workload.create({
      empId: TEST_EMP_ID,
      empName: testFaculty.name,
      facultyRole: 'Main Faculty',
      department: 'CSE',
      designation: testFaculty.designation,
      courseId: COURSE_ID,
      courseType: 'Mandatory',
      subjectCode: SUBJECT_CODE,
      subjectName: 'Distributed Systems & Cloud',
      shortName: 'DSC',
      program: 'B.Tech',
      year: 'III',
      section: 'A',
      fixedL: 2,
      fixedT: 0,
      fixedP: 2,
      manualL: 2,
      manualT: 0,
      manualP: 0, // Main faculty takes lecture
      C: 3,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
      academicYearSemesterId: testSem._id,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });
  });

  afterAll(async () => {
    if (testCourse) {
      await Course.deleteMany({ courseId: COURSE_ID });
      await CourseOffering.deleteMany({ courseId: testCourse._id });
      await CourseWorkloadPlan.deleteMany({ academicYearId: testAy._id, semesterType: SEMESTER });
    }
    await Workload.deleteMany({ courseId: COURSE_ID });
    await CourseAllocation.deleteMany({ courseId: COURSE_ID });
    await Faculty.deleteMany({ empId: TEST_EMP_ID });
    await FacultyCapacity.deleteMany({ empId: TEST_EMP_ID });
  });

  test('1. Initial state: Course-wise Workload Plan displays initial L=2, T=0, P=2 with correct calculations', async () => {
    const res = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = res.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row).toBeDefined();
    expect(row.L).toBe(2);
    expect(row.T).toBe(0);
    expect(row.P).toBe(2);
    expect(row.C).toBe(3);
    expect(row.noOfSections).toBe(2);
    expect(row.tpBatches).toBe(4);
    // totalL = 2 sections * 2 L = 4
    expect(row.totalL).toBe(4);
    // totalT = 0
    expect(row.totalT).toBe(0);
    // totalP = 2 P * 4 batches * 2 sections = 16
    expect(row.totalP).toBe(16);
    // total = 4 + 0 + 16 = 20
    expect(row.total).toBe(20);
  });

  test('2. Changing L hours: updates Course, CourseOffering, Workload, and Course-wise Workload Details', async () => {
    const updateRes = await request(app)
      .put(`/deva/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        L: 3,
        T: 0,
        P: 2,
        C: 4
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.L).toBe(3);
    expect(updateRes.body.data.C).toBe(4);

    // Verify Course document in DB
    const courseInDb = await Course.findOne({ courseId: COURSE_ID }).lean();
    expect(courseInDb.L).toBe(3);
    expect(courseInDb.C).toBe(4);

    // Verify CourseOffering in DB was updated
    const offeringInDb = await CourseOffering.findOne({ courseId: testCourse._id }).lean();
    expect(offeringInDb.L).toBe(3);
    expect(offeringInDb.credits).toBe(4);

    // Verify Workload in DB had manualL & fixedL updated
    const workloadInDb = await Workload.findOne({ courseId: COURSE_ID, empId: TEST_EMP_ID }).lean();
    expect(workloadInDb.fixedL).toBe(3);
    expect(workloadInDb.manualL).toBe(3);

    // Verify Course-wise Workload Details endpoint immediately reflects new L=3 and recalculated totalL
    const planRes = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(planRes.status).toBe(200);
    const row = planRes.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row.L).toBe(3);
    expect(row.C).toBe(4);
    // totalL should now be 2 sections * 3 L = 6
    expect(row.totalL).toBe(6);
    // total should now be 6 + 0 + 16 = 22
    expect(row.total).toBe(22);
  });

  test('3. Changing T hours: updates Course, CourseOffering, and recalculates totalT in Workload Plan', async () => {
    const updateRes = await request(app)
      .put(`/deva/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        L: 3,
        T: 1,
        P: 2,
        C: 4
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.T).toBe(1);

    // Verify CourseOffering in DB
    const offeringInDb = await CourseOffering.findOne({ courseId: testCourse._id }).lean();
    expect(offeringInDb.T).toBe(1);

    // Verify Course-wise Workload Plan reflects T=1 and totalT
    const planRes = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const row = planRes.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row.T).toBe(1);
    // totalT = 1 T * 4 batches * 2 sections = 8
    expect(row.totalT).toBe(8);
    // total = 6 (totalL) + 8 (totalT) + 16 (totalP) = 30
    expect(row.total).toBe(30);
  });

  test('4. Changing P hours: updates Course, CourseOffering, and recalculates totalP in Workload Plan', async () => {
    const updateRes = await request(app)
      .put(`/deva/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        L: 3,
        T: 1,
        P: 4,
        C: 5
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.P).toBe(4);

    // Verify CourseOffering in DB
    const offeringInDb = await CourseOffering.findOne({ courseId: testCourse._id }).lean();
    expect(offeringInDb.P).toBe(4);

    // Verify Course-wise Workload Plan reflects P=4 and totalP
    const planRes = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const row = planRes.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row.P).toBe(4);
    // totalP = 4 P * 4 batches * 2 sections = 32
    expect(row.totalP).toBe(32);
    // total = 6 + 8 + 32 = 46
    expect(row.total).toBe(46);
  });

  test('5. Changing all three (L, T, P) together: maintains database integrity without duplicates and reflects all updates', async () => {
    const updateRes = await request(app)
      .put(`/deva/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectName: 'Distributed Systems & Cloud Computing Revised',
        shortName: 'DSCC',
        L: 4,
        T: 2,
        P: 0,
        C: 5
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.L).toBe(4);
    expect(updateRes.body.data.T).toBe(2);
    expect(updateRes.body.data.P).toBe(0);

    // Verify no duplicate course records were created
    const coursesCount = await Course.countDocuments({ courseId: COURSE_ID });
    expect(coursesCount).toBe(1);

    // Verify Workload record was preserved and updated
    const workloadInDb = await Workload.findOne({ courseId: COURSE_ID, empId: TEST_EMP_ID }).lean();
    expect(workloadInDb).toBeDefined();
    expect(workloadInDb.fixedL).toBe(4);
    expect(workloadInDb.manualL).toBe(4);
    expect(workloadInDb.fixedT).toBe(2);
    expect(workloadInDb.fixedP).toBe(0);
    expect(workloadInDb.shortName).toBe('DSCC');

    // Verify Course-wise Workload Details reflects all three changes and new total
    const planRes = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const row = planRes.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row.subjectName).toBe('Distributed Systems & Cloud Computing Revised');
    expect(row.shortName).toBe('DSCC');
    expect(row.L).toBe(4);
    expect(row.T).toBe(2);
    expect(row.P).toBe(0);
    // totalL = 2 sections * 4 L = 8
    expect(row.totalL).toBe(8);
    // totalT = 2 T * 4 batches * 2 sections = 16
    expect(row.totalT).toBe(16);
    // totalP = 0
    expect(row.totalP).toBe(0);
    // total = 8 + 16 + 0 = 24
    expect(row.total).toBe(24);
  });

  test('6. Consistency on refresh: consecutive requests return identical latest data with cache prevention', async () => {
    const res1 = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res2 = await request(app)
      .get(`/deva/course-workload-plan?academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.headers['cache-control']).toContain('no-cache');
    expect(res2.headers['cache-control']).toContain('no-cache');
    const row1 = res1.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    const row2 = res2.body.data.find(r => r.subjectCode === SUBJECT_CODE);
    expect(row1).toEqual(row2);
    expect(row2.L).toBe(4);
    expect(row2.T).toBe(2);
    expect(row2.P).toBe(0);
  });
});

