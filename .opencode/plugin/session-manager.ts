/**
 * Session Manager Plugin for OpenCode
 * Provides intelligent session management with vault detection and analysis
 * 
 * This plugin implements session management functionality including:
 * - Vault detection and analysis
 * - PARA structure scanning
 * - Context injection during compaction
 * - Performance optimization through caching
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { promises as fs } from 'node:fs';
import { resolve, join, relative, dirname, basename } from 'node:path';
import { 
  StandardToolResult, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult, 
  VaultInfo,
  Session,
  SessionCompactionContext,
  Part
} from './types';
import { performance_optimizer } from './performance-optimizer';

/**
 * PARA folder structure configuration
 */
interface PARAConfig {
  inbox: string[];
  projects: string[];
  areas: string[];
  resources: string[];
  archive: string[];
}

/**
 * Default PARA folder patterns
 */
const DEFAULT_PARA_PATTERNS: PARAConfig = {
  inbox: ['00_Inbox', 'Inbox', '0-Inbox', 'inbox'],
  projects: ['01_Projects', 'Projects', '1-Projects', 'projects'],
  areas: ['02_Areas', 'Areas', '2-Areas', 'areas'],
  resources: ['03_Resources', 'Resources', '3-Resources', 'resources'],
  archive: ['04_Archive', 'Archive', '4-Archive', 'archive']
};

/**
 * Vault analysis cache entry
 */
interface VaultCacheEntry {
  vaultInfo: VaultInfo;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Session context for vault-specific information
 */
interface VaultSessionContext {
  isVault: boolean;
  vaultPath?: string;
  paraStructure?: PARAConfig;
  recentFiles?: string[];
  activeProjects?: string[];
  vaultStats?: {
    totalFiles: number;
    totalSize: number;
    lastModified: Date;
  };
}

/**
 * Vault detector and analyzer
 */
export class VaultAnalyzer {
  private cache: Map<string, VaultCacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private memoryOptimizer = performance_optimizer.initialize().getMemoryOptimizer();

