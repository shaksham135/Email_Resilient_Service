# Resilient Email Service

A robust, production-ready email sending service built in TypeScript with comprehensive resilience features including retry logic, fallback mechanisms, circuit breakers, rate limiting, and idempotency.

## Features

### Core Resilience Features
- **Retry Logic**: Exponential backoff with configurable attempts and delays
- **Provider Fallback**: Automatic switching between multiple email providers
- **Circuit Breaker**: Prevents cascading failures with automatic recovery
- **Rate Limiting**: Sliding window rate limiting to prevent provider overload
- **Idempotency**: Prevents duplicate email sends using content-based keys
- **Status Tracking**: Comprehensive tracking of email sending attempts and results

### Bonus Features
- **Priority Queue**: Background processing with priority-based queuing
- **Structured Logging**: Configurable logging with different levels
- **Mock Providers**: Testable mock email providers with configurable behavior
- **Comprehensive Testing**: Full test coverage for all components

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd resilient-email-service

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Quick Start

```typescript
import { EmailService, ReliableProvider, UnreliableProvider } from './src';

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
  subject: 'Welcome!',
  body: 'Welcome to our service!',
  html: '<h1>Welcome!</h1><p>Welcome to our service!</p>'
};

const emailId = await emailService.sendEmail(emailData, 'user123');
console.log(`Email sent with ID: ${emailId}`);

// Check status
const status = emailService.getEmailStatus(emailId);
console.log('Email status:', status);
```

## Configuration

### Retry Configuration
```typescript
{
  maxAttempts: 3,           // Maximum number of retry attempts
  initialDelay: 1000,       // Initial delay in milliseconds
  maxDelay: 10000,          // Maximum delay in milliseconds
  backoffMultiplier: 2      // Exponential backoff multiplier
}
```

### Rate Limit Configuration
```typescript
{
  maxRequests: 10,          // Maximum requests per time window
  timeWindow: 60000         // Time window in milliseconds
}
```

### Circuit Breaker Configuration
```typescript
{
  failureThreshold: 5,      // Number of failures before opening circuit
  recoveryTimeout: 30000,   // Time to wait before attempting recovery
  monitoringPeriod: 60000   // Period for monitoring failures
}
```

## Email Providers

The service includes several mock providers for testing:

- **ReliableProvider**: 95% success rate, fast response
- **UnreliableProvider**: 70% success rate, slower response
- **SlowProvider**: 90% success rate, very slow response
- **FailingProvider**: 10% success rate, mostly fails

### Creating Custom Providers

```typescript
import { EmailProvider, EmailData, EmailResult } from './src/types';

class CustomEmailProvider implements EmailProvider {
  constructor(public name: string) {}

  async send(email: EmailData): Promise<EmailResult> {
    // Implement your email sending logic here
    try {
      // Your email sending implementation
      return {
        success: true,
        messageId: 'custom-message-id',
        provider: this.name,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.name,
        timestamp: new Date()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    // Implement health check logic
    return true;
  }
}
```

## Advanced Usage

### Queue Processing

```typescript
// Start background queue processing
emailService.startQueueProcessing();

// Enqueue emails with priority
const highPriorityId = emailService.enqueueEmail(emailData, 1);
const lowPriorityId = emailService.enqueueEmail(emailData, 10);

// Stop queue processing
emailService.stopQueueProcessing();
```

### Monitoring and Statistics

```typescript
// Get provider statistics
const providerStats = emailService.getProviderStats();
console.log('Provider stats:', providerStats);

// Get rate limit statistics
const rateLimitStats = emailService.getRateLimitStats();
console.log('Rate limit stats:', rateLimitStats);

// Get idempotency statistics
const idempotencyStats = emailService.getIdempotencyStats();
console.log('Idempotency stats:', idempotencyStats);

// Get queue statistics
const queueStats = emailService.getQueueStats();
console.log('Queue stats:', queueStats);
```

### Utility Methods

```typescript
// Clear idempotency cache
emailService.clearCache();

// Reset circuit breakers
emailService.resetCircuitBreakers();

// Reset rate limiter
emailService.resetRateLimiter();
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Architecture

### Components

1. **EmailService**: Main orchestrator that coordinates all resilience features
2. **CircuitBreaker**: Prevents cascading failures with automatic recovery
3. **RateLimiter**: Implements sliding window rate limiting
4. **RetryMechanism**: Handles exponential backoff retry logic
5. **IdempotencyService**: Prevents duplicate sends using content-based keys
6. **EmailQueue**: Priority-based background processing queue
7. **MockEmailProvider**: Testable email providers with configurable behavior

### Resilience Patterns

- **Retry Pattern**: Exponential backoff with jitter
- **Circuit Breaker Pattern**: Three states (CLOSED, OPEN, HALF_OPEN)
- **Fallback Pattern**: Automatic provider switching
- **Rate Limiting Pattern**: Sliding window implementation
- **Idempotency Pattern**: Content-based deduplication

## Assumptions and Limitations

### Assumptions
- Email providers implement the `EmailProvider` interface
- Network failures are transient and recoverable
- Email content is relatively small (< 10MB)
- System has sufficient memory for caching and queuing
- Clock synchronization is not critical for idempotency

### Limitations
- In-memory storage (not persistent across restarts)
- Single-instance deployment (no distributed coordination)
- Mock providers only (no real email sending)
- Basic priority queue (no advanced scheduling)
- Simple hash-based idempotency (not cryptographically secure)

### Production Considerations
- Replace mock providers with real email services (SendGrid, AWS SES, etc.)
- Implement persistent storage for status tracking
- Add distributed coordination for multi-instance deployments
- Implement proper monitoring and alerting
- Add metrics collection and observability
- Consider using Redis or similar for distributed caching
- Implement proper error handling and dead letter queues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details. 