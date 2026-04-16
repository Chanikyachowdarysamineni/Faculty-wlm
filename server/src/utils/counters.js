'use strict';

const Counter = require('../models/Counter');

const nextSequence = async (key, floor = 0) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // First, ensure the counter exists with at least the floor value
      if (floor > 0) {
        try {
          await Counter.findOneAndUpdate(
            { key, value: { $lt: floor } },
            { $set: { value: floor } },
            { upsert: false }
          );
        } catch (err) {
          // If counter doesn't exist, try to create it
          if (err.kind === 'ObjectId') {
            try {
              await Counter.create({ key, value: floor });
            } catch (createErr) {
              // Duplicate key error - counter was created by another request, continue
              if (createErr.code !== 11000) {
                throw createErr;
              }
            }
          }
        }
      }
      
      // Now increment the counter
      const doc = await Counter.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      
      if (!doc) {
        throw new Error('Failed to get counter document');
      }
      
      return doc.value;
    } catch (err) {
      // Duplicate key error - retry as another request may have created it
      if (err.code === 11000) {
        retryCount++;
        if (retryCount < maxRetries) {
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 10 * retryCount));
          continue;
        }
      }
      throw err;
    }
  }
  
  throw new Error(`Failed to get next sequence after ${maxRetries} retries for key: ${key}`);
};

module.exports = { nextSequence };
