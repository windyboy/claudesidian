/**
 * Slash Commands Plugin for OpenCode
 * Provides command registration and execution system
 * 
 * This plugin implements slash command functionality including:
 * - Command registration and management
 * - Command execution with parameter validation
 * - Help system and command discovery
 * - Command aliasing and shortcuts
 * 
 * Requirements: 2.1
 */

import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';

/**
 * Command parameter definition
 */
export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  choices?: string[];
  validation?: (value: any) => boolean | string;
}

/**
 * Command definition interface
 */
export interface SlashCommand {
  name: string;
  description: string;
  category?: string;
  aliases?: string[];
  parameters?: CommandParameter[];
  examples?: string[];
  handler: (params: Record<string, any>, context: CommandContext) => Promise<StandardToolResult>;
  permissions?: string[];
  hidden?: boolean;
}

/**
 * Command execution context
 */
export interface CommandContext {
  user?: string;
  session?: string;
  directory: string;
  timestamp: number;
  client: any;
  $: any;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult {
  command: string;
  parameters: Record<string, any>;
  result: any;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Command registry for managing slash commands
 */
export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private categories: Set<string> = new Set();

  /**
   * Register a new slash command
   */
  registerCommand(command: SlashCommand): StandardToolResult<void> {
    try {
      // Validate command definition
      const validation = this.validateCommand(command);
      if (!validation.success) {
        return validation;
      }

      // Check for name conflicts
      if (this.commands.has(command.name)) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Command '${command.name}' is already registered`,
          { commandName: command.name }
        );
      }

      // Check for alias conflicts
      if (command.aliases) {
        for (const alias of command.aliases) {
          if (this.commands.has(alias) || this.aliases.has(alias)) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Alias '${alias}' conflicts with existing command or alias`,
              { alias, commandName: command.name }
            );
          }
        }
      }

      // Register the command
      this.commands.set(command.name, command);

      // Register aliases
      if (command.aliases) {
        for (const alias of command.aliases) {
          this.aliases.set(alias, command.name);
        }
      }

      // Add category
      if (command.category) {
        this.categories.add(command.category);
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to register command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { command, error }
      );
    }
  }

  /**
   * Unregister a slash command
   */
  unregisterCommand(name: string): StandardToolResult<void> {
    try {
      const command = this.commands.get(name);
      if (!command) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Command '${name}' is not registered`,
          { commandName: name }
        );
      }

      // Remove aliases
      if (command.aliases) {
        for (const alias of command.aliases) {
          this.aliases.delete(alias);
        }
      }

      // Remove command
      this.commands.delete(name);

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to unregister command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { commandName: name, error }
      );
    }
  }

  /**
   * Get a command by name or alias
   */
  getCommand(name: string): SlashCommand | undefined {
    // Check direct command name
    let command = this.commands.get(name);
    if (command) {
      return command;
    }

    // Check aliases
    const aliasTarget = this.aliases.get(name);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }

    return undefined;
  }

  /**
   * Get all registered commands
   */
  getAllCommands(includeHidden: boolean = false): SlashCommand[] {
    const commands = Array.from(this.commands.values());
    return includeHidden ? commands : commands.filter(cmd => !cmd.hidden);
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): SlashCommand[] {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Search commands by name or description
   */
  searchCommands(query: string): SlashCommand[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.commands.values()).filter(cmd => 
      !cmd.hidden && (
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        (cmd.aliases && cmd.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)))
      )
    );
  }

  /**
   * Validate command definition
   */
  private validateCommand(command: SlashCommand): StandardToolResult<void> {
    // Check required fields
    if (!command.name || typeof command.name !== 'string') {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'Command name is required and must be a string',
        { command }
      );
    }

    if (!command.description || typeof command.description !== 'string') {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'Command description is required and must be a string',
        { command }
      );
    }

    if (!command.handler || typeof command.handler !== 'function') {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'Command handler is required and must be a function',
        { command }
      );
    }

    // Validate command name format
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(command.name)) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'Command name must start with a letter and contain only letters, numbers, underscores, and hyphens',
        { commandName: command.name }
      );
    }

    // Validate aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias)) {
          return createErrorResult(
            ErrorCode.VALIDATION_ERROR,
            `Alias '${alias}' must start with a letter and contain only letters, numbers, underscores, and hyphens`,
            { alias, commandName: command.name }
          );
        }
      }
    }

    // Validate parameters
    if (command.parameters) {
      for (const param of command.parameters) {
        if (!param.name || typeof param.name !== 'string') {
          return createErrorResult(
            ErrorCode.VALIDATION_ERROR,
            'Parameter name is required and must be a string',
            { parameter: param, commandName: command.name }
          );
        }

        if (!['string', 'number', 'boolean', 'array'].includes(param.type)) {
          return createErrorResult(
            ErrorCode.VALIDATION_ERROR,
            `Parameter type must be one of: string, number, boolean, array`,
            { parameter: param, commandName: command.name }
          );
        }
      }
    }

    return createSuccessResult(undefined);
  }

  /**
   * Parse command string into name and parameters
   */
  parseCommand(commandString: string): { name: string; parameters: Record<string, any> } {
    const parts = commandString.trim().split(/\s+/);
    const name = parts[0];
    const parameters: Record<string, any> = {};

    // Simple parameter parsing (key=value or positional)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.includes('=')) {
        // Named parameter: key=value
        const [key, ...valueParts] = part.split('=');
        const value = valueParts.join('=');
        parameters[key] = this.parseValue(value);
      } else {
        // Positional parameter
        parameters[`arg${i - 1}`] = this.parseValue(part);
      }
    }

    return { name, parameters };
  }

  /**
   * Parse string value to appropriate type
   */
  private parseValue(value: string): any {
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number values
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);

    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()));
    }

    // String value (remove quotes if present)
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Validate parameters against command definition
   */
  validateParameters(command: SlashCommand, parameters: Record<string, any>): StandardToolResult<Record<string, any>> {
    try {
      const validatedParams: Record<string, any> = {};

      if (command.parameters) {
        for (const paramDef of command.parameters) {
          const value = parameters[paramDef.name];

          // Check required parameters
          if (paramDef.required && (value === undefined || value === null)) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Required parameter '${paramDef.name}' is missing`,
              { parameter: paramDef.name, command: command.name }
            );
          }

          // Use default value if parameter is missing
          if (value === undefined && paramDef.default !== undefined) {
            validatedParams[paramDef.name] = paramDef.default;
            continue;
          }

          // Skip validation if parameter is not provided and not required
          if (value === undefined) {
            continue;
          }

          // Type validation
          const typeValidation = this.validateParameterType(value, paramDef.type);
          if (!typeValidation.success) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Parameter '${paramDef.name}' ${typeValidation.error!.message}`,
              { parameter: paramDef.name, value, expectedType: paramDef.type }
            );
          }

          // Choice validation
          if (paramDef.choices && !paramDef.choices.includes(value)) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Parameter '${paramDef.name}' must be one of: ${paramDef.choices.join(', ')}`,
              { parameter: paramDef.name, value, choices: paramDef.choices }
            );
          }

          // Custom validation
          if (paramDef.validation) {
            const validationResult = paramDef.validation(value);
            if (validationResult !== true) {
              const message = typeof validationResult === 'string' ? validationResult : 'Validation failed';
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Parameter '${paramDef.name}' validation failed: ${message}`,
                { parameter: paramDef.name, value }
              );
            }
          }

          validatedParams[paramDef.name] = value;
        }
      }

      return createSuccessResult(validatedParams);
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { parameters, command: command.name, error }
      );
    }
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: any, expectedType: string): StandardToolResult<void> {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return createErrorResult(ErrorCode.VALIDATION_ERROR, 'must be a string');
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return createErrorResult(ErrorCode.VALIDATION_ERROR, 'must be a number');
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return createErrorResult(ErrorCode.VALIDATION_ERROR, 'must be a boolean');
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return createErrorResult(ErrorCode.VALIDATION_ERROR, 'must be an array');
        }
        break;
      default:
        return createErrorResult(ErrorCode.VALIDATION_ERROR, `unknown type: ${expectedType}`);
    }

    return createSuccessResult(undefined);
  }

  /**
   * Execute a command
   */
  async executeCommand(
    commandString: string, 
    context: CommandContext
  ): Promise<StandardToolResult<CommandExecutionResult>> {
    const startTime = Date.now();

    try {
      // Parse command
      const { name, parameters } = this.parseCommand(commandString);

      // Get command
      const command = this.getCommand(name);
      if (!command) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Command '${name}' not found`,
          { commandName: name, availableCommands: Array.from(this.commands.keys()) }
        );
      }

      // Validate parameters
      const paramValidation = this.validateParameters(command, parameters);
      if (!paramValidation.success) {
        return createErrorResult(
          paramValidation.error!.code,
          paramValidation.error!.message,
          paramValidation.error!.details,
          { duration: Date.now() - startTime }
        );
      }

      const validatedParams = paramValidation.data!;

      // Execute command
      const result = await command.handler(validatedParams, context);

      const executionResult: CommandExecutionResult = {
        command: name,
        parameters: validatedParams,
        result: result.data,
        duration: Date.now() - startTime,
        success: result.success,
        error: result.error?.message
      };

      return createSuccessResult(
        executionResult,
        { duration: Date.now() - startTime }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { commandString, error },
        { duration: Date.now() - startTime }
      );
    }
  }
}

