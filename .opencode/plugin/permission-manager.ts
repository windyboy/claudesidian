/**
 * Permission Manager Plugin for OpenCode
 * Provides security and permission management for command execution
 * 
 * This plugin implements the core permission management functionality including:
 * - Command whitelist validation
 * - Bypass attempt detection
 * - Permission request handling
 * - Security policy enforcement
 * 
 * Requirements: 3.1, 3.2
 */

import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult, AllowedCommand } from './types';

/**
 * Command token types for parsing
 */
export enum TokenType {
  COMMAND = 'COMMAND',
  ARGUMENT = 'ARGUMENT',
  FLAG = 'FLAG',
  VALUE = 'VALUE',
  PIPE = 'PIPE',
  REDIRECT = 'REDIRECT',
  BACKGROUND = 'BACKGROUND',
  SEPARATOR = 'SEPARATOR'
}

/**
 * Parsed command token
 */
export interface CommandToken {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  pipes: ParsedCommand[];
  redirects: Array<{ type: string; target: string }>;
  background: boolean;
  raw: string;
}

/**
 * Security analysis result
 */
export interface SecurityAnalysis {
  safe: boolean;
  violations: Array<{
    type: 'INJECTION' | 'ENCODING' | 'BYPASS' | 'WHITELIST';
    message: string;
    position?: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  warnings: string[];
}

/**
 * Command parser with tokenization support
 */
export class CommandParser {
  private static readonly DANGEROUS_CHARS = [';', '&', '|', '`', '$', '(', ')', '{', '}', '<', '>', '\\'];
  private static readonly SHELL_METACHARACTERS = ['*', '?', '[', ']', '~'];
  private static readonly ENCODING_PATTERNS = [
    /(?:%[0-9a-fA-F]{2})+/g,  // URL encoding
    /(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,  // Base64
    /\\x[0-9a-fA-F]{2}/g,     // Hex encoding
    /\\[0-7]{3}/g,            // Octal encoding
    /\\u[0-9a-fA-F]{4}/g      // Unicode encoding
  ];

  /**
   * Tokenize a command string into structured tokens
   */
  static tokenize(command: string): CommandToken[] {
    const tokens: CommandToken[] = [];
    let position = 0;
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
        continue;
      }

      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
        continue;
      }

      if (inQuotes) {
        current += char;
        continue;
      }

      // Handle special characters
      if (char === ' ' || char === '\t') {
        if (current.trim()) {
          tokens.push(this.createToken(current.trim(), position));
          current = '';
        }
        this.skipWhitespace(command, i);
        position = i + 1;
        continue;
      }

      if (this.isSpecialChar(char)) {
        if (current.trim()) {
          tokens.push(this.createToken(current.trim(), position));
          current = '';
        }
        
        // Handle multi-character operators
        const operator = this.getOperator(command, i);
        tokens.push({
          type: this.getOperatorType(operator),
          value: operator,
          position: i
        });
        
        i += operator.length - 1;
        position = i + 1;
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      tokens.push(this.createToken(current.trim(), position));
    }

    return tokens;
  }

  /**
   * Parse tokenized command into structured format
   */
  static parse(command: string): ParsedCommand {
    const tokens = this.tokenize(command);
    const result: ParsedCommand = {
      command: '',
      args: [],
      flags: {},
      pipes: [],
      redirects: [],
      background: false,
      raw: command
    };

    if (tokens.length === 0) {
      return result;
    }

    // First token should be the command
    result.command = tokens[0].value;
    
    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];
      
