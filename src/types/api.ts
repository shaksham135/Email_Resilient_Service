import { EmailData, EmailStatus } from './index';

export interface SendEmailRequest {
  to: string | string[];
  from: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  userId?: string;
  priority?: number;
}

export interface SendEmailResponse {
  success: boolean;
  emailId: string;
  message: string;
  status?: EmailStatus;
}

export interface GetStatusResponse {
  success: boolean;
  status?: EmailStatus;
  message?: string;
}

export interface GetAllStatusesResponse {
  success: boolean;
  statuses: EmailStatus[];
  count: number;
}

export interface ServiceStatsResponse {
  success: boolean;
  stats: {
    providerStats: Record<string, any>;
    rateLimitStats: any;
    idempotencyStats: any;
    queueStats: any;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    emailService: boolean;
    providers: Record<string, boolean>;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  requestId?: string;
} 