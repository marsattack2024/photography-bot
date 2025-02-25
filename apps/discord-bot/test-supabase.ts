import { enhancedLogger as logger } from './utils/logger';
import { searchSimilarDocuments } from './db/embeddings';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Constants
const SIMILARITY_THRESHOLD = 0.5;

// Verify OpenAI configuration before testing
function verifyConfiguration() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }
    
    logger.info('OpenAI Configuration', {
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.substring(0, 8),
        apiKeySuffix: apiKey.slice(-4),
        model: 'text-embedding-3-small'
    });
    
    if (!apiKey.startsWith('sk-proj-')) {
        throw new Error('OPENAI_API_KEY must start with sk-proj-');
    }
}

async function testVectorSearch() {
    try {
        // Verify configuration first
        verifyConfiguration();
        
        // Test queries
        const testQueries = [
            "tell me about photography to profits",
            "how do you run google ads?",
            "what issues did photography to profits have with trademark issues?"
        ];

        logger.info('Starting vector similarity search test...', {
            similarityThreshold: SIMILARITY_THRESHOLD,
            model: 'text-embedding-3-small'
        });

        for (const query of testQueries) {
            logger.info(`Testing query: "${query}"`);
            
            try {
                const results = await searchSimilarDocuments(query);
                
                // Filter and log results
                const relevantResults = results.filter(doc => 
                    doc.similarity && doc.similarity >= SIMILARITY_THRESHOLD
                );

                logger.info('Search results', {
                    query,
                    totalResults: results.length,
                    relevantResults: relevantResults.length,
                    threshold: SIMILARITY_THRESHOLD
                });

                results.forEach((doc, index) => {
                    logger.info(`Result ${index + 1}:`, {
                        similarity: doc.similarity,
                        contentPreview: doc.content.substring(0, 200),
                        metadata: doc.metadata
                    });
                });

                if (relevantResults.length === 0) {
                    logger.warn('No results above similarity threshold', {
                        query,
                        threshold: SIMILARITY_THRESHOLD
                    });
                }
            } catch (error) {
                logger.error('Error searching documents', error as Error, { query });
            }
        }

        logger.info('Vector similarity search test completed successfully');

    } catch (error) {
        logger.error('Test failed', error as Error);
        process.exit(1);
    }
}

// Run the test
logger.info('Starting Supabase vector similarity search test...');
testVectorSearch(); 