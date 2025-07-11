export interface EmailData {
  to: string | string[];
  from: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailProvider {
  name: string;
  send(email: EmailData): Promise<EmailResult>;
  isHealthy(): Promise<boolean>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: Date;
}

export interface EmailStatus {
  id: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  result?: EmailResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // in milliseconds
  monitoringPeriod: number; // in milliseconds
}

export interface EmailServiceConfig {
  retry: RetryConfig;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  providers: EmailProvider[];
}

export interface QueueItem {
  id: string;
  email: EmailData;
  priority: number;
  createdAt: Date;
  retryCount: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
} 