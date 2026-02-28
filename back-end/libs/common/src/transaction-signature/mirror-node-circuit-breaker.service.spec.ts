import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';

import {
  MirrorNodeCircuitBreaker,
  CircuitState,
} from './mirror-node-circuit-breaker.service';

describe('MirrorNodeCircuitBreaker', () => {
  let service: MirrorNodeCircuitBreaker;
  const configService = mockDeep<ConfigService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Return the default value (second argument) for config lookups
    configService.get.mockImplementation((_key: string, defaultValue?: any) => defaultValue);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MirrorNodeCircuitBreaker,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<MirrorNodeCircuitBreaker>(MirrorNodeCircuitBreaker);
  });

  describe('config defaults', () => {
    it('should read config with correct defaults', () => {
      expect(configService.get).toHaveBeenCalledWith('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 3);
      expect(configService.get).toHaveBeenCalledWith('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', 60000);
      expect(configService.get).toHaveBeenCalledWith('CIRCUIT_BREAKER_HALF_OPEN_MAX_ATTEMPTS', 1);
    });
  });

  describe('isAvailable', () => {
    it('should return true for unknown networks (default CLOSED)', () => {
      expect(service.isAvailable('testnet')).toBe(true);
    });

    it('should return true when circuit is CLOSED', () => {
      service.recordFailure('testnet'); // 1 failure, still CLOSED
      expect(service.isAvailable('testnet')).toBe(true);
    });

    it('should return false when circuit is OPEN', () => {
      // Default threshold is 3
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      expect(service.isAvailable('testnet')).toBe(false);
    });

    it('should transition OPEN -> HALF_OPEN after reset timeout', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      expect(service.isAvailable('testnet')).toBe(false);

      // Advance time past reset timeout (default 60s)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      expect(service.isAvailable('testnet')).toBe(true);
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);
    });

    it('should return true when circuit is HALF_OPEN (first probe)', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // First call transitions to HALF_OPEN and returns true
      expect(service.isAvailable('testnet')).toBe(true);
    });

    it('should only allow halfOpenMaxAttempts calls in HALF_OPEN before returning false', () => {
      // Default halfOpenMaxAttempts = 1
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // First call: transitions OPEN -> HALF_OPEN, consumes the one allowed attempt
      expect(service.isAvailable('testnet')).toBe(true);
      // Second call: already used the one allowed attempt
      expect(service.isAvailable('testnet')).toBe(false);
      // Third call: still false
      expect(service.isAvailable('testnet')).toBe(false);
    });

    it('should allow requests again after HALF_OPEN -> CLOSED -> re-open -> HALF_OPEN', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // Transition to HALF_OPEN, use the probe
      expect(service.isAvailable('testnet')).toBe(true);
      // Succeed -> CLOSED
      service.recordSuccess('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);

      // Open again
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 122000);

      // Should allow one probe again
      expect(service.isAvailable('testnet')).toBe(true);
      expect(service.isAvailable('testnet')).toBe(false);
    });
  });

  describe('state transitions: CLOSED -> OPEN', () => {
    it('should open after reaching failure threshold', () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      service.recordFailure('testnet');
      service.recordFailure('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);

      service.recordFailure('testnet'); // 3rd failure = threshold
      expect(service.getCircuitState('testnet')).toBe(CircuitState.OPEN);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN for network "testnet"'),
      );
    });
  });

  describe('state transitions: OPEN -> HALF_OPEN', () => {
    it('should report HALF_OPEN via getCircuitState after reset timeout (pure query)', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // getCircuitState reports HALF_OPEN without mutating
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition via isAvailable after reset timeout', () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // isAvailable performs the actual transition
      expect(service.isAvailable('testnet')).toBe(true);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('HALF_OPEN for network "testnet"'),
      );
    });

    it('should not transition before reset timeout', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 30000); // Only 30s

      expect(service.getCircuitState('testnet')).toBe(CircuitState.OPEN);
    });

    it('getCircuitState should not mutate state', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // Call getCircuitState multiple times - should be idempotent
      service.getCircuitState('testnet');
      service.getCircuitState('testnet');

      // The actual internal state is still OPEN (not mutated)
      const circuit = (service as any).circuits.get('testnet');
      expect(circuit.state).toBe(CircuitState.OPEN);
    });
  });

  describe('state transitions: HALF_OPEN -> CLOSED', () => {
    it('should close after enough successes in HALF_OPEN', () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      // Open the circuit
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // Transition to HALF_OPEN
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
      service.isAvailable('testnet');

      // Record success (default halfOpenMaxAttempts = 1)
      service.recordSuccess('testnet');

      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('CLOSED for network "testnet" -- recovered'),
      );
    });
  });

  describe('state transitions: HALF_OPEN -> OPEN', () => {
    it('should re-open on failure in HALF_OPEN', () => {
      // Open the circuit
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // Transition to HALF_OPEN
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
      service.isAvailable('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);

      // Fail again -> back to OPEN
      service.recordFailure('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.OPEN);
    });

    it('should re-open stale HALF_OPEN after resetTimeoutMs when attempts are exhausted', () => {
      const baseTime = Date.now();

      // Open the circuit
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // Transition to HALF_OPEN (consumes the one allowed attempt)
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 61000);
      expect(service.isAvailable('testnet')).toBe(true);
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);

      // Attempts exhausted, but not yet stale — should stay HALF_OPEN
      expect(service.isAvailable('testnet')).toBe(false);
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);

      // Advance past resetTimeoutMs from when HALF_OPEN was entered
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 61000 + 61000);

      // Should transition HALF_OPEN -> OPEN (and return false)
      expect(service.isAvailable('testnet')).toBe(false);
      expect((service as any).circuits.get('testnet').state).toBe(CircuitState.OPEN);
    });

    it('should allow a fresh HALF_OPEN probe cycle after stale HALF_OPEN resets to OPEN', () => {
      const baseTime = Date.now();

      // Open the circuit
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // Transition to HALF_OPEN (consumes the one allowed attempt)
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 61000);
      expect(service.isAvailable('testnet')).toBe(true);

      // No recordSuccess/recordFailure called — simulate the deadlock scenario

      // Advance past resetTimeoutMs — stale HALF_OPEN resets to OPEN
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 61000 + 61000);
      expect(service.isAvailable('testnet')).toBe(false); // triggers HALF_OPEN -> OPEN

      // Advance past another resetTimeoutMs — OPEN -> HALF_OPEN with fresh attempts
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + 61000 + 61000 + 61000);
      expect(service.isAvailable('testnet')).toBe(true);
      expect(service.getCircuitState('testnet')).toBe(CircuitState.HALF_OPEN);

      // This time record success -> should recover to CLOSED
      service.recordSuccess('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);
    });
  });

  describe('recordSuccess in CLOSED state', () => {
    it('should reset failure count', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);

      service.recordSuccess('testnet');

      // After reset, need 3 more failures to open
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);

      service.recordFailure('testnet');
      expect(service.getCircuitState('testnet')).toBe(CircuitState.OPEN);
    });
  });

  describe('recordFailure return value', () => {
    it('should return true when circuit stays CLOSED', () => {
      expect(service.recordFailure('testnet')).toBe(true); // 1st failure
      expect(service.recordFailure('testnet')).toBe(true); // 2nd failure
    });

    it('should return false when circuit transitions to OPEN', () => {
      service.recordFailure('testnet'); // 1
      service.recordFailure('testnet'); // 2
      expect(service.recordFailure('testnet')).toBe(false); // 3rd = threshold
    });

    it('should return false when circuit transitions from HALF_OPEN to OPEN', () => {
      // Open the circuit
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // Transition to HALF_OPEN via isAvailable
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
      service.isAvailable('testnet');

      // Fail in HALF_OPEN -> back to OPEN
      expect(service.recordFailure('testnet')).toBe(false);
    });
  });

  describe('recordSuccess for unknown network', () => {
    it('should be a no-op', () => {
      expect(() => service.recordSuccess('unknown')).not.toThrow();
    });
  });

  describe('multi-network independence', () => {
    it('should track each network independently', () => {
      // Open circuit for testnet
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      // mainnet should still be available
      expect(service.isAvailable('mainnet')).toBe(true);
      expect(service.isAvailable('testnet')).toBe(false);

      // Failures on mainnet don't affect testnet timing
      service.recordFailure('mainnet');
      expect(service.getCircuitState('mainnet')).toBe(CircuitState.CLOSED);
      expect(service.getCircuitState('testnet')).toBe(CircuitState.OPEN);
    });

    it('should allow independent recovery', () => {
      // Open both
      for (let i = 0; i < 3; i++) {
        service.recordFailure('testnet');
        service.recordFailure('mainnet');
      }

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      // Recover testnet only
      service.isAvailable('testnet');
      service.recordSuccess('testnet');

      expect(service.getCircuitState('testnet')).toBe(CircuitState.CLOSED);
      // mainnet reports HALF_OPEN (timeout elapsed) but internal state is still OPEN
      expect(service.getCircuitState('mainnet')).toBe(CircuitState.HALF_OPEN);
    });
  });

  describe('getNetworkHealth', () => {
    it('should return empty object when no networks tracked', () => {
      expect(service.getNetworkHealth()).toEqual({});
    });

    it('should return health for all tracked networks', () => {
      service.recordFailure('testnet');
      service.recordFailure('testnet');
      service.recordFailure('testnet');

      service.recordFailure('mainnet');

      const health = service.getNetworkHealth();

      expect(health).toEqual({
        testnet: { state: CircuitState.OPEN, failureCount: 3 },
        mainnet: { state: CircuitState.CLOSED, failureCount: 1 },
      });
    });
  });
});
