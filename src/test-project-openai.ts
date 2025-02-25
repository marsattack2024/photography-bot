import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { enhancedLogger as logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY?.trim();
const orgId = process.env.OPENAI_ORG_ID?.trim();
const projectId = process.env.OPENAI_PROJECT_ID?.trim();
const basePath = process.env.OPENAI_API_BASE_PATH?.trim();

// Validate required configuration
if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
}

// Validate API key format
if (!apiKey.startsWith('sk-proj-')) {
    throw new Error('API key must start with sk-proj- for project-based authentication');
}

// Organization ID is required for project-based authentication
if (!orgId) {
    throw new Error('OPENAI_ORG_ID is required for project-based authentication');
}

// Project ID is required for project-based authentication
if (!projectId) {
    throw new Error('OPENAI_PROJECT_ID is required for project-based authentication');
}

logger.info('Testing OpenAI configuration', {
    apiKeyPrefix: apiKey.substring(0, 8),
    apiKeyLength: apiKey.length,
    hasOrgId: !!orgId,
    hasProjectId: !!projectId,
    basePath: basePath || 'default'
});

// Configure OpenAI client with all required headers for project-based authentication
const openaiConfig: Record<string, any> = {
    apiKey,
    organization: orgId,
    project: projectId,
    defaultQuery: { 'api-version': '2024-02-15' },
    defaultHeaders: {
        'Content-Type': 'application/json',
        'OpenAI-Organization': orgId,
        'OpenAI-Project': projectId
    }
};

// Add base path if provided
if (basePath) {
    openaiConfig.baseURL = basePath;
}

// Initialize OpenAI client with configuration
const openai = new OpenAI(openaiConfig);

async function testProjectAuth() {
    try {
        // Test 1: List Models
        logger.info('Testing Models API...');
        const models = await openai.models.list();
        logger.info('Models API successful', {
            modelCount: models.data.length,
            firstModel: models.data[0]?.id
        });

        // Test 2: Chat Completion
        logger.info('Testing Chat Completions API...');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 50
        });
        logger.info('Chat Completion successful', {
            response: completion.choices[0]?.message?.content,
            requestId: completion.id
        });

    } catch (error) {
        // Log the original error first
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('API test failed: ' + errorMessage);
        
        // Then log detailed error information
        if (error instanceof Error) {
            const errorDetails: Record<string, any> = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
            
            // If it's an API error, it might have additional properties
            const apiError = error as any;
            if (apiError.status) {
                errorDetails.status = apiError.status;
            }
            if (apiError.headers) {
                errorDetails.headers = apiError.headers;
            }
            if (apiError.response?.data) {
                errorDetails.responseData = apiError.response.data;
            }
            if (apiError.response?.headers?.['x-request-id']) {
                errorDetails.requestId = apiError.response.headers['x-request-id'];
            }
            
            // Log error details as a JSON string to avoid type issues
            logger.error('Detailed error information: ' + JSON.stringify(errorDetails, null, 2));
        }
    }
}

// Run the test
testProjectAuth(); 