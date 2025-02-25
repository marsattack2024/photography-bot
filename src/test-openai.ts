import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY?.trim();
const orgId = process.env.OPENAI_ORG_ID?.trim();
const projectId = process.env.OPENAI_PROJECT_ID?.trim();
const basePath = process.env.OPENAI_API_BASE_PATH?.trim() || 'https://api.openai.com/v1';

// Validate required configuration
if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
}

if (!apiKey.startsWith('sk-proj-')) {
    throw new Error('API key must start with sk-proj- for project-based authentication');
}

if (!orgId) {
    throw new Error('OPENAI_ORG_ID is required for project-based authentication');
}

console.log('OpenAI Configuration Test');
console.log('------------------------');
console.log(`API Key Format: ${apiKey.substring(0, 8)}... (${apiKey.length} chars)`);
console.log(`Organization ID: ${orgId}`);
console.log(`Project ID: ${projectId || 'Not specified'}`);
console.log(`Base URL: ${basePath}`);

// Configure OpenAI client with required headers for project-based authentication
const openai = new OpenAI({
    apiKey,
    organization: orgId,  // Required for project-based authentication
    baseURL: basePath,
    defaultHeaders: {
        'OpenAI-Organization': orgId,  // Explicitly set organization header
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

async function testConnection() {
    try {
        console.log('\nTesting API Connection');
        console.log('--------------------');

        // Test 1: List Models
        console.log('\n1. Testing Models API...');
        try {
            const models = await openai.models.list();
            console.log('✓ Models API accessible');
            console.log('Available models:', models.data.map(m => m.id).join(', '));
        } catch (error: any) {
            console.error('✗ Models API failed:', error.message);
            throw error;
        }

        // Test 2: Simple Chat Completion
        console.log('\n2. Testing Chat Completions API...');
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: 'Hello!' }],
                max_tokens: 50
            });
            console.log('✓ Chat Completions API accessible');
            console.log('Response:', completion.choices[0]?.message?.content);
        } catch (error: any) {
            console.error('✗ Chat Completions API failed:', error.message);
            throw error;
        }

        console.log('\n✓ All tests completed successfully!');
        
    } catch (error: any) {
        console.error('\nConnection Test Failed');
        console.error('--------------------');
        
        if (error.response) {
            // API responded with an error
            console.error('API Error Details:');
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data?.error?.message || 'No error message provided');
            
            // Log request details for debugging
            console.error('\nRequest Details:');
            if (error.config) {
                console.error('URL:', error.config.url);
                console.error('Headers:', JSON.stringify(error.config.headers, null, 2));
                if (error.config.data) {
                    console.error('Data:', JSON.stringify(JSON.parse(error.config.data), null, 2));
                }
            }
        } else if (error.request) {
            // Request was made but no response received
            console.error('Network Error: No response received from API');
            console.error('Request:', error.request);
        } else {
            // Error in setting up the request
            console.error('Setup Error:', error.message);
        }

        process.exit(1);
    }
}

// Run the test
testConnection(); 