import { Client, Events, Message, ClientOptions, ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { enhancedLogger as logger } from '../utils/logger';
import { Orchestrator } from '../orchestrator/orchestrator';
import { CopywritingExpert } from '../specialists/copywritingExpert';

// Load environment variables
config();

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

        if (isDM || isMentioned || startsWithPrefix) {
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
            await message.reply({
              content: response.content || 'I encountered an error processing your request. Please try again.'
            });
          } else {
            let replyContent = response.content;
            
            // Add sources if available
            if (response.sources?.length) {
              replyContent += '\n\nSources:\n' + response.sources.map(s => `• ${s}`).join('\n');
            }

            await message.reply({ content: replyContent });
          }
        }

      } catch (error) {
        logger.error('Error handling message', error as Error, {
          userId: message.author.id,
          messageId: message.id,
        });

        // Send error message to user
        await this.handleError(message);
      }
    });

    // Handle errors
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', error as Error);
    });
  }

  private async handleError(message: Message): Promise<void> {
    try {
      await message.reply({
        content: 'I apologize, but I encountered an error processing your message. Please try again later.',
      });
    } catch (error) {
      logger.error('Failed to send error message to user', error as Error, {
        userId: message.author.id,
        messageId: message.id,
      });
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
