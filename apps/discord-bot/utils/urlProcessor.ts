import { URL } from 'url';

/**
 * Preprocess a URL to ensure it has a proper scheme.
 * Handles various URL formats and always uses https://.
 * 
 * @param url - The URL string to process
 * @returns Processed URL with https:// scheme
 */
export function preprocessUrl(url: string): string {
    // Strip whitespace and convert to lowercase
    url = url.trim().toLowerCase();
    
    // Remove multiple forward slashes (except after scheme)
    url = url.replace(/(?<!:)\/+/g, '/');
    
    // Regular expression for naked URLs with common TLDs
    const tldPattern = '(?:com|net|org|edu|gov|mil|biz|info|name|museum|coop|aero|[a-z]{2}|co)';
    const nakedUrlPattern = new RegExp(
        `^(www\\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+${tldPattern}(/[^\\s]*)?$`
    );
    
    // If it starts with www., add https://
    if (url.startsWith('www.')) {
        return `https://${url}`;
    }
    
    // Check if it's a naked URL
    if (nakedUrlPattern.test(url)) {
        return `https://${url}`;
    }
    
    try {
        // Parse the URL
        const parsed = new URL(url);
        
        // If no scheme or if scheme is http, use https
        if (!parsed.protocol || parsed.protocol === 'http:') {
            parsed.protocol = 'https:';
            return parsed.toString();
        }
        
        return url;
    } catch {
        // If URL parsing fails, assume it needs https://
        return `https://${url}`;
    }
}

/**
 * Normalize a URL by removing common tracking parameters and fragments.
 * 
 * @param url - The URL to normalize
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        
        // List of query parameters to remove
        const trackingParams = new Set([
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', '_ga', 'ref', 'source'
        ]);
        
        // Remove tracking parameters
        const params = Array.from(parsed.searchParams.entries())
            .filter(([key]) => !trackingParams.has(key.toLowerCase()));
        
        // Clear all search parameters
        parsed.search = '';
        
        // Add back non-tracking parameters
        params.forEach(([key, value]) => {
            parsed.searchParams.append(key, value);
        });
        
        // Remove fragment
        parsed.hash = '';
        
        return parsed.toString();
    } catch {
        return url;
    }
}

/**
 * Check if a string is a valid URL.
 * 
 * @param url - The URL string to validate
 * @returns True if valid URL, False otherwise
 */
export function isValidUrl(url: string): boolean {
    try {
        // First preprocess the URL
        const processedUrl = preprocessUrl(url);
        
        // Parse the processed URL
        const parsed = new URL(processedUrl);
        
        // Check for minimum valid URL components
        if (!parsed.protocol || !parsed.hostname) {
            return false;
        }
        
        // Check TLD
        const tld = parsed.hostname.split('.').pop()?.toLowerCase() || '';
        const validTlds = new Set([
            'com', 'net', 'org', 'edu', 'gov', 'mil', 'biz', 'info',
            'name', 'museum', 'coop', 'aero', 'ca', 'co', 'uk', 'us',
            'eu', 'de', 'fr', 'au', 'jp', 'ru', 'ch', 'it', 'nl', 'se',
            'no', 'es', 'pl'
        ]);
        
        return validTlds.has(tld);
    } catch {
        return false;
    }
}

/**
 * Extract URLs from text, including various formats.
 * 
 * @param text - The text to extract URLs from
 * @returns Array of extracted and preprocessed URLs
 */
export function extractUrlsFromText(text: string): string[] {
    // Pattern for URLs with scheme
    const schemePattern = 'https?://(?:[a-z0-9\\-._~%!$&\'()*+,;=:@/]*[a-z0-9])?';
    
    // Pattern for www. URLs
    const wwwPattern = 'www\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?';
    
    // Pattern for naked domains with common TLDs
    const tldPattern = '(?:com|net|org|edu|gov|mil|biz|info|name|museum|coop|aero|[a-z]{2}|co)';
    const domainPattern = `(?<!@)(?!www\\.)([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+${tldPattern}`;
    
    // Combine patterns
    const combinedPattern = new RegExp(
        `(${schemePattern}|${wwwPattern}|${domainPattern})(?:/[^\\s]*)?`,
        'gi'
    );
    
    // Find all matches
    const matches = text.toLowerCase().match(combinedPattern) || [];
    const urls: string[] = [];
    const seen = new Set<string>();
    
    // Process each match
    for (const match of matches) {
        const processedUrl = preprocessUrl(match);
        const normalizedUrl = normalizeUrl(processedUrl);
        
        if (!seen.has(normalizedUrl) && isValidUrl(normalizedUrl)) {
            urls.push(normalizedUrl);
            seen.add(normalizedUrl);
        }
    }
    
    return urls;
} 