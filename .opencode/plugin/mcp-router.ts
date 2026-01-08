/**
 * MCP Router Plugin for OpenCode
 * 
 * Manages MCP server lifecycle, sandboxed execution, resource limits, and audit logging.
 * Provides secure execution environment for Model Context Protocol servers.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { 
  StandardToolResult, 
  MCPSandboxConfig, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult 
} from './types';

/**
 * MCP Server instance information
 */
export interface MCPServerInstance {
  id: string;
  name: string;
  command: string;
  args: string[];
  process?: ChildProcess;
  config: MCPSandboxConfig;
  status: 'starting' | 'running' | 'stopped' | 'failed' | 'terminated';
  startTime?: number;
  resourceUsage?: {
    memoryMB: number;
    cpuPercent: number;
    executionTime: number;
  };
  auditLog: AuditLogEntry[];
}

/**
 * Audit log entry for MCP server activities
 */
export interface AuditLogEntry {
  timestamp: number;
  event: 'start' | 'stop' | 'resource_violation' | 'network_access' | 'filesystem_access' | 'error';
  details: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Docker container configuration for sandbox
 */
export interface DockerContainerConfig {
  image: string;
  name: string;
  memoryLimit: string;
  cpuLimit: string;
  networkMode: 'none' | 'bridge' | 'host';
  volumes: Array<{
    host: string;
    container: string;
    readonly: boolean;
  }>;
  environment: Record<string, string>;
  workingDir: string;
}

/**
 * MCP Router Plugin Class
 * 
 * Handles MCP server lifecycle management with Docker sandboxing,
 * resource limit enforcement, and comprehensive audit logging.
 */
export class MCPRouterPlugin {
  private servers: Map<string, MCPServerInstance> = new Map();
  private auditLogPath: string;
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor(auditLogPath: string = '.opencode/logs/mcp-audit.log') {
    this.auditLogPath = auditLogPath;
    this.startResourceMonitoring();
  }

