import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { enhancedLogger as logger } from '../utils/logger';
import { preprocessUrl, isValidUrl } from '../utils/urlProcessor';

// Environment validation
const PUPPETEER_ENDPOINT = process.env.PUPPETEER_ENDPOINT;
if (!PUPPETEER_ENDPOINT) {
    throw new Error('Missing required environment variable: PUPPETEER_ENDPOINT');
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
}

/**
 * Scrape a URL using the Puppeteer service
 */
export async function scrapeUrl(url: string): Promise<ScraperResponse | null> {
    try {
        const payload = {
            url,
            format: 'json' as const
        };

        if (!PUPPETEER_ENDPOINT) {
            throw new Error('PUPPETEER_ENDPOINT is not defined');
        }

        const response = await axios.post<PuppeteerResponse>(PUPPETEER_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        if (!response.data) {
            return null;
        }

        return {
            url,
            title: response.data.title || '',
            description: response.data.description || '',
            content: response.data.content || ''
        };

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                logger.error('Puppeteer service timeout', error, { url });
            } else {
                logger.error('Axios error during scraping', error, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url
                });
            }
        } else {
            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('Scraping error', err, { url });
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
            // Validate request
            const { url } = ScraperRequestSchema.parse(req.body);

            // Scrape URL
            const scrapedData = await scrapeUrl(url);
            if (!scrapedData) {
                res.status(422).json({
                    error: 'No data returned from scraping service'
                });
                return;
            }

            res.status(200).json(scrapedData);

        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('Webhook processing error', err, {
                body: req.body
            });

            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Invalid request data',
                    details: error.errors
                });
                return;
            }

            res.status(500).json({
                error: 'Failed to process webhook'
            });
        }
    })();
});

export default router;
