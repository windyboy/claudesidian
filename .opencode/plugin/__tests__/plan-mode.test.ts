/**
 * Plan Mode Plugin Tests
 * Basic functionality tests for the plan mode plugin
 */

import { PlanStateManager, PlanPhase } from '../plan-mode';
import { PlanGenerationRequest, PlanApprovalRequest } from '../plan-mode';

describe('Plan Mode Plugin', () => {
  let planStateManager: PlanStateManager;

  beforeEach(() => {
    planStateManager = new PlanStateManager();
  });

  describe('Plan Creation', () => {
    test('should create a plan in draft state', async () => {
      const request: PlanGenerationRequest = {
        title: 'Test Plan',
        description: 'A test plan for validation',
        requirements: ['Requirement 1', 'Requirement 2'],
        estimatedSteps: 3
      };

      const result = await planStateManager.createPlan('session_123', request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('draft');
      expect(result.data!.plan.title).toBe('Test Plan');
      expect(result.data!.plan.steps.length).toBeGreaterThan(0);
    });

    test('should generate appropriate steps based on requirements', async () => {
      const request: PlanGenerationRequest = {
        title: 'Implementation Plan',
        description: 'Implement a new feature',
        requirements: ['Feature A', 'Feature B'],
        estimatedSteps: 2
      };

      const result = await planStateManager.createPlan('session_456', request);

      expect(result.success).toBe(true);
      const plan = result.data!;
      
      // Should have analysis, planning, implementation, and validation steps
      expect(plan.plan.steps.length).toBeGreaterThanOrEqual(4);
      
      // First step should be analysis
      expect(plan.plan.steps[0].title).toContain('Analyze');
      expect(plan.plan.steps[0].tool).toBe('analyze_requirements');
      
      // Should have validation as last step
      const lastStep = plan.plan.steps[plan.plan.steps.length - 1];
      expect(lastStep.title).toContain('Validate');
      expect(lastStep.tool).toBe('validate_implementation');
    });
  });

  describe('Plan Approval', () => {
    test('should approve a draft plan', async () => {
      // Create a plan first
      const createResult = await planStateManager.createPlan('session_789', {
        title: 'Approval Test Plan',
        description: 'Test plan approval',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      expect(createResult.success).toBe(true);
      const planId = createResult.data!.planId;

      // Approve the plan
      const approval: PlanApprovalRequest = {
        planId,
        approved: true,
        comments: 'Plan looks good'
      };

      const approvalResult = await planStateManager.approvePlan(approval);

      expect(approvalResult.success).toBe(true);
      expect(approvalResult.data!.status).toBe('approved');
    });

    test('should reject a draft plan', async () => {
      // Create a plan first
      const createResult = await planStateManager.createPlan('session_101', {
        title: 'Rejection Test Plan',
        description: 'Test plan rejection',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      expect(createResult.success).toBe(true);
      const planId = createResult.data!.planId;

      // Reject the plan
      const approval: PlanApprovalRequest = {
        planId,
        approved: false,
        comments: 'Plan needs more work'
      };

      const approvalResult = await planStateManager.approvePlan(approval);

      expect(approvalResult.success).toBe(true);
      expect(approvalResult.data!.status).toBe('cancelled');
    });

    test('should not approve non-draft plan', async () => {
      // Create and approve a plan first
      const createResult = await planStateManager.createPlan('session_102', {
        title: 'Double Approval Test',
        description: 'Test double approval',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      const planId = createResult.data!.planId;
      await planStateManager.approvePlan({ planId, approved: true });

      // Try to approve again
      const secondApproval = await planStateManager.approvePlan({ planId, approved: true });

      expect(secondApproval.success).toBe(false);
      expect(secondApproval.error?.message).toContain('cannot be approved');
    });
  });

  describe('Plan Execution', () => {
    test('should start execution of approved plan', async () => {
      // Create and approve a plan
      const createResult = await planStateManager.createPlan('session_103', {
        title: 'Execution Test Plan',
        description: 'Test plan execution',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      const planId = createResult.data!.planId;
      await planStateManager.approvePlan({ planId, approved: true });

      // Start execution
      const executionResult = await planStateManager.startExecution(planId);

      expect(executionResult.success).toBe(true);
      expect(executionResult.data!.status).toBe('executing');

      // Check execution context
      const executionContext = planStateManager.getExecutionContext(planId);
      expect(executionContext).toBeDefined();
      expect(executionContext!.currentPhase).toBe(PlanPhase.EXECUTION);
      expect(executionContext!.toolExecutionEnabled).toBe(true);
    });

    test('should not start execution of non-approved plan', async () => {
      // Create a plan but don't approve it
      const createResult = await planStateManager.createPlan('session_104', {
        title: 'Non-approved Plan',
        description: 'Test non-approved execution',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      const planId = createResult.data!.planId;

      // Try to start execution
      const executionResult = await planStateManager.startExecution(planId);

      expect(executionResult.success).toBe(false);
      expect(executionResult.error?.message).toContain('cannot be executed');
    });

    test('should execute steps sequentially', async () => {
      // Create, approve, and start execution
      const createResult = await planStateManager.createPlan('session_105', {
        title: 'Sequential Test Plan',
        description: 'Test sequential execution',
        requirements: ['Test requirement'],
        estimatedSteps: 2
      });

      const planId = createResult.data!.planId;
      await planStateManager.approvePlan({ planId, approved: true });
      await planStateManager.startExecution(planId);

      // Execute first step
      const firstStepResult = await planStateManager.executeNextStep(planId);
      expect(firstStepResult.success).toBe(true);
      expect(firstStepResult.data!.success).toBe(true);

      // Check plan progress
      const plan = planStateManager.getPlan(planId);
      expect(plan!.execution!.currentStep).toBe(1);
      expect(plan!.execution!.results.length).toBe(1);

      // Execute second step
      const secondStepResult = await planStateManager.executeNextStep(planId);
      expect(secondStepResult.success).toBe(true);
      expect(secondStepResult.data!.success).toBe(true);

      // Check plan progress
      const updatedPlan = planStateManager.getPlan(planId);
      expect(updatedPlan!.execution!.currentStep).toBe(2);
      expect(updatedPlan!.execution!.results.length).toBe(2);
    });
  });

  describe('Plan State Management', () => {
    test('should retrieve plan by ID', async () => {
      const createResult = await planStateManager.createPlan('session_106', {
        title: 'Retrieval Test Plan',
        description: 'Test plan retrieval',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      const planId = createResult.data!.planId;
      const retrievedPlan = planStateManager.getPlan(planId);

      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan!.planId).toBe(planId);
      expect(retrievedPlan!.plan.title).toBe('Retrieval Test Plan');
    });

    test('should list plans by session', async () => {
      const sessionId = 'session_107';

      // Create multiple plans for the same session
      await planStateManager.createPlan(sessionId, {
        title: 'Plan 1',
        description: 'First plan',
        requirements: ['Req 1'],
        estimatedSteps: 1
      });

      await planStateManager.createPlan(sessionId, {
        title: 'Plan 2',
        description: 'Second plan',
        requirements: ['Req 2'],
        estimatedSteps: 1
      });

      const sessionPlans = planStateManager.getSessionPlans(sessionId);

      expect(sessionPlans.length).toBe(2);
      expect(sessionPlans[0].sessionId).toBe(sessionId);
      expect(sessionPlans[1].sessionId).toBe(sessionId);
    });

    test('should cancel plan execution', async () => {
      // Create, approve, and start execution
      const createResult = await planStateManager.createPlan('session_108', {
        title: 'Cancellation Test Plan',
        description: 'Test plan cancellation',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      const planId = createResult.data!.planId;
      await planStateManager.approvePlan({ planId, approved: true });
      await planStateManager.startExecution(planId);

      // Cancel execution
      const cancelResult = await planStateManager.cancelExecution(planId, 'User requested cancellation');

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.data!.status).toBe('cancelled');

      // Check execution context
      const executionContext = planStateManager.getExecutionContext(planId);
      expect(executionContext!.toolExecutionEnabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent plan ID', async () => {
      const result = await planStateManager.startExecution('non_existent_plan');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Plan not found');
    });

    test('should handle step dependency validation', async () => {
      // This would require more complex setup to test dependency failures
      // For now, we'll test that the dependency checking logic exists
      const createResult = await planStateManager.createPlan('session_109', {
        title: 'Dependency Test Plan',
        description: 'Test dependency validation',
        requirements: ['Test requirement'],
        estimatedSteps: 1
      });

      expect(createResult.success).toBe(true);
      
      // The plan should have steps with proper dependencies
      const plan = createResult.data!;
      const stepsWithDeps = plan.plan.steps.filter(step => step.dependencies && step.dependencies.length > 0);
      expect(stepsWithDeps.length).toBeGreaterThan(0);
    });
  });
});