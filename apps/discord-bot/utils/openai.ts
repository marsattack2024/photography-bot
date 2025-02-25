import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';
import { enhancedLogger as logger } from './logger';

// Load environment variables explicitly from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Log environment state for debugging
logger.info('Environment state', {
    hasApiKey: !!process.env.OPENAI_API_KEY,
    apiKeyLastFour: process.env.OPENAI_API_KEY?.slice(-4),
    projectId: process.env.OPENAI_PROJECT_ID,
    basePath: process.env.OPENAI_API_BASE_PATH
});

interface OpenAIConfig {
    apiKey: string;
    baseURL: string;
    defaultHeaders: {
        'Content-Type': string;
        'OpenAI-Project': string;
        'OpenAI-Beta': string;
        'OpenAI-Organization'?: string;
    };
    timeout: number;
}

// Function to validate environment variables
function validateEnvironmentVariables() {
    const missingVars: string[] = [];
    const requiredVars = ['OPENAI_API_KEY', 'OPENAI_PROJECT_ID'];
    
    // Check required variables
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate API key format
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey?.startsWith('sk-proj-')) {
        throw new Error('OPENAI_API_KEY must start with sk-proj- for project-based authentication');
    }

    // Get configuration
    const config = {
        apiKey,
        projectId: process.env.OPENAI_PROJECT_ID?.trim(),
        orgId: process.env.OPENAI_ORG_ID?.trim(),
        basePath: process.env.OPENAI_API_BASE_PATH?.trim() || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL?.trim() || 'gpt-4-turbo-preview'
    };

    // Debug logging for configuration verification
    logger.info('OpenAI Configuration', {
        apiKeyLength: config.apiKey.length,
        apiKeyPrefix: config.apiKey.substring(0, 8),
        apiKeySuffix: config.apiKey.slice(-4),
        hasOrgId: !!config.orgId,
        hasProjectId: !!config.projectId,
        projectId: config.projectId,
        basePath: config.basePath,
        model: config.model
    });

    return config;
}

// Get and validate environment variables
const config = validateEnvironmentVariables();

// Configure OpenAI client
const openaiConfig: OpenAIConfig = {
    apiKey: config.apiKey,
    baseURL: config.basePath,
    defaultHeaders: {
        'Content-Type': 'application/json',
        'OpenAI-Project': config.projectId!,
        'OpenAI-Beta': 'assistants=v1'
    },
    timeout: 30000
};

// Add organization if provided
if (config.orgId) {
    openaiConfig.defaultHeaders['OpenAI-Organization'] = config.orgId;
}

// Initialize OpenAI client with configuration
export const openai = new OpenAI(openaiConfig);

// Export model name for consistency
export const OPENAI_MODEL = config.model; 