import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { generateUUID } from './utils/UUID';

import { EmailService } from './EmailService';
import { ReliableProvider, UnreliableProvider, SlowProvider, FailingProvider } from './providers/MockEmailProvider';
import { SendEmailRequest, SendEmailResponse, GetStatusResponse, GetAllStatusesResponse, ServiceStatsResponse, HealthCheckResponse, ErrorResponse } from './types/api';
import { EmailData } from './types';
import { logger } from './utils/Logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize email service
const emailService = new EmailService({
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    initialDelay: parseInt(process.env.INITIAL_RETRY_DELAY || '1000'),
    maxDelay: parseInt(process.env.MAX_RETRY_DELAY || '10000'),
    backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2')
  },
  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000')
  },
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    recoveryTimeout: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || '30000'),
    monitoringPeriod: parseInt(process.env.CIRCUIT_BREAKER_MONITORING_PERIOD || '60000')
  },
  providers: [
    new ReliableProvider(),
    new UnreliableProvider(),
    new SlowProvider(),
    new FailingProvider()
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  }
});
app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const requestId = generateUUID();
  req.headers['x-request-id'] = requestId;
  
  logger.info(`${req.method} ${req.path}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next();
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.error('Unhandled error:', error);
  
  const errorResponse: ErrorResponse = {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId
  };
  
  res.status(500).json(errorResponse);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const providerStats = emailService.getProviderStats();
    const providerHealth: Record<string, boolean> = {};
    
    // Check provider health
    for (const [providerName, stats] of providerStats) {
      providerHealth[providerName] = stats.circuitBreaker.state !== 'OPEN';
    }
    
    const healthResponse: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        emailService: true,
        providers: providerHealth
      }
    };
    
    res.json(healthResponse);
  } catch (error) {
    const healthResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        emailService: false,
        providers: {}
      }
    };
    
    res.status(503).json(healthResponse);
  }
});

// API Routes
app.post('/api/emails', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const emailRequest: SendEmailRequest = req.body;
    
    // Validate required fields
    if (!emailRequest.to || !emailRequest.from || !emailRequest.subject || !emailRequest.body) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: to, from, subject, body',
        timestamp: new Date().toISOString(),
        requestId
      };
      return res.status(400).json(errorResponse);
    }
    
    // Convert to EmailData format
    const emailData: EmailData = {
      to: emailRequest.to,
      from: emailRequest.from,
      subject: emailRequest.subject,
      body: emailRequest.body,
      html: emailRequest.html,
      cc: emailRequest.cc,
      bcc: emailRequest.bcc
    };
    
    // Send email
    const emailId = await emailService.sendEmail(emailData, emailRequest.userId);
    
    // Get initial status
    const status = emailService.getEmailStatus(emailId);
    
    const response: SendEmailResponse = {
      success: true,
      emailId,
      message: 'Email queued for sending',
      status
    };
    
    logger.info(`Email queued successfully`, { requestId, emailId });
    res.status(202).json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'EMAIL_SEND_ERROR',
      message: error instanceof Error ? error.message : 'Failed to send email',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to send email:', error);
    res.status(500).json(errorResponse);
  }
});

app.get('/api/emails/:emailId/status', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const { emailId } = req.params;
    
    const status = emailService.getEmailStatus(emailId);
    
    if (!status) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'EMAIL_NOT_FOUND',
        message: 'Email not found',
        timestamp: new Date().toISOString(),
        requestId
      };
      return res.status(404).json(errorResponse);
    }
    
    const response: GetStatusResponse = {
      success: true,
      status
    };
    
    res.json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'STATUS_RETRIEVAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to retrieve email status',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to retrieve email status:', error);
    res.status(500).json(errorResponse);
  }
});

app.get('/api/emails', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    
    const statuses = emailService.getAllStatuses();
    
    const response: GetAllStatusesResponse = {
      success: true,
      statuses,
      count: statuses.length
    };
    
    res.json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'STATUSES_RETRIEVAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to retrieve email statuses',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to retrieve email statuses:', error);
    res.status(500).json(errorResponse);
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    
    const providerStats = emailService.getProviderStats();
    const rateLimitStats = emailService.getRateLimitStats();
    const idempotencyStats = emailService.getIdempotencyStats();
    const queueStats = emailService.getQueueStats();
    
    const response: ServiceStatsResponse = {
      success: true,
      stats: {
        providerStats: Object.fromEntries(providerStats),
        rateLimitStats,
        idempotencyStats,
        queueStats
      }
    };
    
    res.json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'STATS_RETRIEVAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to retrieve service stats',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to retrieve service stats:', error);
    res.status(500).json(errorResponse);
  }
});

// Queue management endpoints
app.post('/api/emails/queue', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const emailRequest: SendEmailRequest = req.body;
    const priority = emailRequest.priority || 0;
    
    // Validate required fields
    if (!emailRequest.to || !emailRequest.from || !emailRequest.subject || !emailRequest.body) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: to, from, subject, body',
        timestamp: new Date().toISOString(),
        requestId
      };
      return res.status(400).json(errorResponse);
    }
    
    // Convert to EmailData format
    const emailData: EmailData = {
      to: emailRequest.to,
      from: emailRequest.from,
      subject: emailRequest.subject,
      body: emailRequest.body,
      html: emailRequest.html,
      cc: emailRequest.cc,
      bcc: emailRequest.bcc
    };
    
    // Enqueue email
    const queueId = emailService.enqueueEmail(emailData, priority);
    
    const response = {
      success: true,
      queueId,
      message: 'Email added to queue',
      priority
    };
    
    logger.info(`Email added to queue`, { requestId, queueId, priority });
    res.status(202).json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'QUEUE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to add email to queue',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to add email to queue:', error);
    res.status(500).json(errorResponse);
  }
});

// Start queue processing
app.post('/api/queue/start', (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    
    emailService.startQueueProcessing();
    
    const response = {
      success: true,
      message: 'Queue processing started'
    };
    
    logger.info('Queue processing started', { requestId });
    res.json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'QUEUE_START_ERROR',
      message: error instanceof Error ? error.message : 'Failed to start queue processing',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to start queue processing:', error);
    res.status(500).json(errorResponse);
  }
});

app.post('/api/queue/stop', (req, res) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    
    emailService.stopQueueProcessing();
    
    const response = {
      success: true,
      message: 'Queue processing stopped'
    };
    
    logger.info('Queue processing stopped', { requestId });
    res.json(response);
    
  } catch (error) {
    const requestId = req.headers['x-request-id'] as string;
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'QUEUE_STOP_ERROR',
      message: error instanceof Error ? error.message : 'Failed to stop queue processing',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    logger.error('Failed to stop queue processing:', error);
    res.status(500).json(errorResponse);
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Resilient Email Service API running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API documentation: http://localhost:${PORT}/api`);
});

export default app; 