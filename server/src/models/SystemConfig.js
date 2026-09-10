'use strict';

const { mongoose } = require('../db');

const configItemSchema = new mongoose.Schema({
  value: { type: String, required: true },
  label: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { _id: false });

const systemConfigSchema = new mongoose.Schema({
  // Only one config document should exist, force it to be unique
  singletonFlag: { type: String, default: 'config', unique: true },
  
  years: [configItemSchema],
  courseTypes: [configItemSchema],
  facultyRoles: [configItemSchema],
  designations: [configItemSchema],
  departments: [configItemSchema],
}, {
  timestamps: true,
  collection: 'system_config' // Explicit collection name
});

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
module.exports = SystemConfig;
