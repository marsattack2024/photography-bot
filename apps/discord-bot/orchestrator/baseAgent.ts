import { enhancedLogger as logger } from '../utils/logger';
import { openai, OPENAI_MODEL } from '../utils/openai';

// Validate OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
}

export interface AgentContext {
    relevantDocs?: string[];
    scrapedContent?: {
        url: string;
        content: string;
        title?: string;
        description?: string;
    }[];
    chatHistory?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
}

export interface AgentResponse {
    content: string;
    sources?: string[];
    error?: string;
}

export abstract class BaseAgent {
    protected systemPrompt: string;
    protected keywords: string[];
    protected name: string;
    protected expertise: string[];

    constructor(name: string, expertise: string[], systemPrompt: string, keywords: string[] = []) {
        this.name = name;
        this.expertise = expertise;
        this.systemPrompt = systemPrompt;
        this.keywords = keywords.map(k => k.toLowerCase());
    }

    /**
     * Check if this agent can handle the given query based on keywords
     */
    public canHandle(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        return this.keywords.some(keyword => lowerQuery.includes(keyword));
    }

    /**
     * Process a user request with context
     */
    public async processRequest(query: string, context: AgentContext = {}): Promise<AgentResponse> {
        try {
            // Prepare messages array
            const messages = this.buildMessages(query, context);

            logger.info('Processing request with agent', {
                agentName: this.name,
                query,
                contextSize: JSON.stringify(context).length
            });

            // Call OpenAI
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages,
                temperature: 0.7,
                stream: false
            });

            const response = completion.choices[0]?.message?.content || '';

            return {
                content: response,
                sources: this.extractSources(context)
            };

        } catch (error) {
            logger.error(`Error processing request for ${this.name}`, error instanceof Error ? error : new Error('Unknown error'));

            return {
                content: '',
                error: 'Failed to process request'
            };
        }
    }

    /**
     * Build the messages array for the OpenAI API call
     */
    protected buildMessages(query: string, context: AgentContext) {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            {
                role: 'system',
                content: this.buildSystemMessage(context)
            },
            {
                role: 'user',
                content: query
            }
        ];

        // Add chat history if available
        if (context.chatHistory) {
            messages.splice(1, 0, ...context.chatHistory);
        }

        return messages;
    }

    /**
     * Build the system message including context
     */
    protected buildSystemMessage(context: AgentContext): string {
        let systemMessage = this.systemPrompt;

        // Add relevant documents if available
        if (context.relevantDocs?.length) {
            systemMessage += '\n\nRelevant documents:\n' + context.relevantDocs.join('\n---\n');
        }

        // Add scraped content if available
        if (context.scrapedContent?.length) {
            systemMessage += '\n\nScraped content:\n' + context.scrapedContent.map(doc => 
                `URL: ${doc.url}\nTitle: ${doc.title || 'N/A'}\nContent: ${doc.content}`
            ).join('\n---\n');
        }

        return systemMessage;
    }

    /**
     * Extract sources from context
     */
    protected extractSources(context: AgentContext): string[] {
        const sources: string[] = [];

        if (context.relevantDocs?.length) {
            sources.push('Database documents');
        }

        if (context.scrapedContent?.length) {
            sources.push(...context.scrapedContent.map(doc => doc.url));
        }

        return sources;
    }
}
