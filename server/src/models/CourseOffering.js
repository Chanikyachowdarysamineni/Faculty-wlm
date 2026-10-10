/**
 * models/CourseOffering.js
 */
'use strict';

const { mongoose } = require('../db');

const courseOfferingSchema = new mongoose.Schema(
  {
    academicYearSemesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearSemester', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    academicYearSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearSection', default: null }, // Optional if offering is across sections
    credits: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    T: { type: Number, default: 0 },
    P: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
  },
  { timestamps: true, collection: 'course_offerings' }
);

// We define a compound index, but depending on how offerings map to sections, we might allow multiple offerings or one per section.
// courseOfferingSchema.index({ academicYearSemesterId: 1, courseId: 1, academicYearSectionId: 1 }, { unique: true });


courseOfferingSchema.pre('findOneAndDelete', async function(next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    try {
      await mongoose.model('CourseSectionConfig').deleteMany({ courseOfferingId: doc._id });
    } catch(e){}
  }
  next();
});

courseOfferingSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    await mongoose.model('CourseSectionConfig').deleteMany({ courseOfferingId: this._id });
  } catch(e){}
  next();
});

module.exports = mongoose.model('CourseOffering', courseOfferingSchema);
