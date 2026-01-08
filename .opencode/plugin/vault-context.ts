/**
 * Vault Context Plugin for OpenCode
 * Provides secure file operations within vault boundaries
 * 
 * This plugin implements the core vault context functionality including:
 * - Secure file operations within vault boundaries
 * - Path validation and jail enforcement
 * - File content reading and writing
 * - Directory listing and content search
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

// Note: Plugin type will be provided by OpenCode runtime
// import type { Plugin } from "@opencode-ai/plugin";
import { promises as fs } from 'node:fs';
import { resolve, normalize, relative, join, dirname, basename } from 'node:path';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';

/**
 * Protected directories that should be blocked from access
 */
const PROTECTED_DIRECTORIES = [
  '.obsidian',
  '.git', 
  'node_modules',
  '.opencode',
  '.claude'
];

/**
 * Path validation utilities
 */
export class PathValidator {
  private vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = resolve(vaultRoot);
  }

  /**
   * Validate that a path is within vault boundaries and not protected
   */
  async validatePath(inputPath: string): Promise<StandardToolResult<string>> {
    try {
      // Normalize and resolve the path
      const normalizedPath = normalize(inputPath);
      const resolvedPath = resolve(this.vaultRoot, normalizedPath);

      // Check if path is within vault boundaries
      const relativePath = relative(this.vaultRoot, resolvedPath);
      if (relativePath.startsWith('..') || resolve(relativePath) === resolve('..')) {
        return createErrorResult(
          ErrorCode.JAIL_VIOLATION,
          `Path '${inputPath}' attempts to access outside vault root`,
          { inputPath, resolvedPath, vaultRoot: this.vaultRoot }
        );
      }

      // Check for protected directories
      const pathParts = relativePath.split('/').filter(part => part !== '');
      for (const part of pathParts) {
        if (PROTECTED_DIRECTORIES.includes(part) || PROTECTED_DIRECTORIES.some(protectedDir => part.startsWith(protectedDir))) {
          return createErrorResult(
            ErrorCode.PROTECTED_PATH,
            `Path '${inputPath}' attempts to access protected directory '${part}'`,
            { inputPath, protectedDirectory: part }
          );
        }
      }

      // Resolve symlinks and validate the target
      try {
        const realPath = await fs.realpath(resolvedPath);
        const realRelativePath = relative(this.vaultRoot, realPath);
        
        if (realRelativePath.startsWith('..') || resolve(realRelativePath) === resolve('..')) {
          return createErrorResult(
            ErrorCode.JAIL_VIOLATION,
            `Symlink '${inputPath}' resolves to path outside vault root`,
            { inputPath, resolvedPath, realPath, vaultRoot: this.vaultRoot }
          );
        }
      } catch (error) {
        // If realpath fails, the file doesn't exist yet, which is okay for write operations
        // We'll just use the resolved path
      }

      return createSuccessResult(resolvedPath);
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Path validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { inputPath, error }
      );
    }
  }

  /**
   * Get the vault root path
   */
  getVaultRoot(): string {
    return this.vaultRoot;
  }
}

/**
 * File operation utilities
 */
export class FileOperations {
  private pathValidator: PathValidator;

  constructor(vaultRoot: string) {
    this.pathValidator = new PathValidator(vaultRoot);
  }

