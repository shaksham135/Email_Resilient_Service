// Main exports
export { EmailService } from './EmailService';
export { MockEmailProvider, ReliableProvider, UnreliableProvider, SlowProvider, FailingProvider } from './providers/MockEmailProvider';
export { CircuitBreaker } from './utils/CircuitBreaker';
export { RateLimiter } from './utils/RateLimiter';
export { RetryMechanism } from './utils/RetryMechanism';
export { IdempotencyService } from './utils/IdempotencyService';
export { EmailQueue } from './utils/EmailQueue';
export { Logger, LogLevel, logger } from './utils/Logger';
export { generateUUID } from './utils/UUID';

// Type exports
export * from './types';

// Example usage
async function example() {
  const { EmailService, ReliableProvider, UnreliableProvider } = require('./index');

  // Configure the email service
  const emailService = new EmailService({
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    },
    rateLimit: {
      maxRequests: 10,
      timeWindow: 60000 // 1 minute
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000 // 1 minute
    },
    providers: [
      new ReliableProvider(),
      new UnreliableProvider()
    ]
  });

  // Send an email
  const emailData = {
    to: 'user@example.com',
    from: 'noreply@example.com',
    subject: 'Test Email',
    body: 'This is a test email from the resilient email service.',
    html: '<h1>Test Email</h1><p>This is a test email from the resilient email service.</p>'
  };

  try {
    const emailId = await emailService.sendEmail(emailData, 'user123');
    console.log(`Email sent with ID: ${emailId}`);

    // Check status after a delay
    setTimeout(async () => {
      const status = emailService.getEmailStatus(emailId);
      console.log('Email status:', status);

      // Get service statistics
      console.log('Provider stats:', emailService.getProviderStats());
      console.log('Rate limit stats:', emailService.getRateLimitStats());
      console.log('Idempotency stats:', emailService.getIdempotencyStats());
    }, 2000);

  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
} 