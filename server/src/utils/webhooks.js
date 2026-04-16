/**
 * utils/webhooks.js
 * 
 * Webhook system for real-time notifications and integrations
 * Send events to external services
 */

'use strict';

const crypto = require('crypto');

// In-memory webhook registry (use database in production)
const webhooks = new Map();
const webhookLogs = [];

/**
 * Register a webhook
 * @param {string} event - Event name (workload.created, faculty.updated, etc.)
 * @param {string} url - Webhook URL
 * @param {string} secret - Secret for signing webhook
 */
const registerWebhook = (event, url, secret) => {
  const id = crypto.randomUUID();
  const webhook = {
    id,
    event,
    url,
    secret,
    createdAt: new Date(),
    lastTriggeredAt: null,
    failureCount: 0,
    isActive: true,
  };

  if (!webhooks.has(event)) {
    webhooks.set(event, []);
  }

  webhooks.get(event).push(webhook);
  return webhook;
};

/**
 * Unregister a webhook
 */
const unregisterWebhook = (id) => {
  for (const [event, hooks] of webhooks.entries()) {
    const index = hooks.findIndex((w) => w.id === id);
    if (index >= 0) {
      hooks.splice(index, 1);
      return true;
    }
  }
  return false;
};

/**
 * Sign webhook payload
 */
const signWebhook = (payload, secret) => {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `sha256=${signature}`;
};

/**
 * Trigger webhook event
 */
const triggerWebhook = async (event, data) => {
  const eventHooks = webhooks.get(event) || [];

  for (const webhook of eventHooks) {
    if (!webhook.isActive) continue;

    try {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      const signature = signWebhook(payload, webhook.secret);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      });

      webhook.lastTriggeredAt = new Date();

      logWebhookEvent({
        webhookId: webhook.id,
        event,
        status: response.status,
        success: response.ok,
        timestamp: new Date(),
      });

      if (!response.ok) {
        webhook.failureCount += 1;
        if (webhook.failureCount >= 10) {
          webhook.isActive = false;
          console.warn(`⚠️  Webhook ${webhook.id} disabled after 10 failures`);
        }
      } else {
        webhook.failureCount = 0;
      }
    } catch (err) {
      webhook.failureCount += 1;
      logWebhookEvent({
        webhookId: webhook.id,
        event,
        error: err.message,
        success: false,
        timestamp: new Date(),
      });

      console.error(`Error triggering webhook for ${event}:`, err.message);
    }
  }
};

/**
 * Log webhook events for debugging
 */
const logWebhookEvent = (logEntry) => {
  webhookLogs.push(logEntry);
  // Keep only last 1000 logs
  if (webhookLogs.length > 1000) {
    webhookLogs.shift();
  }
};

/**
 * Get webhook event logs
 */
const getWebhookLogs = (limit = 50) => {
  return webhookLogs.slice(-limit).reverse();
};

/**
 * Get all webhooks for an event
 */
const getWebhooks = (event) => {
  return webhooks.get(event) || [];
};

module.exports = {
  registerWebhook,
  unregisterWebhook,
  signWebhook,
  triggerWebhook,
  logWebhookEvent,
  getWebhookLogs,
  getWebhooks,
};
