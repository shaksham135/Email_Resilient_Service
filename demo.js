// Simple demo script to show the email service in action
// This can be run with: node demo.js

console.log('🚀 Resilient Email Service Demo\n');

// Simple mock implementations for demo purposes
class SimpleMockProvider {
  constructor(name, successRate = 0.9) {
    this.name = name;
    this.successRate = successRate;
  }

  async send(email) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const isSuccess = Math.random() < this.successRate;
    
    if (isSuccess) {
      return {
        success: true,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: this.name,
        timestamp: new Date()
      };
    } else {
      return {
        success: false,
        error: 'Simulated failure',
        provider: this.name,
        timestamp: new Date()
      };
    }
  }

  async isHealthy() {
    return true;
  }
}

// Simple retry mechanism
class SimpleRetry {
  constructor(maxAttempts = 3, delay = 1000) {
    this.maxAttempts = maxAttempts;
    this.delay = delay;
  }

  async execute(operation) {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.maxAttempts) {
          throw error;
        }
        console.log(`  Attempt ${attempt} failed, retrying in ${this.delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.delay));
        this.delay *= 2; // Exponential backoff
      }
    }
  }
}

// Simple rate limiter
class SimpleRateLimiter {
  constructor(maxRequests = 5, timeWindow = 10000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }

  async waitForSlot() {
    while (!(await this.acquire())) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Simple email service
class SimpleEmailService {
  constructor(providers, retry, rateLimit) {
    this.providers = providers;
    this.retry = new SimpleRetry(retry.maxAttempts, retry.initialDelay);
    this.rateLimiter = new SimpleRateLimiter(rateLimit.maxRequests, rateLimit.timeWindow);
    this.statusTracking = new Map();
  }

  async sendEmail(emailData, userId) {
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📧 Sending email: ${emailData.subject}`);
    
    // Track status
    this.statusTracking.set(emailId, {
      id: emailId,
      status: 'sending',
      attempts: 0,
      createdAt: new Date()
    });

    // Process email
    this.processEmail(emailId, emailData).catch(error => {
      console.error(`❌ Failed to process email ${emailId}:`, error.message);
      this.updateStatus(emailId, 'failed', error.message);
    });

    return emailId;
  }

  async processEmail(emailId, emailData) {
    try {
      // Wait for rate limit slot
      await this.rateLimiter.waitForSlot();
      
      // Try providers with retry
      const result = await this.retry.execute(async () => {
        return this.sendWithFallback(emailData);
      });

      this.updateStatus(emailId, 'sent', null, result);
      console.log(`✅ Email sent successfully via ${result.provider}`);
      
    } catch (error) {
      this.updateStatus(emailId, 'failed', error.message);
      throw error;
    }
  }

  async sendWithFallback(emailData) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const result = await provider.send(emailData);
        if (result.success) {
          return result;
        } else {
          lastError = new Error(result.error);
        }
      } catch (error) {
        lastError = error;
        console.log(`  Provider ${provider.name} failed: ${error.message}`);
      }
    }

    throw lastError || new Error('All providers failed');
  }

  updateStatus(emailId, status, error, result) {
    const emailStatus = this.statusTracking.get(emailId);
    if (emailStatus) {
      emailStatus.status = status;
      emailStatus.updatedAt = new Date();
      if (status === 'sending') {
        emailStatus.attempts++;
      }
      if (result) {
        emailStatus.result = result;
      }
      if (error) {
        emailStatus.error = error;
      }
    }
  }

  getEmailStatus(emailId) {
    return this.statusTracking.get(emailId);
  }
}

// Demo execution
async function runDemo() {
  // Create providers
  const reliableProvider = new SimpleMockProvider('ReliableProvider', 0.95);
  const unreliableProvider = new SimpleMockProvider('UnreliableProvider', 0.7);
  const failingProvider = new SimpleMockProvider('FailingProvider', 0.1);

  // Create email service
  const emailService = new SimpleEmailService(
    [reliableProvider, unreliableProvider, failingProvider],
    { maxAttempts: 3, initialDelay: 500 },
    { maxRequests: 3, timeWindow: 5000 }
  );

  // Test email data
  const testEmails = [
    {
      to: 'user1@example.com',
      from: 'noreply@example.com',
      subject: 'Welcome Email',
      body: 'Welcome to our service!'
    },
    {
      to: 'user2@example.com',
      from: 'noreply@example.com',
      subject: 'Password Reset',
      body: 'Your password has been reset.'
    },
    {
      to: 'user3@example.com',
      from: 'noreply@example.com',
      subject: 'Order Confirmation',
      body: 'Your order has been confirmed.'
    },
    {
      to: 'user4@example.com',
      from: 'noreply@example.com',
      subject: 'Newsletter',
      body: 'Here is your weekly newsletter.'
    },
    {
      to: 'user5@example.com',
      from: 'noreply@example.com',
      subject: 'Account Update',
      body: 'Your account has been updated.'
    }
  ];

  console.log('📧 Sending multiple emails with resilience features...\n');

  // Send emails
  const emailIds = [];
  for (const email of testEmails) {
    const emailId = await emailService.sendEmail(email, 'demo-user');
    emailIds.push(emailId);
  }

  console.log('\n⏳ Waiting for emails to process...\n');

  // Wait for processing and check results
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('📊 Email Processing Results:\n');

  let successCount = 0;
  let failureCount = 0;

  for (const emailId of emailIds) {
    const status = emailService.getEmailStatus(emailId);
    if (status) {
      const icon = status.status === 'sent' ? '✅' : '❌';
      const provider = status.result?.provider || 'unknown';
      console.log(`${icon} ${status.id}: ${status.status} (${provider})`);
      
      if (status.status === 'sent') {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failureCount}`);
  console.log(`  Success Rate: ${((successCount / emailIds.length) * 100).toFixed(1)}%`);

  console.log('\n🎉 Demo completed!');
  console.log('\nKey Features Demonstrated:');
  console.log('  ✅ Retry logic with exponential backoff');
  console.log('  ✅ Provider fallback mechanism');
  console.log('  ✅ Rate limiting to prevent overload');
  console.log('  ✅ Status tracking for all emails');
  console.log('  ✅ Error handling and recovery');
}

// Run the demo
runDemo().catch(console.error); 