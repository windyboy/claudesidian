/**
 * Plan Mode Plugin for OpenCode
 * Provides two-phase plan execution with plan generation and execution phases
 * 
 * This plugin implements plan mode functionality including:
 * - Two-phase execution (plan generation then execution)
 * - Plan state management
 * - Step-by-step execution with progress tracking
 * - Error handling and execution stopping
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5, 6.6
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { 
  StandardToolResult, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult, 
  PlanState,
  PlanStep,
  Session
} from './types';

/**
 * Plan execution phases
 */
export enum PlanPhase {
  GENERATION = 'generation',
  EXECUTION = 'execution'
}

/**
 * Plan execution status
 */
export enum PlanStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Plan step execution result
 */
export interface PlanStepResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  duration: number;
}

/**
 * Plan execution context
 */
export interface PlanExecutionContext {
  planId: string;
  sessionId: string;
  currentPhase: PlanPhase;
  toolExecutionEnabled: boolean;
  stepResults: PlanStepResult[];
  startTime: number;
  lastStepTime?: number;
}

/**
 * Plan generation request
 */
export interface PlanGenerationRequest {
  title: string;
  description: string;
  requirements: string[];
  constraints?: string[];
  estimatedSteps?: number;
}

/**
 * Plan approval request
 */
export interface PlanApprovalRequest {
  planId: string;
  approved: boolean;
  modifications?: {
    title?: string;
    description?: string;
    steps?: PlanStep[];
  };
  comments?: string;
}

/**
 * Plan state manager
 */
export class PlanStateManager {
  private plans: Map<string, PlanState> = new Map();
  private executionContexts: Map<string, PlanExecutionContext> = new Map();
  private readonly PLAN_STORAGE_DIR = '.opencode/plans';

  constructor() {
    this.ensureStorageDirectory();
  }

