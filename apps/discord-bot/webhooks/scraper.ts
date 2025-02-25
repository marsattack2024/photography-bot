import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { enhancedLogger as logger } from '../utils/logger';
import { preprocessUrl, isValidUrl } from '../utils/urlProcessor';

// Environment validation
const SCRAPER_ENDPOINT = process.env.SCRAPER_ENDPOINT?.trim();
let isScraperConfigured = false;

// Validate endpoint
if (!SCRAPER_ENDPOINT) {
    logger.warn('SCRAPER_ENDPOINT not set - web scraping will be disabled', {
        envVars: {
            NODE_ENV: process.env.NODE_ENV,
            hasEndpoint: false
        }
    });
} else {
    // Validate endpoint URL
    try {
        new URL(SCRAPER_ENDPOINT);
        isScraperConfigured = true;
        logger.info('Scraper endpoint configured', {
            endpoint: SCRAPER_ENDPOINT
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Invalid URL');
        logger.error('Invalid SCRAPER_ENDPOINT URL - web scraping will be disabled', err, {
            endpoint: SCRAPER_ENDPOINT
        });
    }
}

// Response type from Puppeteer service
export interface PuppeteerResponse {
    title: string;
    description: string;
    content: string;
}

// Request validation schema
const ScraperRequestSchema = z.object({
    url: z.string()
        .transform((url: string) => {
            const processed = preprocessUrl(url);
            if (!isValidUrl(processed)) {
                throw new Error('Invalid URL format');
            }
            return processed;
        })
});

// Response type
export interface ScraperResponse {
    url: string;
    title: string;
    description: string;
    content: string;
    metadata: {
        scrapeTimestamp: string;
        sourceType: string;
        [key: string]: unknown;
    };
}

/**
 * Scrape a URL using the scraper service
 */
export async function scrapeUrl(url: string): Promise<ScraperResponse | null> {
    // Check if scraper is configured
    if (!isScraperConfigured || !SCRAPER_ENDPOINT) {
        logger.warn('Web scraping is disabled - SCRAPER_ENDPOINT not configured', {
            url,
            NODE_ENV: process.env.NODE_ENV
        });
        return {
            url,
            title: 'Web scraping not available',
            description: 'The web scraping service is not configured',
            content: 'Web scraping is currently disabled. Please configure SCRAPER_ENDPOINT to enable this feature.',
            metadata: {
                scrapeTimestamp: new Date().toISOString(),
                sourceType: 'error',
                error: 'scraper_not_configured'
            }
        };
    }

    // Ensure URL is properly formatted
    const processedUrl = preprocessUrl(url);

    logger.info('Starting URL scrape', {
        url: processedUrl
    });

    try {
        // Prepare request payload
        const payload = {
            url: processedUrl,
            format: 'json' as const
        };

        logger.debug('Sending request to scraper service', {
            payload
        });

        const response = await axios.post<PuppeteerResponse>(SCRAPER_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        // Log raw response for debugging
        logger.info('Received response from scraper service', {
            statusCode: response.status,
            responsePreview: response.data ? JSON.stringify(response.data).substring(0, 1000) : '',
            contentType: response.headers['content-type'] || 'unknown',
            responseLength: response.data ? JSON.stringify(response.data).length : 0
        });

        if (!response.data) {
            logger.error('Empty response from scraper service', new Error('Empty response'), {
                url: processedUrl
            });
            return null;
        }

        // Extract and validate required fields
        const result: ScraperResponse = {
            url: processedUrl,
            title: response.data.title || '',
            description: response.data.description || '',
            content: response.data.content || '',
            metadata: {
                scrapeTimestamp: new Date().toISOString(),
                sourceType: 'web_scrape'
            }
        };

        logger.info('Successfully scraped URL', {
            url: processedUrl,
            titleLength: result.title.length,
            descriptionLength: result.description.length,
            contentLength: result.content.length
        });

        return result;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                logger.error('Scraper service timeout', error, {
                    url: processedUrl,
                    timeout: 30000
                });
            } else {
                logger.error('Axios error during scraping', error, {
                    url: processedUrl,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    responseData: error.response?.data
                });
            }
        } else {
            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('Scraping error', err, { url: processedUrl });
        }
        return null;
    }
}

// Create router
const router = Router();

// Webhook endpoint
router.post('/webhook/scrape', (req: Request, res: Response): void => {
    (async () => {
        try {
            logger.info('Received scrape webhook request', {
                url: req.body.url,
                format: req.body.format
            });

            // Validate request
            const { url } = ScraperRequestSchema.parse(req.body);

            // Scrape URL
            const scrapedData = await scrapeUrl(url);
            if (!scrapedData) {
                logger.error('No data returned from scraper', new Error('Scraping failed'), {
                    url
                });
                res.status(422).json({
                    error: 'No data returned from scraping service'
                });
                return;
            }

            logger.info('Successfully processed webhook', {
                url,
                contentLength: scrapedData.content.length
            });

            res.status(200).json(scrapedData);

        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error('Invalid request data', error, {
                    body: req.body,
                    errors: error.errors
                });
                res.status(400).json({
                    error: 'Invalid request data',
                    details: error.errors
                });
                return;
            }

            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('Webhook processing error', err, {
                body: req.body
            });

            res.status(500).json({
                error: 'Failed to process webhook'
            });
        }
    })();
});

export default router;

