/**
 * models/Faculty.js
 */
'use strict';

const { mongoose } = require('../db');

const facultySchema = new mongoose.Schema(
  {
    slNo:        { type: Number },
    empId:       { type: String, required: true, unique: true, trim: true },
    name:        { type: String, required: true, trim: true },
    department:  { type: String, default: 'CSE' },
    cluster:     { type: String, default: '' },
    designation: { type: String, required: true, trim: true },
    mobile:      { type: String, default: '' },
    email:       { type: String, default: '' },
    passwordHash:{ type: String, default: null },
    capacity: { 
      type: Number, 
      default: function() {
        const { getDefaultCapacity } = require('../utils/designationUtils');
        return getDefaultCapacity(this.designation);
      },
      min: [1, 'Capacity must be at least 1'], 
      max: [60, 'Capacity cannot exceed 60'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value'
      }
    },
    allocated: { type: Number, default: 0 },
    remaining: { 
      type: Number, 
      default: function() {
        return this.capacity || 18;
      }
    },
    workloadPercentage: { type: Number, default: 0 },
    status: { type: String, default: 'Available' },
    isDeleted: { type: Boolean, default: false },
    joiningDate: { type: Date, default: null },
    relievingDate: { type: Date, default: null },
  },
  { timestamps: true, collection: 'faculty' }
);

// Indexes for efficient filtering and sorting
facultySchema.index({ department: 1 });
facultySchema.index({ designation: 1 });
facultySchema.index({ status: 1 });
facultySchema.index({ name: 1 });

// Clear faculty from allocations when soft-deleted
facultySchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && update.$set && update.$set.isDeleted === true) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      // Find all allocations that have this faculty and clear the slots
      const empId = docToUpdate.empId;
      const Allocation = mongoose.model('CourseAllocation');
      const activeAllocs = await Allocation.find({
        isDeleted: false,
        $or: [
          { 'lectureSlots.empId': empId },
          { 'tutorialSlots.empId': empId },
          { 'practicalSlots.empId': empId }
        ]
      });

      for (const a of activeAllocs) {
        let modified = false;
        ['lectureSlots', 'tutorialSlots', 'practicalSlots'].forEach(slotType => {
          if (Array.isArray(a[slotType])) {
            a[slotType].forEach(slot => {
              if (slot.empId === empId) {
                slot.empId = '';
                slot.empName = '';
                slot.faculty = null;
                slot.hours = 0;
                modified = true;
              }
            });
          }
        });
        if (modified) {
          await a.save();
        }
      }
    }
  }
  next();
});

module.exports = mongoose.model('Faculty', facultySchema);
