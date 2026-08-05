const mongoose = require('mongoose');
const Workload = require('./models/Workload');
const CourseAllocation = require('./models/CourseAllocation');
require('dotenv').config({ path: '../.env' });

async function audit() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/faculty_wlm');
  console.log('Connected to MongoDB');

  const workloads = await Workload.find({ year: 'II' }).lean();
  console.log(`Found ${workloads.length} Workloads for Year II.`);

  let missingCount = 0;
  for (const w of workloads) {
    const allocation = await CourseAllocation.findOne({
      courseId: w.courseId,
      year: w.year,
      section: w.section
    }).lean();

    let isMissing = false;
    if (!allocation) {
      isMissing = true;
    } else {
      // Check if the specific faculty is in the allocation
      const allSlots = [
        allocation.lectureSlot,
        ...(allocation.lectureSlots || []),
        ...(allocation.tutorialSlots || []),
        ...(allocation.practicalSlots || [])
      ].filter(Boolean);

      const found = allSlots.some(s => String(s.empId) === String(w.empId));
      if (!found) {
        isMissing = true;
      }
    }

    if (isMissing) {
      missingCount++;
      console.log(`[MISSING] Course: ${w.courseId}, Section: ${w.section}, Faculty: ${w.empId} (${w.empName}), Role: ${w.facultyRole}`);
    }
  }

  console.log(`Total missing allocations from Workloads: ${missingCount}`);
  process.exit(0);
}

audit().catch(console.error);
