import { NextRequest, NextResponse } from 'next/server';
import { summarizeDocument, validateGroqApiKey, type SummaryRequest } from '../../../lib/services/backend/groq-summary.service';

export async function POST(request: NextRequest) {
  try {
    // Validate API key first
    if (!validateGroqApiKey()) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    
        // Validate required fields - handle single document or document chunks
    const { document, documentChunks, extractionScope, scopeDescription } = body;
    
    // Exactly one of document or documentChunks must be provided
    const hasDocument = document && typeof document === 'object';
    const hasDocumentChunks = documentChunks && Array.isArray(documentChunks);
    
    if (!hasDocument && !hasDocumentChunks) {
      return NextResponse.json(
        { error: 'Must provide either "document" (whole document) or "documentChunks" (array of chunks)' },
        { status: 400 }
      );
    }
    
    if (hasDocument && hasDocumentChunks) {
      return NextResponse.json(
        { error: 'Provide either "document" or "documentChunks", not both' },
        { status: 400 }
      );
    }
    
    if (!extractionScope || typeof extractionScope !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid extractionScope' },
        { status: 400 }
      );
    }
    
    if (!scopeDescription || typeof scopeDescription !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid scopeDescription' },
        { status: 400 }
      );
    }

    let filename: string;
    let summaryRequest: SummaryRequest;

    if (hasDocument) {
      // Single whole document
      if (!document.filename || !document.parsedContent) {
        return NextResponse.json(
          { error: 'Invalid document structure - missing filename or parsedContent' },
          { status: 400 }
        );
      }
      
      filename = document.filename;
      console.log(`Processing whole document: ${filename}`);
      
      summaryRequest = {
        documentContent: document.parsedContent,
        extractionScope,
        scopeDescription,
        filename
      };
    } else {
      // Document chunks (pre-chunked pieces of the same document)
      if (documentChunks.length === 0) {
        return NextResponse.json(
          { error: 'documentChunks array cannot be empty' },
          { status: 400 }
        );
      }
      
      // All chunks should have the same filename (they're chunks of the same document)
      filename = documentChunks[0].filename;
      if (!filename) {
        return NextResponse.json(
          { error: 'Missing filename in first chunk' },
          { status: 400 }
        );
      }
      
        // Validate all chunks and extract content
       const chunks = documentChunks.map((chunk: any, index: number) => {
         if (!chunk.parsedContent) {
           throw new Error(`Missing parsedContent in chunk ${index}`);
         }
         return {
           content: chunk.parsedContent,
           chunkIndex: index
         };
       });
      
      console.log(`Processing ${chunks.length} chunks of document: ${filename}`);
      
      summaryRequest = {
        documentContent: undefined, // Not used when chunks are provided
        documentChunks: chunks,
        extractionScope,
        scopeDescription,
        filename
      };
    }

    console.log(`Extraction scope: ${extractionScope}`);

    // Process the document (whole or chunked)
    const summary = await summarizeDocument(summaryRequest);
    
    console.log(`Summarization complete for ${filename}: ${summary.success ? 'SUCCESS' : 'FAILED'}`);

    // Return result
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Error in smart-summary API:', error);
    
    return NextResponse.json(
      { 
        filename: 'unknown',
        summary: '',
        chunkCount: 0,
        wordCount: 0,
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST to submit a document (whole or chunked) for summarization.',
      supportedMethods: ['POST'],
      usage: {
        wholeDocument: { document: { filename: 'file.pdf', parsedContent: '...' } },
        chunkedDocument: { documentChunks: [{ filename: 'file.pdf', parsedContent: '...' }] }
      }
    },
    { status: 405 }
  );
}