  /**
   * Ensure plan storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.PLAN_STORAGE_DIR, { recursive: true });
    } catch (error) {
      console.warn('Failed to create plan storage directory:', error);
    }
  }

  /**
   * Generate a new plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new plan in draft state
   */
  async createPlan(
    sessionId: string,
    request: PlanGenerationRequest
  ): Promise<StandardToolResult<PlanState>> {
    const startTime = Date.now();
    
    try {
      const planId = this.generatePlanId();
      
      // Generate initial plan steps based on requirements
      const steps = await this.generatePlanSteps(request);
      
      const planState: PlanState = {
        planId,
        sessionId,
        status: 'draft',
        plan: {
          title: request.title,
          description: request.description,
          steps
        }
      };

      // Store plan in memory
      this.plans.set(planId, planState);
      
      // Create execution context in generation phase
      const executionContext: PlanExecutionContext = {
        planId,
        sessionId,
        currentPhase: PlanPhase.GENERATION,
        toolExecutionEnabled: false, // Tools disabled during generation
        stepResults: [],
        startTime: Date.now()
      };
      
      this.executionContexts.set(planId, executionContext);
      
      // Persist plan to disk
      await this.persistPlan(planState);
      
      return createSuccessResult(planState, {
        duration: Date.now() - startTime,
        warnings: ['Plan created in draft state - requires approval before execution']
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Plan creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sessionId, request, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Generate plan steps based on requirements
   */
  private async generatePlanSteps(request: PlanGenerationRequest): Promise<PlanStep[]> {
    const steps: PlanStep[] = [];
    
    // This is a simplified step generation - in a real implementation,
    // this would use AI to generate detailed steps based on requirements
    
    // Analysis step
    steps.push({
      id: 'step_001',
      title: 'Analyze Requirements',
      description: `Analyze the requirements: ${request.requirements.join(', ')}`,
      tool: 'analyze_requirements',
      parameters: { requirements: request.requirements },
      dependencies: []
    });

    // Planning step
    steps.push({
      id: 'step_002',
      title: 'Create Detailed Plan',
      description: 'Create a detailed implementation plan based on analysis',
      tool: 'create_detailed_plan',
      parameters: { 
        title: request.title,
        description: request.description,
        constraints: request.constraints || []
      },
      dependencies: ['step_001']
    });

    // Implementation steps (simplified)
    for (let i = 0; i < (request.estimatedSteps || 3); i++) {
      const stepNum = String(i + 3).padStart(3, '0');
      steps.push({
        id: `step_${stepNum}`,
        title: `Implementation Step ${i + 1}`,
        description: `Execute implementation step ${i + 1} of the plan`,
        tool: 'execute_implementation_step',
        parameters: { stepNumber: i + 1 },
        dependencies: i === 0 ? ['step_002'] : [`step_${String(i + 2).padStart(3, '0')}`]
      });
    }

    // Validation step
    const validationStepNum = String(steps.length + 1).padStart(3, '0');
    steps.push({
      id: `step_${validationStepNum}`,
      title: 'Validate Implementation',
      description: 'Validate that the implementation meets all requirements',
      tool: 'validate_implementation',
      parameters: { requirements: request.requirements },
      dependencies: [`step_${String(steps.length).padStart(3, '0')}`]
    });

    return steps;
  }

  /**
   * Approve a plan for execution
   */
  async approvePlan(approval: PlanApprovalRequest): Promise<StandardToolResult<PlanState>> {
    const startTime = Date.now();
    
    try {
      const plan = this.plans.get(approval.planId);
      if (!plan) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan not found: ${approval.planId}`,
          { planId: approval.planId },
          { duration: Date.now() - startTime }
        );
      }

      if (plan.status !== 'draft') {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan cannot be approved - current status: ${plan.status}`,
          { planId: approval.planId, currentStatus: plan.status },
          { duration: Date.now() - startTime }
        );
      }

      if (!approval.approved) {
        // Plan was rejected
        plan.status = 'cancelled';
        await this.persistPlan(plan);
        
        return createSuccessResult(plan, {
          duration: Date.now() - startTime,
          warnings: ['Plan was rejected and cancelled']
        });
      }

      // Apply modifications if provided
      if (approval.modifications) {
        if (approval.modifications.title) {
          plan.plan.title = approval.modifications.title;
        }
        if (approval.modifications.description) {
          plan.plan.description = approval.modifications.description;
        }
        if (approval.modifications.steps) {
          plan.plan.steps = approval.modifications.steps;
        }
      }

      // Update plan status to approved
      plan.status = 'approved';
      
      // Update execution context to execution phase
      const executionContext = this.executionContexts.get(approval.planId);
      if (executionContext) {
        executionContext.currentPhase = PlanPhase.EXECUTION;
        executionContext.toolExecutionEnabled = true; // Enable tools for execution
      }

      // Persist updated plan
      await this.persistPlan(plan);
      
      return createSuccessResult(plan, {
        duration: Date.now() - startTime,
        warnings: ['Plan approved and ready for execution']
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Plan approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { approval, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Start plan execution
   */
  async startExecution(planId: string): Promise<StandardToolResult<{ planId: string; status: string }>> {
    const startTime = Date.now();
    
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan not found: ${planId}`,
          { planId },
          { duration: Date.now() - startTime }
        );
      }

      if (plan.status !== 'approved') {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan cannot be executed - current status: ${plan.status}`,
          { planId, currentStatus: plan.status },
          { duration: Date.now() - startTime }
        );
      }

      // Update plan status to executing
      plan.status = 'executing';
      plan.execution = {
        currentStep: 0,
        startTime: Date.now(),
        results: []
      };

      // Update execution context
      const executionContext = this.executionContexts.get(planId);
      if (executionContext) {
        executionContext.currentPhase = PlanPhase.EXECUTION;
        executionContext.toolExecutionEnabled = true;
        executionContext.lastStepTime = Date.now();
      }

      await this.persistPlan(plan);
      
      return createSuccessResult(
        { planId, status: plan.status },
        { duration: Date.now() - startTime }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to start plan execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { planId, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Execute the next step in the plan with comprehensive error handling and stopping
   */
  async executeNextStep(planId: string): Promise<StandardToolResult<PlanStepResult>> {
    const startTime = Date.now();
    
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan not found: ${planId}`,
          { planId },
          { duration: Date.now() - startTime }
        );
      }

      if (plan.status !== 'executing') {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan is not in executing state: ${plan.status}`,
          { planId, currentStatus: plan.status },
          { duration: Date.now() - startTime }
        );
      }

      if (!plan.execution) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          'Plan execution context is missing',
          { planId },
          { duration: Date.now() - startTime }
        );
      }

      const currentStepIndex = plan.execution.currentStep;
      if (currentStepIndex >= plan.plan.steps.length) {
        // All steps completed
        plan.status = 'completed';
        await this.persistPlan(plan);
        
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          'All plan steps have been completed',
          { planId, totalSteps: plan.plan.steps.length },
          { duration: Date.now() - startTime }
        );
      }

      const currentStep = plan.plan.steps[currentStepIndex];
      
      console.log(`[Plan Execution] Processing step ${currentStepIndex + 1}/${plan.plan.steps.length}: ${currentStep.title}`);
      
      // Check dependencies
      const dependencyCheck = this.checkStepDependencies(currentStep, plan.execution.results);
      if (!dependencyCheck.satisfied) {
        const errorMessage = `Step dependencies not satisfied: ${dependencyCheck.missing.join(', ')}`;
        console.log(`[Plan Execution] ❌ ${errorMessage}`);
        
        // Mark plan as failed due to dependency issues
        plan.status = 'failed';
        await this.persistPlan(plan);
        
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          errorMessage,
          { planId, stepId: currentStep.id, missingDependencies: dependencyCheck.missing },
          { duration: Date.now() - startTime }
        );
      }

      // Execute the step
      const stepResult = await this.executeStep(currentStep);
      
      // Record the result
      plan.execution.results.push({
        stepId: currentStep.id,
        result: stepResult,
        timestamp: Date.now()
      });

      // Update execution context
      const executionContext = this.executionContexts.get(planId);
      if (executionContext) {
        executionContext.stepResults.push(stepResult);
        executionContext.lastStepTime = Date.now();
      }

      // Handle step failure - stop execution
      if (!stepResult.success) {
        console.log(`[Plan Execution] ❌ Step failed, stopping execution: ${stepResult.error?.message}`);
        plan.status = 'failed';
        await this.persistPlan(plan);
        
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan execution stopped due to step failure: ${stepResult.error?.message || 'Unknown error'}`,
          { 
            planId, 
            stepId: currentStep.id, 
            stepResult,
            stepsCompleted: currentStepIndex,
            totalSteps: plan.plan.steps.length
          },
          { 
            duration: Date.now() - startTime,
            warnings: ['Plan execution has been stopped due to step failure']
          }
        );
      }

      // Move to next step
      plan.execution.currentStep++;

      // Check if this was the last step
      if (plan.execution.currentStep >= plan.plan.steps.length) {
        plan.status = 'completed';
        console.log(`[Plan Execution] ✅ Plan completed successfully: ${plan.plan.title}`);
      } else {
        console.log(`[Plan Execution] ✅ Step completed, moving to step ${plan.execution.currentStep + 1}/${plan.plan.steps.length}`);
      }

      await this.persistPlan(plan);
      
      return createSuccessResult(stepResult, {
        duration: Date.now() - startTime,
        warnings: plan.status === 'completed' ? ['Plan execution completed successfully'] : undefined
      });
    } catch (error) {
      console.log(`[Plan Execution] ❌ Unexpected error during step execution:`, error);
      
      // Mark plan as failed
      const plan = this.plans.get(planId);
      if (plan) {
        plan.status = 'failed';
        await this.persistPlan(plan);
      }
      
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Step execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { planId, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Check if step dependencies are satisfied
   */
  private checkStepDependencies(
    step: PlanStep, 
    completedResults: Array<{ stepId: string; result: any; timestamp: number }>
  ): { satisfied: boolean; missing: string[] } {
    if (!step.dependencies || step.dependencies.length === 0) {
      return { satisfied: true, missing: [] };
    }

    const completedStepIds = new Set(completedResults.map(r => r.stepId));
    const missing = step.dependencies.filter(depId => !completedStepIds.has(depId));
    
    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  /**
   * Execute a single plan step with comprehensive error handling
   */
  private async executeStep(step: PlanStep): Promise<PlanStepResult> {
    const stepStartTime = Date.now();
    
    try {
      console.log(`[Plan Execution] Starting step: ${step.title}`);
      console.log(`[Plan Execution] Tool: ${step.tool || 'No tool specified'}`);
      console.log(`[Plan Execution] Parameters:`, step.parameters || {});
      
      // Validate step before execution
      const validationResult = this.validateStep(step);
      if (!validationResult.valid) {
        throw new Error(`Step validation failed: ${validationResult.errors.join(', ')}`);
      }

      // In a real implementation, this would integrate with the actual tool execution system
      // For now, we'll simulate step execution with more realistic behavior
      
      let result: any;
      let success = true;
      let errorDetails: any = null;

      if (step.tool) {
        // Simulate tool execution
        result = await this.simulateToolExecution(step);
      } else {
        // Handle steps without tools (e.g., manual steps, checkpoints)
        result = {
          stepId: step.id,
          type: 'manual_step',
          title: step.title,
          description: step.description,
          completed: true,
          timestamp: Date.now()
        };
      }

      // Validate step result
      if (result && typeof result === 'object' && result.error) {
        success = false;
        errorDetails = result.error;
      }

      const stepResult: PlanStepResult = {
        stepId: step.id,
        success,
        result: success ? result : undefined,
        error: success ? undefined : {
          code: errorDetails?.code || ErrorCode.VALIDATION_ERROR,
          message: errorDetails?.message || 'Step execution failed',
          details: { step, error: errorDetails }
        },
        timestamp: Date.now(),
        duration: Date.now() - stepStartTime
      };

      if (success) {
        console.log(`[Plan Execution] ✅ Step completed: ${step.title} (${stepResult.duration}ms)`);
      } else {
        console.log(`[Plan Execution] ❌ Step failed: ${step.title} - ${stepResult.error?.message}`);
      }

      return stepResult;
    } catch (error) {
      const stepResult: PlanStepResult = {
        stepId: step.id,
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error during step execution',
          details: { step, error }
        },
        timestamp: Date.now(),
        duration: Date.now() - stepStartTime
      };

      console.log(`[Plan Execution] ❌ Step failed with exception: ${step.title} - ${stepResult.error?.message || 'Unknown error'}`);
      return stepResult;
    }
  }

  /**
   * Validate a step before execution
   */
  private validateStep(step: PlanStep): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!step.id) {
      errors.push('Step ID is required');
    }

    if (!step.title) {
      errors.push('Step title is required');
    }

    if (!step.description) {
      errors.push('Step description is required');
    }

    // Validate tool if specified
    if (step.tool) {
      if (typeof step.tool !== 'string' || step.tool.trim().length === 0) {
        errors.push('Tool name must be a non-empty string');
      }
    }

    // Validate parameters if specified
    if (step.parameters && typeof step.parameters !== 'object') {
      errors.push('Step parameters must be an object');
    }

    // Validate dependencies if specified
    if (step.dependencies) {
      if (!Array.isArray(step.dependencies)) {
        errors.push('Step dependencies must be an array');
      } else {
        for (const dep of step.dependencies) {
          if (typeof dep !== 'string' || dep.trim().length === 0) {
            errors.push('Each dependency must be a non-empty string');
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Simulate tool execution for demonstration purposes
   */
  private async simulateToolExecution(step: PlanStep): Promise<any> {
    // Simulate processing time based on step complexity
    const baseDelay = 50;
    const complexityMultiplier = step.parameters ? Object.keys(step.parameters).length : 1;
    const delay = baseDelay + (complexityMultiplier * 25);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate different outcomes based on step type
    const stepType = step.tool?.toLowerCase() || 'unknown';
    
    switch (stepType) {
      case 'analyze_requirements':
        return {
          stepId: step.id,
          toolUsed: step.tool,
          analysis: {
            requirements: step.parameters?.requirements || [],
            complexity: 'medium',
            estimatedTime: '2-3 hours',
            dependencies: step.dependencies || []
          },
          recommendations: [
            'Break down complex requirements into smaller tasks',
            'Identify potential risks early',
            'Plan for testing and validation'
          ],
          timestamp: Date.now()
        };

      case 'create_detailed_plan':
        return {
          stepId: step.id,
          toolUsed: step.tool,
          plan: {
            title: step.parameters?.title || 'Implementation Plan',
            description: step.parameters?.description || 'Detailed implementation plan',
            phases: ['Analysis', 'Design', 'Implementation', 'Testing', 'Deployment'],
            constraints: step.parameters?.constraints || []
          },
          timeline: {
            estimatedDuration: '1-2 weeks',
            milestones: ['Requirements complete', 'Design approved', 'Implementation done', 'Testing complete']
          },
          timestamp: Date.now()
        };

      case 'execute_implementation_step':
        const stepNumber = step.parameters?.stepNumber || 1;
        return {
          stepId: step.id,
          toolUsed: step.tool,
          implementation: {
            stepNumber,
            description: `Implementation step ${stepNumber} completed`,
            filesModified: [`file_${stepNumber}.ts`, `test_${stepNumber}.test.ts`],
            linesOfCode: Math.floor(Math.random() * 200) + 50
          },
          status: 'completed',
          timestamp: Date.now()
        };

      case 'validate_implementation':
        return {
          stepId: step.id,
          toolUsed: step.tool,
          validation: {
            requirements: step.parameters?.requirements || [],
            testsPassed: Math.floor(Math.random() * 10) + 15,
            testsFailed: Math.floor(Math.random() * 2),
            coverage: Math.floor(Math.random() * 20) + 80
          },
          issues: [],
          recommendations: ['All requirements validated successfully'],
          timestamp: Date.now()
        };

      default:
        // Generic tool execution
        return {
          stepId: step.id,
          toolUsed: step.tool,
          parameters: step.parameters,
          output: `Tool ${step.tool} executed successfully`,
          metadata: {
            executionTime: delay,
            success: true
          },
          timestamp: Date.now()
        };
    }
  }

  /**
   * Execute all remaining steps in the plan sequentially
   */
  async executeAllSteps(planId: string): Promise<StandardToolResult<{
    planId: string;
    status: string;
    stepsExecuted: number;
    totalSteps: number;
    results: PlanStepResult[];
    failedStep?: string;
  }>> {
    const startTime = Date.now();
    
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan not found: ${planId}`,
          { planId },
          { duration: Date.now() - startTime }
        );
      }

      if (plan.status !== 'executing') {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan is not in executing state: ${plan.status}`,
          { planId, currentStatus: plan.status },
          { duration: Date.now() - startTime }
        );
      }

      console.log(`[Plan Execution] Starting sequential execution of all remaining steps for plan: ${plan.plan.title}`);
      
      const executionResults: PlanStepResult[] = [];
      let stepsExecuted = 0;
      let failedStep: string | undefined;

      // Execute steps sequentially until completion or failure
      while (plan.status === 'executing' && plan.execution && plan.execution.currentStep < plan.plan.steps.length) {
        const stepResult = await this.executeNextStep(planId);
        
        if (!stepResult.success) {
          // Execution failed or stopped
          failedStep = plan.plan.steps[plan.execution.currentStep]?.id;
          break;
        }
        
        if (stepResult.data) {
          executionResults.push(stepResult.data);
          stepsExecuted++;
        }
        
        // Small delay between steps to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Get final plan state
      const finalPlan = this.plans.get(planId);
      const finalStatus = finalPlan?.status || 'unknown';
      
      console.log(`[Plan Execution] Sequential execution completed. Status: ${finalStatus}, Steps executed: ${stepsExecuted}/${plan.plan.steps.length}`);
      
      return createSuccessResult({
        planId,
        status: finalStatus,
        stepsExecuted,
        totalSteps: plan.plan.steps.length,
        results: executionResults,
        failedStep
      }, {
        duration: Date.now() - startTime,
        warnings: failedStep ? [`Execution stopped at step: ${failedStep}`] : undefined
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Sequential execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { planId, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Cancel plan execution
   */
  async cancelExecution(planId: string, reason?: string): Promise<StandardToolResult<PlanState>> {
    const startTime = Date.now();
    
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Plan not found: ${planId}`,
          { planId },
          { duration: Date.now() - startTime }
        );
      }

      plan.status = 'cancelled';
      
      // Update execution context
      const executionContext = this.executionContexts.get(planId);
      if (executionContext) {
        executionContext.toolExecutionEnabled = false;
      }

      await this.persistPlan(plan);
      
      return createSuccessResult(plan, {
        duration: Date.now() - startTime,
        warnings: reason ? [`Plan cancelled: ${reason}`] : ['Plan cancelled']
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to cancel plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { planId, reason, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Get plan state
   */
  getPlan(planId: string): PlanState | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Get execution context
   */
  getExecutionContext(planId: string): PlanExecutionContext | null {
    return this.executionContexts.get(planId) || null;
  }

  /**
   * Get all plans for a session
   */
  getSessionPlans(sessionId: string): PlanState[] {
    return Array.from(this.plans.values()).filter(plan => plan.sessionId === sessionId);
  }

  /**
   * Persist plan to disk
   */
  private async persistPlan(plan: PlanState): Promise<void> {
    try {
      const planFile = join(this.PLAN_STORAGE_DIR, `${plan.planId}.json`);
      await fs.writeFile(planFile, JSON.stringify(plan, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to persist plan ${plan.planId}:`, error);
    }
  }

  /**
   * Load plan from disk
   */
  private async loadPlan(planId: string): Promise<PlanState | null> {
    try {
      const planFile = join(this.PLAN_STORAGE_DIR, `${planId}.json`);
      const planData = await fs.readFile(planFile, 'utf-8');
      return JSON.parse(planData) as PlanState;
    } catch {
      return null;
    }
  }

  /**
   * Load all plans from disk
   */
  async loadAllPlans(): Promise<void> {
    try {
      const files = await fs.readdir(this.PLAN_STORAGE_DIR);
      const planFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of planFiles) {
        const planId = file.replace('.json', '');
        const plan = await this.loadPlan(planId);
        if (plan) {
          this.plans.set(planId, plan);
          
          // Recreate execution context if plan is in progress
          if (plan.status === 'executing' || plan.status === 'approved') {
            const executionContext: PlanExecutionContext = {
              planId: plan.planId,
              sessionId: plan.sessionId,
              currentPhase: plan.status === 'executing' ? PlanPhase.EXECUTION : PlanPhase.GENERATION,
              toolExecutionEnabled: plan.status === 'executing',
              stepResults: [],
              startTime: plan.execution?.startTime || Date.now()
            };
            this.executionContexts.set(planId, executionContext);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load plans from disk:', error);
    }
  }
}

/**
 * Plan Mode Plugin
 */
export const planModePlugin = async ({ client, $, directory }: any) => {
  const planStateManager = new PlanStateManager();
  
  // Load existing plans on startup
  await planStateManager.loadAllPlans();

  return {
    tools: {
      create_plan: {
        description: "Create a new plan in draft state for two-phase execution",
        parameters: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID for the plan"
            },
            title: {
              type: "string",
              description: "Title of the plan"
            },
            description: {
              type: "string",
              description: "Detailed description of what the plan should accomplish"
            },
            requirements: {
              type: "array",
              items: { type: "string" },
              description: "List of requirements the plan must fulfill"
            },
            constraints: {
              type: "array",
              items: { type: "string" },
              description: "Optional constraints or limitations for the plan"
            },
            estimatedSteps: {
              type: "number",
              description: "Estimated number of implementation steps (default: 3)",
              default: 3
            }
          },
          required: ["sessionId", "title", "description", "requirements"]
        },
        handler: async ({ 
          sessionId, 
          title, 
          description, 
          requirements, 
          constraints, 
          estimatedSteps = 3 
        }: {
          sessionId: string;
          title: string;
          description: string;
          requirements: string[];
          constraints?: string[];
          estimatedSteps?: number;
        }) => {
          const request: PlanGenerationRequest = {
            title,
            description,
            requirements,
            constraints,
            estimatedSteps
          };
          
          return await planStateManager.createPlan(sessionId, request);
        }
      },

      approve_plan: {
        description: "Approve or reject a plan for execution",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to approve or reject"
            },
            approved: {
              type: "boolean",
              description: "Whether the plan is approved (true) or rejected (false)"
            },
            modifications: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      tool: { type: "string" },
                      parameters: { type: "object" },
                      dependencies: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["id", "title", "description"]
                  }
                }
              },
              description: "Optional modifications to apply to the plan before approval"
            },
            comments: {
              type: "string",
              description: "Optional comments about the approval decision"
            }
          },
          required: ["planId", "approved"]
        },
        handler: async ({ planId, approved, modifications, comments }: PlanApprovalRequest) => {
          const approval: PlanApprovalRequest = {
            planId,
            approved,
            modifications,
            comments
          };
          
          return await planStateManager.approvePlan(approval);
        }
      },

      start_plan_execution: {
        description: "Start executing an approved plan",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the approved plan to start executing"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId }: { planId: string }) => {
          return await planStateManager.startExecution(planId);
        }
      },

      execute_next_step: {
        description: "Execute the next step in the plan",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to execute next step for"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId }: { planId: string }) => {
          return await planStateManager.executeNextStep(planId);
        }
      },

      execute_all_steps: {
        description: "Execute all remaining steps in the plan sequentially",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to execute all steps for"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId }: { planId: string }) => {
          return await planStateManager.executeAllSteps(planId);
        }
      },

      cancel_plan: {
        description: "Cancel plan execution",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to cancel"
            },
            reason: {
              type: "string",
              description: "Optional reason for cancellation"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId, reason }: { planId: string; reason?: string }) => {
          return await planStateManager.cancelExecution(planId, reason);
        }
      },

      get_plan: {
        description: "Get the current state of a plan",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to retrieve"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId }: { planId: string }) => {
          const startTime = Date.now();
          
          try {
            const plan = planStateManager.getPlan(planId);
            
            if (!plan) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Plan not found: ${planId}`,
                { planId },
                { duration: Date.now() - startTime }
              );
            }

            const executionContext = planStateManager.getExecutionContext(planId);
            
            return createSuccessResult(
              { plan, executionContext },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to get plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { planId, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      list_session_plans: {
        description: "List all plans for a session",
        parameters: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID to list plans for"
            }
          },
          required: ["sessionId"]
        },
        handler: async ({ sessionId }: { sessionId: string }) => {
          const startTime = Date.now();
          
          try {
            const plans = planStateManager.getSessionPlans(sessionId);
            
            return createSuccessResult(
              { sessionId, plans, count: plans.length },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to list session plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { sessionId, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      get_plan_progress: {
        description: "Get execution progress for a plan",
        parameters: {
          type: "object",
          properties: {
            planId: {
              type: "string",
              description: "ID of the plan to get progress for"
            }
          },
          required: ["planId"]
        },
        handler: async ({ planId }: { planId: string }) => {
          const startTime = Date.now();
          
          try {
            const plan = planStateManager.getPlan(planId);
            const executionContext = planStateManager.getExecutionContext(planId);
            
            if (!plan) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Plan not found: ${planId}`,
                { planId },
                { duration: Date.now() - startTime }
              );
            }

            const progress = {
              planId: plan.planId,
              status: plan.status,
              totalSteps: plan.plan.steps.length,
              completedSteps: plan.execution?.currentStep || 0,
              currentPhase: executionContext?.currentPhase || PlanPhase.GENERATION,
              toolExecutionEnabled: executionContext?.toolExecutionEnabled || false,
              startTime: plan.execution?.startTime,
              lastStepTime: executionContext?.lastStepTime,
              stepResults: executionContext?.stepResults || [],
              progressPercentage: plan.plan.steps.length > 0 
                ? Math.round(((plan.execution?.currentStep || 0) / plan.plan.steps.length) * 100)
                : 0
            };
            
            return createSuccessResult(progress, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              `Failed to get plan progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { planId, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    hooks: {
      "tool.execute.before": async (context: { tool: string; input: any; context: any }) => {
        // Check if we're in plan mode and tool execution is disabled
        const sessionId = context.context?.sessionId;
        if (sessionId) {
          const sessionPlans = planStateManager.getSessionPlans(sessionId);
          
          // Find any plan in generation phase
          const generatingPlan = sessionPlans.find(plan => {
            const executionContext = planStateManager.getExecutionContext(plan.planId);
            return executionContext && executionContext.currentPhase === PlanPhase.GENERATION;
          });
          
          if (generatingPlan) {
            const executionContext = planStateManager.getExecutionContext(generatingPlan.planId);
            
            if (executionContext && !executionContext.toolExecutionEnabled) {
              // Tools are disabled during plan generation phase
              console.log(`[Plan Mode] ❌ Tool execution blocked during generation phase: ${context.tool}`);
              throw new Error(
                `Tool execution is disabled during plan generation phase. ` +
                `Plan "${generatingPlan.plan.title}" (ID: ${generatingPlan.planId}) must be approved first. ` +
                `Use approve_plan tool to approve the plan before executing tools.`
              );
            }
          }
          
          // Log tool execution in plan context
          const executingPlan = sessionPlans.find(plan => plan.status === 'executing');
          if (executingPlan) {
            console.log(`[Plan Mode] 🔧 Tool execution in plan context: ${context.tool} (Plan: ${executingPlan.planId})`);
          }
        }
      },

      "tool.execute.after": async (context: { tool: string; input: any; result: any; context: any }) => {
        // Track tool execution results for plan progress
        const sessionId = context.context?.sessionId;
        if (sessionId) {
          const sessionPlans = planStateManager.getSessionPlans(sessionId);
          const executingPlan = sessionPlans.find(plan => plan.status === 'executing');
          
          if (executingPlan) {
            const executionContext = planStateManager.getExecutionContext(executingPlan.planId);
            if (executionContext) {
              // Log successful tool execution
              if (context.result && !context.result.error) {
                console.log(`[Plan Mode] ✅ Tool completed successfully: ${context.tool} (Plan: ${executingPlan.planId})`);
              } else {
                console.log(`[Plan Mode] ❌ Tool failed: ${context.tool} (Plan: ${executingPlan.planId})`);
              }
            }
          }
        }
      },

      "session.created": async (context: { session: any }) => {
        // Initialize plan mode for new sessions
        console.log(`[Plan Mode] Session created: ${context.session.id}`);
        console.log(`[Plan Mode] Plan mode plugin ready for two-phase execution`);
      }
    }
  };
};

export default planModePlugin;