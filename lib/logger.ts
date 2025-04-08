/**
 * Simple logger utility for the application
 */

// Base logger interface
export interface Logger {
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
}

// Development logger that logs to console
class ConsoleLogger implements Logger {
  info(message: string, context: Record<string, any> = {}) {
    console.log(`[INFO] ${message}`, context);
  }

  warn(message: string, context: Record<string, any> = {}) {
    console.warn(`[WARN] ${message}`, context);
  }

  error(message: string, context: Record<string, any> = {}) {
    console.error(`[ERROR] ${message}`, context);
  }

  debug(message: string, context: Record<string, any> = {}) {
    console.debug(`[DEBUG] ${message}`, context);
  }
}

// Specialized tool logger
export const toolLogger: Logger = new ConsoleLogger();

// General application logger
export const appLogger: Logger = new ConsoleLogger();

// Export default logger
export default appLogger;
