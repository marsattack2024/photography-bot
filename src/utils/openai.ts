import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { enhancedLogger as logger } from './logger';

// Load environment variables
dotenv.config();

// Type definitions for configuration
interface OpenAIConfig {
    apiKey: string;
    organization: string;
    project: string;
    baseURL?: string;
    defaultQuery: {
        'api-version': string;
    };
    defaultHeaders: {
        'Content-Type': string;
        'OpenAI-Organization': string;
        'OpenAI-Project': string;
    };
}

// Function to validate environment variables
function validateEnvironmentVariables() {
    const missingVars: string[] = [];
    const requiredVars = ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID'];
    
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey?.startsWith('sk-proj-')) {
        throw new Error('OPENAI_API_KEY must start with sk-proj- for project-based authentication');
    }

    return {
        apiKey,
        orgId: process.env.OPENAI_ORG_ID?.trim(),
        projectId: process.env.OPENAI_PROJECT_ID?.trim(),
        basePath: process.env.OPENAI_API_BASE_PATH?.trim(),
        model: process.env.OPENAI_MODEL?.trim()
    };
}

// Get and validate environment variables
const config = validateEnvironmentVariables();

logger.info('Initializing OpenAI client', {
    apiKeyLength: config.apiKey.length,
    apiKeyPrefix: config.apiKey.substring(0, 8),
    hasOrgId: !!config.orgId,
    hasProjectId: !!config.projectId,
    basePath: config.basePath || 'default'
});

// Configure OpenAI client with required headers for project-based authentication
const openaiConfig: OpenAIConfig = {
    apiKey: config.apiKey,
    organization: config.orgId!,
    project: config.projectId!,
    defaultQuery: { 'api-version': '2024-02-15' },
    defaultHeaders: {
        'Content-Type': 'application/json',
        'OpenAI-Organization': config.orgId!,
        'OpenAI-Project': config.projectId!
    }
};

// Add base path if provided
if (config.basePath) {
    openaiConfig.baseURL = config.basePath;
}

// Initialize OpenAI client with configuration
export const openai = new OpenAI(openaiConfig);

// Export model name for consistency
export const OPENAI_MODEL = config.model || 'gpt-4-turbo-preview'; 