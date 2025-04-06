import posthog from "posthog-js";

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Default log level
const DEFAULT_LOG_LEVEL =
  process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

// Logger class for centralized logging
export class Logger {
  private context: string;
  private logLevel: LogLevel;

  constructor(context: string, logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
    this.context = context;
    this.logLevel = logLevel;
  }

  // Format log message with timestamp and context
  private formatMessage(message: string): string {
    return `[${new Date().toISOString()}] [${this.context}] ${message}`;
  }

  // Log to console with appropriate level
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.logLevel) return;

    const formattedMessage = this.formatMessage(message);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data || "");
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data || "");
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || "");
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data || "");
        break;
    }

    // Track in analytics for non-debug logs
    if (level > LogLevel.DEBUG) {
      this.trackAnalytics(level, message, data);
    }
  }

  // Track in analytics system
  private trackAnalytics(level: LogLevel, message: string, data?: any): void {
    try {
      const eventName = level === LogLevel.ERROR ? "error" : "log";
      posthog.capture(eventName, {
        context: this.context,
        level: LogLevel[level],
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Silently fail if analytics tracking fails
      console.error("Failed to track analytics:", e);
    }
  }

  // Public logging methods
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  // Log API calls with request and response details
  logApiCall(
    api: string,
    method: string,
    request: any,
    response: any,
    durationMs?: number
  ): void {
    this.info(`API Call: ${api} (${method})`, {
      api,
      method,
      request,
      response:
        typeof response === "object"
          ? {
              status: response.status,
              ok: response.ok,
              data: response.data || null,
            }
          : response,
      durationMs,
    });
  }

  // Log tool execution with details
  logToolExecution(
    toolName: string,
    operation: string,
    input: any,
    output: any,
    durationMs: number
  ): void {
    this.info(`Tool Execution: ${toolName}.${operation}`, {
      tool: toolName,
      operation,
      input,
      output,
      durationMs,
      success: !output?.error,
    });
  }

  // Log user actions
  logUserAction(userId: string, action: string, details?: any): void {
    this.info(`User Action: ${action}`, {
      userId,
      action,
      details,
    });
  }

  // Log workflow execution
  logWorkflow(workflowName: string, stage: string, details?: any): void {
    this.info(`Workflow: ${workflowName} - ${stage}`, {
      workflow: workflowName,
      stage,
      details,
    });
  }
}

// Create loggers for different contexts
export const createLogger = (context: string) => new Logger(context);

// Common loggers
export const apiLogger = createLogger("API");
export const toolLogger = createLogger("Tools");
export const authLogger = createLogger("Auth");
export const workflowLogger = createLogger("Workflow");