  /**
   * Read file content with metadata
   */
  async readFile(filePath: string): Promise<StandardToolResult<{ content: string; metadata: any }>> {
    const startTime = Date.now();
    
    // Validate path
    const pathValidation = await this.pathValidator.validatePath(filePath);
    if (!pathValidation.success) {
      return createErrorResult(
        pathValidation.error!.code,
        pathValidation.error!.message,
        pathValidation.error!.details,
        { duration: Date.now() - startTime }
      );
    }

    const resolvedPath = pathValidation.data!;

    try {
      // Check if file exists and is readable
      await fs.access(resolvedPath, fs.constants.R_OK);
      
      // Read file content
      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      // Get file stats for metadata
      const stats = await fs.stat(resolvedPath);
      
      const metadata = {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        path: relative(this.pathValidator.getVaultRoot(), resolvedPath)
      };

      return createSuccessResult(
        { content, metadata },
        { 
          duration: Date.now() - startTime,
          warnings: content.length > 1000000 ? ['Large file detected'] : undefined
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to read file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, resolvedPath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Write file content with safety checks
   */
  async writeFile(filePath: string, content: string, options?: { createDirectories?: boolean }): Promise<StandardToolResult<{ path: string; size: number }>> {
    const startTime = Date.now();
    
    // Validate path
    const pathValidation = await this.pathValidator.validatePath(filePath);
    if (!pathValidation.success) {
      return createErrorResult(
        pathValidation.error!.code,
        pathValidation.error!.message,
        pathValidation.error!.details,
        { duration: Date.now() - startTime }
      );
    }

    const resolvedPath = pathValidation.data!;

    try {
      // Create directories if requested
      if (options?.createDirectories) {
        const dir = dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Write file content
      await fs.writeFile(resolvedPath, content, 'utf-8');
      
      // Get file stats
      const stats = await fs.stat(resolvedPath);
      
      return createSuccessResult(
        { 
          path: relative(this.pathValidator.getVaultRoot(), resolvedPath),
          size: stats.size
        },
        { 
          duration: Date.now() - startTime,
          warnings: content.length > 1000000 ? ['Large file written'] : undefined
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to write file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, resolvedPath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * List files with pattern matching
   */
  async listFiles(dirPath: string, options?: { 
    pattern?: string; 
    recursive?: boolean; 
    includeDirectories?: boolean;
    maxDepth?: number;
  }): Promise<StandardToolResult<Array<{ name: string; path: string; isDirectory: boolean; size?: number }>>> {
    const startTime = Date.now();
    
    // Validate path
    const pathValidation = await this.pathValidator.validatePath(dirPath);
    if (!pathValidation.success) {
      return createErrorResult(
        pathValidation.error!.code,
        pathValidation.error!.message,
        pathValidation.error!.details,
        { duration: Date.now() - startTime }
      );
    }

    const resolvedPath = pathValidation.data!;

    try {
      const results: Array<{ name: string; path: string; isDirectory: boolean; size?: number }> = [];
      
      await this.listFilesRecursive(
        resolvedPath, 
        results, 
        options?.pattern,
        options?.recursive ?? false,
        options?.includeDirectories ?? true,
        options?.maxDepth ?? 10,
        0
      );

      return createSuccessResult(
        results,
        { 
          duration: Date.now() - startTime,
          warnings: results.length > 1000 ? ['Large directory listing'] : undefined
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to list files in '${dirPath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        { dirPath, resolvedPath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Recursive file listing helper
   */
  private async listFilesRecursive(
    dirPath: string,
    results: Array<{ name: string; path: string; isDirectory: boolean; size?: number }>,
    pattern?: string,
    recursive: boolean = false,
    includeDirectories: boolean = true,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(this.pathValidator.getVaultRoot(), fullPath);
      
      // Skip protected directories
      if (PROTECTED_DIRECTORIES.includes(entry.name)) {
        continue;
      }

      // Apply pattern matching if specified
      if (pattern && !entry.name.includes(pattern)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (includeDirectories) {
          results.push({
            name: entry.name,
            path: relativePath,
            isDirectory: true
          });
        }
        
        if (recursive) {
          await this.listFilesRecursive(
            fullPath, 
            results, 
            pattern, 
            recursive, 
            includeDirectories, 
            maxDepth, 
            currentDepth + 1
          );
        }
      } else {
        const stats = await fs.stat(fullPath);
        results.push({
          name: entry.name,
          path: relativePath,
          isDirectory: false,
          size: stats.size
        });
      }
    }
  }

  /**
   * Search file content
   */
  async searchContent(
    searchPath: string, 
    query: string, 
    options?: { 
      caseSensitive?: boolean; 
      wholeWord?: boolean; 
      filePattern?: string;
      maxResults?: number;
    }
  ): Promise<StandardToolResult<Array<{ file: string; matches: Array<{ line: number; content: string; column: number }> }>>> {
    const startTime = Date.now();
    
    // Validate path
    const pathValidation = await this.pathValidator.validatePath(searchPath);
    if (!pathValidation.success) {
      return createErrorResult(
        pathValidation.error!.code,
        pathValidation.error!.message,
        pathValidation.error!.details,
        { duration: Date.now() - startTime }
      );
    }

    const resolvedPath = pathValidation.data!;
    const maxResults = options?.maxResults ?? 100;
    const results: Array<{ file: string; matches: Array<{ line: number; content: string; column: number }> }> = [];

    try {
      await this.searchInDirectory(resolvedPath, query, options, results, maxResults);

      return createSuccessResult(
        results,
        { 
          duration: Date.now() - startTime,
          warnings: results.length >= maxResults ? ['Search results truncated'] : undefined
        }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to search content in '${searchPath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        { searchPath, resolvedPath, query, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Search in directory helper
   */
  private async searchInDirectory(
    dirPath: string,
    query: string,
    options: any,
    results: Array<{ file: string; matches: Array<{ line: number; content: string; column: number }> }>,
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) {
      return;
    }

    const stats = await fs.stat(dirPath);
    
    if (stats.isFile()) {
      await this.searchInFile(dirPath, query, options, results);
    } else if (stats.isDirectory()) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) {
          break;
        }
        
        // Skip protected directories
        if (PROTECTED_DIRECTORIES.includes(entry.name)) {
          continue;
        }

        const fullPath = join(dirPath, entry.name);
        
        if (entry.isFile()) {
          // Apply file pattern if specified
          if (options?.filePattern && !entry.name.includes(options.filePattern)) {
            continue;
          }
          
          await this.searchInFile(fullPath, query, options, results);
        } else if (entry.isDirectory()) {
          await this.searchInDirectory(fullPath, query, options, results, maxResults);
        }
      }
    }
  }

  /**
   * Search in single file
   */
  private async searchInFile(
    filePath: string,
    query: string,
    options: any,
    results: Array<{ file: string; matches: Array<{ line: number; content: string; column: number }> }>
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: Array<{ line: number; content: string; column: number }> = [];
      
      const searchQuery = options?.caseSensitive ? query : query.toLowerCase();
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const searchLine = options?.caseSensitive ? line : line.toLowerCase();
        
        let searchIndex = 0;
        while (true) {
          const index = searchLine.indexOf(searchQuery, searchIndex);
          if (index === -1) break;
          
          // Check for whole word match if requested
          if (options?.wholeWord) {
            const before = index > 0 ? searchLine[index - 1] : ' ';
            const after = index + searchQuery.length < searchLine.length ? searchLine[index + searchQuery.length] : ' ';
            
            if (!/\W/.test(before) || !/\W/.test(after)) {
              searchIndex = index + 1;
              continue;
            }
          }
          
          matches.push({
            line: i + 1,
            content: line,
            column: index + 1
          });
          
          searchIndex = index + 1;
        }
      }
      
      if (matches.length > 0) {
        results.push({
          file: relative(this.pathValidator.getVaultRoot(), filePath),
          matches
        });
      }
    } catch (error) {
      // Skip files that can't be read (binary files, permission issues, etc.)
    }
  }

  /**
   * Scan multiple context paths
   */
  async scanContextPaths(paths: string[]): Promise<StandardToolResult<Array<{ path: string; exists: boolean; type: 'file' | 'directory' | 'unknown'; content?: string }>>> {
    const startTime = Date.now();
    const results: Array<{ path: string; exists: boolean; type: 'file' | 'directory' | 'unknown'; content?: string }> = [];
    
    for (const path of paths) {
      try {
        // Validate path
        const pathValidation = await this.pathValidator.validatePath(path);
        if (!pathValidation.success) {
          results.push({
            path,
            exists: false,
            type: 'unknown'
          });
          continue;
        }

        const resolvedPath = pathValidation.data!;
        
        try {
          const stats = await fs.stat(resolvedPath);
          
          if (stats.isFile()) {
            // Read file content if it's a text file and not too large
            let content: string | undefined;
            if (stats.size < 100000) { // 100KB limit
              try {
                content = await fs.readFile(resolvedPath, 'utf-8');
              } catch {
                // Skip binary files or files with encoding issues
              }
            }
            
            results.push({
              path: relative(this.pathValidator.getVaultRoot(), resolvedPath),
              exists: true,
              type: 'file',
              content
            });
          } else if (stats.isDirectory()) {
            results.push({
              path: relative(this.pathValidator.getVaultRoot(), resolvedPath),
              exists: true,
              type: 'directory'
            });
          } else {
            results.push({
              path: relative(this.pathValidator.getVaultRoot(), resolvedPath),
              exists: true,
              type: 'unknown'
            });
          }
        } catch {
          results.push({
            path,
            exists: false,
            type: 'unknown'
          });
        }
      } catch {
        results.push({
          path,
          exists: false,
          type: 'unknown'
        });
      }
    }

    return createSuccessResult(
      results,
      { 
        duration: Date.now() - startTime,
        warnings: results.length > 50 ? ['Large number of paths scanned'] : undefined
      }
    );
  }
}

/**
 * Vault Context Plugin
 */
export const vaultContextPlugin = async ({ client, $, directory }: any) => {
  const fileOps = new FileOperations(directory);

  return {
    tools: {
      vault_read_file: {
        description: "Read file content with metadata from within the vault",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to read (relative to vault root)"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          return await fileOps.readFile(filePath);
        }
      },

      vault_write_file: {
        description: "Write file content with safety checks within the vault",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to write (relative to vault root)"
            },
            content: {
              type: "string",
              description: "Content to write to the file"
            },
            createDirectories: {
              type: "boolean",
              description: "Whether to create parent directories if they don't exist",
              default: false
            }
          },
          required: ["filePath", "content"]
        },
        handler: async ({ filePath, content, createDirectories }: { filePath: string; content: string; createDirectories?: boolean }) => {
          return await fileOps.writeFile(filePath, content, { createDirectories });
        }
      },

      vault_list_files: {
        description: "List files with pattern matching within the vault",
        parameters: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "Directory path to list (relative to vault root)"
            },
            pattern: {
              type: "string",
              description: "Optional pattern to filter files"
            },
            recursive: {
              type: "boolean",
              description: "Whether to list files recursively",
              default: false
            },
            includeDirectories: {
              type: "boolean",
              description: "Whether to include directories in the results",
              default: true
            },
            maxDepth: {
              type: "number",
              description: "Maximum depth for recursive listing",
              default: 10
            }
          },
          required: ["dirPath"]
        },
        handler: async ({ dirPath, pattern, recursive, includeDirectories, maxDepth }: { 
          dirPath: string; 
          pattern?: string; 
          recursive?: boolean; 
          includeDirectories?: boolean;
          maxDepth?: number;
        }) => {
          return await fileOps.listFiles(dirPath, { pattern, recursive, includeDirectories, maxDepth });
        }
      },

      vault_search_content: {
        description: "Search file content within the vault",
        parameters: {
          type: "object",
          properties: {
            searchPath: {
              type: "string",
              description: "Path to search in (file or directory, relative to vault root)"
            },
            query: {
              type: "string",
              description: "Search query string"
            },
            caseSensitive: {
              type: "boolean",
              description: "Whether the search should be case sensitive",
              default: false
            },
            wholeWord: {
              type: "boolean",
              description: "Whether to match whole words only",
              default: false
            },
            filePattern: {
              type: "string",
              description: "Optional pattern to filter files to search"
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results to return",
              default: 100
            }
          },
          required: ["searchPath", "query"]
        },
        handler: async ({ searchPath, query, caseSensitive, wholeWord, filePattern, maxResults }: {
          searchPath: string;
          query: string;
          caseSensitive?: boolean;
          wholeWord?: boolean;
          filePattern?: string;
          maxResults?: number;
        }) => {
          return await fileOps.searchContent(searchPath, query, { caseSensitive, wholeWord, filePattern, maxResults });
        }
      },

      vault_scan_context_paths: {
        description: "Scan multiple paths for context information within the vault",
        parameters: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of paths to scan (relative to vault root)"
            }
          },
          required: ["paths"]
        },
        handler: async ({ paths }: { paths: string[] }) => {
          return await fileOps.scanContextPaths(paths);
        }
      }
    }
  };
};

export default vaultContextPlugin;