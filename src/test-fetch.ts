import fetch, { RequestInit } from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const orgId = process.env.OPENAI_ORG_ID?.trim();
    const projectId = process.env.OPENAI_PROJECT_ID?.trim();
    const baseURL = process.env.OPENAI_API_BASE_PATH?.trim() || 'https://api.openai.com/v1';

    if (!apiKey || !orgId) {
        throw new Error('Missing API key or org ID in environment variables');
    }

    console.log('Direct Fetch Test Configuration:');
    console.log('-------------------------------');
    console.log(`API Key Format: ${apiKey.substring(0, 8)}... (${apiKey.length} chars)`);
    console.log(`Organization ID: ${orgId}`);
    console.log(`Project ID: ${projectId || 'Not specified'}`);
    console.log(`Base URL: ${baseURL}`);

    // Test both models and chat completion endpoints
    const endpoints = [
        { path: '/models', method: 'GET', body: undefined },
        {
            path: '/chat/completions',
            method: 'POST',
            body: {
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: 'Hello!' }],
                max_tokens: 50
            }
        }
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\nTesting ${endpoint.method} ${endpoint.path}...`);

            const headers: Record<string, string> = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Organization': orgId
            };

            // Optionally include project header
            if (projectId) {
                headers['OpenAI-Project'] = projectId;
            }

            const requestOptions: RequestInit = {
                method: endpoint.method,
                headers,
                body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
            };

            console.log('Request Headers:', JSON.stringify(headers, null, 2));
            if (endpoint.body) {
                console.log('Request Body:', JSON.stringify(endpoint.body, null, 2));
            }

            const res = await fetch(`${baseURL}${endpoint.path}`, requestOptions);
            
            // Get response headers before reading the body
            const responseHeaders = Object.fromEntries(res.headers.entries());
            
            const data = await res.json();

            console.log('Response Status:', res.status, res.statusText);
            console.log('Response Headers:', JSON.stringify(responseHeaders, null, 2));
            console.log('Response Body:', JSON.stringify(data, null, 2));

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
            }

        } catch (error) {
            console.error(`Error testing ${endpoint.path}:`, error instanceof Error ? error.message : error);
        }
    }
})(); 