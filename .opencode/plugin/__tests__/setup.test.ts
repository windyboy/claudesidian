/**
 * Setup verification tests
 * Ensures the testing infrastructure is working correctly
 */

import fc from 'fast-check';
import { createPropertyTest, runPropertyTest, validVaultPath, standardToolResult } from '../test-utils';
import { createSuccessResult, createErrorResult, ErrorCode } from '../types';

describe('Plugin Infrastructure Setup', () => {
  describe('Testing Framework Verification', () => {
    test('Jest is configured correctly', () => {
      expect(true).toBe(true);
    });

    test('fast-check is available globally', () => {
      expect(fc).toBeDefined();
      expect(typeof fc.assert).toBe('function');
    });

    test('Property test runs with minimum 100 iterations', () => {
      let runCount = 0;
      const property = fc.property(fc.integer(), () => {
        runCount++;
        return true;
      });

      runPropertyTest(property);
      expect(runCount).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Test Utilities', () => {
    test('validVaultPath generator produces valid paths', () => {
      const property = fc.property(validVaultPath(), (path) => {
        // Path should not contain path traversal
        expect(path).not.toContain('..');
        // Path should not start with absolute path
        expect(path).not.toMatch(/^[\/\\]/);
        // Path should not be empty
        expect(path.length).toBeGreaterThan(0);
        return true;
      });

      runPropertyTest(property);
    });

    test('standardToolResult generator produces valid results', () => {
      const property = fc.property(standardToolResult<string>(), (result) => {
        // Result should have success field
        expect(typeof result.success).toBe('boolean');
        
        // If success is false, should have error
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error?.code).toBeDefined();
          expect(result.error?.message).toBeDefined();
        }
        
        // Should have metadata with timestamp
        if (result.metadata) {
          expect(typeof result.metadata.timestamp).toBe('number');
        }
        
        return true;
      });

      runPropertyTest(property);
    });
  });

  describe('Type System', () => {
    test('createSuccessResult produces valid success result', () => {
      const result = createSuccessResult('test data', { duration: 100 });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.metadata?.duration).toBe(100);
      expect(result.metadata?.timestamp).toBeDefined();
    });

    test('createErrorResult produces valid error result', () => {
      const result = createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'Test error message',
        { detail: 'test' }
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toBe('Test error message');
      expect(result.error?.details).toEqual({ detail: 'test' });
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });

  describe('Property Test Infrastructure', () => {
    createPropertyTest(
      'plugin-infrastructure',
      0,
      'Test infrastructure setup validation',
      () => {
        const property = fc.property(fc.integer(), fc.string(), (num, str) => {
          // Simple property to verify the infrastructure works
          return typeof num === 'number' && typeof str === 'string';
        });

        runPropertyTest(property);
      }
    );
  });
});