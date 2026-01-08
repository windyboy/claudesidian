/**
 * Jest setup for property-based testing with fast-check
 * Configures global settings for all tests
 */

const fc = require('fast-check');

// Configure fast-check globally
fc.configureGlobal({
  // Minimum 100 iterations per property test as per design requirements
  numRuns: 100,
  // Enable verbose mode for better debugging
  verbose: true,
  // Seed for reproducible tests (can be overridden per test)
  seed: 42,
  // Maximum shrinking iterations
  maxSkipsPerRun: 100,
  // Timeout for individual property runs
  timeout: 5000
});

// Global test utilities
global.fc = fc;

// Custom matchers for property-based testing
expect.extend({
  toSatisfyProperty(received, property) {
    try {
      fc.assert(property);
      return {
        message: () => `Expected property to fail but it passed`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Property failed: ${error.message}`,
        pass: false
      };
    }
  }
});

// Setup for async property tests
beforeEach(() => {
  // Reset any global state before each test
  jest.clearAllMocks();
});

// Global cleanup after all tests
afterAll(async () => {
  // Clean up any global instances that might have timers
  try {
    const { globalPerformanceOptimizer } = require('./performance-optimizer');
    if (globalPerformanceOptimizer && typeof globalPerformanceOptimizer.stop === 'function') {
      globalPerformanceOptimizer.stop();
    }
  } catch (error) {
    // Ignore if module not loaded
  }

  try {
    const { mcpRouterPlugin } = require('./mcp-router');
    if (mcpRouterPlugin && typeof mcpRouterPlugin.cleanup === 'function') {
      await mcpRouterPlugin.cleanup();
    }
  } catch (error) {
    // Ignore if module not loaded
  }
});

// Global timeout for property-based tests
jest.setTimeout(30000);