import { 
  EmailService, 
  ReliableProvider, 
  UnreliableProvider, 
  SlowProvider,
  FailingProvider,
  EmailData,
  logger,
  LogLevel
} from './index';

// Set log level for more detailed output
logger.setLevel(LogLevel.DEBUG);

async function demonstrateEmailService() {
  console.log('🚀 Starting Resilient Email Service Demo\n');

  // Configure the email service with different providers
  const emailService = new EmailService({
    retry: {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 2
    },
    rateLimit: {
      maxRequests: 5,
      timeWindow: 10000 // 10 seconds
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 5000, // 5 seconds
      monitoringPeriod: 10000 // 10 seconds
    },
    providers: [
      new ReliableProvider(),
      new UnreliableProvider(),
      new SlowProvider(),
      new FailingProvider()
    ]
  });

  // Test email data
  const testEmail: EmailData = {
    to: 'user@example.com',
    from: 'noreply@example.com',
    subject: 'Resilient Email Service Test',
    body: 'This is a test email demonstrating the resilient email service features.',
    html: `
      <h1>Resilient Email Service Test</h1>
      <p>This is a test email demonstrating the resilient email service features.</p>
      <ul>
        <li>Retry Logic</li>
        <li>Provider Fallback</li>
        <li>Circuit Breaker</li>
        <li>Rate Limiting</li>
        <li>Idempotency</li>
      </ul>
    `
  };

  console.log('📧 Testing Basic Email Sending...');
  
  // Test 1: Basic email sending
  try {
    const emailId = await emailService.sendEmail(testEmail, 'demo-user');
    console.log(`✅ Email sent successfully with ID: ${emailId}`);
    
    // Wait for processing and check status
    await new Promise(resolve => setTimeout(resolve, 1000));
    const status = emailService.getEmailStatus(emailId);
    console.log(`📊 Email status: ${status?.status}`);
    console.log(`📊 Provider used: ${status?.result?.provider}`);
    console.log(`📊 Message ID: ${status?.result?.messageId}\n`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }

  console.log('🔄 Testing Idempotency...');
  
  // Test 2: Idempotency (same email, same user)
  try {
    const emailId1 = await emailService.sendEmail(testEmail, 'demo-user');
    const emailId2 = await emailService.sendEmail(testEmail, 'demo-user');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const status1 = emailService.getEmailStatus(emailId1);
    const status2 = emailService.getEmailStatus(emailId2);
    
    if (status1?.result?.messageId === status2?.result?.messageId) {
      console.log('✅ Idempotency working: Same message ID for duplicate emails\n');
    } else {
      console.log('❌ Idempotency failed: Different message IDs\n');
    }
  } catch (error) {
    console.error('❌ Idempotency test failed:', error);
  }

  console.log('⚡ Testing Rate Limiting...');
  
  // Test 3: Rate limiting
  const rateLimitPromises = [];
  for (let i = 0; i < 8; i++) {
    rateLimitPromises.push(emailService.sendEmail({
      ...testEmail,
      subject: `Rate Limit Test ${i + 1}`
    }));
  }
  
  try {
    const emailIds = await Promise.all(rateLimitPromises);
    console.log(`✅ Sent ${emailIds.length} emails with rate limiting`);
    
    const rateLimitStats = emailService.getRateLimitStats();
    console.log(`📊 Rate limit stats: ${rateLimitStats.currentUsage}/${rateLimitStats.maxRequests} used\n`);
  } catch (error) {
    console.error('❌ Rate limiting test failed:', error);
  }

  console.log('🛡️ Testing Circuit Breaker...');
  
  // Test 4: Circuit breaker with failing provider
  const failingService = new EmailService({
    retry: { maxAttempts: 1, initialDelay: 100, maxDelay: 500, backoffMultiplier: 2 },
    rateLimit: { maxRequests: 10, timeWindow: 1000 },
    circuitBreaker: { failureThreshold: 2, recoveryTimeout: 2000, monitoringPeriod: 5000 },
    providers: [new FailingProvider()]
  });

  try {
    // Send emails to trigger circuit breaker
    for (let i = 0; i < 4; i++) {
      await failingService.sendEmail({
        ...testEmail,
        subject: `Circuit Breaker Test ${i + 1}`
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const stats = failingService.getProviderStats();
    const providerStats = stats.get('FailingProvider');
    console.log(`📊 Circuit breaker state: ${providerStats.circuitBreaker.state}`);
    console.log(`📊 Failure count: ${providerStats.circuitBreaker.failureCount}\n`);
  } catch (error) {
    console.error('❌ Circuit breaker test failed:', error);
  }

  console.log('📋 Testing Queue Processing...');
  
  // Test 5: Queue processing
  emailService.startQueueProcessing();
  
  const queueIds = [];
  for (let i = 0; i < 3; i++) {
    const queueId = emailService.enqueueEmail({
      ...testEmail,
      subject: `Queue Test ${i + 1}`
    }, i + 1);
    queueIds.push(queueId);
  }
  
  console.log(`✅ Enqueued ${queueIds.length} emails`);
  
  // Wait for queue processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const queueStats = emailService.getQueueStats();
  console.log(`📊 Queue size after processing: ${queueStats.size}`);
  
  emailService.stopQueueProcessing();
  console.log('✅ Queue processing stopped\n');

  console.log('📈 Service Statistics...');
  
  // Display comprehensive statistics
  const allStats = {
    providerStats: emailService.getProviderStats(),
    rateLimitStats: emailService.getRateLimitStats(),
    idempotencyStats: emailService.getIdempotencyStats(),
    queueStats: emailService.getQueueStats(),
    allStatuses: emailService.getAllStatuses()
  };
  
  console.log('📊 Provider Statistics:');
  allStats.providerStats.forEach((stats, provider) => {
    console.log(`  ${provider}: ${stats.circuitBreaker.state} (${stats.circuitBreaker.failureCount} failures)`);
  });
  
  console.log('\n📊 Rate Limit Statistics:');
  console.log(`  Current usage: ${allStats.rateLimitStats.currentUsage}/${allStats.rateLimitStats.maxRequests}`);
  console.log(`  Remaining slots: ${allStats.rateLimitStats.remainingSlots}`);
  
  console.log('\n📊 Idempotency Statistics:');
  console.log(`  Cache size: ${allStats.idempotencyStats.cacheSize}`);
  console.log(`  Pending requests: ${allStats.idempotencyStats.pendingRequests}`);
  
  console.log('\n📊 Email Status Summary:');
  const statusCounts = allStats.allStatuses.reduce((acc, status) => {
    acc[status.status] = (acc[status.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n🎉 Demo completed successfully!');
}

// Run the demo
if (require.main === module) {
  demonstrateEmailService().catch(console.error);
} 