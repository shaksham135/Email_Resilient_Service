import { EmailData, EmailResult } from '../types';

export class IdempotencyService {
  private cache: Map<string, EmailResult> = new Map();
  private pendingRequests: Set<string> = new Set();

  generateKey(email: EmailData, idempotencyKey?: string, userId?: string): string {
    if (idempotencyKey) {
      return `idempotency_${idempotencyKey}`;
    }
    const emailContent = JSON.stringify({
      to: Array.isArray(email.to) ? email.to.sort() : email.to,
      from: email.from,
      subject: email.subject,
      body: email.body,
      html: email.html,
      cc: email.cc?.sort(),
      bcc: email.bcc?.sort(),
      userId
    });

    // Simple hash function for the key
    let hash = 0;
    for (let i = 0; i < emailContent.length; i++) {
      const char = emailContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `email_${Math.abs(hash)}_${userId || 'anonymous'}`;
  }

  async execute<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if we already have a result
    const existingResult = this.cache.get(key);
    if (existingResult) {
      return existingResult as T;
    }

    // Check if the same request is already in progress
    if (this.pendingRequests.has(key)) {
      // Wait for the pending request to complete
      return this.waitForPendingRequest(key);
    }

    // Mark this request as pending
    this.pendingRequests.add(key);

    try {
      const result = await operation();
      
      // Cache the successful result
      this.cache.set(key, result as EmailResult);
      
      return result;
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(key);
    }
  }

  private async waitForPendingRequest<T>(key: string): Promise<T> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 100; // 100ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const result = this.cache.get(key);
      if (result) {
        return result as T;
      }

      if (!this.pendingRequests.has(key)) {
        // Request completed but no result cached (failed)
        throw new Error('Request failed while waiting for pending operation');
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Timeout waiting for pending request');
  }

  hasResult(key: string): boolean {
    return this.cache.has(key);
  }

  getResult(key: string): EmailResult | undefined {
    return this.cache.get(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  removeFromCache(key: string): void {
    this.cache.delete(key);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }
} 