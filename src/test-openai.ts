import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const basePath = process.env.OPENAI_API_BASE_PATH;

if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}

console.log('Testing OpenAI connection...');
console.log(`API Key format check: ${apiKey.substring(0, 5)}... (should start with 'sk-')`);
console.log(`Using base URL: ${basePath}`);

// Configure OpenAI client
const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: basePath,
    timeout: 10000, // 10 second timeout
});

async function testConnection() {
    try {
        console.log('\nStep 1: Testing API key validity...');
        
        console.log('\nStep 2: Fetching available models...');
        const models = await openai.models.list();
        console.log('Available models:', models.data.map(m => m.id).join(', '));

        console.log('\nStep 3: Testing chat completion...');
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: 'Hello!' }],
            max_tokens: 50
        });

        console.log('Chat completion response:', completion.choices[0]?.message);
        console.log('\nAll tests passed successfully!');
        
    } catch (error: any) {
        console.error('\nError testing OpenAI connection:');
        
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Request error - no response received');
            console.error('Request details:', error.request);
        } else {
            // Something happened in setting up the request
            console.error('Error details:', error.message);
        }

        // Log the full error object for debugging
        console.error('\nFull error object:', JSON.stringify(error, null, 2));
        
        process.exit(1);
    }
}

testConnection(); 