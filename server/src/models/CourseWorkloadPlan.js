const mongoose = require('mongoose');

const courseWorkloadPlanSchema = new mongoose.Schema({
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
  tpBatches: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  noOfSections: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  studentStrength: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  updatedBy: { 
    type: String 
  }
}, { 
  timestamps: true 
});

// Compound unique index to ensure one plan per course offering per semester/year
courseWorkloadPlanSchema.index({ academicYearId: 1, semesterType: 1, courseOfferingId: 1 }, { unique: true });

module.exports = mongoose.model('CourseWorkloadPlan', courseWorkloadPlanSchema);
