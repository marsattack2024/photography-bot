import winston from 'winston';
import { TransformableInfo } from 'logform';
import { config } from 'dotenv';

// Load environment variables
config();

// Define custom log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to Winston
winston.addColors(colors);

// Custom format for log entries
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.printf((info: TransformableInfo) => {
    let log = `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;
    
    // Add metadata if present
    if (info.metadata && Object.keys(info.metadata).length > 0) {
      log += ` | ${JSON.stringify(info.metadata)}`;
    }
    
    // Add stack trace for errors
    if (info.stack) {
      log += `\n${info.stack}`;
    }
    
    return log;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Console transport with colored output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    }),
  ],
});

// Add request context tracking
interface LogContext {
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

class LoggerWithContext {
  private context: LogContext = {};

  public setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  public clearContext(): void {
    this.context = {};
  }

  private logWithContext(
    level: keyof typeof levels,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    logger[level](message, { metadata: { ...metadata, ...this.context } });
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.logWithContext('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.logWithContext('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.logWithContext('warn', message, metadata);
  }

  public error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.logWithContext('error', message, {
      ...metadata,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    });
  }
}

// Export the enhanced logger instance
export const enhancedLogger = new LoggerWithContext();

// Export type for metadata
export type LogMetadata = Record<string, unknown>;

// Add shutdown handler
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down logger...');
  logger.end();
});

// Example usage:
/*
enhancedLogger.setContext({ requestId: '123', userId: 'user456' });
enhancedLogger.info('Processing message', { messageId: 'msg789' });
enhancedLogger.error('Failed to process message', new Error('Database error'), { messageId: 'msg789' });
enhancedLogger.clearContext();
*/