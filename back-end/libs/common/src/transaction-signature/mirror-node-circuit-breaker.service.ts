import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface NetworkCircuit {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  halfOpenSuccesses: number;
  halfOpenAttempts: number;
}

@Injectable()
export class MirrorNodeCircuitBreaker {
  private readonly logger = new Logger(MirrorNodeCircuitBreaker.name);
  private readonly circuits = new Map<string, NetworkCircuit>();

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(private readonly configService: ConfigService) {
    this.failureThreshold = this.configService.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 3);
    this.resetTimeoutMs = this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', 60000);
    this.halfOpenMaxAttempts = this.configService.get<number>(
      'CIRCUIT_BREAKER_HALF_OPEN_MAX_ATTEMPTS',
      1,
    );
  }

  /**
   * Checks whether the given network is available for requests.
   *
   * When the circuit is OPEN and the reset timeout has elapsed, this method
   * transitions the circuit to HALF_OPEN and increments `halfOpenAttempts`.
   * Only call once per decision point.
   */
  isAvailable(network: string): boolean {
    const circuit = this.circuits.get(network);
    if (!circuit) return true;

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (Date.now() - circuit.lastFailureTime >= this.resetTimeoutMs) {
          this.transitionTo(network, circuit, CircuitState.HALF_OPEN);
          circuit.halfOpenAttempts++;
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        if (circuit.halfOpenAttempts < this.halfOpenMaxAttempts) {
          circuit.halfOpenAttempts++;
          return true;
        }
        return false;
    }
  }

  recordSuccess(network: string): void {
    const circuit = this.circuits.get(network);
    if (!circuit) return;

    switch (circuit.state) {
      case CircuitState.HALF_OPEN:
        circuit.halfOpenSuccesses++;
        if (circuit.halfOpenSuccesses >= this.halfOpenMaxAttempts) {
          this.transitionTo(network, circuit, CircuitState.CLOSED);
        }
        break;

      case CircuitState.CLOSED:
        circuit.failureCount = 0;
        break;
    }
  }

  /**
   * Records a failure for the given network and returns whether the circuit
   * is still available (i.e. has not tripped to OPEN).
   */
  recordFailure(network: string): boolean {
    let circuit = this.circuits.get(network);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenSuccesses: 0,
        halfOpenAttempts: 0,
      };
      this.circuits.set(network, circuit);
    }

    circuit.lastFailureTime = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        circuit.failureCount++;
        if (circuit.failureCount >= this.failureThreshold) {
          this.transitionTo(network, circuit, CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        this.transitionTo(network, circuit, CircuitState.OPEN);
        break;
    }

    return circuit.state === CircuitState.CLOSED;
  }

  getCircuitState(network: string): CircuitState {
    const circuit = this.circuits.get(network);
    if (!circuit) return CircuitState.CLOSED;

    // Pure observation: report what the next isAvailable() call would see
    if (
      circuit.state === CircuitState.OPEN &&
      Date.now() - circuit.lastFailureTime >= this.resetTimeoutMs
    ) {
      return CircuitState.HALF_OPEN;
    }

    return circuit.state;
  }

  getNetworkHealth(): Record<string, { state: CircuitState; failureCount: number }> {
    const health: Record<string, { state: CircuitState; failureCount: number }> = {};
    for (const [network, circuit] of this.circuits) {
      health[network] = {
        state: this.getCircuitState(network),
        failureCount: circuit.failureCount,
      };
    }
    return health;
  }

  private transitionTo(network: string, circuit: NetworkCircuit, newState: CircuitState): void {
    const oldState = circuit.state;
    circuit.state = newState;

    switch (newState) {
      case CircuitState.OPEN:
        this.logger.warn(
          `Circuit breaker OPEN for network "${network}" after ${circuit.failureCount} failures`,
        );
        break;

      case CircuitState.HALF_OPEN:
        circuit.halfOpenSuccesses = 0;
        circuit.halfOpenAttempts = 0;
        this.logger.log(
          `Circuit breaker HALF_OPEN for network "${network}" -- probing recovery`,
        );
        break;

      case CircuitState.CLOSED:
        circuit.failureCount = 0;
        circuit.halfOpenSuccesses = 0;
        circuit.halfOpenAttempts = 0;
        this.logger.log(
          `Circuit breaker CLOSED for network "${network}" -- recovered`,
        );
        break;
    }
  }
}