/**
 * Slash Commands Plugin
 */
export const slashCommandsPlugin = async ({ client, $, directory }: any) => {
  const registry = new CommandRegistry();

  // Register built-in commands
  await registerBuiltinCommands(registry, { client, $, directory });

  return {
    tools: {
      execute_slash_command: {
        description: "Execute a slash command with parameters",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The slash command to execute (e.g., 'help', 'list files', 'search query=test')"
            }
          },
          required: ["command"]
        },
        handler: async ({ command }: { command: string }) => {
          const context: CommandContext = {
            directory,
            timestamp: Date.now(),
            client,
            $
          };

          return await registry.executeCommand(command, context);
        }
      },

      list_slash_commands: {
        description: "List all available slash commands",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional category to filter commands"
            },
            includeHidden: {
              type: "boolean",
              description: "Whether to include hidden commands",
              default: false
            }
          },
          required: []
        },
        handler: async ({ category, includeHidden }: { category?: string; includeHidden?: boolean }) => {
          const startTime = Date.now();

          try {
            let commands: SlashCommand[];

            if (category) {
              commands = registry.getCommandsByCategory(category);
            } else {
              commands = registry.getAllCommands(includeHidden || false);
            }

            const commandList = commands.map(cmd => ({
              name: cmd.name,
              description: cmd.description,
              category: cmd.category,
              aliases: cmd.aliases,
              parameters: cmd.parameters?.map(p => ({
                name: p.name,
                type: p.type,
                required: p.required,
                description: p.description
              })),
              examples: cmd.examples
            }));

            return createSuccessResult(
              {
                commands: commandList,
                categories: registry.getCategories(),
                total: commandList.length
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to list commands: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { category, includeHidden, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      search_slash_commands: {
        description: "Search for slash commands by name or description",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to match against command names and descriptions"
            }
          },
          required: ["query"]
        },
        handler: async ({ query }: { query: string }) => {
          const startTime = Date.now();

          try {
            const commands = registry.searchCommands(query);
            
            const commandList = commands.map(cmd => ({
              name: cmd.name,
              description: cmd.description,
              category: cmd.category,
              aliases: cmd.aliases
            }));

            return createSuccessResult(
              {
                commands: commandList,
                query,
                total: commandList.length
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to search commands: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { query, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      get_command_help: {
        description: "Get detailed help information for a specific command",
        parameters: {
          type: "object",
          properties: {
            commandName: {
              type: "string",
              description: "Name of the command to get help for"
            }
          },
          required: ["commandName"]
        },
        handler: async ({ commandName }: { commandName: string }) => {
          const startTime = Date.now();

          try {
            const command = registry.getCommand(commandName);
            
            if (!command) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Command '${commandName}' not found`,
                { commandName }
              );
            }

            const helpInfo = {
              name: command.name,
              description: command.description,
              category: command.category,
              aliases: command.aliases,
              parameters: command.parameters,
              examples: command.examples,
              permissions: command.permissions
            };

            return createSuccessResult(
              helpInfo,
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to get command help: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { commandName, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    // Expose registry for other plugins to register commands
    registry
  };
};

/**
 * Register built-in slash commands
 */
async function registerBuiltinCommands(registry: CommandRegistry, context: any) {
  // Help command
  registry.registerCommand({
    name: 'help',
    description: 'Show help information for commands',
    category: 'system',
    aliases: ['h', '?'],
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Specific command to get help for',
        required: false
      }
    ],
    examples: [
      'help',
      'help list',
      'h search'
    ],
    handler: async (params, ctx) => {
      if (params.command) {
        const command = registry.getCommand(params.command);
        if (!command) {
          return createErrorResult(
            ErrorCode.VALIDATION_ERROR,
            `Command '${params.command}' not found`
          );
        }

        return createSuccessResult({
          type: 'command_help',
          command: {
            name: command.name,
            description: command.description,
            category: command.category,
            aliases: command.aliases,
            parameters: command.parameters,
            examples: command.examples
          }
        });
      } else {
        const commands = registry.getAllCommands();
        const categories = registry.getCategories();
        
        return createSuccessResult({
          type: 'general_help',
          commands: commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            category: cmd.category
          })),
          categories,
          total: commands.length
        });
      }
    }
  });

  // List command
  registry.registerCommand({
    name: 'list',
    description: 'List available commands or command categories',
    category: 'system',
    aliases: ['ls'],
    parameters: [
      {
        name: 'category',
        type: 'string',
        description: 'Category to filter by',
        required: false
      }
    ],
    examples: [
      'list',
      'list system',
      'ls file'
    ],
    handler: async (params, ctx) => {
      let commands: SlashCommand[];
      
      if (params.category) {
        commands = registry.getCommandsByCategory(params.category);
      } else {
        commands = registry.getAllCommands();
      }

      return createSuccessResult({
        commands: commands.map(cmd => ({
          name: cmd.name,
          description: cmd.description,
          category: cmd.category
        })),
        category: params.category,
        total: commands.length
      });
    }
  });
}

export default slashCommandsPlugin;