import Groq from 'groq-sdk';
import { analyzeText, contentToText } from '../../../utils/textAnalysis';

// Initialize Groq client (server-side only)
const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
});

// Types
export interface DocumentChunk {
  content: any;
  chunkIndex?: number;
}

export interface SummaryRequest {
  // Either a single document or an array of chunks from the SAME document
  documentContent: any; // Single whole document
  documentChunks?: DocumentChunk[]; // OR pre-chunked pieces of the same document
  extractionScope: string;
  scopeDescription: string;
  filename: string;
}

export interface SummaryResponse {
  filename: string;
  summary: string;
  chunkCount: number;
  wordCount: number;
  tokenCount?: number;
  success: boolean;
  error?: string;
}

/**
 * Process a single document or chunk
 */
async function processDocumentChunk(
  content: any,
  extractionScope: string,
  scopeDescription: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const contentText = contentToText(content);
  const chunkInfo = totalChunks > 1 ? ` (Part ${chunkIndex + 1} of ${totalChunks})` : '';
  
  const prompt = `You are an expert document analyst. Your task is to extract and summarize key information from the provided document content based on the specified extraction scope. Key information is defined according to the scope, where scope description will tell you what to focus during your extraction.

EXTRACTION SCOPE: ${extractionScope}
SCOPE DESCRIPTION: ${scopeDescription}

INSTRUCTIONS:
1. Focus specifically on information relevant to the "${extractionScope}" scope
2. Extract key facts, figures, and insights that align with the scope description
3. Maintain accuracy and cite specific details when available
4. If the content doesn't contain relevant information for this scope, state that clearly
5. Be concise but comprehensive in your analysis. You don’t have a set page limit. Include the information you access valid to that scope
6. NEVER PARAPHRASE, always use the exact words from the document
7. NEVER ADD NEW INFORMATION. You are a summary tool, all the information in the summary MUST come from the document. Don’t infer or calculate.
8. ONLY include information relevant to the scope

EXECUTION GUIDELINES:
Think step by step. In your execution, you should follow these steps:
- Step 1: Analyze the scope description and define what are the items to look for in the document. 
- Step 2: Remember the INSTRUCTIONS before continuing
- Step 3: Go through the document and extract information relevant to the aforementioned plan
- Step 4: Comprise the final result

${chunkInfo}

DOCUMENT CONTENT:
${contentText}

OUTPUT INSTRUCTIONS:
Provide the summary as markdown text and prefer to use bullet points and lists to make it more concise. NEVER PARAPRASE, always use the exact words from the document. Output only the summary, no other text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyst specializing in extracting and summarizing key business information from various document types.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: process.env.NEXT_PUBLIC_GROQ_MODEL || 'llama-3.1-70b-versatile',
      temperature: 0.1
    });

    return completion.choices[0].message.content || 'No summary generated';
  } catch (error: any) {
    console.error(`Error processing chunk ${chunkIndex + 1}:`, error);
    throw new Error(`Failed to process chunk: ${error.message}`);
  }
}



/**
 * Combine multiple chunk summaries into a final summary
 */
async function combineSummaries(
  summaries: string[], 
  extractionScope: string, 
  scopeDescription: string,
  filename: string
): Promise<string> {
  const combinedSummaries = summaries.map((summary, index) => 
    `=== Part ${index + 1} ===\n${summary}`
  ).join('\n\n');

  console.log('PARTS BEING MERGED - Combined summaries:', combinedSummaries);

  const prompt = `You are an expert document analyst. You have received summaries from different parts of the same document. Your task is to create a comprehensive, cohesive final summary.

DOCUMENT: ${filename}

INSTRUCTIONS:
1. Combine the information from all parts into a single, cohesive summary
2. Remove redundancy and consolidate similar information
3. Maintain all key facts, figures, and insights
4. Ensure the final summary flows logically
5. NEVER PARAPHRASE, always use the exact words from the document
6. NEVER ADD NEW INFORMATION. You are a summary tool, all the information in the summary MUST come from the parts. Don’t infer or calculate.
7. You don’t have a set page limit. Your goal is to combine the summaries into a single document making sure to remove redundancy and consolidate similar information.

PART SUMMARIES:
${combinedSummaries}

OUTPUT INSTRUCTIONS:
Provide the final summary as markdown text and prefer to use bullet points and lists to make it more concise. NEVER PARAPHRASE, always use the exact words from the document. Output only the summary, no other text.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyst specializing in creating comprehensive, cohesive summaries from multiple document parts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: process.env.NEXT_PUBLIC_GROQ_MODEL || 'llama-3.1-70b-versatile',
      temperature: 0.1
    });

    console.log('FINAL SUMMARY:', completion.choices[0].message.content);

    return completion.choices[0].message.content || 'No final summary generated';
  } catch (error: any) {
    console.error('Error combining summaries:', error);
    throw new Error(`Failed to combine summaries: ${error.message}`);
  }
}

