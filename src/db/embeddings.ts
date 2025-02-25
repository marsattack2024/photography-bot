import OpenAI from 'openai';
import { supabase } from './supabase';
import { enhancedLogger as logger } from '../utils/logger';
import type { Document, DocumentMetadata } from './supabase';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Creates a text embedding using OpenAI's text-embedding-ada-002 model
 */
export async function createEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text
        });
        
        if (!response.data[0]?.embedding) {
            throw new Error('No embedding returned from OpenAI');
        }
        
        return response.data[0].embedding;
    } catch (error) {
        logger.error('Failed to create embedding', error as Error, { textLength: text.length });
        throw error;
    }
}

/**
 * Store a document with its metadata and embedding in Supabase
 */
export async function storeDocument(doc: {
    url: string;
    title: string;
    content: string;
    metadata: DocumentMetadata;
}): Promise<Document> {
    try {
        const embedding = await createEmbedding(doc.content);
        
        const { data, error } = await supabase
            .from('documents')
            .insert({
                url: doc.url,
                title: doc.title,
                content: doc.content,
                metadata: doc.metadata,
                embedding
            })
            .select()
            .single();
        
        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');
        
        return data;
    } catch (error) {
        logger.error('Failed to store document', error as Error, {
            url: doc.url,
            title: doc.title
        });
        throw error;
    }
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
    queryText: string,
    limit: number = 5
): Promise<Document[]> {
    try {
        const queryEmbedding = await createEmbedding(queryText);
        
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_count: limit
        });
        
        if (error) throw error;
        if (!data) return [];
        
        return data;
    } catch (error) {
        logger.error('Failed to search documents', error as Error, {
            queryText,
            limit
        });
        return [];
    }
}

/**
 * Document matcher class for compatibility with existing code
 */
export class DocumentMatcher {
    public async matchDocuments(query: string, limit: number = 5): Promise<Document[]> {
        return searchSimilarDocuments(query, limit);
    }
} 