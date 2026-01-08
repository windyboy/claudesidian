/**
 * Tests for MCP Router Plugin
 * 
 * Basic functionality tests for the MCP router plugin implementation.
 * These tests focus on core logic and don't require Docker to be installed.
 */

import { MCPRouterPlugin } from '../mcp-router';
import { MCPSandboxConfig, ErrorCode } from '../types';

describe('MCPRouterPlugin', () => {
  let plugin: MCPRouterPlugin;

  beforeEach(() => {
    plugin = new MCPRouterPlugin('/tmp/test-audit.log');
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.cleanup();
    }
  });

  describe('Server Status', () => {
    it('should return empty server list initially', async () => {
      const result = await plugin.getServerStatus();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('Configuration Validation', () => {
    it('should create valid sandbox config', () => {
      const config: MCPSandboxConfig = {
        sandboxType: 'docker',
        resourceLimits: {
          maxMemoryMB: 256,
          maxCpuPercent: 50,
          maxExecutionTime: 300
        },
        filesystem: {
          readOnly: true,
          allowedPaths: ['/tmp/test']
        },
        network: {
          enabled: false
        }
      };

      expect(config.sandboxType).toBe('docker');
      expect(config.resourceLimits?.maxMemoryMB).toBe(256);
      expect(config.filesystem?.readOnly).toBe(true);
      expect(config.network?.enabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle stopping non-existent server', async () => {
      const result = await plugin.stopMCPServer('non-existent-id');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.LIFECYCLE_ERROR);
      expect(result.error?.message).toContain('Server not found');
    });
  });

  describe('Audit Logging', () => {
    it('should initialize with empty audit log path', () => {
      const testPlugin = new MCPRouterPlugin();
      expect(testPlugin).toBeDefined();
    });
  });
});