      switch (token.type) {
        case TokenType.FLAG:
          // Handle flags with optional values
          const flagValue = token.value;
          if (flagValue.startsWith('--')) {
            // Long flag (--flag)
            const flagName = flagValue.replace(/^--/, '');
            if (i + 1 < tokens.length && tokens[i + 1].type === TokenType.VALUE) {
              result.flags[flagName] = tokens[i + 1].value;
              i += 2;
            } else {
              result.flags[flagName] = true;
              i++;
            }
          } else if (flagValue.startsWith('-') && flagValue.length > 2) {
            // Combined short flags (-la = -l -a)
            const flagChars = flagValue.substring(1);
            for (const char of flagChars) {
              result.flags[char] = true;
            }
            i++;
          } else {
            // Single short flag (-l)
            const flagName = flagValue.replace(/^-/, '');
            if (i + 1 < tokens.length && tokens[i + 1].type === TokenType.VALUE) {
              result.flags[flagName] = tokens[i + 1].value;
              i += 2;
            } else {
              result.flags[flagName] = true;
              i++;
            }
          }
          break;
          
        case TokenType.ARGUMENT:
          result.args.push(token.value);
          i++;
          break;
          
        case TokenType.PIPE:
          // Parse the rest as a new command
          const remainingTokens = tokens.slice(i + 1);
          if (remainingTokens.length > 0) {
            const pipeCommand = remainingTokens.map(t => t.value).join(' ');
            result.pipes.push(this.parse(pipeCommand));
          }
          return result;
          
        case TokenType.REDIRECT:
          if (i + 1 < tokens.length) {
            result.redirects.push({
              type: token.value,
              target: tokens[i + 1].value
            });
            i += 2;
          } else {
            i++;
          }
          break;
          
        case TokenType.BACKGROUND:
          result.background = true;
          i++;
          break;
          
        default:
          result.args.push(token.value);
          i++;
          break;
      }
    }

    return result;
  }

  /**
   * Create a token with appropriate type classification
   */
  private static createToken(value: string, position: number): CommandToken {
    if (value.startsWith('-')) {
      return { type: TokenType.FLAG, value, position };
    }
    
    return { type: TokenType.ARGUMENT, value, position };
  }

  /**
   * Check if character is a special shell character
   */
  private static isSpecialChar(char: string): boolean {
    return ['|', '&', '>', '<', ';'].includes(char);
  }

  /**
   * Get multi-character operator starting at position
   */
  private static getOperator(command: string, position: number): string {
    const char = command[position];
    const nextChar = position + 1 < command.length ? command[position + 1] : '';
    
    // Check for two-character operators
    const twoChar = char + nextChar;
    if (['&&', '||', '>>', '<<'].includes(twoChar)) {
      return twoChar;
    }
    
    return char;
  }

  /**
   * Get token type for operator
   */
  private static getOperatorType(operator: string): TokenType {
    switch (operator) {
      case '|':
        return TokenType.PIPE;
      case '&':
        return TokenType.BACKGROUND;
      case '&&':
      case '||':
      case ';':
        return TokenType.SEPARATOR;
      case '>':
      case '>>':
      case '<':
      case '<<':
        return TokenType.REDIRECT;
      default:
        return TokenType.ARGUMENT;
    }
  }

  /**
   * Skip whitespace characters
   */
  private static skipWhitespace(command: string, start: number): number {
    let i = start;
    while (i < command.length && /\s/.test(command[i])) {
      i++;
    }
    return i;
  }

  /**
   * Detect potential command injection attempts
   */
  static detectInjection(command: string): SecurityAnalysis {
    const violations: SecurityAnalysis['violations'] = [];
    const warnings: string[] = [];

    // Check for dangerous characters
    for (const char of this.DANGEROUS_CHARS) {
      const index = command.indexOf(char);
      if (index !== -1) {
        violations.push({
          type: 'INJECTION',
          message: `Dangerous character '${char}' detected`,
          position: index,
          severity: 'HIGH'
        });
      }
    }

    // Check for shell metacharacters
    for (const char of this.SHELL_METACHARACTERS) {
      if (command.includes(char)) {
        warnings.push(`Shell metacharacter '${char}' detected - may cause unexpected behavior`);
      }
    }

    // Check for encoding attempts
    for (const pattern of this.ENCODING_PATTERNS) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'ENCODING',
            message: `Potential encoding bypass detected: ${match}`,
            severity: 'MEDIUM'
          });
        }
      }
    }

    // Check for common injection patterns
    const injectionPatterns = [
      /\$\([^)]*\)/g,           // Command substitution
      /`[^`]*`/g,               // Backtick command substitution
      /\${[^}]*}/g,             // Variable expansion
      /\|\s*sh\b/g,             // Pipe to shell
      /\|\s*bash\b/g,           // Pipe to bash
      /\|\s*zsh\b/g,            // Pipe to zsh
      /\beval\s+/g,             // Eval command
      /\bexec\s+/g,             // Exec command
      /\bsource\s+/g,           // Source command
      /\b\.\s+/g,               // Dot command
    ];

    for (const pattern of injectionPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'INJECTION',
            message: `Potential command injection pattern detected: ${match}`,
            severity: 'CRITICAL'
          });
        }
      }
    }

    return {
      safe: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Detect bypass attempts using various encoding techniques
   */
  static detectBypassAttempts(command: string): SecurityAnalysis {
    const violations: SecurityAnalysis['violations'] = [];
    const warnings: string[] = [];

    // Check for URL encoding bypass attempts
    const urlEncodedMatches = command.match(/%[0-9a-fA-F]{2}/g);
    if (urlEncodedMatches) {
      for (const match of urlEncodedMatches) {
        try {
          const decoded = decodeURIComponent(match);
          if (this.DANGEROUS_CHARS.includes(decoded)) {
            violations.push({
              type: 'BYPASS',
              message: `URL encoding bypass attempt detected: ${match} -> ${decoded}`,
              severity: 'HIGH'
            });
          }
        } catch {
          // Invalid URL encoding, but still suspicious
          violations.push({
            type: 'BYPASS',
            message: `Suspicious URL encoding pattern detected: ${match}`,
            severity: 'MEDIUM'
          });
        }
      }
    }

    // Check for Base64 encoding bypass attempts
    const base64Matches = command.match(/(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g);
    if (base64Matches) {
      for (const match of base64Matches) {
        if (match.length > 4) { // Skip short matches that are likely false positives
          try {
            const decoded = Buffer.from(match, 'base64').toString('utf-8');
            if (this.DANGEROUS_CHARS.some(char => decoded.includes(char))) {
              violations.push({
                type: 'BYPASS',
                message: `Base64 encoding bypass attempt detected: ${match}`,
                severity: 'HIGH'
              });
            }
          } catch {
            // Invalid Base64, ignore
          }
        }
      }
    }

    // Check for hex encoding bypass attempts
    const hexMatches = command.match(/\\x[0-9a-fA-F]{2}/g);
    if (hexMatches) {
      for (const match of hexMatches) {
        const hexValue = match.substring(2);
        const decoded = String.fromCharCode(parseInt(hexValue, 16));
        if (this.DANGEROUS_CHARS.includes(decoded)) {
          violations.push({
            type: 'BYPASS',
            message: `Hex encoding bypass attempt detected: ${match} -> ${decoded}`,
            severity: 'HIGH'
          });
        }
      }
    }

    // Check for Unicode encoding bypass attempts
    const unicodeMatches = command.match(/\\u[0-9a-fA-F]{4}/g);
    if (unicodeMatches) {
      for (const match of unicodeMatches) {
        const unicodeValue = match.substring(2);
        const decoded = String.fromCharCode(parseInt(unicodeValue, 16));
        if (this.DANGEROUS_CHARS.includes(decoded)) {
          violations.push({
            type: 'BYPASS',
            message: `Unicode encoding bypass attempt detected: ${match} -> ${decoded}`,
            severity: 'HIGH'
          });
        }
      }
    }

    // Check for octal encoding bypass attempts
    const octalMatches = command.match(/\\[0-7]{3}/g);
    if (octalMatches) {
      for (const match of octalMatches) {
        const octalValue = match.substring(1);
        const decoded = String.fromCharCode(parseInt(octalValue, 8));
        if (this.DANGEROUS_CHARS.includes(decoded)) {
          violations.push({
            type: 'BYPASS',
            message: `Octal encoding bypass attempt detected: ${match} -> ${decoded}`,
            severity: 'HIGH'
          });
        }
      }
    }

    // Check for environment variable manipulation
    const envVarPatterns = [
      /\$\{[^}]*PATH[^}]*\}/g,    // PATH manipulation
      /\$\{[^}]*LD_[^}]*\}/g,     // LD_* manipulation
      /\$\{[^}]*SHELL[^}]*\}/g,   // SHELL manipulation
      /\$PATH/g,                  // Direct PATH reference
      /\$LD_/g,                   // Direct LD_* reference
      /\$SHELL/g                  // Direct SHELL reference
    ];

    for (const pattern of envVarPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'BYPASS',
            message: `Environment variable manipulation detected: ${match}`,
            severity: 'MEDIUM'
          });
        }
      }
    }

    // Check for path traversal attempts
    const pathTraversalPatterns = [
      /\.\.\//g,                  // Directory traversal
      /\.\.\\\\/g,                // Windows directory traversal
      /\/etc\/passwd/g,           // System file access
      /\/etc\/shadow/g,           // Shadow file access
      /\/proc\//g,                // Process information access
      /\/sys\//g,                 // System information access
      /\/dev\//g,                 // Device access
      /\/tmp\//g,                 // Temporary directory access
      /\/var\/log\//g,            // Log file access
      /\/root\//g,                // Root directory access
      /\/home\/[^\/]*\/\.[^\/]*/g // Hidden files in home directories
    ];

    for (const pattern of pathTraversalPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'BYPASS',
            message: `Path traversal attempt detected: ${match}`,
            severity: 'HIGH'
          });
        }
      }
    }

    // Check for privilege escalation attempts
    const privEscPatterns = [
      /\bsudo\b/g,                // Sudo usage
      /\bsu\b/g,                  // Switch user
      /\bchmod\s+[0-7]{3,4}/g,    // Permission changes
      /\bchown\b/g,               // Ownership changes
      /\bsetuid\b/g,              // SetUID
      /\bsetgid\b/g,              // SetGID
      /\bumask\b/g,               // Umask changes
    ];

    for (const pattern of privEscPatterns) {
      const matches = command.match(pattern);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'BYPASS',
            message: `Privilege escalation attempt detected: ${match}`,
            severity: 'CRITICAL'
          });
        }
      }
    }

    return {
      safe: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Comprehensive security analysis combining injection and bypass detection
   */
  static performSecurityAnalysis(command: string): SecurityAnalysis {
    const injectionAnalysis = this.detectInjection(command);
    const bypassAnalysis = this.detectBypassAttempts(command);

    return {
      safe: injectionAnalysis.safe && bypassAnalysis.safe,
      violations: [...injectionAnalysis.violations, ...bypassAnalysis.violations],
      warnings: [...injectionAnalysis.warnings, ...bypassAnalysis.warnings]
    };
  }
}

/**
 * Whitelist configuration manager
 */
export class WhitelistManager {
  private allowedCommands: Map<string, AllowedCommand> = new Map();
  private defaultConfig: AllowedCommand[] = [
    // Safe file operations
    { command: 'ls', allowedArgs: ['-la', '-l', '-a'], allowedFlags: ['l', 'a', 'h'], requireApproval: false },
    { command: 'cat', requireApproval: false },
    { command: 'head', allowedFlags: ['n'], requireApproval: false },
    { command: 'tail', allowedFlags: ['n', 'f'], requireApproval: false },
    { command: 'grep', allowedFlags: ['r', 'i', 'n', 'v'], requireApproval: false },
    { command: 'find', allowedFlags: ['name', 'type', 'size'], requireApproval: false },
    
    // Safe system info
    { command: 'pwd', requireApproval: false },
    { command: 'whoami', requireApproval: false },
    { command: 'date', requireApproval: false },
    { command: 'uptime', requireApproval: false },
    
    // Git operations (require approval)
    { command: 'git', allowedArgs: ['status', 'log', 'diff', 'show'], requireApproval: true },
    
    // Node.js operations (require approval)
    { command: 'npm', allowedArgs: ['list', 'info', 'view'], requireApproval: true },
    { command: 'node', allowedFlags: ['version', 'v'], requireApproval: true },
    
    // Text processing
    { command: 'wc', allowedFlags: ['l', 'w', 'c'], requireApproval: false },
    { command: 'sort', allowedFlags: ['r', 'n', 'u'], requireApproval: false },
    { command: 'uniq', allowedFlags: ['c', 'i'], requireApproval: false }
  ];

  constructor(customConfig?: AllowedCommand[]) {
    this.loadConfiguration(customConfig || this.defaultConfig);
  }

  /**
   * Load whitelist configuration
   */
  private loadConfiguration(config: AllowedCommand[]): void {
    this.allowedCommands.clear();
    for (const cmd of config) {
      this.allowedCommands.set(cmd.command, cmd);
    }
  }

  /**
   * Check if a command is whitelisted
   */
  isCommandAllowed(parsedCommand: ParsedCommand): StandardToolResult<{
    allowed: boolean;
    requiresApproval: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];
    const commandConfig = this.allowedCommands.get(parsedCommand.command);

    if (!commandConfig) {
      violations.push(`Command '${parsedCommand.command}' is not in the whitelist`);
      return createSuccessResult({
        allowed: false,
        requiresApproval: false,
        violations
      });
    }

    // Check allowed arguments
    if (commandConfig.allowedArgs) {
      for (const arg of parsedCommand.args) {
        if (!commandConfig.allowedArgs.includes(arg)) {
          violations.push(`Argument '${arg}' is not allowed for command '${parsedCommand.command}'`);
        }
      }
    }

    // Check allowed flags
    if (commandConfig.allowedFlags) {
      for (const flag of Object.keys(parsedCommand.flags)) {
        if (!commandConfig.allowedFlags.includes(flag)) {
          violations.push(`Flag '${flag}' is not allowed for command '${parsedCommand.command}'`);
        }
      }
    }

    // Check for pipes (generally not allowed unless explicitly configured)
    if (parsedCommand.pipes.length > 0) {
      violations.push('Piped commands are not allowed');
    }

    // Check for redirects (generally not allowed unless explicitly configured)
    if (parsedCommand.redirects.length > 0) {
      violations.push('Command redirects are not allowed');
    }

    // Check for background execution
    if (parsedCommand.background) {
      violations.push('Background command execution is not allowed');
    }

    return createSuccessResult({
      allowed: violations.length === 0,
      requiresApproval: commandConfig.requireApproval || false,
      violations
    });
  }

  /**
   * Add or update a command in the whitelist
   */
  addCommand(command: AllowedCommand): void {
    this.allowedCommands.set(command.command, command);
  }

  /**
   * Remove a command from the whitelist
   */
  removeCommand(command: string): void {
    this.allowedCommands.delete(command);
  }

  /**
   * Get all whitelisted commands
   */
  getAllowedCommands(): AllowedCommand[] {
    return Array.from(this.allowedCommands.values());
  }

  /**
   * Update whitelist configuration
   */
  updateConfiguration(config: AllowedCommand[]): void {
    this.loadConfiguration(config);
  }
}

/**
 * Permission Manager Plugin
 */
export const permissionManagerPlugin = async ({ client, $, directory }: any) => {
  const whitelistManager = new WhitelistManager();

  return {
    tools: {
      validate_command: {
        description: "Validate a bash command against security policies and whitelist",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The bash command to validate"
            }
          },
          required: ["command"]
        },
        handler: async ({ command }: { command: string }) => {
          const startTime = Date.now();

          try {
            // Parse the command
            const parsedCommand = CommandParser.parse(command);
            
            // Perform security analysis
            const securityAnalysis = CommandParser.performSecurityAnalysis(command);
            
            // Check whitelist
            const whitelistResult = whitelistManager.isCommandAllowed(parsedCommand);
            
            if (!whitelistResult.success) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                'Failed to validate command against whitelist',
                { command, error: whitelistResult.error },
                { duration: Date.now() - startTime }
              );
            }

            // Combine results
            const result = {
              command: parsedCommand.command,
              parsed: parsedCommand,
              security: securityAnalysis,
              whitelist: whitelistResult.data!,
              approved: securityAnalysis.safe && whitelistResult.data!.allowed,
              requiresApproval: whitelistResult.data!.requiresApproval
            };

            return createSuccessResult(
              result,
              { 
                duration: Date.now() - startTime,
                warnings: securityAnalysis.warnings
              }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Command validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { command, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      get_whitelist: {
        description: "Get the current command whitelist configuration",
        parameters: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => {
          const startTime = Date.now();
          
          try {
            const allowedCommands = whitelistManager.getAllowedCommands();
            
            return createSuccessResult(
              { allowedCommands },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to get whitelist: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      update_whitelist: {
        description: "Update the command whitelist configuration",
        parameters: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  command: { type: "string" },
                  allowedArgs: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Optional array of allowed arguments"
                  },
                  allowedFlags: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Optional array of allowed flags"
                  },
                  requireApproval: { 
                    type: "boolean",
                    description: "Whether the command requires user approval"
                  }
                },
                required: ["command"]
              },
              description: "Array of allowed commands with their configurations"
            }
          },
          required: ["commands"]
        },
        handler: async ({ commands }: { commands: AllowedCommand[] }) => {
          const startTime = Date.now();
          
          try {
            whitelistManager.updateConfiguration(commands);
            
            return createSuccessResult(
              { 
                message: "Whitelist updated successfully",
                commandCount: commands.length
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to update whitelist: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { commands, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      detect_injection: {
        description: "Detect potential command injection attempts in a command string",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command string to analyze for injection attempts"
            }
          },
          required: ["command"]
        },
        handler: async ({ command }: { command: string }) => {
          const startTime = Date.now();
          
          try {
            const analysis = CommandParser.detectInjection(command);
            
            return createSuccessResult(
              analysis,
              { 
                duration: Date.now() - startTime,
                warnings: analysis.warnings
              }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Injection detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { command, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      detect_bypass_attempts: {
        description: "Detect bypass attempts using encoding and other techniques",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command string to analyze for bypass attempts"
            }
          },
          required: ["command"]
        },
        handler: async ({ command }: { command: string }) => {
          const startTime = Date.now();
          
          try {
            const analysis = CommandParser.detectBypassAttempts(command);
            
            return createSuccessResult(
              analysis,
              { 
                duration: Date.now() - startTime,
                warnings: analysis.warnings
              }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Bypass detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { command, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      parse_command: {
        description: "Parse a command string into structured components",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command string to parse"
            }
          },
          required: ["command"]
        },
        handler: async ({ command }: { command: string }) => {
          const startTime = Date.now();
          
          try {
            const parsed = CommandParser.parse(command);
            const tokens = CommandParser.tokenize(command);
            
            return createSuccessResult(
              {
                parsed,
                tokens,
                raw: command
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Command parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { command, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    hooks: {
      "tool.execute.before": async (context: any) => {
        // Hook to validate commands before execution
        if (context.tool === 'bash' || context.tool === 'shell') {
          const command = context.input?.command || context.input?.script;
          if (command) {
            const validation = await permissionManagerPlugin({ client, $, directory }).then(plugin => 
              plugin.tools.validate_command.handler({ command })
            );
            
            if (!validation.success || !validation.data?.approved) {
              throw new Error(`Command validation failed: ${validation.error?.message || 'Command not approved'}`);
            }
          }
        }
      }
    }
  };
};

export default permissionManagerPlugin;