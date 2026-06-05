/**
 * [PERF-OPT] Circuit Breaker implementation for graceful fallback
 * Prevents cascading failures by tripping after N consecutive failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures: number = 3,
    private cooldownMs: number = 30000
  ) {}

  get isTripped(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
      console.error(`[CircuitBreaker] TRIPPED after ${this.failures} failures`);
    }
  }
}
