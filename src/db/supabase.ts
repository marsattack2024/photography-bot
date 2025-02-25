import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { enhancedLogger as logger } from '../utils/logger';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions
export interface DocumentMetadata {
    [key: string]: unknown;
}

export interface Document {
    id: number;
    content: string;
    metadata: DocumentMetadata;
    similarity?: number;
    created_at?: Date;
}

export interface ChatSession {
    id: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

/**
 * Create a new chat session
 */
export async function createChatSession(): Promise<ChatSession> {
    try {
        logger.info('Creating chat session');

        const { data, error } = await supabase
            .from('v0_chat_sessions')
            .insert({})  // No fields needed as they are auto-generated
            .select()
            .single();
        
        if (error) {
            const err = new Error('Failed to create chat session');
            Object.assign(err, {
                details: {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                }
            });
            logger.error('Failed to create chat session', err);
            throw error;
        }
        
        if (!data) {
            const err = new Error('No data returned from chat session creation');
            logger.error('Chat session creation failed', err);
            throw err;
        }

        logger.info('Chat session created successfully', {
            sessionId: data.id
        });
        
        return data;
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Error in createChatSession', err);
        throw error;
    }
}

/**
 * Store a message in a chat session
 */
export async function storeMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
): Promise<ChatMessage> {
    try {
        logger.info('Storing message', { sessionId, role });

        const { data, error } = await supabase
            .from('v0_chat_histories')
            .insert({
                session_id: sessionId,
                role,
                content
            })
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');

        return data;
    } catch (error) {
        logger.error('Failed to store message', error instanceof Error ? error : new Error(String(error)), {
            sessionId,
            role
        });
        throw error;
    }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
    sessionId: string,
    limit: number = 50
): Promise<ChatMessage[]> {
    try {
        // First verify the session exists
        const { data: session, error: sessionError } = await supabase
            .from('v0_chat_sessions')
            .select()
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            const err = new Error(`Chat session ${sessionId} not found`);
            Object.assign(err, {
                details: sessionError ? {
                    message: sessionError.message,
                    code: sessionError.code
                } : 'No session found'
            });
            logger.error('Session not found', err);
            throw err;
        }

        // Then get the messages
        const { data, error } = await supabase
            .from('v0_chat_histories')
            .select()
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            const err = new Error('Failed to get chat history');
            Object.assign(err, {
                details: {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    sessionId
                }
            });
            logger.error('Failed to get chat history', err);
            throw error;
        }

        logger.info('Chat history retrieved', {
            sessionId,
            messageCount: data?.length ?? 0
        });

        return data || [];
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        Object.assign(err, {
            details: { sessionId }
        });
        logger.error('Error in getChatHistory', err);
        throw error;
    }
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
    try {
        logger.info('Retrieving chat session', { sessionId });

        const { data, error } = await supabase
            .from('v0_chat_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Session not found
                return null;
            }
            logger.error('Failed to retrieve chat session', error, { sessionId });
            throw error;
        }
        
        if (!data) {
            return null;
        }

        logger.info('Chat session retrieved', {
            sessionId: data.id
        });
        
        return data;
    } catch (error) {
        logger.error('Error in getChatSession', error as Error, { sessionId });
        throw error;
    }
}