  /**
   * Start a new MCP server with sandbox configuration
   * Requirement 9.1: MCP server lifecycle management
   */
  async startMCPServer(
    name: string,
    command: string,
    args: string[],
    config: MCPSandboxConfig
  ): Promise<StandardToolResult<MCPServerInstance>> {
    const startTime = Date.now();
    
    try {
      // Generate unique server ID
      const serverId = `${name}-${Date.now()}`;
      
      // Create server instance
      const server: MCPServerInstance = {
        id: serverId,
        name,
        command,
        args,
        config,
        status: 'starting',
        startTime,
        auditLog: []
      };

      // Add audit log entry
      this.addAuditLogEntry(server, 'start', {
        command,
        args,
        config
      }, 'info');

      // Start server based on sandbox type
      if (config.sandboxType === 'docker') {
        await this.startDockerSandboxedServer(server);
      } else if (config.sandboxType === 'none') {
        await this.startUnsandboxedServer(server);
      } else {
        throw new Error(`Unsupported sandbox type: ${config.sandboxType}`);
      }

      // Store server instance
      this.servers.set(serverId, server);
      server.status = 'running';

      return createSuccessResult(server, {
        duration: Date.now() - startTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        `Failed to start MCP server: ${errorMessage}`,
        { name, command, args, config },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Stop an MCP server and clean up resources
   * Requirement 9.1: MCP server lifecycle management
   */
  async stopMCPServer(serverId: string): Promise<StandardToolResult<void>> {
    const startTime = Date.now();
    
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        return createErrorResult(
          ErrorCode.LIFECYCLE_ERROR,
          `Server not found: ${serverId}`,
          { serverId }
        );
      }

      // Add audit log entry
      this.addAuditLogEntry(server, 'stop', {
        reason: 'manual_stop'
      }, 'info');

      // Stop the server process
      if (server.config.sandboxType === 'docker') {
        await this.stopDockerContainer(server);
      } else if (server.process) {
        server.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (server.process && !server.process.killed) {
            server.process.kill('SIGKILL');
          }
        }, 5000);
      }

      server.status = 'stopped';
      this.servers.delete(serverId);

      return createSuccessResult(undefined, {
        duration: Date.now() - startTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        `Failed to stop MCP server: ${errorMessage}`,
        { serverId },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Get status of all MCP servers
   * Requirement 9.4: Audit logging
   */
  async getServerStatus(): Promise<StandardToolResult<MCPServerInstance[]>> {
    try {
      const servers = Array.from(this.servers.values());
      return createSuccessResult(servers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to get server status: ${errorMessage}`
      );
    }
  }

  /**
   * Start Docker sandboxed MCP server
   * Requirement 9.2: Sandboxed execution environment
   * Requirement 9.3: Resource limit enforcement
   */
  private async startDockerSandboxedServer(server: MCPServerInstance): Promise<void> {
    const config = this.createDockerConfig(server);
    
    // Ensure Docker is available
    await this.ensureDockerAvailable();
    
    // Pull image if not available
    await this.ensureDockerImage(config.image);
    
    // Create Docker container with comprehensive security settings
    const createArgs = [
      'create',
      '--name', config.name,
      '--memory', config.memoryLimit,
      '--cpus', config.cpuLimit,
      '--network', config.networkMode,
      '--workdir', config.workingDir,
      
      // Security restrictions
      '--security-opt', 'no-new-privileges:true',
      '--cap-drop', 'ALL',
      '--read-only',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m',
      '--user', '1000:1000', // Non-root user
      
      // Resource limits
      '--memory-swappiness', '0',
      '--oom-kill-disable', 'false',
      '--pids-limit', '100',
      
      // Filesystem restrictions
      '--no-new-privileges'
    ];

    // Add network restrictions
    if (!server.config.network?.enabled) {
      createArgs.push('--network', 'none');
    } else {
      // Apply network restrictions
      if (server.config.network.allowedHosts?.length) {
        // Note: This would require custom network configuration
        // For now, we log the restriction
        this.addAuditLogEntry(server, 'network_access', {
          allowedHosts: server.config.network.allowedHosts,
          note: 'Network restrictions logged but not enforced in this implementation'
        }, 'info');
      }
    }

    // Add volume mounts with strict permissions
    for (const volume of config.volumes) {
      const mountFlag = volume.readonly ? 'ro' : 'rw';
      createArgs.push('-v', `${volume.host}:${volume.container}:${mountFlag}`);
      
      // Log filesystem access
      this.addAuditLogEntry(server, 'filesystem_access', {
        hostPath: volume.host,
        containerPath: volume.container,
        readonly: volume.readonly
      }, 'info');
    }

    // Add denied paths as read-only empty volumes to block access
    if (server.config.filesystem?.deniedPaths) {
      for (const deniedPath of server.config.filesystem.deniedPaths) {
        createArgs.push('-v', `/dev/null:${deniedPath}:ro`);
      }
    }

    // Add environment variables with sanitization
    for (const [key, value] of Object.entries(config.environment)) {
      // Sanitize environment variables
      const sanitizedValue = this.sanitizeEnvironmentValue(value);
      createArgs.push('-e', `${key}=${sanitizedValue}`);
    }

    // Add execution time limit via timeout
    if (server.config.resourceLimits?.maxExecutionTime) {
      createArgs.push('--stop-timeout', server.config.resourceLimits.maxExecutionTime.toString());
    }

    // Add image and command
    createArgs.push(config.image, server.command, ...server.args);

    // Create container
    const createProcess = spawn('docker', createArgs);
    await this.waitForProcess(createProcess);

    // Start container
    const startProcess = spawn('docker', ['start', config.name]);
    await this.waitForProcess(startProcess);

    // Set up process monitoring
    this.setupContainerMonitoring(server);

    // Store container reference for cleanup
    server.process = { 
      pid: -1, 
      kill: () => this.stopDockerContainer(server),
      killed: false
    } as any;
  }

  /**
   * Start unsandboxed MCP server (for development/testing)
   * Requirement 9.1: MCP server lifecycle management
   */
  private async startUnsandboxedServer(server: MCPServerInstance): Promise<void> {
    const childProcess = spawn(server.command, server.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    server.process = childProcess;

    // Handle process events
    childProcess.on('error', (error: Error) => {
      this.addAuditLogEntry(server, 'error', {
        error: error.message
      }, 'error');
      server.status = 'failed';
    });

    childProcess.on('exit', (code: number | null, signal: string | null) => {
      this.addAuditLogEntry(server, 'stop', {
        exitCode: code,
        signal
      }, code === 0 ? 'info' : 'warning');
      server.status = 'stopped';
    });
  }




  /**
   * Enhanced resource monitoring with comprehensive limits checking
   * Requirement 9.3, 9.5: Resource limit enforcement and termination
   */
  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(async () => {
      const servers = Array.from(this.servers.values());
      for (const server of servers) {
        if (server.status === 'running') {
          await this.checkResourceLimits(server);
        }
      }
    }, 2000); // Check every 2 seconds for better responsiveness
  }

  /**
   * Comprehensive resource limit checking with immediate termination
   * Requirement 9.5: Server termination on limit violations
   */
  private async checkResourceLimits(server: MCPServerInstance): Promise<void> {
    try {
      const usage = await this.getResourceUsage(server);
      server.resourceUsage = usage;

      const limits = server.config.resourceLimits;
      if (!limits) return;

      let violated = false;
      const violations: string[] = [];
      let severity: 'warning' | 'critical' = 'warning';

      // Check memory limit with threshold warnings
      if (limits.maxMemoryMB) {
        const memoryPercent = (usage.memoryMB / limits.maxMemoryMB) * 100;
        
        if (usage.memoryMB > limits.maxMemoryMB) {
          violations.push(`Memory: ${usage.memoryMB}MB > ${limits.maxMemoryMB}MB (${memoryPercent.toFixed(1)}%)`);
          violated = true;
          severity = 'critical';
        } else if (memoryPercent > 90) {
          // Warning at 90% usage
          this.addAuditLogEntry(server, 'resource_violation', {
            type: 'memory_warning',
            usage: `${usage.memoryMB}MB (${memoryPercent.toFixed(1)}% of limit)`
          }, 'warning');
        }
      }

      // Check CPU limit with sustained usage detection
      if (limits.maxCpuPercent && usage.cpuPercent > limits.maxCpuPercent) {
        violations.push(`CPU: ${usage.cpuPercent}% > ${limits.maxCpuPercent}%`);
        violated = true;
        severity = 'critical';
      }

      // Check execution time limit
      if (limits.maxExecutionTime && usage.executionTime > limits.maxExecutionTime) {
        violations.push(`Time: ${usage.executionTime}s > ${limits.maxExecutionTime}s`);
        violated = true;
        severity = 'critical';
      }

      // Check for additional resource violations (file descriptors, network connections, etc.)
      const additionalViolations = await this.checkAdditionalResourceLimits(server);
      if (additionalViolations.length > 0) {
        violations.push(...additionalViolations);
        violated = true;
        severity = 'critical';
      }

      if (violated) {
        this.addAuditLogEntry(server, 'resource_violation', {
          violations,
          usage,
          action: 'terminating_server'
        }, severity);

        // Immediate termination for resource violations
        server.status = 'terminated';
        await this.forceTerminateServer(server);
      }

    } catch (error) {
      this.addAuditLogEntry(server, 'error', {
        error: 'Failed to check resource limits',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 'error');
    }
  }

  /**
   * Check additional resource limits beyond basic CPU/memory
   * Requirement 9.3: Resource limit enforcement
   */
  private async checkAdditionalResourceLimits(server: MCPServerInstance): Promise<string[]> {
    const violations: string[] = [];
    
    if (server.config.sandboxType === 'docker') {
      try {
        const containerName = `mcp-${server.id}`;
        
        // Check process count
        const psProcess = spawn('docker', ['exec', containerName, 'ps', 'aux']);
        const psOutput = await this.getProcessOutput(psProcess);
        const processCount = psOutput.split('\n').length - 1; // Subtract header
        
        if (processCount > 50) { // Arbitrary limit
          violations.push(`Process count: ${processCount} > 50`);
        }
        
        // Check open file descriptors (if available)
        try {
          const fdProcess = spawn('docker', ['exec', containerName, 'find', '/proc/self/fd', '-type', 'l']);
          const fdOutput = await this.getProcessOutput(fdProcess);
          const fdCount = fdOutput.split('\n').length;
          
          if (fdCount > 1000) { // Arbitrary limit
            violations.push(`File descriptors: ${fdCount} > 1000`);
          }
        } catch (error) {
          // Ignore if we can't check file descriptors
        }
        
      } catch (error) {
        // Ignore errors in additional checks
      }
    }
    
    return violations;
  }

  /**
   * Force terminate a server immediately
   * Requirement 9.5: Server termination on limit violations
   */
  private async forceTerminateServer(server: MCPServerInstance): Promise<void> {
    try {
      if (server.config.sandboxType === 'docker') {
        const containerName = `mcp-${server.id}`;
        
        // Force kill the container immediately
        const killProcess = spawn('docker', ['kill', containerName]);
        await this.waitForProcess(killProcess);
        
        // Remove the container
        const rmProcess = spawn('docker', ['rm', '-f', containerName]);
        await this.waitForProcess(rmProcess);
        
      } else if (server.process && !server.process.killed) {
        // Force kill the process
        server.process.kill('SIGKILL');
      }
      
      // Remove from active servers
      this.servers.delete(server.id);
      
      this.addAuditLogEntry(server, 'stop', {
        method: 'force_termination',
        reason: 'resource_limit_violation'
      }, 'critical');
      
    } catch (error) {
      this.addAuditLogEntry(server, 'error', {
        error: 'Failed to force terminate server',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 'error');
    }
  }

  /**
   * Get resource usage for a server
   * Requirement 9.3: Resource limit enforcement
   */
  private async getResourceUsage(server: MCPServerInstance): Promise<{
    memoryMB: number;
    cpuPercent: number;
    executionTime: number;
  }> {
    if (server.config.sandboxType === 'docker') {
      return this.getDockerResourceUsage(server);
    } else if (server.process?.pid) {
      return this.getProcessResourceUsage(server.process.pid);
    }

    return { memoryMB: 0, cpuPercent: 0, executionTime: 0 };
  }

  /**
   * Get Docker container resource usage
   */
  private async getDockerResourceUsage(server: MCPServerInstance): Promise<{
    memoryMB: number;
    cpuPercent: number;
    executionTime: number;
  }> {
    const containerName = `mcp-${server.id}`;
    const statsProcess = spawn('docker', ['stats', '--no-stream', '--format', 'json', containerName]);
    
    try {
      const output = await this.getProcessOutput(statsProcess);
      const stats = JSON.parse(output);
      
      return {
        memoryMB: this.parseMemoryUsage(stats.MemUsage),
        cpuPercent: parseFloat(stats.CPUPerc.replace('%', '')),
        executionTime: server.startTime ? (Date.now() - server.startTime) / 1000 : 0
      };
    } catch (error) {
      return { memoryMB: 0, cpuPercent: 0, executionTime: 0 };
    }
  }

  /**
   * Get process resource usage (for unsandboxed servers)
   */
  private async getProcessResourceUsage(pid: number): Promise<{
    memoryMB: number;
    cpuPercent: number;
    executionTime: number;
  }> {
    // This is a simplified implementation
    // In production, you'd use proper system monitoring tools
    return { memoryMB: 0, cpuPercent: 0, executionTime: 0 };
  }

  /**
   * Add audit log entry
   * Requirement 9.4: Audit logging
   */
  private addAuditLogEntry(
    server: MCPServerInstance,
    event: AuditLogEntry['event'],
    details: any,
    severity: AuditLogEntry['severity']
  ): void {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      event,
      details,
      severity
    };

    server.auditLog.push(entry);
    this.writeAuditLog(server.id, entry);
  }

  /**
   * Write audit log entry to file
   * Requirement 9.4: Audit logging
   */
  private async writeAuditLog(serverId: string, entry: AuditLogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify({
        serverId,
        ...entry
      }) + '\n';

      await fs.appendFile(this.auditLogPath, logLine);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Parse memory usage from Docker stats
   */
  private parseMemoryUsage(memUsage: string): number {
    // Parse format like "123.4MiB / 512MiB"
    const match = memUsage.match(/^([\d.]+)(\w+)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'b': return value / (1024 * 1024);
      case 'kib': case 'kb': return value / 1024;
      case 'mib': case 'mb': return value;
      case 'gib': case 'gb': return value * 1024;
      default: return value;
    }
  }

  /**
   * Wait for a process to complete
   */
  private async waitForProcess(process: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Get process output as string
   */
  private async getProcessOutput(process: ChildProcess): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Cleanup resources on shutdown
   */
  async cleanup(): Promise<void> {
    // Stop resource monitoring
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
    }

    // Stop all running servers
    const stopPromises = Array.from(this.servers.keys()).map(serverId => 
      this.stopMCPServer(serverId)
    );

    await Promise.allSettled(stopPromises);
  }

  /**
   * Ensure Docker is available on the system
   * Requirement 9.2: Sandboxed execution environment
   */
  private async ensureDockerAvailable(): Promise<void> {
    try {
      const versionProcess = spawn('docker', ['--version']);
      await this.waitForProcess(versionProcess);
    } catch (error) {
      throw new Error('Docker is not available. Please install Docker to use sandboxed MCP servers.');
    }
  }

  /**
   * Ensure Docker image is available
   * Requirement 9.2: Sandboxed execution environment
   */
  private async ensureDockerImage(image: string): Promise<void> {
    try {
      // Check if image exists locally
      const inspectProcess = spawn('docker', ['image', 'inspect', image]);
      await this.waitForProcess(inspectProcess);
    } catch (error) {
      // Pull image if not available
      const pullProcess = spawn('docker', ['pull', image]);
      await this.waitForProcess(pullProcess);
    }
  }

  /**
   * Set up container monitoring for resource usage and violations
   * Requirement 9.3, 9.5: Resource limit enforcement and termination
   */
  private setupContainerMonitoring(server: MCPServerInstance): void {
    const containerName = `mcp-${server.id}`;
    
    // Monitor container events
    const eventsProcess = spawn('docker', ['events', '--filter', `container=${containerName}`, '--format', '{{json .}}']);
    
    eventsProcess.stdout?.on('data', (data) => {
      try {
        const event = JSON.parse(data.toString().trim());
        
        if (event.Action === 'die') {
          this.addAuditLogEntry(server, 'stop', {
            reason: 'container_died',
            exitCode: event.Actor?.Attributes?.exitCode
          }, 'warning');
          server.status = 'stopped';
        } else if (event.Action === 'oom') {
          this.addAuditLogEntry(server, 'resource_violation', {
            type: 'out_of_memory',
            action: 'container_killed'
          }, 'critical');
          server.status = 'terminated';
        }
      } catch (error) {
        // Ignore JSON parsing errors for malformed events
      }
    });

    eventsProcess.on('error', (error) => {
      this.addAuditLogEntry(server, 'error', {
        error: 'Container monitoring failed',
        details: error.message
      }, 'error');
    });
  }

  /**
   * Sanitize environment variable values
   * Requirement 9.2: Sandboxed execution environment
   */
  private sanitizeEnvironmentValue(value: string): string {
    // Remove potentially dangerous characters and sequences
    return value
      .replace(/[;&|`$(){}[\]]/g, '') // Remove shell metacharacters
      .replace(/\.\./g, '') // Remove path traversal
      .substring(0, 1000); // Limit length
  }

  /**
   * Enhanced Docker container configuration with security hardening
   * Requirement 9.2, 9.3: Docker sandbox configuration and resource limits
   */
  private createDockerConfig(server: MCPServerInstance): DockerContainerConfig {
    const config = server.config;
    
    // Default secure configuration
    const dockerConfig: DockerContainerConfig = {
      image: 'node:18-alpine', // Minimal Alpine-based image
      name: `mcp-${server.id}`,
      memoryLimit: `${config.resourceLimits?.maxMemoryMB || 256}m`, // Reduced default
      cpuLimit: `${(config.resourceLimits?.maxCpuPercent || 25) / 100}`, // Reduced default
      networkMode: config.network?.enabled ? 'bridge' : 'none',
      volumes: [],
      environment: {
        NODE_ENV: 'production',
        MCP_SERVER_ID: server.id,
        // Disable Node.js debugging and inspection
        NODE_OPTIONS: '--no-deprecation --no-warnings'
      },
      workingDir: '/mcp'
    };

    // Add allowed paths as volumes with strict permissions
    if (config.filesystem?.allowedPaths) {
      for (const path of config.filesystem.allowedPaths) {
        // Validate path is safe
        const resolvedPath = resolve(path);
        if (this.isPathSafe(resolvedPath)) {
          dockerConfig.volumes.push({
            host: resolvedPath,
            container: `/mcp${resolvedPath}`,
            readonly: config.filesystem?.readOnly || true // Default to read-only
          });
        }
      }
    }

    // Add temporary directory for MCP server operations
    dockerConfig.volumes.push({
      host: '/tmp',
      container: '/tmp',
      readonly: false
    });

    return dockerConfig;
  }

  /**
   * Validate that a path is safe for container mounting
   * Requirement 9.2: Sandboxed execution environment
   */
  private isPathSafe(path: string): boolean {
    const normalizedPath = resolve(path);
    
    // Block system directories
    const blockedPaths = [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/boot',
      '/dev',
      '/proc',
      '/sys',
      '/root'
    ];

    return !blockedPaths.some(blocked => normalizedPath.startsWith(blocked));
  }

  /**
   * Enhanced Docker container stopping with force cleanup
   * Requirement 9.2, 9.5: Sandboxed execution environment and termination
   */
  private async stopDockerContainer(server: MCPServerInstance): Promise<void> {
    const containerName = `mcp-${server.id}`;
    
    try {
      // First, try graceful stop with timeout
      const stopProcess = spawn('docker', ['stop', '--time', '10', containerName]);
      await this.waitForProcess(stopProcess);
      
      this.addAuditLogEntry(server, 'stop', {
        method: 'graceful',
        container: containerName
      }, 'info');
      
    } catch (error) {
      // If graceful stop fails, force kill
      try {
        const killProcess = spawn('docker', ['kill', containerName]);
        await this.waitForProcess(killProcess);
        
        this.addAuditLogEntry(server, 'stop', {
          method: 'force_kill',
          container: containerName,
          reason: 'graceful_stop_failed'
        }, 'warning');
        
      } catch (killError) {
        this.addAuditLogEntry(server, 'error', {
          error: 'Failed to stop container',
          container: containerName,
          details: killError instanceof Error ? killError.message : 'Unknown error'
        }, 'error');
      }
    }

    // Always try to remove the container
    try {
      const rmProcess = spawn('docker', ['rm', '-f', containerName]);
      await this.waitForProcess(rmProcess);
      
    } catch (error) {
      this.addAuditLogEntry(server, 'error', {
        error: 'Failed to remove container',
        container: containerName,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 'warning');
    }
  }
}

/**
 * Default MCP Router Plugin instance
 */
export const mcpRouterPlugin = new MCPRouterPlugin();

/**
 * Plugin export for OpenCode
 */
export default function mcpRouter() {
  return {
    name: 'mcp-router',
    version: '1.0.0',
    dependencies: [],
    
    tools: {
      mcp_start_server: {
        description: 'Start an MCP server with sandbox configuration',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Server name' },
            command: { type: 'string', description: 'Command to execute' },
            args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
            config: { 
              type: 'object',
              description: 'Sandbox configuration',
              properties: {
                sandboxType: { type: 'string', enum: ['none', 'docker'] },
                resourceLimits: {
                  type: 'object',
                  properties: {
                    maxMemoryMB: { type: 'number' },
                    maxCpuPercent: { type: 'number' },
                    maxExecutionTime: { type: 'number' }
                  }
                },
                filesystem: {
                  type: 'object',
                  properties: {
                    readOnly: { type: 'boolean' },
                    allowedPaths: { type: 'array', items: { type: 'string' } }
                  }
                },
                network: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' }
                  }
                }
              }
            }
          },
          required: ['name', 'command', 'args', 'config']
        }
      },

      mcp_stop_server: {
        description: 'Stop an MCP server',
        parameters: {
          type: 'object',
          properties: {
            serverId: { type: 'string', description: 'Server ID to stop' }
          },
          required: ['serverId']
        }
      },

      mcp_get_server_status: {
        description: 'Get status of all MCP servers',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },

    async execute(tool: string, parameters: any) {
      switch (tool) {
        case 'mcp_start_server':
          return mcpRouterPlugin.startMCPServer(
            parameters.name,
            parameters.command,
            parameters.args,
            parameters.config
          );

        case 'mcp_stop_server':
          return mcpRouterPlugin.stopMCPServer(parameters.serverId);

        case 'mcp_get_server_status':
          return mcpRouterPlugin.getServerStatus();

        default:
          return createErrorResult(
            ErrorCode.UNKNOWN_ERROR,
            `Unknown tool: ${tool}`
          );
      }
    },

    async cleanup() {
      await mcpRouterPlugin.cleanup();
    }
  };
}