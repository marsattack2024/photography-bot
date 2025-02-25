import { openai } from '../utils/openai';
import { supabase } from './supabase';
import { enhancedLogger as logger } from '../utils/logger';
import { processTextForEmbedding } from '../utils/textProcessor';
import type { Document, DocumentMetadata } from './supabase';

// Constants for embedding validation
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EXPECTED_DIMENSIONS = 1536;

/**
 * Helper function to validate and extract embedding from OpenAI response
 */
function extractEmbedding(response: any): number[] {
    if (!response.data || response.data.length === 0 || !response.data[0]?.embedding) {
        throw new Error('No embedding returned from OpenAI');
    }
    
    const embedding = response.data[0].embedding;
    
    if (!Array.isArray(embedding)) {
        throw new Error('Embedding is not an array');
    }
    
    if (embedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(`Invalid embedding dimensions. Expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`);
    }
    
    if (!embedding.every(num => typeof num === 'number' && !isNaN(num))) {
        throw new Error('Embedding contains invalid values');
    }
    
    return embedding;
}

/**
 * Creates text embeddings using OpenAI's text-embedding-3-small model
 * Handles chunking and processes multiple chunks if necessary
 */
export async function createEmbedding(text: string): Promise<number[]> {
    try {
        // Process text into chunks
        const chunks = await processTextForEmbedding(text);
        if (chunks.length === 0) {
            throw new Error('No valid chunks produced from text');
        }

        // Log detailed chunk information
        logger.info('Processing text chunks', {
            totalChunks: chunks.length,
            chunkDetails: chunks.map((chunk, index) => ({
                chunkIndex: index,
                characters: chunk?.length || 0,
                estimatedTokens: chunk ? Math.ceil(chunk.length / 4) : 0,
                preview: chunk ? chunk.substring(0, 100) + '...' : 'Invalid chunk'
            }))
        });
        
        if (chunks.length === 1) {
            // Single chunk - process normally
            const chunk = chunks[0];
            if (!chunk) {
                throw new Error('First chunk is undefined');
            }

            logger.info('Processing single chunk', {
                chunkSize: chunk.length,
                estimatedTokens: Math.ceil(chunk.length / 4)
            });

            const response = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: chunk,
                encoding_format: 'float'
            });
            
            return extractEmbedding(response);
        } else {
            // Multiple chunks - create embeddings for each and average them
            logger.info('Processing multiple chunks', {
                chunkCount: chunks.length,
                totalCharacters: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
                averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length
            });

            const embeddingPromises = chunks.map(async (chunk, index) => {
                const response = await openai.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: chunk,
                    encoding_format: 'float'
                });
                
                const embedding = extractEmbedding(response);
                
                logger.debug(`Processed chunk ${index + 1}/${chunks.length}`, {
                    chunkSize: chunk.length,
                    embeddingDimensions: embedding.length
                });
                
                return embedding;
            });
            
            const embeddings = await Promise.all(embeddingPromises);
            
            // Validate all embeddings have correct dimensions
            embeddings.forEach((embedding, index) => {
                if (embedding.length !== EXPECTED_DIMENSIONS) {
                    throw new Error(`Chunk ${index} produced invalid embedding dimensions: ${embedding.length}`);
                }
            });
            
            // Average the embeddings
            const averageEmbedding = new Array(EXPECTED_DIMENSIONS).fill(0);
            
            embeddings.forEach(embedding => {
                for (let i = 0; i < EXPECTED_DIMENSIONS; i++) {
                    averageEmbedding[i] += embedding[i];
                }
            });
            
            for (let i = 0; i < EXPECTED_DIMENSIONS; i++) {
                averageEmbedding[i] /= embeddings.length;
            }
            
            logger.info('Successfully averaged embeddings', {
                originalChunks: chunks.length,
                finalDimensions: averageEmbedding.length
            });
            
            return averageEmbedding;
        }
    } catch (error) {
        logger.error('Failed to create embedding', error instanceof Error ? error : new Error(String(error)), {
            textLength: text.length,
            chunksAttempted: (await processTextForEmbedding(text)).length
        });
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
        // Create embedding from processed text
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
        logger.error('Failed to store document', error instanceof Error ? error : new Error(String(error)), {
            url: doc.url,
            title: doc.title
        });
        throw error;
    }
}

/**
 * Search for similar documents using vector similarity
 * @param queryText - The text to search for
 * @param limit - Maximum number of results to return (default: 5)
 * @param filter - Optional JSONB filter for metadata (e.g., { type: "photography_tip" })
 * @returns Array of documents with similarity scores
 */
export async function searchSimilarDocuments(
    queryText: string,
    limit: number = 5,
    filter: Record<string, unknown> = {}
): Promise<Document[]> {
    try {
        // Process query text and create embedding
        const chunks = await processTextForEmbedding(queryText);
        if (chunks.length === 0) {
            throw new Error('No valid chunks produced from query text');
        }
        
        const firstChunk = chunks[0];
        if (!firstChunk) {
            throw new Error('First chunk is undefined');
        }
        
        const queryEmbedding = await createEmbedding(firstChunk);
        
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_count: limit,
            filter: filter
        });
        
        if (error) throw error;
        if (!data) return [];
        
        return data;
    } catch (error) {
        logger.error('Failed to search documents', error instanceof Error ? error : new Error(String(error)), {
            queryText,
            limit,
            filter
        });
        return [];
    }
}

/**
 * Document matcher class for compatibility with existing code
 */
export class DocumentMatcher {
    public async matchDocuments(
        query: string,
        limit: number = 5,
        filter: Record<string, unknown> = {}
    ): Promise<Document[]> {
        return searchSimilarDocuments(query, limit, filter);
    }
} 