import { EmailProvider, EmailData, EmailResult } from '../types';

export class MockEmailProvider implements EmailProvider {
  private successRate: number;
  private averageDelay: number;
  private isHealthyStatus: boolean;

  constructor(
    public name: string,
    successRate: number = 0.9,
    averageDelay: number = 100,
    isHealthy: boolean = true
  ) {
    this.successRate = Math.max(0, Math.min(1, successRate));
    this.averageDelay = Math.max(0, averageDelay);
    this.isHealthyStatus = isHealthy;
  }

  async send(email: EmailData): Promise<EmailResult> {
    // Simulate network delay
    const delay = this.averageDelay + (Math.random() - 0.5) * this.averageDelay;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate success/failure based on success rate
    const isSuccess = Math.random() < this.successRate;

    if (isSuccess) {
      return {
        success: true,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: this.name,
        timestamp: new Date()
      };
    } else {
      const errors = [
        'SMTP connection failed',
        'Authentication failed',
        'Rate limit exceeded',
        'Invalid recipient address',
        'Server temporarily unavailable'
      ];
      
      return {
        success: false,
        error: errors[Math.floor(Math.random() * errors.length)],
        provider: this.name,
        timestamp: new Date()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    // Simulate health check delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.isHealthyStatus;
  }

  // Methods for testing
  setSuccessRate(rate: number): void {
    this.successRate = Math.max(0, Math.min(1, rate));
  }

  setAverageDelay(delay: number): void {
    this.averageDelay = Math.max(0, delay);
  }

  setHealthy(healthy: boolean): void {
    this.isHealthyStatus = healthy;
  }
}

// Pre-configured providers for common scenarios
export class ReliableProvider extends MockEmailProvider {
  constructor() {
    super('ReliableProvider', 0.95, 80, true);
  }
}

export class UnreliableProvider extends MockEmailProvider {
  constructor() {
    super('UnreliableProvider', 0.7, 200, true);
  }
}

export class SlowProvider extends MockEmailProvider {
  constructor() {
    super('SlowProvider', 0.9, 500, true);
  }
}

export class FailingProvider extends MockEmailProvider {
  constructor() {
    super('FailingProvider', 0.1, 100, false);
  }
} 