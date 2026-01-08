/**
 * Session Manager Plugin Tests
 * Basic functionality tests for the session manager plugin
 */

import { VaultAnalyzer, SessionContextManager } from '../session-manager';
import { Session } from '../types';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

describe('VaultAnalyzer', () => {
  let vaultAnalyzer: VaultAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    vaultAnalyzer = new VaultAnalyzer();
    tempDir = join(__dirname, 'temp-test-vault');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('detectVault', () => {
    it('should detect vault with .obsidian directory', async () => {
      // Create temp vault structure
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(join(tempDir, '.obsidian'), { recursive: true });

      const result = await vaultAnalyzer.detectVault(tempDir);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should not detect vault in empty directory', async () => {
      // Create empty temp directory
      await fs.mkdir(tempDir, { recursive: true });

      const result = await vaultAnalyzer.detectVault(tempDir);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe('analyzeVault', () => {
    it('should analyze vault structure', async () => {
      // Create temp vault with PARA structure
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(join(tempDir, '.obsidian'), { recursive: true });
      await fs.mkdir(join(tempDir, '00_Inbox'), { recursive: true });
      await fs.mkdir(join(tempDir, '01_Projects'), { recursive: true });
      
      // Create some markdown files
      await fs.writeFile(join(tempDir, 'test.md'), '# Test Note');
      await fs.writeFile(join(tempDir, '00_Inbox', 'inbox-note.md'), '# Inbox Note');

      const result = await vaultAnalyzer.analyzeVault(tempDir);
      
      expect(result.success).toBe(true);
      expect(result.data?.isVault).toBe(true);
      expect(result.data?.paraStructure.inbox).toContain('00_Inbox');
      expect(result.data?.paraStructure.projects).toContain('01_Projects');
      expect(result.data?.totalFiles).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    it('should cache vault analysis results', async () => {
      // Create temp vault
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(join(tempDir, '.obsidian'), { recursive: true });

      // First analysis
      const result1 = await vaultAnalyzer.analyzeVault(tempDir, true);
      expect(result1.success).toBe(true);

      // Second analysis should use cache
      const result2 = await vaultAnalyzer.analyzeVault(tempDir, true);
      expect(result2.success).toBe(true);
      expect(result2.metadata?.warnings).toContain('Using cached vault analysis');
    });

    it('should provide cache statistics', () => {
      const stats = vaultAnalyzer.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });
});

describe('SessionContextManager', () => {
  let contextManager: SessionContextManager;
  let tempDir: string;

  beforeEach(() => {
    contextManager = new SessionContextManager();
    tempDir = join(__dirname, 'temp-test-vault');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('generateVaultContext', () => {
    it('should generate context for vault session', async () => {
      // Create temp vault
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(join(tempDir, '.obsidian'), { recursive: true });
      await fs.mkdir(join(tempDir, '00_Inbox'), { recursive: true });

      const session: Session = {
        id: 'test-session',
        agent: 'test-agent',
        model: { provider: 'openai', model: 'gpt-4' },
        directory: tempDir,
        created: Date.now(),
        state: {}
      };

      const result = await contextManager.generateVaultContext(session);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
      
      // Check that context contains vault information
      const contextText = result.data![0].content;
      expect(contextText).toContain('Vault Context');
      expect(contextText).toContain('Vault Path');
    });

    it('should generate context for non-vault session', async () => {
      // Create temp non-vault directory
      await fs.mkdir(tempDir, { recursive: true });

      const session: Session = {
        id: 'test-session',
        agent: 'test-agent',
        model: { provider: 'openai', model: 'gpt-4' },
        directory: tempDir,
        created: Date.now(),
        state: {}
      };

      const result = await contextManager.generateVaultContext(session);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
      
      // Check that context indicates non-vault directory
      const contextText = result.data![0].content;
      expect(contextText).toContain('Directory Context');
      expect(contextText).toContain('not detected as an Obsidian vault');
    });
  });
});