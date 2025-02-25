import { Client, Events, Message, ClientOptions, ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { enhancedLogger as logger } from '../utils/logger';
import { Orchestrator } from '../orchestrator/orchestrator';
import { CopywritingExpert } from '../specialists/copywritingExpert';
import { createChatSession, getChatSession, getChatHistory, storeMessage } from '../db/supabase';
import { ChatMessage } from '../db/supabase';

// Load environment variables explicitly
config({ path: path.resolve(process.cwd(), '.env') });

export class DiscordBot {
  private static _instance: DiscordBot | null = null;
  private static isInitializing = false;
  private static readonly LOCK_FILE = path.join(process.cwd(), '.discord-bot.lock');
  private client: Client;
  private readonly token: string;
  private orchestrator: Orchestrator;
  private isStarted = false;
  private processedMessages = new Map<string, number>();
  private sentResponses = new Map<string, number>();
  private readonly messageExpiryMs = 60000; // 1 minute expiry for processed messages
  private userSessions = new Map<string, string>(); // Map user IDs to session IDs

  public static getInstance(): DiscordBot {
    if (!DiscordBot._instance) {
      if (DiscordBot.isInitializing) {
        throw new Error('Circular dependency detected in DiscordBot initialization');
      }
      DiscordBot.isInitializing = true;
      DiscordBot._instance = new DiscordBot();
      DiscordBot.isInitializing = false;
      logger.info('Created new DiscordBot instance');
    }
    return DiscordBot._instance;
  }

  private static checkLock(): boolean {
    try {
      // Check if lock file exists
      if (fs.existsSync(this.LOCK_FILE)) {
        const lockData = fs.readFileSync(this.LOCK_FILE, 'utf8');
        const { pid, timestamp } = JSON.parse(lockData);

        // Check if the process is still running
        try {
          process.kill(pid, 0); // This throws if process doesn't exist
          const age = Date.now() - timestamp;
          logger.warn('Another bot instance is already running', {
            processId: pid,
            instanceAge: Math.floor(age / 1000) + ' seconds',
            lockFilePath: this.LOCK_FILE
          });
          return true;
        } catch (e) {
          // Process is not running, safe to remove stale lock
          logger.info('Removing stale lock file', {
            processId: pid,
            lockFilePath: this.LOCK_FILE
          });
          fs.unlinkSync(this.LOCK_FILE);
        }
      }
      return false;
    } catch (error) {
      logger.error('Error checking lock file', error as Error, {
        lockFilePath: this.LOCK_FILE
      });
      return false;
    }
  }

  private static createLock(): void {
    try {
      const lockData = {
        pid: process.pid,
        timestamp: Date.now()
      };
      fs.writeFileSync(this.LOCK_FILE, JSON.stringify(lockData));
      logger.info('Created lock file', {
        processId: process.pid,
        lockFilePath: this.LOCK_FILE
      });

      // Remove lock file on process exit
      process.on('exit', () => {
        try {
          if (fs.existsSync(this.LOCK_FILE)) {
            fs.unlinkSync(this.LOCK_FILE);
            logger.info('Removed lock file on exit', {
              processId: process.pid,
              lockFilePath: this.LOCK_FILE
            });
          }
        } catch (error) {
          logger.error('Error removing lock file', error as Error, {
            processId: process.pid,
            lockFilePath: this.LOCK_FILE
          });
        }
      });
    } catch (error) {
      logger.error('Error creating lock file', error as Error, {
        processId: process.pid,
        lockFilePath: this.LOCK_FILE
      });
      throw error;
    }
  }

  private constructor() {
    if (DiscordBot._instance) {
      throw new Error('Use DiscordBot.getInstance() instead of new DiscordBot()');
    }

    // Check for existing instance
    if (DiscordBot.checkLock()) {
      throw new Error('Another instance of the bot is already running');
    }

    // Create lock file
    DiscordBot.createLock();

    // Validate environment variables
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN is required in environment variables');
    }
    this.token = token;

    // Log environment state for debugging
    logger.info('Discord Configuration', {
      hasToken: !!token,
      tokenLength: token.length,
      prefix: process.env.DISCORD_BOT_PREFIX
    });

    // Initialize Discord client with required intents
    const clientOptions: ClientOptions = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
      ]
    };

    this.client = new Client(clientOptions);
    this.orchestrator = new Orchestrator([new CopywritingExpert()]);
  }

  private cleanupTrackedMessages(): void {
    const now = Date.now();
    for (const [messageId, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > this.messageExpiryMs) {
        this.processedMessages.delete(messageId);
        this.sentResponses.delete(messageId);
      }
    }
  }

  private async sendMessage(message: Message, content: string): Promise<void> {
    const MAX_MESSAGE_LENGTH = 2000; // Discord's actual message limit
    
    // Check if we've already sent a response to this message
    if (this.sentResponses.has(message.id)) {
      logger.warn('Attempted to send duplicate response', {
        messageId: message.id,
        timeSinceFirstResponse: Date.now() - (this.sentResponses.get(message.id) || 0)
      });
      return;
    }

    try {
      logger.info('Preparing to send response', {
        messageId: message.id,
        responseLength: content.length,
        isDM: message.channel.isDMBased()
      });

      // Mark that we're sending a response to this message
      this.sentResponses.set(message.id, Date.now());

      if (content.length > MAX_MESSAGE_LENGTH) {
        logger.info('Response exceeds Discord limit, splitting message', {
          messageId: message.id,
          totalLength: content.length,
          chunks: Math.ceil(content.length / MAX_MESSAGE_LENGTH)
        });

        await message.reply({
          content: 'The response was too long for Discord. I will send it in multiple parts.'
        });
        
        for (let i = 0; i < content.length; i += MAX_MESSAGE_LENGTH) {
          const chunk = content.slice(i, i + MAX_MESSAGE_LENGTH);
          await message.reply({ content: chunk });
          logger.debug('Sent message chunk', {
            messageId: message.id,
            chunkIndex: Math.floor(i / MAX_MESSAGE_LENGTH) + 1,
            chunkLength: chunk.length
          });
          // Add a small delay between chunks to maintain order
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        await message.reply({ content });
        logger.info('Sent response successfully', {
          messageId: message.id,
          responseLength: content.length
        });
      }
    } catch (error) {
      // Remove from sent responses if the send failed
      this.sentResponses.delete(message.id);
      
      logger.error('Failed to send message', error as Error, {
        messageId: message.id,
        userId: message.author.id,
        contentLength: content.length
      });
      
      // Only send error message if we haven't sent any response yet
      if (!this.sentResponses.has(message.id)) {
        await message.reply({
          content: 'I encountered an error processing your request. Please try again later.'
        });
      }
    }
  }

  private async handleError(message: Message, error?: Error): Promise<void> {
    try {
      let errorMessage = 'I apologize, but I encountered an error processing your message. Please try again later.';
      
      // Add more context if available
      if (error?.message) {
        errorMessage += `\n\nError details: ${error.message}`;
      }

      await this.sendMessage(message, errorMessage);
    } catch (error) {
      logger.error('Failed to send error message to user', error as Error, {
        userId: message.author.id,
        messageId: message.id,
      });
    }
  }

  /**
   * Get or create a chat session for a user
   */
  private async getOrCreateSession(userId: string): Promise<string> {
    try {
      // Check if user has an existing session
      const existingSessionId = this.userSessions.get(userId);
      if (existingSessionId) {
        // Verify the session still exists
        const session = await getChatSession(existingSessionId);
        if (session) {
          return existingSessionId;
        }
        // Session not found, remove from map
        this.userSessions.delete(userId);
      }

      // Create new session
      const session = await createChatSession();
      this.userSessions.set(userId, session.id);
      
      logger.info('Created new chat session for user', {
        userId,
        sessionId: session.id
      });

      return session.id;
    } catch (error) {
      logger.error('Failed to get/create chat session', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get chat history for the orchestrator
   */
  private async getChatHistoryForOrchestrator(sessionId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const history = await getChatHistory(sessionId);
      return history.map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      logger.error('Failed to get chat history', error as Error, { sessionId });
      return []; // Return empty history on error
    }
  }

  private async handleMessage(message: Message, content: string): Promise<void> {
    try {
      // Get or create session for user
      const sessionId = await this.getOrCreateSession(message.author.id);
      
      // Get chat history
      const chatHistory = await this.getChatHistoryForOrchestrator(sessionId);

      // Store user message
      await storeMessage(sessionId, 'user', content);

      // Process through orchestrator with chat history
      const response = await this.orchestrator.processRequest(content, {
        chatHistory
      });

      // Store assistant response
      if (!response.error) {
        await storeMessage(sessionId, 'assistant', response.content);
      }

      // Send the response
      if (response.error) {
        await this.handleError(message, new Error(response.error));
      } else {
        let replyContent = response.content;
        
        // Add sources if available
        if (response.sources?.length) {
          replyContent += '\n\nSources:\n' + response.sources.map(s => `• ${s}`).join('\n');
        }

        await this.sendMessage(message, replyContent);
      }
    } catch (error) {
      logger.error('Error handling message', error as Error, {
        messageId: message.id,
        userId: message.author.id,
        content
      });
      
      if (!this.sentResponses.has(message.id)) {
        await this.handleError(message, error as Error);
      }
    }
  }

  private setupEventHandlers(): void {
    // Clean up existing handlers
    this.client.removeAllListeners();
    logger.info('Removed all existing event listeners');

    // Handle ready event
    this.client.once(Events.ClientReady, (client) => {
      logger.info('Discord bot is ready', { 
        username: client.user.tag,
        servers: client.guilds.cache.size,
        serverNames: Array.from(client.guilds.cache.values()).map(guild => guild.name)
      });
    });

    // Handle all messages
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore messages from bots
        if (message.author.bot) {
          logger.debug('Ignoring bot message', { messageId: message.id });
          return;
        }

        // Check if message was already processed
        if (this.processedMessages.has(message.id)) {
          logger.warn('Skipping already processed message', { 
            messageId: message.id,
            content: message.content,
            author: message.author.username,
            timeSinceFirstProcess: Date.now() - (this.processedMessages.get(message.id) || 0)
          });
          return;
        }

        // Clean up old tracked messages periodically
        this.cleanupTrackedMessages();

        // Mark message as being processed
        this.processedMessages.set(message.id, Date.now());

        // Debug logging for all messages
        logger.info('Processing new message', {
          messageId: message.id,
          userId: message.author.id,
          username: message.author.username,
          content: message.content,
          isDM: message.channel.isDMBased(),
          channelType: message.channel.type,
          guildId: message.guild?.id,
          channelId: message.channel.id,
          timestamp: new Date().toISOString()
        });

        // Show typing indicator if supported
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        // Handle DMs and mentions
        const prefix = process.env.DISCORD_BOT_PREFIX || 'thrcbot';
        const isMentioned = message.mentions.users.has(this.client.user!.id);
        const startsWithPrefix = message.content.toLowerCase().startsWith(prefix.toLowerCase() + ' ');
        const isDM = message.channel.isDMBased();

        // Debug log the trigger conditions
        logger.info('Message trigger conditions', {
          isDM,
          isMentioned,
          startsWithPrefix,
          content: message.content,
          cleanContent: message.cleanContent,
          prefix
        });

        // Determine trigger type and process only one
        let shouldProcess = false;
        let triggerType = '';
        let content = message.content;

        if (isDM) {
          shouldProcess = true;
          triggerType = 'DM';
        } else if (isMentioned && !startsWithPrefix) {
          shouldProcess = true;
          triggerType = 'MENTION';
          content = content.replace(new RegExp(`<@!?${this.client.user!.id}>`, 'g'), '').trim();
        } else if (startsWithPrefix && !isMentioned) {
          shouldProcess = true;
          triggerType = 'PREFIX';
          content = content.slice(prefix.length).trim();
        }

        // Log processing decision
        logger.info('Processing decision', {
          shouldProcess,
          triggerType,
          processedContent: content
        });

        if (shouldProcess) {
          await this.handleMessage(message, content);
        }

      } catch (error) {
        logger.error('Error in message event handler', error as Error, {
          messageId: message.id,
          userId: message.author.id,
          content: message.content
        });
        
        if (!this.sentResponses.has(message.id)) {
          await this.handleError(message, error as Error);
        }
      }
    });

    // Handle errors
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', error as Error);
    });

    logger.info('Event handlers setup completed');
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Attempted to start DiscordBot that is already running');
      return;
    }

    try {
      // Set up event handlers
      this.setupEventHandlers();
      
      // Login to Discord
      await this.client.login(this.token);
      
      this.isStarted = true;
      logger.info('Discord bot successfully started');
      
      // Set bot's activity status
      this.client.user?.setActivity('DMs', { type: ActivityType.Watching });
    } catch (error) {
      this.isStarted = false;
      logger.error('Failed to start Discord bot', error as Error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Attempted to stop DiscordBot that is not running');
      return;
    }

    try {
      logger.info('Shutting down Discord bot...');
      this.client.removeAllListeners();
      await this.client.destroy();
      this.isStarted = false;
      DiscordBot._instance = null;

      // Remove lock file
      if (fs.existsSync(DiscordBot.LOCK_FILE)) {
        fs.unlinkSync(DiscordBot.LOCK_FILE);
        logger.info('Removed lock file', {
          pid: process.pid,
          lockFile: DiscordBot.LOCK_FILE
        });
      }

      logger.info('Discord bot successfully shut down');
    } catch (error) {
      logger.error('Error shutting down Discord bot', error as Error);
      throw error;
    }
  }
}

// Export only the getInstance method
export const getDiscordBot = DiscordBot.getInstance.bind(DiscordBot);

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await DiscordBot.getInstance().stop();
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await DiscordBot.getInstance().stop();
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', error);
  await DiscordBot.getInstance().stop();
  process.exit(1);
});
