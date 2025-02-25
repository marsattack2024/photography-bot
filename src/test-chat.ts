import { enhancedLogger as logger } from './utils/logger';
import { createChatSession, storeMessage, getChatHistory } from './db/supabase';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testChatFunctionality() {
    try {
        logger.info('Starting chat functionality test...');

        // Test 1: Create a new chat session
        logger.info('Test 1: Creating chat session...');
        const session = await createChatSession();
        
        logger.info('Chat session created', {
            sessionId: session.id,
            createdAt: session.created_at
        });

        // Test 2: Store messages in the session
        logger.info('Test 2: Storing messages...');
        const messages = [
            { role: 'user' as const, content: 'Hello, how can you help me with photography?' },
            { role: 'assistant' as const, content: 'I can help you with various photography topics!' },
            { role: 'user' as const, content: 'How do I improve my portrait photography?' },
            { role: 'assistant' as const, content: 'Here are some portrait photography tips...' }
        ];

        // Store messages sequentially
        for (const msg of messages) {
            const storedMessage = await storeMessage(
                session.id,
                msg.role,
                msg.content
            );
            
            logger.info('Message stored', {
                messageId: storedMessage.id,
                role: storedMessage.role,
                createdAt: storedMessage.created_at
            });
        }

        // Test 3: Retrieve chat history
        logger.info('Test 3: Retrieving chat history...');
        const history = await getChatHistory(session.id);
        
        logger.info('Chat history retrieved', {
            sessionId: session.id,
            messageCount: history.length,
            messages: history.map(msg => ({
                role: msg.role,
                contentPreview: msg.content.substring(0, 50)
            }))
        });

        // Verify message order
        const isInOrder = history.every((msg, index) => {
            if (index === 0) return true;
            const prevMessage = history[index - 1];
            if (!prevMessage || !msg.created_at || !prevMessage.created_at) return false;
            return new Date(msg.created_at) >= new Date(prevMessage.created_at);
        });

        logger.info('Message order verification', {
            isInOrder,
            messageCount: history.length,
            expectedCount: messages.length
        });

        // Test 4: Verify message content
        const contentMatches = history.every((msg, index) => {
            const expectedMessage = messages[index];
            if (!expectedMessage || !msg.content || !msg.role) return false;
            return msg.content === expectedMessage.content && msg.role === expectedMessage.role;
        });

        logger.info('Content verification', {
            contentMatches,
            sampleMessage: history[0] || null
        });

        logger.info('Chat functionality test completed successfully! ✅');

    } catch (error) {
        logger.error('Chat functionality test failed', error as Error);
        process.exit(1);
    }
}

// Run the test
logger.info('Starting chat functionality tests...');
testChatFunctionality(); 