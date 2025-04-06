import { workflowLogger } from "./logger";
import { toolRegistry } from "./tools/base";
import { DealsTool, Deal } from "./tools/deals";
import { trackToolAction } from "./oauth-utils";

/**
 * Interface representing a workflow step
 */
interface WorkflowStep<InputType, OutputType> {
  name: string;
  execute: (input: InputType, context: WorkflowContext) => Promise<OutputType>;
}

/**
 * Workflow execution context with shared data
 */
interface WorkflowContext {
  userId: string;
  workflowId: string;
  startTime: number;
  data: Record<string, any>;
}

/**
 * Workflow result interface
 */
interface WorkflowResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
  steps: {
    name: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTimeMs: number;
  }[];
}

/**
 * Base workflow class with chained execution capabilities
 */
export class Workflow<InputType, OutputType> {
  private steps: WorkflowStep<any, any>[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Add a step to the workflow
   */
  addStep<StepInput, StepOutput>(
    name: string,
    execute: (input: StepInput, context: WorkflowContext) => Promise<StepOutput>
  ): Workflow<InputType, StepOutput> {
    this.steps.push({ name, execute });
    return this as unknown as Workflow<InputType, StepOutput>;
  }

  /**
   * Execute the entire workflow
   */
  async execute(
    userId: string,
    input: InputType
  ): Promise<WorkflowResult<OutputType>> {
    const workflowId = `${this.name}-${Date.now()}`;
    const startTime = Date.now();

    const context: WorkflowContext = {
      userId,
      workflowId,
      startTime,
      data: {},
    };

    workflowLogger.info(`Starting workflow: ${this.name}`, {
      workflowId,
      input,
    });

    const stepResults = [];
    let lastOutput: any = input;
    let success = true;
    let error: string | undefined;

    for (const step of this.steps) {
      const stepStartTime = Date.now();
      workflowLogger.info(`Executing step: ${step.name}`, {
        workflowId,
        input: lastOutput,
      });

      try {
        const stepOutput = await step.execute(lastOutput, context);

        const stepExecutionTime = Date.now() - stepStartTime;
        workflowLogger.info(`Step completed: ${step.name}`, {
          workflowId,
          executionTimeMs: stepExecutionTime,
          output: stepOutput,
        });

        stepResults.push({
          name: step.name,
          success: true,
          data: stepOutput,
          executionTimeMs: stepExecutionTime,
        });

        lastOutput = stepOutput;
        context.data[step.name] = stepOutput;
      } catch (err) {
        const stepExecutionTime = Date.now() - stepStartTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        workflowLogger.error(`Step failed: ${step.name}`, {
          workflowId,
          error: errorMessage,
          executionTimeMs: stepExecutionTime,
        });

        stepResults.push({
          name: step.name,
          success: false,
          error: errorMessage,
          executionTimeMs: stepExecutionTime,
        });

        success = false;
        error = `Step '${step.name}' failed: ${errorMessage}`;
        break;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    workflowLogger.info(
      `Workflow ${success ? "completed" : "failed"}: ${this.name}`,
      {
        workflowId,
        executionTimeMs,
        success,
        error,
      }
    );

    return {
      success,
      data: success ? lastOutput : undefined,
      error,
      executionTimeMs,
      steps: stepResults,
    };
  }
}

/**
 * Predefined workflow for summarizing a deal and creating a Google Doc
 */
export const dealSummaryWorkflow = new Workflow<
  { dealId: string },
  { documentId: string; documentUrl: string }
>("deal-summary")
  // Step 1: Retrieve deal information from CRM
  .addStep(
    "retrieve-deal-info",
    async (input: { dealId: string }, context: WorkflowContext) => {
      const result = await toolRegistry.executeTool(
        "crm-deals",
        context.userId,
        {
          id: input.dealId,
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to retrieve deal information");
      }

      // Track the tool action
      trackToolAction(
        context.userId,
        {
          provider: "crm",
          action: "get_deal",
          parameters: {
            dealId: input.dealId,
          },
        },
        {
          success: true,
          details: {
            dealId: input.dealId,
            title: result.data.name,
            description: `Deal amount: $${result.data.amount.toLocaleString()}`,
          },
        }
      );

      return result.data;
    }
  )

  // Step 2: Generate a summary of the deal
  .addStep(
    "generate-summary",
    async (dealData: Deal, context: WorkflowContext) => {
      // Format the deal data into a summary
      const summaryTitle = `${dealData.name} - Deal Summary`;

      // Create a structured summary with all deal information
      const summary = [
        `# Deal Summary: ${dealData.name}`,
        "",
        "## Deal Overview",
        `**Amount**: $${dealData.amount.toLocaleString()}`,
        `**Stage**: ${dealData.stage}`,
        `**Probability**: ${dealData.probability}%`,
        `**Close Date**: ${new Date(dealData.closeDate).toLocaleDateString()}`,
        "",
        "## Description",
        dealData.description || "No description provided.",
        "",
        "## Notes",
        dealData.notes || "No additional notes.",
        "",
        "## Next Steps",
        "1. Follow up with stakeholders",
        "2. Schedule product demonstration",
        "3. Prepare proposal revisions",
        "",
        `## Summary Generated`,
        `This summary was automatically generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      ].join("\n");

      return {
        title: summaryTitle,
        content: summary,
        dealData,
      };
    }
  )

  // Step 3: Create a Google Doc with the summary
  .addStep(
    "create-document",
    async (
      summaryData: { title: string; content: string; dealData: Deal },
      context: WorkflowContext
    ) => {
      const result = await toolRegistry.executeTool(
        "documents",
        context.userId,
        {
          title: summaryData.title,
          content: summaryData.content,
          template: {
            type: "deal-summary",
            data: summaryData.dealData,
          },
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to create document");
      }

      // Track the tool action
      trackToolAction(
        context.userId,
        {
          provider: "google-docs",
          action: "create_document",
          parameters: {
            documentTitle: summaryData.title,
          },
        },
        {
          success: true,
          details: {
            documentId: result.data.id,
            documentTitle: result.data.title,
            title: result.data.title,
            link: `https://docs.google.com/document/d/${result.data.id}`,
          },
        }
      );

      return {
        documentId: result.data.id,
        documentUrl: `https://docs.google.com/document/d/${result.data.id}`,
        title: result.data.title,
      };
    }
  );

/**
 * Function to execute the deal summary workflow
 */
export async function summarizeDealToDocument(userId: string, dealId: string) {
  return dealSummaryWorkflow.execute(userId, { dealId });
}
