import { enhancedLogger as logger } from './logger';
import { openai } from './openai';

/**
 * Configuration for text preprocessing
 */
export interface TextProcessorConfig {
    removeStopWords?: boolean;
    maxTokens?: number;
    overlapTokens?: number;
    preserveCase?: boolean;
    preserveNumbers?: boolean;
    preservePunctuation?: boolean;
}

const DEFAULT_CONFIG: TextProcessorConfig = {
    removeStopWords: false,
    maxTokens: 8000,      // Safe limit for text-embedding-3-small (max 8192)
    overlapTokens: 350,   // Tokens to overlap between chunks
    preserveCase: true,   // Preserve case for technical terms
    preserveNumbers: true, // Important for prices and metrics
    preservePunctuation: true // Important for sentence structure
};

// Pre-compile regex patterns for performance
const WHITESPACE_REGEX = /\s+/g;
const PUNCTUATION_REGEX = /[^\w\s$%.,!?]/g;
const NUMBER_REGEX = /\d+/g;

// Photography and marketing domain-specific terms to preserve (case-sensitive)
const DOMAIN_TERMS = new Set([
    'Google Ads', 'Facebook Ads', 'Instagram Ads', 'Meta Ads', 'Email List',
    'Photography', 'Photographer', 'Studio', 'Portrait', 'Wedding', 'Session',
    'Client', 'Booking', 'Package', 'Pricing', 'Marketing', 'Social Media',
    'Website', 'SEO', 'Analytics', 'ROI', 'Conversion', 'Lead', 'Funnel',
    // Add individual important terms
    'Google', 'Facebook', 'Instagram', 'Meta', 'Email',
    'Photography to Profits', 'P2P'
].sort((a, b) => b.length - a.length)); // Sort by length for proper replacement

/**
 * Estimate token count using OpenAI's API
 */
async function estimateTokenCount(text: string): Promise<number> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            encoding_format: 'float'
        });
        
        // The API response includes token count information
        return response.usage?.total_tokens || Math.ceil(text.length / 4);
    } catch (error) {
        logger.warn('Error estimating token count, using character-based estimate', {
            error: error instanceof Error ? {
                message: error.message,
                name: error.name,
                stack: error.stack
            } : String(error)
        });
        return Math.ceil(text.length / 4); // Fallback: rough estimate (4 chars ~ 1 token)
    }
}

/**
 * Clean and normalize text while preserving domain-specific terms
 */
export function normalizeText(text: string, config: TextProcessorConfig = DEFAULT_CONFIG): string {
    if (!text || typeof text !== 'string') {
        logger.warn('Invalid input for text normalization', { text });
        return '';
    }

    try {
        // Preserve domain-specific terms by temporarily replacing them
        const preservedTerms = new Map<string, string>();
        let processedText = text;

        // Replace domain terms with placeholders (case-sensitive)
        DOMAIN_TERMS.forEach((term, index) => {
            const placeholder = `__TERM${index}__`;
            const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            if (regex.test(processedText)) {
                preservedTerms.set(placeholder, term);
                processedText = processedText.replace(regex, placeholder);
            }
        });

        // Basic cleaning
        if (!config.preserveCase) {
            processedText = processedText.toLowerCase();
        }

        // Handle whitespace consistently
        processedText = processedText.replace(WHITESPACE_REGEX, ' ').trim();

        // Handle punctuation selectively
        if (!config.preservePunctuation) {
            processedText = processedText.replace(PUNCTUATION_REGEX, ' ');
        }

        // Handle numbers
        if (!config.preserveNumbers) {
            processedText = processedText.replace(NUMBER_REGEX, ' ');
        }

        // Restore preserved terms
        preservedTerms.forEach((term, placeholder) => {
            processedText = processedText.replace(new RegExp(placeholder, 'g'), term);
        });

        // Final whitespace cleanup
        return processedText.replace(WHITESPACE_REGEX, ' ').trim();
    } catch (error) {
        logger.error('Error normalizing text', error as Error);
        return text; // Return original text if processing fails
    }
}

/**
 * Split text into chunks with token-aware boundaries
 */
export async function chunkText(text: string, config: TextProcessorConfig = DEFAULT_CONFIG): Promise<string[]> {
    if (!text || typeof text !== 'string') {
        logger.warn('Invalid input for text chunking', { text });
        return [''];
    }

    try {
        const tokenCount = await estimateTokenCount(text);
        const { maxTokens = DEFAULT_CONFIG.maxTokens, overlapTokens = DEFAULT_CONFIG.overlapTokens } = config;

        if (tokenCount <= maxTokens!) {
            return [text];
        }

        // Split into sentences first
        const sentenceEndings = /[.!?]\s+/g;
        const sentences = text.split(sentenceEndings).filter(Boolean);
        
        const chunks: string[] = [];
        let currentChunk = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentenceTokens = await estimateTokenCount(sentence);
            
            if (currentTokens + sentenceTokens <= maxTokens!) {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
                currentTokens += sentenceTokens;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    // Keep overlap from previous chunk
                    const overlap = currentChunk.split(' ').slice(-overlapTokens!).join(' ');
                    currentChunk = overlap + ' ' + sentence;
                    currentTokens = await estimateTokenCount(currentChunk);
                } else {
                    // Handle case where single sentence exceeds maxTokens
                    const words = sentence.split(' ');
                    let tempChunk = '';
                    for (const word of words) {
                        if (await estimateTokenCount(tempChunk + ' ' + word) <= maxTokens!) {
                            tempChunk += (tempChunk ? ' ' : '') + word;
                        } else {
                            if (tempChunk) chunks.push(tempChunk);
                            tempChunk = word;
                        }
                    }
                    if (tempChunk) chunks.push(tempChunk);
                    currentChunk = '';
                    currentTokens = 0;
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    } catch (error) {
        logger.error('Error chunking text', error as Error);
        return [text]; // Return original text as single chunk if processing fails
    }
}

/**
 * Process text for embedding with token-aware chunking
 */
export async function processTextForEmbedding(text: string, config: TextProcessorConfig = DEFAULT_CONFIG): Promise<string[]> {
    if (!text || typeof text !== 'string') {
        logger.warn('Invalid input for text processing', { text });
        return [''];
    }

    try {
        // Handle maximum text length
        const MAX_TEXT_LENGTH = 1000000; // 1MB limit
        if (text.length > MAX_TEXT_LENGTH) {
            logger.warn('Text exceeds maximum length, truncating', { 
                originalLength: text.length,
                maxLength: MAX_TEXT_LENGTH 
            });
            text = text.slice(0, MAX_TEXT_LENGTH);
        }

        // First normalize the text
        const normalizedText = normalizeText(text, config);
        
        // Estimate token count
        const tokenCount = await estimateTokenCount(normalizedText);
        if (tokenCount > config.maxTokens!) {
            logger.info('Text exceeds token limit, chunking required', { 
                tokenCount,
                maxTokens: config.maxTokens 
            });
        }

        // Then split into chunks if necessary
        return chunkText(normalizedText, config);
    } catch (error) {
        logger.error('Error processing text for embedding', error as Error);
        return [text]; // Return original text as single chunk if processing fails
    }
} 