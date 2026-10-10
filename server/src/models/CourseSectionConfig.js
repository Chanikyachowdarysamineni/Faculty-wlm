const mongoose = require('mongoose');

const courseSectionConfigSchema = new mongoose.Schema({
  academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true
  },
  semesterType: {
    type: String,
    enum: ['ODD', 'EVEN'],
    required: true
  },
  courseOfferingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseOffering',
    required: true
  },
  totalSections: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

courseSectionConfigSchema.index({ academicYearId: 1, semesterType: 1, courseOfferingId: 1 }, { unique: true });

module.exports = mongoose.model('CourseSectionConfig', courseSectionConfigSchema);
