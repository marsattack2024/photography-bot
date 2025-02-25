import { getDiscordBot } from './discord/discordBot';
import { enhancedLogger as logger } from './utils/logger';

class Server {
  private static instance: Server;
  private isShuttingDown = false;
  private discordBot = getDiscordBot();

  private constructor() {
    this.setupProcessHandlers();
  }

  public static getInstance(): Server {
    if (!Server.instance) {
      Server.instance = new Server();
    }
    return Server.instance;
  }

  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled Promise Rejection:', error);
      this.shutdown(1);
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting server...');
      await this.discordBot.start();
      logger.info('Server started successfully');
    } catch (error) {
      logger.error('Failed to start server:', error as Error);
      await this.shutdown(1);
    }
  }

  public async shutdown(code: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Server shutdown initiated');

    try {
      await this.discordBot.stop();
      logger.info('Server shutdown completed');
      process.exit(code);
    } catch (error) {
      logger.error('Error during shutdown:', error as Error);
      process.exit(1);
    }
  }
}

// Start the server
const server = Server.getInstance();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
