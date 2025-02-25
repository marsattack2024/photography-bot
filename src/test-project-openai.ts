import { openai } from './utils/openai';
import { enhancedLogger as logger } from './utils/logger';

// Type definitions for OpenAI error responses
interface OpenAIErrorResponse extends Error {
    status?: number;
    headers?: Record<string, string>;
    error?: {
        message: string;
        type: string;
        code: string;
    };
}

async function testProjectAuth() {
    try {
        // Test 1: List Models
        logger.info('Testing Models API...');
        const models = await openai.models.list();
        logger.info('Models API successful', {
            modelCount: models.data.length,
            availableModels: models.data.map(m => m.id).slice(0, 5) // Log first 5 models
        });

        // Test 2: Chat Completion
        logger.info('Testing Chat Completions API...');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 50
        });

        const responseContent = completion.choices[0]?.message?.content ?? 'No response';
        logger.info('Chat Completion successful', {
            response: responseContent,
            model: completion.model,
            usage: completion.usage
        });

        // Test 3: Embeddings
        logger.info('Testing Embeddings API...');
        const embedding = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: 'Hello, world!'
        });

        const dimensions = embedding.data[0]?.embedding?.length ?? 0;
        logger.info('Embeddings API successful', {
            dimensions,
            model: embedding.model
        });

        logger.info('All tests completed successfully! ✅');

    } catch (error) {
        // Log detailed error information
        if (error instanceof Error) {
            logger.error('API test failed', error);

            // Check if error has OpenAI-specific properties
            const openaiError = error as OpenAIErrorResponse;
            if (openaiError.status) {
                logger.error('OpenAI API Error Details', error, {
                    status: openaiError.status,
                    headers: openaiError.headers,
                    error: openaiError.error
                });
            }
        } else {
            logger.error('Unknown error occurred', new Error(String(error)));
        }
        process.exit(1);
    }
}

// Run the test
logger.info('Starting OpenAI Project Authentication Tests...');
testProjectAuth(); 