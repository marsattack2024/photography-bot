import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions
export interface DocumentMetadata {
    url?: string;
    title?: string;
    description?: string;
    sourceType?: string;
    scrapeTimestamp?: string;
    [key: string]: unknown;
}

export interface Document {
    id: string;
    url: string;
    title: string;
    content: string;
    metadata: DocumentMetadata;
    embedding: number[];
    created_at: string;
}

export interface ChatSession {
    id: string;
    user_id: string;
    created_at: string;
    metadata?: Record<string, unknown>;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    metadata?: Record<string, unknown>;
}

// Chat session functions
export async function createChatSession(userId: string, metadata?: Record<string, unknown>): Promise<ChatSession> {
    const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, metadata })
        .select()
        .single();
        
    if (error) throw error;
    return data;
}

export async function storeMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
): Promise<ChatMessage> {
    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            role,
            content,
            metadata
        })
        .select()
        .single();
        
    if (error) throw error;
    return data;
}

export async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
        
    if (error) throw error;
    return data;
}