/**
 * Main function to summarize a document or document chunks
 */
export async function summarizeDocument(request: SummaryRequest): Promise<SummaryResponse> {
  try {
    console.log(`Starting summarization for: ${request.filename}`);
    console.log(`Extraction scope: ${request.extractionScope}`);
    
    // Determine processing mode: whole document or pre-chunked
    const isChunkedMode = !!request.documentChunks;
    const chunks = isChunkedMode 
      ? request.documentChunks!.map(chunk => chunk.content)
      : [request.documentContent];
    const chunkCount = chunks.length;
    
    console.log(`Processing mode: ${isChunkedMode ? 'PRE-CHUNKED' : 'WHOLE DOCUMENT'}`);
    console.log(`Processing ${chunkCount} chunk(s)`);
    
    // Calculate total word and token count from all chunks
    let totalWordCount = 0;
    let totalTokenCount = 0;
    
    for (const chunk of chunks) {
      const analysis = analyzeText(contentToText(chunk));
      totalWordCount += analysis.wordCount;
      totalTokenCount += analysis.tokenCount;
    }
    
    console.log(`Total analysis - Words: ${totalWordCount}, Tokens: ${totalTokenCount}`);
    
    if (chunkCount === 1) {
      // Single whole document
      console.log('Processing single document');
      
      const summary = await processDocumentChunk(
        chunks[0],
        request.extractionScope,
        request.scopeDescription,
        0,
        1
      );
      
      return {
        filename: request.filename,
        summary,
        chunkCount: 1,
        wordCount: totalWordCount,
        tokenCount: totalTokenCount,
        success: true
      };
    } else {
      // Multiple chunks of the same document - process each and combine
      console.log(`Processing ${chunkCount} chunks of the same document`);
      
      const chunkSummaries: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        const chunkSummary = await processDocumentChunk(
          chunks[i],
          request.extractionScope,
          request.scopeDescription,
          i,
          chunks.length
        );
        
        chunkSummaries.push(chunkSummary);
        
        // Add small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log('All chunks processed, combining summaries');
      
      // Combine all chunk summaries into final summary
      const finalSummary = await combineSummaries(
        chunkSummaries,
        request.extractionScope,
        request.scopeDescription,
        request.filename
      );
      
      return {
        filename: request.filename,
        summary: finalSummary,
        chunkCount: chunks.length,
        wordCount: totalWordCount,
        tokenCount: totalTokenCount,
        success: true
      };
    }
  } catch (error: any) {
    console.error(`Error summarizing document ${request.filename}:`, error);
    
    return {
      filename: request.filename,
      summary: '',
      chunkCount: 0,
      wordCount: 0,
      tokenCount: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate Groq API key
 */
export function validateGroqApiKey(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    console.error('Groq API key not found. Please set NEXT_PUBLIC_GROQ_API_KEY in your .env file');
    return false;
  }
  return true;
} 