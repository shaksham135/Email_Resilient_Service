import { RateLimitConfig } from '../types';

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async acquire(): Promise<boolean> {
    const now = Date.now();
    
    // Remove expired requests outside the time window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.timeWindow
    );

    // Check if we can make a new request
    if (this.requests.length >= this.config.maxRequests) {
      return false;
    }

    // Add current request
    this.requests.push(now);
    return true;
  }

  async waitForSlot(): Promise<void> {
    while (!(await this.acquire())) {
      // Calculate wait time until the oldest request expires
      const now = Date.now();
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.config.timeWindow - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  getCurrentUsage(): number {
    const now = Date.now();
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.timeWindow
    );
    return this.requests.length;
  }

  getRemainingSlots(): number {
    return Math.max(0, this.config.maxRequests - this.getCurrentUsage());
  }

  reset(): void {
    this.requests = [];
  }
} 