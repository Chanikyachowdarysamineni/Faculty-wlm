/**
 * export-db-to-seed.js — Export existing database to production seed file
 * 
 * This script connects to your existing MongoDB and exports collections
 * to create a production-ready seed file with your actual data.
 * 
 * Usage:
 *   npx ts-node server/scripts/export-db-to-seed.js [--output path/to/seed-file.js]
 *   npm run export:seed
 * 
 * What it does:
 *   1. Connects to MongoDB (uses MONGO_URI from .env)
 *   2. Exports users, faculty, courses, workloads, settings, etc.
 *   3. Generates seed-production-import.js with your actual data
 *   4. Creates formatted seed file ready for npm run seed:prod
 */

'use strict';

const path = require('path');
const dotenvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });

const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Add src directory to module search path
const srcPath = path.join(__dirname, '..', 'src');
const User = require(path.join(srcPath, 'models', 'User'));
const Faculty = require(path.join(srcPath, 'models', 'Faculty'));
const Course = require(path.join(srcPath, 'models', 'Course'));
const Workload = require(path.join(srcPath, 'models', 'Workload'));
const Submission = require(path.join(srcPath, 'models', 'Submission'));
const CourseAllocation = require(path.join(srcPath, 'models', 'CourseAllocation'));
const Setting = require(path.join(srcPath, 'models', 'Setting'));
const AuditLog = require(path.join(srcPath, 'models', 'AuditLog'));
const { connect } = require(path.join(srcPath, 'db'));

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const OUTPUT_FILE = process.argv[3] || 
  path.join(__dirname, '..', 'seeds', 'seed-data.json');

const OUTPUT_FILE_JS = path.join(__dirname, '..', 'seeds', 'seed-production-import.js');

// Ensure seeds directory exists
const seedsDir = path.join(__dirname, '..', 'seeds');
if (!fs.existsSync(seedsDir)) {
  fs.mkdirSync(seedsDir, { recursive: true });
}

const COLLECTIONS_TO_EXPORT = [
  { name: 'users', model: User, maxRecords: null },
  { name: 'faculty', model: Faculty, maxRecords: null },
  { name: 'courses', model: Course, maxRecords: null },
  { name: 'workloads', model: Workload, maxRecords: null },
  { name: 'submissions', model: Submission, maxRecords: 100 }, // Limit to recent
  { name: 'courseAllocations', model: CourseAllocation, maxRecords: null },
  { name: 'settings', model: Setting, maxRecords: null },
  { name: 'auditLogs', model: AuditLog, maxRecords: 500 }, // Limit to recent logs
];

// ────────────────────────────────────────────────────────────
// Export Function
// ────────────────────────────────────────────────────────────

const exportDatabaseToSeed = async () => {
  try {
    console.log('📤 Database Export Tool');
    console.log('═'.repeat(60));
    console.log(`\n🔗 Connecting to MongoDB...\n`);

    await connect();
    console.log('✅ Connected to MongoDB\n');

    const exportedData = {};
    let totalRecords = 0;

    // ── Export each collection ──────────────────────────────
    for (const collection of COLLECTIONS_TO_EXPORT) {
      try {
        console.log(`📦 Exporting ${collection.name}...`);

        let query = collection.model.find().lean();
        if (collection.maxRecords) {
          query = query.sort({ createdAt: -1 }).limit(collection.maxRecords);
        }

        const records = await query.exec();
        exportedData[collection.name] = records;
        totalRecords += records.length;

        console.log(`   ✅ ${records.length} records exported\n`);
      } catch (err) {
        console.log(`   ⚠️  Skipped (might not exist): ${err.message}\n`);
        exportedData[collection.name] = [];
      }
    }

    // ── Generate seed file ─────────────────────────────────
    console.log('📝 Generating seed files...\n');
    const seedContent = generateSeedFile(exportedData);
    const seedJSON = generateSeedJSON(exportedData);

    // ── Write to JSON file ─────────────────────────────────
    fs.writeFileSync(OUTPUT_FILE, seedJSON);
    console.log(`✅ JSON seed file created: ${OUTPUT_FILE}\n`);

    // ── Write to JS file ───────────────────────────────────
    fs.writeFileSync(OUTPUT_FILE_JS, seedContent);
    console.log(`✅ JS seed file created: ${OUTPUT_FILE_JS}\n`);

    // ── Summary ────────────────────────────────────────────
    console.log('═'.repeat(60));
    console.log('📊 Export Summary:');
    console.log('═'.repeat(60));
    console.log(`Total Records Exported: ${totalRecords}\n`);
    console.log('Export Details:');
    for (const [name, records] of Object.entries(exportedData)) {
      console.log(`  • ${name}: ${records.length} records`);
    }
    console.log(`\n📁 Output files:`);
    console.log(`   • JSON: ${OUTPUT_FILE}`);
    console.log(`   • JS:   ${OUTPUT_FILE_JS}`);
    console.log('\n🚀 Next Steps:');
    console.log('   1. Review the exported seed files');
    console.log('   2. Test import: npm run seed:prod:import');
    console.log('   3. Commit to version control for backup');
    console.log('   4. Deploy to production\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export failed:');
    console.error(error.message);
    console.error(error);
    process.exit(1);
  }
};

