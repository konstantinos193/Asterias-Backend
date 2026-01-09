/**
 * Server-side memory monitoring
 * Logs memory usage warnings if leaks are detected
 */
class MemoryMonitor {
  constructor() {
    this.interval = null;
    this.isEnabled = false;
    this.history = []; // Track memory history for leak detection
    this.checkCount = 0;
    this.lastLogTime = Date.now();
    this.logIntervalMs = 10 * 60 * 1000; // Log summary every 10 minutes
  }

  /**
   * Start monitoring memory usage
   * @param {number} thresholdMB - Memory threshold in MB to trigger warnings (default: 500MB)
   * @param {number} checkIntervalMs - How often to check memory (default: 60000ms = 1 minute)
   */
  start(thresholdMB = 500, checkIntervalMs = 60000) {
    if (this.isEnabled) {
      console.warn('Memory monitor is already running');
      return;
    }

    this.isEnabled = true;
    this.thresholdMB = thresholdMB;
    this.checkIntervalMs = checkIntervalMs;
    this.history = [];
    this.checkCount = 0;
    this.lastLogTime = Date.now();
    
    console.log(`🔍 Memory monitor started (threshold: ${thresholdMB}MB, interval: ${checkIntervalMs}ms)`);
    console.log(`📊 Summary logs every ${this.logIntervalMs / 60000} minutes, leak detection active`);

    this.interval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const rssMB = usage.rss / 1024 / 1024;
      const externalMB = usage.external / 1024 / 1024;
      const timestamp = Date.now();

      // Store in history (keep last 30 minutes of data)
      this.history.push({
        timestamp,
        heapUsedMB,
        rssMB,
        externalMB
      });

      // Keep only last 30 data points (approximately 30 minutes)
      if (this.history.length > 30) {
        this.history.shift();
      }

      this.checkCount++;

      // Check for high threshold first
      if (heapUsedMB > thresholdMB) {
        console.warn(
          `⚠️ High memory usage detected: ` +
          `Heap: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB, ` +
          `RSS: ${rssMB.toFixed(2)}MB, External: ${externalMB.toFixed(2)}MB`
        );
      } else {
        // Check for memory leak patterns
        const leakDetected = this.detectLeak();
        if (leakDetected) {
          console.warn(
            `🚨 Potential memory leak detected: ` +
            `Heap growth: ${leakDetected.heapGrowth.toFixed(2)}MB over ${(leakDetected.timeWindow / 60000).toFixed(1)} minutes, ` +
            `RSS growth: ${leakDetected.rssGrowth.toFixed(2)}MB`
          );
        }

        // Log summary periodically (every 10 minutes by default)
        const timeSinceLastLog = timestamp - this.lastLogTime;
        if (timeSinceLastLog >= this.logIntervalMs) {
          const stats = this.getSummaryStats();
          console.log(
            `📊 Memory summary (${this.checkCount} checks): ` +
            `Heap: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB, ` +
            `RSS: ${rssMB.toFixed(2)}MB | ` +
            `Trend: ${stats.trend} | ` +
            `Avg: ${stats.avgHeap.toFixed(2)}MB heap, ${stats.avgRss.toFixed(2)}MB RSS`
          );
          this.lastLogTime = timestamp;
          this.checkCount = 0; // Reset counter
        }
      }
    }, checkIntervalMs);
  }

  /**
   * Detect potential memory leaks based on steady growth pattern
   * @returns {Object|null} Leak detection info or null
   */
  detectLeak() {
    if (this.history.length < 10) {
      return null; // Need at least 10 data points
    }

    const recent = this.history.slice(-10); // Last 10 measurements
    const older = this.history.slice(0, Math.min(5, this.history.length - 10)); // Earlier measurements

    if (older.length === 0) {
      return null;
    }

    const recentAvgHeap = recent.reduce((sum, h) => sum + h.heapUsedMB, 0) / recent.length;
    const olderAvgHeap = older.reduce((sum, h) => sum + h.heapUsedMB, 0) / older.length;
    const heapGrowth = recentAvgHeap - olderAvgHeap;

    const recentAvgRss = recent.reduce((sum, h) => sum + h.rssMB, 0) / recent.length;
    const olderAvgRss = older.reduce((sum, h) => sum + h.rssMB, 0) / older.length;
    const rssGrowth = recentAvgRss - olderAvgRss;

    const timeWindow = recent[recent.length - 1].timestamp - older[0].timestamp;

    // Detect leak if:
    // 1. Steady growth of more than 5MB in heap
    // 2. Growth rate is consistent (not just spikes)
    // 3. Growth is significant relative to baseline (more than 10%)
    if (heapGrowth > 5 && (heapGrowth / olderAvgHeap) > 0.1) {
      return {
        heapGrowth,
        rssGrowth,
        timeWindow,
        growthRate: (heapGrowth / (timeWindow / 60000)).toFixed(2) // MB per minute
      };
    }

    return null;
  }

  /**
   * Get summary statistics from recent history
   * @returns {Object} Summary stats
   */
  getSummaryStats() {
    if (this.history.length < 2) {
      return { trend: 'stable', avgHeap: 0, avgRss: 0 };
    }

    const recent = this.history.slice(-10);
    const older = this.history.slice(0, Math.min(5, this.history.length - 10));

    if (older.length === 0) {
      const avgHeap = recent.reduce((sum, h) => sum + h.heapUsedMB, 0) / recent.length;
      const avgRss = recent.reduce((sum, h) => sum + h.rssMB, 0) / recent.length;
      return { trend: 'stable', avgHeap, avgRss };
    }

    const recentAvgHeap = recent.reduce((sum, h) => sum + h.heapUsedMB, 0) / recent.length;
    const olderAvgHeap = older.reduce((sum, h) => sum + h.heapUsedMB, 0) / older.length;
    const heapDiff = recentAvgHeap - olderAvgHeap;

    const avgRss = recent.reduce((sum, h) => sum + h.rssMB, 0) / recent.length;

    let trend = 'stable';
    if (heapDiff > 2) trend = '⬆️ increasing';
    else if (heapDiff < -2) trend = '⬇️ decreasing';
    else trend = '➡️ stable';

    return {
      trend,
      avgHeap: recentAvgHeap,
      avgRss
    };
  }

  /**
   * Stop monitoring memory usage
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isEnabled = false;
      // Clear history to prevent memory leak in the monitor itself
      this.history = [];
      this.checkCount = 0;
      console.log('🔍 Memory monitor stopped');
    }
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage stats
   */
  getStats() {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: usage.heapUsed / 1024 / 1024,
      heapTotalMB: usage.heapTotal / 1024 / 1024,
      rssMB: usage.rss / 1024 / 1024,
      externalMB: usage.external / 1024 / 1024,
      arrayBuffersMB: usage.arrayBuffers ? usage.arrayBuffers / 1024 / 1024 : 0,
    };
  }

  /**
   * Check if memory usage exceeds threshold
   * @param {number} thresholdMB - Threshold in MB
   * @returns {boolean} true if usage exceeds threshold
   */
  checkThreshold(thresholdMB = 500) {
    const stats = this.getStats();
    return stats.heapUsedMB > thresholdMB;
  }

  /**
   * Force garbage collection if available (requires --expose-gc flag)
   */
  forceGC() {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
      return true;
    } else {
      console.warn('⚠️ Garbage collection not available. Run node with --expose-gc flag');
      return false;
    }
  }
}

module.exports = new MemoryMonitor();

