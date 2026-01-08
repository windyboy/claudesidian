/**
 * Security Integration Tests
 * Basic integration tests to verify the core security foundation works
 */

import { PathValidator, FileOperations } from '../vault-context';
import { CommandParser, WhitelistManager } from '../permission-manager';
import { ErrorCode } from '../types';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('Core Security Foundation Integration', () => {
  const testVaultRoot = path.join(tmpdir(), 'test-vault');

  describe('Vault Context Security', () => {
    let pathValidator: PathValidator;

    beforeEach(() => {
      pathValidator = new PathValidator(testVaultRoot);
    });

    test('PathValidator blocks path traversal attempts', async () => {
      const result = await pathValidator.validatePath('../../../etc/passwd');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.JAIL_VIOLATION);
    });

    test('PathValidator blocks protected directories', async () => {
      const result = await pathValidator.validatePath('.obsidian/config');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.PROTECTED_PATH);
    });

    test('PathValidator allows valid paths', async () => {
      const result = await pathValidator.validatePath('notes/test.md');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Permission Manager Security', () => {
    let whitelistManager: WhitelistManager;

    beforeEach(() => {
      whitelistManager = new WhitelistManager();
    });

    test('CommandParser detects command injection', () => {
      const analysis = CommandParser.detectInjection('ls; rm -rf /');
      
      expect(analysis.safe).toBe(false);
      expect(analysis.violations.length).toBeGreaterThan(0);
      expect(analysis.violations.some(v => v.type === 'INJECTION')).toBe(true);
    });

    test('CommandParser detects bypass attempts', () => {
      const analysis = CommandParser.detectBypassAttempts('echo%3Brm%20-rf%20/'); // Decodes to: echo;rm -rf /
      
      expect(analysis.safe).toBe(false);
      expect(analysis.violations.length).toBeGreaterThan(0);
      expect(analysis.violations.some(v => v.type === 'BYPASS')).toBe(true);
    });

    test('WhitelistManager allows whitelisted commands', () => {
      const parsed = CommandParser.parse('ls -la');
      const result = whitelistManager.isCommandAllowed(parsed);
      
      expect(result.success).toBe(true);
      expect(result.data?.allowed).toBe(true);
    });

    test('WhitelistManager blocks non-whitelisted commands', () => {
      const parsed = CommandParser.parse('rm -rf /');
      const result = whitelistManager.isCommandAllowed(parsed);
      
      expect(result.success).toBe(true);
      expect(result.data?.allowed).toBe(false);
    });
  });

  describe('Plugin Loading', () => {
    test('Vault context plugin can be imported', async () => {
      const { vaultContextPlugin } = await import('../vault-context');
      expect(vaultContextPlugin).toBeDefined();
      expect(typeof vaultContextPlugin).toBe('function');
    });

    test('Permission manager plugin can be imported', async () => {
      const { permissionManagerPlugin } = await import('../permission-manager');
      expect(permissionManagerPlugin).toBeDefined();
      expect(typeof permissionManagerPlugin).toBe('function');
    });
  });
});