import { Client, Events, Message, ClientOptions, ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import path from 'path';
import { enhancedLogger as logger } from '../utils/logger';
import { Orchestrator } from '../orchestrator/orchestrator';
import { CopywritingExpert } from '../specialists/copywritingExpert';

// Load environment variables explicitly
config({ path: path.resolve(process.cwd(), '.env') });

export class DiscordBot {
  private client: Client;
  private readonly token: string;
  private orchestrator: Orchestrator;

  constructor() {
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

    // Initialize orchestrator with specialists
    this.orchestrator = new Orchestrator([
      new CopywritingExpert(),
      // Add other specialists here
    ]);
  }

  private async sendMessage(message: Message, content: string): Promise<void> {
    try {
      // For THRC bot, we don't split messages - send them as is
      await message.reply({ content });
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Failed to send message', error, {
          userId: message.author.id,
          messageId: message.id,
          contentLength: content.length
        });
        
        // If the message is too long for Discord's absolute limit (4000 characters)
        if (content.length > 4000) {
          await message.reply({
            content: 'The response was too long for Discord. I will send it in multiple parts.'
          });
          
          // Split only if absolutely necessary (Discord's hard limit)
          for (let i = 0; i < content.length; i += 4000) {
            await message.reply({
              content: content.slice(i, i + 4000)
            });
          }
        } else {
          // For other errors, try sending a simplified version
          await message.reply({
            content: 'I encountered an error sending the full response. Here is a simplified version:\n\n' +
                    content.slice(0, 1900)
          });
        }
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

  private setupEventHandlers(): void {
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
          return;
        }

        // Debug logging for all messages
        logger.info('Received message', {
          userId: message.author.id,
          username: message.author.username,
          content: message.content,
          isDM: message.channel.isDMBased(),
          channelType: message.channel.type,
          guildId: message.guild?.id,
          channelId: message.channel.id
        });

        // Show typing indicator if supported
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        // Handle DMs and mentions
        const prefix = process.env.DISCORD_BOT_PREFIX || 'thrcbot';
        const isMentioned = message.mentions.users.has(this.client.user!.id);
        const startsWithPrefix = message.content.toLowerCase().startsWith(prefix.toLowerCase());
        const isDM = message.channel.isDMBased();

        // Only process if it's a DM or if it matches exactly one trigger condition
        if (isDM || (isMentioned !== startsWithPrefix)) {
          // Clean up the message content
          let content = message.content;
          if (isMentioned) {
            content = content.replace(new RegExp(`<@!?${this.client.user!.id}>`), '').trim();
          } else if (startsWithPrefix) {
            content = content.slice(prefix.length).trim();
          }

          // Process the message through the orchestrator
          const response = await this.orchestrator.processRequest(content, {
            chatHistory: [] // TODO: Implement chat history
          });

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
        }

      } catch (error) {
        logger.error('Error handling message', error as Error, {
          userId: message.author.id,
          messageId: message.id,
        });

        await this.handleError(message, error as Error);
      }
    });

    // Handle errors
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', error as Error);
    });
  }

  public async start(): Promise<void> {
    try {
      // Set up event handlers
      this.setupEventHandlers();
      
      // Login to Discord
      await this.client.login(this.token);
      
      logger.info('Discord bot successfully started');
      
      // Set bot's activity status
      this.client.user?.setActivity('DMs', { type: ActivityType.Watching });
    } catch (error) {
      logger.error('Failed to start Discord bot', error as Error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      logger.info('Shutting down Discord bot...');
      this.client.destroy();
      logger.info('Discord bot successfully shut down');
    } catch (error) {
      logger.error('Error shutting down Discord bot', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const discordBot = new DiscordBot();

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await discordBot.stop();
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await discordBot.stop();
});
