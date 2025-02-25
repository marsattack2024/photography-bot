export interface DocumentMetadata {
    url?: string;
    title?: string;
    description?: string;
    sourceType?: string;
    scrapeTimestamp?: string;
    [key: string]: unknown;
}

export interface DocumentInput {
    content: string;
    source: string;
    metadata: DocumentMetadata;
}

export interface StoredDocument {
    id: string;
    content: string;
    metadata: DocumentMetadata;
    embedding?: number[];
}

export function storeDocument(doc: DocumentInput): Promise<StoredDocument>; 