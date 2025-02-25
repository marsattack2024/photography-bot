import OpenAI from 'openai';
import { enhancedLogger as logger } from '../utils/logger';
import { BaseAgent, AgentContext, AgentResponse } from './baseAgent';
import { extractUrlsFromText } from '../utils/urlProcessor';
import { scrapeUrl } from '../webhooks/scraper';

// Validate OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';

if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
}

// OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// Router prompt for specialist selection
const ROUTER_PROMPT = `You are a routing assistant that determines which specialist agents should handle a user's request.
Available specialists: facebook_ads, google_ads, copywriting, quiz
Respond with a JSON array of specialist names, or ["none"] if no specialist is needed.
Consider the user's query carefully and only select relevant specialists.`;

export class Orchestrator {
    private specialists: Map<string, BaseAgent>;
    
    constructor(specialists: BaseAgent[]) {
        this.specialists = new Map();
        specialists.forEach(specialist => {
            this.specialists.set(specialist.constructor.name.toLowerCase(), specialist);
        });
    }

    /**
     * Process a user request through appropriate specialists
     */
    public async processRequest(query: string, context: AgentContext = {}): Promise<AgentResponse> {
        try {
            // First, enrich context with any URLs found in the query
            const enrichedContext = await this.enrichContext(query, context);

            // Determine which specialists should handle the request
            const specialistNames = await this.routeRequest(query);

            logger.info('Request routed to specialists', {
                specialists: specialistNames,
                query
            });

            if (specialistNames.includes('none') || specialistNames.length === 0) {
                return this.handleGeneralRequest(query, enrichedContext);
            }

            // Process with each specialist
            const responses = await Promise.all(
                specialistNames.map(name => {
                    const specialist = this.specialists.get(name);
                    if (!specialist) {
                        logger.warn(`Specialist ${name} not found`);
                        return null;
                    }
                    return specialist.processRequest(query, enrichedContext);
                })
            );

            // Combine responses
            return this.combineResponses(responses.filter(Boolean) as AgentResponse[]);

        } catch (error) {
            logger.error('Error processing orchestrated request', error instanceof Error ? error : new Error('Unknown error'));

            return {
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                error: 'Orchestration error'
            };
        }
    }

    /**
     * Enrich context with scraped content from URLs
     */
    private async enrichContext(query: string, context: AgentContext): Promise<AgentContext> {
        const urls = extractUrlsFromText(query);
        if (!urls.length) {
            return context;
        }

        logger.info('Found URLs in query', { urls });

        const scrapedContent = context.scrapedContent || [];
        
        // Scrape each URL
        const scrapePromises = urls.map(async url => {
            try {
                const result = await scrapeUrl(url);
                if (result) {
                    scrapedContent.push({
                        url: result.url,
                        title: result.title,
                        description: result.description,
                        content: result.content
                    });
                }
            } catch (error) {
                logger.error(`Error scraping URL: ${url}`, error instanceof Error ? error : new Error('Unknown error'));
            }
        });

        await Promise.all(scrapePromises);

        return {
            ...context,
            scrapedContent
        };
    }

    /**
     * Route the request to appropriate specialists using GPT
     */
    private async routeRequest(query: string): Promise<string[]> {
        try {
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: 'system', content: ROUTER_PROMPT },
                    { role: 'user', content: query }
                ],
                temperature: 0
            });

            const response = completion.choices[0]?.message?.content || '["none"]';
            
            try {
                return JSON.parse(response.toLowerCase());
            } catch {
                logger.error('Failed to parse router response', new Error(`Invalid response: ${response}`));
                return ['none'];
            }

        } catch (error) {
            logger.error('Error routing request', error instanceof Error ? error : new Error('Unknown error'));
            return ['none'];
        }
    }

    /**
     * Handle a general request with no specific specialist
     */
    private async handleGeneralRequest(query: string, context: AgentContext): Promise<AgentResponse> {
        try {
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant with expertise in photography and marketing.'
                    },
                    { role: 'user', content: query }
                ],
                temperature: 0.7
            });

            return {
                content: completion.choices[0]?.message?.content || 'I apologize, but I could not process your request.',
                sources: this.extractSources(context)
            };

        } catch (error) {
            logger.error('Error handling general request', error instanceof Error ? error : new Error('Unknown error'));

            return {
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                error: 'General processing error'
            };
        }
    }

    /**
     * Combine responses from multiple specialists
     */
    private combineResponses(responses: AgentResponse[]): AgentResponse {
        if (!responses.length) {
            return {
                content: 'I apologize, but none of our specialists could process your request.',
                error: 'No specialist responses'
            };
        }

        const combinedContent = responses.map(r => r.content).join('\n\n---\n\n');
        const combinedSources = [...new Set(responses.flatMap(r => r.sources || []))];

        return {
            content: combinedContent,
            sources: combinedSources
        };
    }

    /**
     * Extract sources from context
     */
    private extractSources(context: AgentContext): string[] {
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
