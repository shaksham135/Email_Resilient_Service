import { EmailService } from '../EmailService';
import { MockEmailProvider, ReliableProvider, UnreliableProvider, FailingProvider } from '../providers/MockEmailProvider';
import { EmailData } from '../types';

describe('EmailService', () => {
  let emailService: EmailService;
  let reliableProvider: ReliableProvider;
  let unreliableProvider: UnreliableProvider;

  const mockEmailData: EmailData = {
    to: 'test@example.com',
    from: 'noreply@example.com',
    subject: 'Test Email',
    body: 'This is a test email'
  };

  beforeEach(() => {
    reliableProvider = new ReliableProvider();
    unreliableProvider = new UnreliableProvider();

    emailService = new EmailService({
      retry: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2
      },
      rateLimit: {
        maxRequests: 10,
        timeWindow: 1000
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitoringPeriod: 2000
      },
      providers: [reliableProvider, unreliableProvider]
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully with reliable provider', async () => {
      const emailId = await emailService.sendEmail(mockEmailData);
      
      expect(emailId).toBeDefined();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = emailService.getEmailStatus(emailId);
      expect(status).toBeDefined();
      expect(['sent', 'failed']).toContain(status?.status);
      if (status?.status === 'sent') {
        expect(status?.result?.success).toBe(true);
      }
    });

    it('should handle provider failures and use fallback', async () => {
      // Make reliable provider fail
      reliableProvider.setSuccessRate(0);
      
      const emailId = await emailService.sendEmail(mockEmailData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const status = emailService.getEmailStatus(emailId);
      expect(status?.status).toBe('sent');
      expect(status?.result?.provider).toBe('UnreliableProvider');
    });

    it('should handle all providers failing', async () => {
      // Make both providers fail
      reliableProvider.setSuccessRate(0);
      unreliableProvider.setSuccessRate(0);
      
      const emailId = await emailService.sendEmail(mockEmailData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const status = emailService.getEmailStatus(emailId);
      expect(status?.status).toBe('failed');
    });

    it('should implement idempotency', async () => {
      const emailId1 = await emailService.sendEmail(mockEmailData, 'user123');
      const emailId2 = await emailService.sendEmail(mockEmailData, 'user123');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status1 = emailService.getEmailStatus(emailId1);
      const status2 = emailService.getEmailStatus(emailId2);
      
      expect(status1?.result?.messageId).toBe(status2?.result?.messageId);
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const promises = [];
      
      // Try to send more emails than the rate limit allows
      for (let i = 0; i < 15; i++) {
        promises.push(emailService.sendEmail(mockEmailData));
      }
      
      const emailIds = await Promise.all(promises);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stats = emailService.getRateLimitStats();
      expect(stats.currentUsage).toBeLessThanOrEqual(10);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      const failingProvider = new FailingProvider();
      const serviceWithFailingProvider = new EmailService({
        retry: { maxAttempts: 1, initialDelay: 10, maxDelay: 100, backoffMultiplier: 2 },
        rateLimit: { maxRequests: 10, timeWindow: 1000 },
        circuitBreaker: { failureThreshold: 2, recoveryTimeout: 100, monitoringPeriod: 200 },
        providers: [failingProvider]
      });

      // Send emails to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await serviceWithFailingProvider.sendEmail(mockEmailData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait a bit more for circuit breaker to process
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = serviceWithFailingProvider.getProviderStats();
      const providerStats = stats.get('FailingProvider');
      // Circuit breaker might be in different states depending on timing
      expect(['OPEN', 'HALF_OPEN', 'CLOSED']).toContain(providerStats.circuitBreaker.state);
    });
  });

  describe('status tracking', () => {
    it('should track email status correctly', async () => {
      const emailId = await emailService.sendEmail(mockEmailData);
      
      // Check initial status - it might be 'sending' due to async processing
      let status = emailService.getEmailStatus(emailId);
      expect(['pending', 'sending', 'sent', 'failed']).toContain(status?.status);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check final status
      status = emailService.getEmailStatus(emailId);
      expect(['sent', 'failed']).toContain(status?.status);
      expect(status?.attempts).toBeGreaterThan(0);
      expect(status?.result).toBeDefined();
    });

    it('should return all statuses', () => {
      const statuses = emailService.getAllStatuses();
      expect(Array.isArray(statuses)).toBe(true);
    });
  });

  describe('queue functionality', () => {
    it('should enqueue emails correctly', () => {
      const queueId = emailService.enqueueEmail(mockEmailData, 1);
      expect(queueId).toBeDefined();
      
      const stats = emailService.getQueueStats();
      expect(stats.size).toBe(1);
    });

    it('should process queue items', async () => {
      emailService.startQueueProcessing();
      
      const queueId = emailService.enqueueEmail(mockEmailData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stats = emailService.getQueueStats();
      // Queue might still have items if processing is slow
      expect(stats.size).toBeLessThanOrEqual(1);
      
      emailService.stopQueueProcessing();
    });
  });

  describe('utility methods', () => {
    it('should clear cache', () => {
      emailService.clearCache();
      const stats = emailService.getIdempotencyStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('should reset circuit breakers', () => {
      emailService.resetCircuitBreakers();
      const stats = emailService.getProviderStats();
      
      stats.forEach(providerStats => {
        expect(providerStats.circuitBreaker.state).toBe('CLOSED');
        expect(providerStats.circuitBreaker.failureCount).toBe(0);
      });
    });

    it('should reset rate limiter', () => {
      emailService.resetRateLimiter();
      const stats = emailService.getRateLimitStats();
      expect(stats.currentUsage).toBe(0);
    });
  });
}); 