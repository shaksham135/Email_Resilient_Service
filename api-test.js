// API Test Script for Resilient Email Service
// Run this after starting the server: npm run dev

const API_BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🚀 Testing Resilient Email Service API\n');

  // Test 1: Health Check
  console.log('1. Testing Health Check...');
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData.status);
    console.log('   Uptime:', Math.round(healthData.uptime), 'seconds');
    console.log('   Providers:', Object.keys(healthData.services.providers).length, 'providers');
  } catch (error) {
    console.log('❌ Health Check failed:', error.message);
  }

  // Test 2: Send Email
  console.log('\n2. Testing Send Email...');
  try {
    const emailData = {
      to: 'test@example.com',
      from: 'noreply@example.com',
      subject: 'API Test Email',
      body: 'This is a test email sent via the API.',
      html: '<h1>API Test</h1><p>This is a test email sent via the API.</p>',
      userId: 'api-test-user'
    };

    const sendResponse = await fetch(`${API_BASE_URL}/api/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const sendResult = await sendResponse.json();
    console.log('✅ Email sent:', sendResult.success);
    console.log('   Email ID:', sendResult.emailId);
    console.log('   Status:', sendResult.status?.status);

    // Test 3: Check Email Status
    console.log('\n3. Testing Email Status Check...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing

    const statusResponse = await fetch(`${API_BASE_URL}/api/emails/${sendResult.emailId}/status`);
    const statusData = await statusResponse.json();
    console.log('✅ Status retrieved:', statusData.success);
    console.log('   Final Status:', statusData.status?.status);
    console.log('   Provider:', statusData.status?.result?.provider);
    console.log('   Attempts:', statusData.status?.attempts);

  } catch (error) {
    console.log('❌ Send Email failed:', error.message);
  }

  // Test 4: Queue Email
  console.log('\n4. Testing Queue Email...');
  try {
    const queueData = {
      to: 'queue@example.com',
      from: 'noreply@example.com',
      subject: 'Queued Email Test',
      body: 'This email was added to the queue.',
      priority: 1
    };

    const queueResponse = await fetch(`${API_BASE_URL}/api/emails/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queueData)
    });

    const queueResult = await queueResponse.json();
    console.log('✅ Email queued:', queueResult.success);
    console.log('   Queue ID:', queueResult.queueId);
    console.log('   Priority:', queueResult.priority);

  } catch (error) {
    console.log('❌ Queue Email failed:', error.message);
  }

  // Test 5: Get Service Stats
  console.log('\n5. Testing Service Stats...');
  try {
    const statsResponse = await fetch(`${API_BASE_URL}/api/stats`);
    const statsData = await statsResponse.json();
    console.log('✅ Stats retrieved:', statsData.success);
    console.log('   Rate Limit Usage:', statsData.stats.rateLimitStats.currentUsage);
    console.log('   Idempotency Cache Size:', statsData.stats.idempotencyStats.cacheSize);
    console.log('   Queue Size:', statsData.stats.queueStats.size);

  } catch (error) {
    console.log('❌ Stats failed:', error.message);
  }

  // Test 6: Get All Email Statuses
  console.log('\n6. Testing Get All Statuses...');
  try {
    const allStatusesResponse = await fetch(`${API_BASE_URL}/api/emails`);
    const allStatusesData = await allStatusesResponse.json();
    console.log('✅ All statuses retrieved:', allStatusesData.success);
    console.log('   Total Emails:', allStatusesData.count);

    // Count by status
    const statusCounts = allStatusesData.statuses.reduce((acc, status) => {
      acc[status.status] = (acc[status.status] || 0) + 1;
      return acc;
    }, {});

    console.log('   Status Breakdown:', statusCounts);

  } catch (error) {
    console.log('❌ Get All Statuses failed:', error.message);
  }

  console.log('\n🎉 API Testing Complete!');
  console.log('\nAPI Endpoints Available:');
  console.log('  GET  /health                    - Health check');
  console.log('  POST /api/emails                - Send email');
  console.log('  GET  /api/emails/:id/status     - Get email status');
  console.log('  GET  /api/emails                - Get all email statuses');
  console.log('  GET  /api/stats                 - Get service statistics');
  console.log('  POST /api/emails/queue          - Add email to queue');
  console.log('  POST /api/queue/start           - Start queue processing');
  console.log('  POST /api/queue/stop            - Stop queue processing');
}

// Run the test
testAPI().catch(console.error); 