// ────────────────────────────────────────────────────────────
// Seed File Generator
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Seed File Generators
// ────────────────────────────────────────────────────────────

/**
 * Generate JSON seed file (for backup and version control)
 */
const generateSeedJSON = (data) => {
  const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
    // Remove sensitive fields
    if (key === 'passwordHash' || key === '__v') {
      return undefined;
    }
    return value;
  }));

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalRecords: Object.values(sanitized).reduce((sum, arr) => sum + arr.length, 0),
      collections: sanitized,
    },
    null,
    2
  );
};

/**
 * Generate JavaScript seed file (for importing into database)
 */
const generateSeedFile = (data) => {
  // Sanitize data for safe JSON stringification
  const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
    // Remove sensitive fields
    if (key === 'passwordHash' || key === '__v' || key === 'createdAt' || key === 'updatedAt') {
      return undefined;
    }
    return value;
  }));

  return `/**
 * seed-production-import.js — Production seed data (exported from existing database)
 * 
 * This file was auto-generated from your existing database.
 * It contains all your current collections, ready for production deployment.
 * 
 * Usage:  npm run seed:prod:import
 * 
 * WARNING: This file contains your actual data. Handle with care!
 *          - Do not commit sensitive information to version control
 *          - Use environment variables for MongoDB credentials
 *          - Change passwords after first login
 */

'use strict';

const path = require('path');
const dotenvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const srcPath = path.join(__dirname, '..', 'src');
const User = require(path.join(srcPath, 'models', 'User'));
const Faculty = require(path.join(srcPath, 'models', 'Faculty'));
const Course = require(path.join(srcPath, 'models', 'Course'));
const Workload = require(path.join(srcPath, 'models', 'Workload'));
const Submission = require(path.join(srcPath, 'models', 'Submission'));
const CourseAllocation = require(path.join(srcPath, 'models', 'CourseAllocation'));
const Setting = require(path.join(srcPath, 'models', 'Setting'));
const AuditLog = require(path.join(srcPath, 'models', 'AuditLog'));
const { connect } = require(path.join(srcPath, 'db'));

// ────────────────────────────────────────────────────────────
// Exported Data from Existing Database (Exported: ${new Date().toISOString()})
// ────────────────────────────────────────────────────────────

const EXPORTED_USERS = ${JSON.stringify(sanitized.users, null, 2)};

const EXPORTED_FACULTY = ${JSON.stringify(sanitized.faculty, null, 2)};

const EXPORTED_COURSES = ${JSON.stringify(sanitized.courses, null, 2)};

const EXPORTED_WORKLOADS = ${JSON.stringify(sanitized.workloads, null, 2)};

const EXPORTED_SUBMISSIONS = ${JSON.stringify(sanitized.submissions, null, 2)};

const EXPORTED_ALLOCATIONS = ${JSON.stringify(sanitized.courseAllocations, null, 2)};

const EXPORTED_SETTINGS = ${JSON.stringify(sanitized.settings, null, 2)};

const EXPORTED_AUDIT_LOGS = ${JSON.stringify(sanitized.auditLogs.slice(0, 100), null, 2)};

// ────────────────────────────────────────────────────────────
// Seed Function
// ────────────────────────────────────────────────────────────

const seedDatabase = async () => {
  try {
    console.log('🌱 Importing production data from exported collections...\\n');

    // Connect to database
    await connect();
    console.log('✅ Connected to MongoDB\\n');

    // ── USERS ──────────────────────────────────────────────
    console.log('👤 Importing users...');
    let usersCreated = 0;
    for (const user of EXPORTED_USERS) {
      const exists = await User.findOne({ empId: user.empId });
      if (!exists) {
        // Ensure password is hashed
        const passwordHash = user.passwordHash || bcrypt.hashSync('password123', 10);
        await User.create({
          ...user,
          passwordHash
        });
        usersCreated++;
      }
    }
    if (usersCreated > 0) {
      console.log(\`   ✅ \${usersCreated} users imported\\n\`);
    } else {
      console.log('   ⏭️  All users already exist\\n');
    }

    // ── FACULTY ────────────────────────────────────────────
    console.log('👥 Importing faculty...');
    let facultyCreated = 0;
    for (const fac of EXPORTED_FACULTY) {
      const exists = await Faculty.findOne({ empId: fac.empId });
      if (!exists) {
        await Faculty.create(fac);
        facultyCreated++;
      }
    }
    if (facultyCreated > 0) {
      console.log(\`   ✅ \${facultyCreated} faculty records imported\\n\`);
    } else {
      console.log('   ⏭️  Faculty records already exist\\n');
    }

    // ── COURSES ────────────────────────────────────────────
    console.log('📖 Importing courses...');
    let coursesCreated = 0;
    for (const course of EXPORTED_COURSES) {
      const exists = await Course.findOne({ courseId: course.courseId });
      if (!exists) {
        await Course.create(course);
        coursesCreated++;
      }
    }
    if (coursesCreated > 0) {
      console.log(\`   ✅ \${coursesCreated} courses imported\\n\`);
    } else {
      console.log('   ⏭️  Courses already exist\\n');
    }

    // ── WORKLOADS ──────────────────────────────────────────
    console.log('💼 Importing workloads...');
    let workloadsCreated = 0;
    for (const workload of EXPORTED_WORKLOADS) {
      const exists = await Workload.findOne({
        empId: workload.empId,
        academicYearStart: workload.academicYearStart,
        semester: workload.semester
      });
      if (!exists) {
        await Workload.create(workload);
        workloadsCreated++;
      }
    }
    if (workloadsCreated > 0) {
      console.log(\`   ✅ \${workloadsCreated} workloads imported\\n\`);
    } else {
      console.log('   ⏭️  Workloads already exist\\n');
    }

    // ── SUBMISSIONS ────────────────────────────────────────
    console.log('📤 Importing submissions...');
    let submissionsCreated = 0;
    for (const submission of EXPORTED_SUBMISSIONS) {
      const exists = await Submission.findOne({ _id: submission._id });
      if (!exists) {
        await Submission.create(submission);
        submissionsCreated++;
      }
    }
    if (submissionsCreated > 0) {
      console.log(\`   ✅ \${submissionsCreated} submissions imported\\n\`);
    }

    // ── SETTINGS ───────────────────────────────────────────
    console.log('⚙️  Importing settings...');
    let settingsCreated = 0;
    for (const setting of EXPORTED_SETTINGS) {
      const exists = await Setting.findOne({ key: setting.key });
      if (!exists) {
        await Setting.create(setting);
        settingsCreated++;
      }
    }
    if (settingsCreated > 0) {
      console.log(\`   ✅ \${settingsCreated} settings imported\\n\`);
    } else {
      console.log('   ⏭️  Settings already exist\\n');
    }

    // ── ALLOCATIONS ────────────────────────────────────────
    if (EXPORTED_ALLOCATIONS && EXPORTED_ALLOCATIONS.length > 0) {
      console.log('📋 Importing allocations...');
      let allocationsCreated = 0;
      for (const allocation of EXPORTED_ALLOCATIONS) {
        const exists = await CourseAllocation.findById(allocation._id);
        if (!exists) {
          await CourseAllocation.create(allocation);
          allocationsCreated++;
        }
      }
      if (allocationsCreated > 0) {
        console.log(\`   ✅ \${allocationsCreated} allocations imported\\n\`);
      }
    }

    // ── SUCCESS MESSAGE ────────────────────────────────────
    console.log('═'.repeat(60));
    console.log('🎉 Production data import completed!');
    console.log('═'.repeat(60));
    console.log('\\n📊 Import Summary:');
    console.log(\`   - Users: \${EXPORTED_USERS.length}\`);
    console.log(\`   - Faculty: \${EXPORTED_FACULTY.length}\`);
    console.log(\`   - Courses: \${EXPORTED_COURSES.length}\`);
    console.log(\`   - Workloads: \${EXPORTED_WORKLOADS.length}\`);
    console.log(\`   - Submissions: \${EXPORTED_SUBMISSIONS.length}\`);
    console.log(\`   - Settings: \${EXPORTED_SETTINGS.length}\`);
    console.log(\`   - Allocations: \${EXPORTED_ALLOCATIONS.length}\`);
    console.log('\\n🚀 Production ready for deployment!\\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();
`;
};

// ────────────────────────────────────────────────────────────
// Run Export
// ────────────────────────────────────────────────────────────

exportDatabaseToSeed();
