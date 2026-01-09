/**
 * Centralized job manager for all scheduled tasks
 * Provides unified interface for starting/stopping jobs
 * Prevents memory leaks by tracking all jobs and timeouts
 */
const cron = require('node-cron');

class JobManager {
  constructor() {
    this.jobs = new Map();
    this.timeouts = new Set();
  }

  /**
   * Schedule a cron job
   * @param {string} name - Unique name for the job
   * @param {string} pattern - Cron pattern (e.g., '0 * * * *')
   * @param {Function} callback - Function to execute
   * @param {Object} options - Additional options (start: boolean, timezone: string)
   * @returns {Object} The cron job object
   */
  scheduleCron(name, pattern, callback, options = {}) {
    // Cancel existing job with same name if exists
    if (this.jobs.has(name)) {
      console.warn(`⚠️ Job "${name}" already exists, cancelling previous instance`);
      this.cancel(name);
    }

    const job = cron.schedule(pattern, callback, {
      scheduled: options.start !== false, // Start by default
      timezone: options.timezone || 'UTC',
    });

    this.jobs.set(name, {
      type: 'cron',
      job,
      pattern,
      started: options.start !== false,
      createdAt: new Date(),
    });

    if (options.start !== false) {
      console.log(`✅ Scheduled cron job "${name}" with pattern "${pattern}"`);
    } else {
      console.log(`✅ Created cron job "${name}" (not started)`);
    }

    return job;
  }

  /**
   * Schedule a one-time timeout
   * @param {string} name - Unique name for the timeout
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {NodeJS.Timeout} The timeout ID
   */
  scheduleTimeout(name, callback, delay) {
    // Cancel existing timeout with same name if exists
    if (this.jobs.has(name)) {
      console.warn(`⚠️ Timeout "${name}" already exists, cancelling previous instance`);
      this.cancel(name);
    }

    const timeout = setTimeout(() => {
      callback();
      this.timeouts.delete(timeout);
      this.jobs.delete(name);
    }, delay);

    this.timeouts.add(timeout);
    this.jobs.set(name, {
      type: 'timeout',
      timeout,
      delay,
      createdAt: new Date(),
    });

    console.log(`✅ Scheduled timeout "${name}" in ${delay}ms`);
    return timeout;
  }

  /**
   * Schedule a recurring interval
   * @param {string} name - Unique name for the interval
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {NodeJS.Timeout} The interval ID
   */
  scheduleInterval(name, callback, delay) {
    // Cancel existing interval with same name if exists
    if (this.jobs.has(name)) {
      console.warn(`⚠️ Interval "${name}" already exists, cancelling previous instance`);
      this.cancel(name);
    }

    const interval = setInterval(callback, delay);
    
    this.jobs.set(name, {
      type: 'interval',
      interval,
      delay,
      createdAt: new Date(),
    });

    console.log(`✅ Scheduled interval "${name}" every ${delay}ms`);
    return interval;
  }

  /**
   * Start a scheduled cron job
   * @param {string} name - Name of the job
   */
  start(name) {
    const job = this.jobs.get(name);
    if (!job) {
      console.warn(`⚠️ Job "${name}" not found`);
      return false;
    }

    if (job.type === 'cron' && job.job && typeof job.job.start === 'function') {
      job.job.start();
      job.started = true;
      console.log(`▶️ Started job "${name}"`);
      return true;
    }

    console.warn(`⚠️ Job "${name}" cannot be started (type: ${job.type})`);
    return false;
  }

  /**
   * Stop a scheduled cron job
   * @param {string} name - Name of the job
   */
  stop(name) {
    const job = this.jobs.get(name);
    if (!job) {
      console.warn(`⚠️ Job "${name}" not found`);
      return false;
    }

    if (job.type === 'cron' && job.job && typeof job.job.stop === 'function') {
      job.job.stop();
      job.started = false;
      console.log(`⏸️ Stopped job "${name}"`);
      return true;
    }

    console.warn(`⚠️ Job "${name}" cannot be stopped (type: ${job.type})`);
    return false;
  }

  /**
   * Cancel a job or timeout
   * @param {string} name - Name of the job/timeout to cancel
   */
  cancel(name) {
    const job = this.jobs.get(name);
    if (!job) {
      return false;
    }

    switch (job.type) {
      case 'cron':
        if (job.job && typeof job.job.stop === 'function') {
          job.job.stop();
        }
        if (job.job && typeof job.job.destroy === 'function') {
          job.job.destroy();
        }
        break;

      case 'timeout':
        clearTimeout(job.timeout);
        this.timeouts.delete(job.timeout);
        break;

      case 'interval':
        clearInterval(job.interval);
        break;

      default:
        console.warn(`⚠️ Unknown job type: ${job.type}`);
    }

    this.jobs.delete(name);
    console.log(`❌ Cancelled job "${name}"`);
    return true;
  }

  /**
   * Stop all jobs and clear all timeouts
   */
  stopAll() {
    console.log(`🛑 Stopping all jobs (${this.jobs.size} active)...`);

    // Cancel all tracked jobs
    const jobNames = Array.from(this.jobs.keys());
    jobNames.forEach((name) => this.cancel(name));

    // Clear any remaining timeouts
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();

    console.log('✅ All jobs stopped and cleaned up');
  }

  /**
   * Get statistics about all jobs
   * @returns {Object} Job statistics
   */
  getStats() {
    const stats = {
      total: this.jobs.size,
      cron: 0,
      timeout: 0,
      interval: 0,
      active: 0,
      jobs: [],
    };

    this.jobs.forEach((job, name) => {
      stats[job.type]++;
      if (job.started !== false) {
        stats.active++;
      }

      stats.jobs.push({
        name,
        type: job.type,
        active: job.started !== false,
        pattern: job.pattern,
        delay: job.delay,
        createdAt: job.createdAt,
      });
    });

    return stats;
  }

  /**
   * List all active jobs
   */
  listJobs() {
    const stats = this.getStats();
    console.log('\n📋 Job Manager Status:');
    console.log(`Total jobs: ${stats.total}`);
    console.log(`Active: ${stats.active}`);
    console.log(`  - Cron: ${stats.cron}`);
    console.log(`  - Timeout: ${stats.timeout}`);
    console.log(`  - Interval: ${stats.interval}`);
    
    if (stats.jobs.length > 0) {
      console.log('\nActive Jobs:');
      stats.jobs.forEach((job) => {
        const status = job.active ? '▶️' : '⏸️';
        const detail = job.pattern || `${job.delay}ms`;
        console.log(`  ${status} ${job.name} (${job.type}, ${detail})`);
      });
    }
    console.log('');
  }
}

// Export singleton instance
module.exports = new JobManager();

