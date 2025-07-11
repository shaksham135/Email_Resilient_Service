import { CircuitBreaker } from '../utils/CircuitBreaker';
import { CircuitBreakerConfig, CircuitBreakerState } from '../types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 2000
    };
    circuitBreaker = new CircuitBreaker(config);
  });

  it('should start in CLOSED state', () => {
    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.failureCount).toBe(0);
  });

  it('should execute successful operations', async () => {
    const result = await circuitBreaker.execute(async () => 'success');
    expect(result).toBe('success');
    
    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.failureCount).toBe(0);
  });

  it('should track failures and open circuit', async () => {
    let failureCount = 0;
    const failingOperation = async () => {
      failureCount++;
      throw new Error(`Failure ${failureCount}`);
    };

    // Execute failing operations
    for (let i = 0; i < config.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.OPEN);
    expect(stats.failureCount).toBe(config.failureThreshold);
    expect(stats.lastFailureTime).toBeDefined();
  });

  it('should reject operations when circuit is open', async () => {
    // Open the circuit first
    for (let i = 0; i < config.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch (error) {
        // Expected to fail
      }
    }

    // Try to execute when circuit is open
    await expect(
      circuitBreaker.execute(async () => 'should not execute')
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to HALF_OPEN after recovery timeout', async () => {
    // Open the circuit
    for (let i = 0; i < config.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch (error) {
        // Expected to fail
      }
    }

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, config.recoveryTimeout + 100));

    // Try to execute - should go to HALF_OPEN
    try {
      await circuitBreaker.execute(async () => 'success');
    } catch (error) {
      // Should succeed and close circuit
    }

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
  });

  it('should reset failure count on successful operation', async () => {
    // Fail once
    try {
      await circuitBreaker.execute(async () => {
        throw new Error('Failure');
      });
    } catch (error) {
      // Expected to fail
    }

    expect(circuitBreaker.getStats().failureCount).toBe(1);

    // Succeed
    await circuitBreaker.execute(async () => 'success');
    expect(circuitBreaker.getStats().failureCount).toBe(0);
  });

  it('should provide correct state information', () => {
    expect(circuitBreaker.isClosed()).toBe(true);
    expect(circuitBreaker.isOpen()).toBe(false);
    expect(circuitBreaker.isHalfOpen()).toBe(false);
  });

  it('should reset circuit breaker', async () => {
    // Open the circuit
    for (let i = 0; i < config.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch (error) {
        // Expected to fail
      }
    }

    circuitBreaker.reset();
    
    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe(CircuitBreakerState.CLOSED);
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureTime).toBeUndefined();
    expect(stats.nextAttemptTime).toBeUndefined();
  });
}); 