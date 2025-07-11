import { 
  EmailData, 
  EmailResult, 
  EmailStatus, 
  EmailProvider, 
  EmailServiceConfig,
  RetryConfig,
  RateLimitConfig,
  CircuitBreakerConfig
} from './types';
import { CircuitBreaker } from './utils/CircuitBreaker';
import { RateLimiter } from './utils/RateLimiter';
import { RetryMechanism } from './utils/RetryMechanism';
import { IdempotencyService } from './utils/IdempotencyService';
import { EmailQueue } from './utils/EmailQueue';
import { generateUUID } from './utils/UUID';
import { logger } from './utils/Logger';

export class EmailService {
  private config: EmailServiceConfig;
  private providers: EmailProvider[];
  private circuitBreakers: Map<string, CircuitBreaker>;
  private rateLimiter: RateLimiter;
  private retryMechanism: RetryMechanism;
  private idempotencyService: IdempotencyService;
  private queue: EmailQueue;
  private statusTracking: Map<string, EmailStatus>;

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.providers = config.providers;
    this.circuitBreakers = new Map();
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.retryMechanism = new RetryMechanism(config.retry);
    this.idempotencyService = new IdempotencyService();
    this.queue = new EmailQueue();
    this.statusTracking = new Map();

    // Initialize circuit breakers for each provider
    this.providers.forEach(provider => {
      this.circuitBreakers.set(provider.name, new CircuitBreaker(config.circuitBreaker));
    });
  }

  async sendEmail(email: EmailData, userId?: string): Promise<string> {
    const emailId = generateUUID();
    
    // Create initial status
    const status: EmailStatus = {
      id: emailId,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.retry.maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.statusTracking.set(emailId, status);

    // Generate idempotency key
    const idempotencyKey = this.idempotencyService.generateKey(email, userId);

    // Process email asynchronously
    this.processEmail(emailId, email, idempotencyKey, userId).catch(error => {
      logger.error(`Failed to process email ${emailId}:`, error);
      this.updateStatus(emailId, 'failed', undefined, error.message);
    });

    return emailId;
  }

  private async processEmail(
    emailId: string, 
    email: EmailData, 
    idempotencyKey: string, 
    userId?: string
  ): Promise<void> {
    try {
      this.updateStatus(emailId, 'sending');

      // Wait for rate limit slot
      await this.rateLimiter.waitForSlot();

      // Execute with idempotency
      const result = await this.idempotencyService.execute(idempotencyKey, async () => {
        return this.sendWithFallback(email);
      });

      this.updateStatus(emailId, 'sent', result);
    } catch (error) {
      this.updateStatus(emailId, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async sendWithFallback(email: EmailData): Promise<EmailResult> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      const circuitBreaker = this.circuitBreakers.get(provider.name);
      if (!circuitBreaker) continue;

      try {
        const result = await circuitBreaker.execute(async () => {
          return this.retryMechanism.execute(async () => {
            return provider.send(email);
          });
        });

        if (result.success) {
          return result;
        } else {
          lastError = new Error(result.error || 'Provider returned failure');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Provider ${provider.name} failed:`, lastError.message);
      }
    }

    throw lastError || new Error('All providers failed');
  }

  private updateStatus(
    emailId: string, 
    status: EmailStatus['status'], 
    result?: EmailResult, 
    error?: string
  ): void {
    const emailStatus = this.statusTracking.get(emailId);
    if (!emailStatus) return;

    emailStatus.status = status;
    emailStatus.updatedAt = new Date();
    
    if (status === 'sending') {
      emailStatus.attempts++;
      emailStatus.lastAttempt = new Date();
    } else if (status === 'sent' && result) {
      emailStatus.result = result;
    } else if (status === 'failed') {
      emailStatus.result = {
        success: false,
        error: error || 'Unknown error',
        provider: 'unknown',
        timestamp: new Date()
      };
    }
  }

  getEmailStatus(emailId: string): EmailStatus | undefined {
    return this.statusTracking.get(emailId);
  }

  getAllStatuses(): EmailStatus[] {
    return Array.from(this.statusTracking.values());
  }

  getProviderStats(): Map<string, any> {
    const stats = new Map();
    
    this.providers.forEach(provider => {
      const circuitBreaker = this.circuitBreakers.get(provider.name);
      if (circuitBreaker) {
        stats.set(provider.name, {
          circuitBreaker: circuitBreaker.getStats(),
          healthy: true // We could add health check here
        });
      }
    });

    return stats;
  }

  getRateLimitStats(): any {
    return {
      currentUsage: this.rateLimiter.getCurrentUsage(),
      remainingSlots: this.rateLimiter.getRemainingSlots(),
      maxRequests: this.config.rateLimit.maxRequests,
      timeWindow: this.config.rateLimit.timeWindow
    };
  }

  getQueueStats(): any {
    return {
      size: this.queue.getSize(),
      items: this.queue.getItems()
    };
  }

  getIdempotencyStats(): any {
    return {
      cacheSize: this.idempotencyService.getCacheSize(),
      pendingRequests: this.idempotencyService.getPendingRequestsCount()
    };
  }

  // Queue management methods
  enqueueEmail(email: EmailData, priority: number = 0): string {
    return this.queue.enqueue(email, priority);
  }

  startQueueProcessing(): void {
    this.queue.startProcessing(async (item) => {
      await this.processEmail(item.id, item.email, '', undefined);
    });
  }

  stopQueueProcessing(): void {
    this.queue.stopProcessing();
  }

  // Utility methods
  clearCache(): void {
    this.idempotencyService.clearCache();
  }

  resetCircuitBreakers(): void {
    this.circuitBreakers.forEach(breaker => breaker.reset());
  }

  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
} 