  /**
   * Detect if a directory is an Obsidian vault
   */
  async detectVault(directoryPath: string): Promise<StandardToolResult<boolean>> {
    const startTime = Date.now();
    
    try {
      const resolvedPath = resolve(directoryPath);
      
      // Optimize cache management
      this.optimizeCacheUsage();
      
      // Check for .obsidian directory (primary indicator)
      const obsidianPath = join(resolvedPath, '.obsidian');
      
      try {
        const obsidianStats = await fs.stat(obsidianPath);
        if (obsidianStats.isDirectory()) {
          return createSuccessResult(true, { 
            duration: Date.now() - startTime,
            warnings: ['Obsidian vault detected via .obsidian directory']
          });
        }
      } catch {
        // .obsidian directory doesn't exist, continue with other checks
      }

      // Check for common vault indicators
      const vaultIndicators = [
        '.obsidian.vimrc',
        'obsidian.css',
        '.obsidian-git-data'
      ];

      for (const indicator of vaultIndicators) {
        try {
          await fs.access(join(resolvedPath, indicator));
          return createSuccessResult(true, { 
            duration: Date.now() - startTime,
            warnings: [`Vault detected via ${indicator}`]
          });
        } catch {
          // Indicator doesn't exist, continue
        }
      }

      // Check for PARA structure as secondary indicator
      const paraFolders = await this.detectPARAStructure(resolvedPath);
      const paraFolderCount = Object.values(paraFolders).flat().length;
      
      if (paraFolderCount >= 3) {
        return createSuccessResult(true, { 
          duration: Date.now() - startTime,
          warnings: [`Potential vault detected via PARA structure (${paraFolderCount} folders)`]
        });
      }

      // Check for markdown files as tertiary indicator
      const markdownFiles = await this.countMarkdownFiles(resolvedPath);
      if (markdownFiles > 10) {
        return createSuccessResult(true, { 
          duration: Date.now() - startTime,
          warnings: [`Potential vault detected via markdown files (${markdownFiles} files)`]
        });
      }

      return createSuccessResult(false, { 
        duration: Date.now() - startTime 
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Vault detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { directoryPath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Analyze vault structure and return comprehensive information
   */
  async analyzeVault(vaultPath: string, useCache: boolean = true): Promise<StandardToolResult<VaultInfo>> {
    const startTime = Date.now();
    const resolvedPath = resolve(vaultPath);
    
    // Check cache first
    if (useCache) {
      const cached = this.getCachedAnalysis(resolvedPath);
      if (cached) {
        return createSuccessResult(cached.vaultInfo, {
          duration: Date.now() - startTime,
          warnings: ['Using cached vault analysis']
        });
      }
    }

    try {
      // Detect if it's a vault
      const vaultDetection = await this.detectVault(resolvedPath);
      if (!vaultDetection.success) {
        return createErrorResult(
          vaultDetection.error!.code,
          vaultDetection.error!.message,
          vaultDetection.error!.details,
          { duration: Date.now() - startTime }
        );
      }

      const isVault = vaultDetection.data!;
      
      // Analyze PARA structure
      const paraStructure = await this.detectPARAStructure(resolvedPath);
      
      // Get plugin settings if available
      const pluginSettings = await this.extractPluginSettings(resolvedPath);
      
      // Calculate vault statistics
      const stats = await this.calculateVaultStats(resolvedPath);

      const vaultInfo: VaultInfo = {
        isVault,
        vaultPath: resolvedPath,
        paraStructure,
        pluginSettings,
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize
      };

      // Cache the result
      if (useCache) {
        this.cacheAnalysis(resolvedPath, vaultInfo);
      }

      return createSuccessResult(vaultInfo, {
        duration: Date.now() - startTime,
        warnings: isVault ? undefined : ['Directory is not detected as an Obsidian vault']
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Vault analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { vaultPath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Detect PARA structure in the vault
   */
  private async detectPARAStructure(vaultPath: string): Promise<PARAConfig> {
    const paraStructure: PARAConfig = {
      inbox: [],
      projects: [],
      areas: [],
      resources: [],
      archive: []
    };

    try {
      const entries = await fs.readdir(vaultPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const folderName = entry.name;
        
        // Check against PARA patterns
        for (const [category, patterns] of Object.entries(DEFAULT_PARA_PATTERNS)) {
          if (patterns.some((pattern: string) => 
            folderName.toLowerCase().includes(pattern.toLowerCase()) ||
            pattern.toLowerCase().includes(folderName.toLowerCase())
          )) {
            (paraStructure as any)[category].push(folderName);
            break;
          }
        }
      }
    } catch (error) {
      // If we can't read the directory, return empty structure
    }

    return paraStructure;
  }

  /**
   * Extract plugin settings from .obsidian directory
   */
  private async extractPluginSettings(vaultPath: string): Promise<Record<string, any>> {
    const settings: Record<string, any> = {};
    
    try {
      const obsidianPath = join(vaultPath, '.obsidian');
      const pluginsPath = join(obsidianPath, 'plugins');
      
      // Try to read community-plugins.json
      try {
        const communityPluginsPath = join(obsidianPath, 'community-plugins.json');
        const communityPluginsContent = await fs.readFile(communityPluginsPath, 'utf-8');
        settings.communityPlugins = JSON.parse(communityPluginsContent);
      } catch {
        // File doesn't exist or can't be parsed
      }

      // Try to read app.json for core settings
      try {
        const appJsonPath = join(obsidianPath, 'app.json');
        const appJsonContent = await fs.readFile(appJsonPath, 'utf-8');
        settings.app = JSON.parse(appJsonContent);
      } catch {
        // File doesn't exist or can't be parsed
      }

      // Try to read workspace.json
      try {
        const workspacePath = join(obsidianPath, 'workspace.json');
        const workspaceContent = await fs.readFile(workspacePath, 'utf-8');
        settings.workspace = JSON.parse(workspaceContent);
      } catch {
        // File doesn't exist or can't be parsed
      }

      // Scan for individual plugin settings
      try {
        const pluginEntries = await fs.readdir(pluginsPath, { withFileTypes: true });
        for (const entry of pluginEntries) {
          if (entry.isDirectory()) {
            const pluginName = entry.name;
            const dataJsonPath = join(pluginsPath, pluginName, 'data.json');
            
            try {
              const dataContent = await fs.readFile(dataJsonPath, 'utf-8');
              settings[pluginName] = JSON.parse(dataContent);
            } catch {
              // Plugin data file doesn't exist or can't be parsed
            }
          }
        }
      } catch {
        // Plugins directory doesn't exist
      }
    } catch {
      // .obsidian directory doesn't exist
    }

    return settings;
  }

  /**
   * Calculate vault statistics
   */
  private async calculateVaultStats(vaultPath: string): Promise<{ totalFiles: number; totalSize: number }> {
    let totalFiles = 0;
    let totalSize = 0;

    try {
      await this.calculateStatsRecursive(vaultPath, (stats) => {
        totalFiles += stats.files;
        totalSize += stats.size;
      });
    } catch {
      // If calculation fails, return zeros
    }

    return { totalFiles, totalSize };
  }

  /**
   * Recursive helper for calculating stats
   */
  private async calculateStatsRecursive(
    dirPath: string, 
    callback: (stats: { files: number; size: number }) => void,
    maxDepth: number = 5,
    currentDepth: number = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files = 0;
      let size = 0;

      for (const entry of entries) {
        // Skip hidden directories and common non-content directories
        if (entry.name.startsWith('.') || 
            ['node_modules', '.git', '.opencode', '.claude'].includes(entry.name)) {
          continue;
        }

        const fullPath = join(dirPath, entry.name);
        
        if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            files++;
            size += stats.size;
          } catch {
            // Skip files we can't stat
          }
        } else if (entry.isDirectory()) {
          await this.calculateStatsRecursive(fullPath, callback, maxDepth, currentDepth + 1);
        }
      }

      callback({ files, size });
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Count markdown files in directory
   */
  private async countMarkdownFiles(dirPath: string, maxDepth: number = 3): Promise<number> {
    let count = 0;
    
    try {
      await this.countMarkdownRecursive(dirPath, (fileCount) => {
        count += fileCount;
      }, maxDepth);
    } catch {
      // If counting fails, return 0
    }

    return count;
  }

  /**
   * Recursive helper for counting markdown files
   */
  private async countMarkdownRecursive(
    dirPath: string,
    callback: (count: number) => void,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let markdownFiles = 0;

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(dirPath, entry.name);
        
        if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          markdownFiles++;
        } else if (entry.isDirectory()) {
          await this.countMarkdownRecursive(fullPath, callback, maxDepth, currentDepth + 1);
        }
      }

      callback(markdownFiles);
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Get cached analysis if available and not expired
   */
  private getCachedAnalysis(vaultPath: string): VaultCacheEntry | null {
    const cached = this.cache.get(vaultPath);
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(vaultPath);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache vault analysis result with memory optimization
   */
  private cacheAnalysis(vaultPath: string, vaultInfo: VaultInfo): void {
    // Clean up old entries if cache is getting too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(vaultPath, {
      vaultInfo,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
    
    // Optimize cache sizes based on memory pressure
    this.optimizeCacheUsage();
  }

  /**
   * Optimize cache usage based on memory pressure
   */
  private optimizeCacheUsage(): void {
    const cacheSize = this.cache.size * 1024; // Rough estimate in bytes
    
    this.memoryOptimizer.optimizeCacheSizes([{
      name: 'VaultAnalyzer',
      size: cacheSize,
      clear: () => this.cache.clear()
    }]);
  }

  /**
   * Clear cache for a specific vault or all vaults
   */
  clearCache(vaultPath?: string): void {
    if (vaultPath) {
      this.cache.delete(resolve(vaultPath));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; entries: Array<{ path: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      age: now - entry.timestamp
    }));

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries
    };
  }
}

/**
 * Session context manager
 */
export class SessionContextManager {
  private vaultAnalyzer: VaultAnalyzer;

  constructor() {
    this.vaultAnalyzer = new VaultAnalyzer();
  }

  /**
   * Generate vault-specific context for session compaction
   */
  async generateVaultContext(session: Session): Promise<StandardToolResult<Part[]>> {
    const startTime = Date.now();
    
    try {
      // Analyze the session directory
      const vaultAnalysis = await this.vaultAnalyzer.analyzeVault(session.directory);
      
      if (!vaultAnalysis.success) {
        return createErrorResult(
          vaultAnalysis.error!.code,
          vaultAnalysis.error!.message,
          vaultAnalysis.error!.details,
          { duration: Date.now() - startTime }
        );
      }

      const vaultInfo = vaultAnalysis.data!;
      const contextParts: Part[] = [];

      if (vaultInfo.isVault) {
        // Add vault information context
        contextParts.push({
          type: 'text',
          content: this.formatVaultContext(vaultInfo)
        });

        // Add PARA structure context if available
        if (this.hasPARAStructure(vaultInfo.paraStructure)) {
          contextParts.push({
            type: 'text',
            content: this.formatPARAContext(vaultInfo.paraStructure)
          });
        }

        // Add recent activity context
        const recentActivity = await this.getRecentActivity(vaultInfo.vaultPath);
        if (recentActivity.length > 0) {
          contextParts.push({
            type: 'text',
            content: this.formatRecentActivityContext(recentActivity)
          });
        }
      } else {
        // Add non-vault directory context
        contextParts.push({
          type: 'text',
          content: this.formatNonVaultContext(session.directory)
        });
      }

      return createSuccessResult(contextParts, {
        duration: Date.now() - startTime,
        warnings: contextParts.length === 0 ? ['No context generated'] : undefined
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.COMPACTION_ERROR,
        `Context generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { session, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Format vault information as context text
   */
  private formatVaultContext(vaultInfo: VaultInfo): string {
    const lines = [
      '## Vault Context',
      '',
      `**Vault Path:** ${vaultInfo.vaultPath}`,
      `**Total Files:** ${vaultInfo.totalFiles}`,
      `**Total Size:** ${this.formatBytes(vaultInfo.totalSize)}`,
      ''
    ];

    // Add plugin information if available
    if (vaultInfo.pluginSettings.communityPlugins && vaultInfo.pluginSettings.communityPlugins.length > 0) {
      lines.push('**Active Plugins:**');
      for (const plugin of vaultInfo.pluginSettings.communityPlugins.slice(0, 10)) {
        lines.push(`- ${plugin}`);
      }
      if (vaultInfo.pluginSettings.communityPlugins.length > 10) {
        lines.push(`- ... and ${vaultInfo.pluginSettings.communityPlugins.length - 10} more`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format PARA structure as context text
   */
  private formatPARAContext(paraStructure: PARAConfig): string {
    const lines = [
      '## PARA Structure',
      ''
    ];

    const categories = [
      { name: 'Projects', folders: paraStructure.projects },
      { name: 'Areas', folders: paraStructure.areas },
      { name: 'Resources', folders: paraStructure.resources },
      { name: 'Archive', folders: paraStructure.archive },
      { name: 'Inbox', folders: paraStructure.inbox }
    ];

    for (const category of categories) {
      if (category.folders.length > 0) {
        lines.push(`**${category.name}:**`);
        for (const folder of category.folders) {
          lines.push(`- ${folder}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format recent activity as context text
   */
  private formatRecentActivityContext(recentFiles: string[]): string {
    const lines = [
      '## Recent Activity',
      '',
      '**Recently Modified Files:**'
    ];

    for (const file of recentFiles.slice(0, 10)) {
      lines.push(`- ${file}`);
    }

    if (recentFiles.length > 10) {
      lines.push(`- ... and ${recentFiles.length - 10} more files`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format non-vault directory context
   */
  private formatNonVaultContext(directoryPath: string): string {
    return [
      '## Directory Context',
      '',
      `**Current Directory:** ${directoryPath}`,
      '**Note:** This directory is not detected as an Obsidian vault.',
      ''
    ].join('\n');
  }

  /**
   * Check if PARA structure exists
   */
  private hasPARAStructure(paraStructure: PARAConfig): boolean {
    return Object.values(paraStructure).some(folders => folders.length > 0);
  }

  /**
   * Get recent activity in the vault
   */
  private async getRecentActivity(vaultPath: string): Promise<string[]> {
    const recentFiles: Array<{ path: string; mtime: Date }> = [];
    
    try {
      await this.scanForRecentFiles(vaultPath, recentFiles, 3);
      
      // Sort by modification time (most recent first)
      recentFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      return recentFiles.slice(0, 20).map(file => file.path);
    } catch {
      return [];
    }
  }

  /**
   * Recursively scan for recently modified files
   */
  private async scanForRecentFiles(
    dirPath: string,
    results: Array<{ path: string; mtime: Date }>,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(dirPath, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          
          if (entry.isFile() && stats.mtime > oneWeekAgo) {
            results.push({
              path: relative(dirPath, fullPath),
              mtime: stats.mtime
            });
          } else if (entry.isDirectory()) {
            await this.scanForRecentFiles(fullPath, results, maxDepth, currentDepth + 1);
          }
        } catch {
          // Skip files/directories we can't access
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Format bytes as human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
/**
 * Session Manager Plugin
 */
export const sessionManagerPlugin = async ({ client, $, directory }: any) => {
  const vaultAnalyzer = new VaultAnalyzer();
  const contextManager = new SessionContextManager();

  return {
    tools: {
      detect_vault: {
        description: "Detect if the current directory is an Obsidian vault",
        parameters: {
          type: "object",
          properties: {
            directoryPath: {
              type: "string",
              description: "Path to the directory to analyze (defaults to current directory)",
              default: directory
            }
          },
          required: []
        },
        handler: async ({ directoryPath = directory }: { directoryPath?: string }) => {
          return await vaultAnalyzer.detectVault(directoryPath);
        }
      },

      analyze_vault: {
        description: "Analyze vault structure and return comprehensive information",
        parameters: {
          type: "object",
          properties: {
            vaultPath: {
              type: "string",
              description: "Path to the vault to analyze (defaults to current directory)",
              default: directory
            },
            useCache: {
              type: "boolean",
              description: "Whether to use cached analysis if available",
              default: true
            }
          },
          required: []
        },
        handler: async ({ vaultPath = directory, useCache = true }: { vaultPath?: string; useCache?: boolean }) => {
          return await vaultAnalyzer.analyzeVault(vaultPath, useCache);
        }
      },

      get_vault_context: {
        description: "Generate vault-specific context for the current session",
        parameters: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID to generate context for"
            }
          },
          required: ["sessionId"]
        },
        handler: async ({ sessionId }: { sessionId: string }) => {
          // Create a mock session object for context generation
          const session: Session = {
            id: sessionId,
            agent: 'default',
            model: { provider: 'openai', model: 'gpt-4' },
            directory: directory,
            created: Date.now(),
            state: {}
          };

          return await contextManager.generateVaultContext(session);
        }
      },

      clear_vault_cache: {
        description: "Clear the vault analysis cache",
        parameters: {
          type: "object",
          properties: {
            vaultPath: {
              type: "string",
              description: "Specific vault path to clear from cache (clears all if not specified)"
            }
          },
          required: []
        },
        handler: async ({ vaultPath }: { vaultPath?: string }) => {
          const startTime = Date.now();
          
          try {
            vaultAnalyzer.clearCache(vaultPath);
            
            return createSuccessResult(
              { 
                message: vaultPath ? `Cache cleared for ${vaultPath}` : 'All cache cleared',
                clearedPath: vaultPath || 'all'
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { vaultPath, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      get_cache_stats: {
        description: "Get vault analysis cache statistics",
        parameters: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => {
          const startTime = Date.now();
          
          try {
            const stats = vaultAnalyzer.getCacheStats();
            
            return createSuccessResult(
              stats,
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { error },
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    hooks: {
      "session.created": async (context: { session: Session }) => {
        // Automatically analyze vault when session is created
        try {
          const vaultAnalysis = await vaultAnalyzer.analyzeVault(context.session.directory);
          
          if (vaultAnalysis.success && vaultAnalysis.data?.isVault) {
            console.log(`Session created in Obsidian vault: ${context.session.directory}`);
            console.log(`PARA structure detected:`, vaultAnalysis.data.paraStructure);
          } else {
            console.log(`Session created in non-vault directory: ${context.session.directory}`);
          }
        } catch (error) {
          console.warn('Failed to analyze vault during session creation:', error);
        }
      },

      "experimental.session.compacting": async (context: SessionCompactionContext) => {
        // Inject vault-specific context during session compaction
        try {
          const vaultContextResult = await contextManager.generateVaultContext(context.session);
          
          if (vaultContextResult.success && vaultContextResult.data) {
            // Prepend vault context to the existing context
            const vaultContextParts = vaultContextResult.data;
            const updatedContext = [...vaultContextParts, ...context.context];
            
            return { context: updatedContext };
          }
        } catch (error) {
          console.warn('Failed to inject vault context during compaction:', error);
        }
        
        // Return original context if vault context injection fails
        return { context: context.context };
      }
    }
  };
};

export default sessionManagerPlugin;