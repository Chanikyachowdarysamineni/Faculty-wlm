'use strict';

const { mongoose } = require('../db');

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'counters' }
);

module.exports = mongoose.model('Counter', counterSchema);
