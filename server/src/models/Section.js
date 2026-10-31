'use strict';

const { mongoose } = require('../db');

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., '1', '2', 'A'
    code: { type: String, trim: true, default: '' },
    department: { type: String, default: 'CSE', trim: true },
    year: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    description: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    sectionType: { type: String, enum: ['Regular', 'Honours', 'Minors'], default: 'Regular' },
    isDeleted: { type: Boolean, default: false }, // Soft delete
  },
  { timestamps: true, collection: 'sections' }
);

// Prevent duplicate active sections in the same year/department
sectionSchema.index({ name: 1, year: 1, department: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// Cascade soft-delete to allocations & workloads if section is soft-deleted
sectionSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && update.$set && update.$set.isDeleted === true) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const yearVariants = [docToUpdate.year];
      const romanMap = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
      if (romanMap[docToUpdate.year]) yearVariants.push(romanMap[docToUpdate.year]);

      await mongoose.model('CourseAllocation').updateMany(
        {
          $or: [
            { sectionRef: docToUpdate._id },
            { section: docToUpdate.name, year: { $in: yearVariants } }
          ],
          isDeleted: { $ne: true }
        },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      );

      await mongoose.model('Workload').updateMany(
        {
          section: docToUpdate.name,
          year: { $in: yearVariants },
          isDeleted: { $ne: true }
        },
        { $set: { isDeleted: true, allocationStatus: 'CANCELLED', deletedAt: new Date() } }
      );
    }
  }
  next();
});

module.exports = mongoose.model('Section', sectionSchema);
