import { analyzeText, contentToText, countTokens } from './textAnalysis';

// Configuration
export const MAX_TOKENS_PER_CHUNK = 10000; // Target tokens per chunk
export const TOKEN_OVERLAP = 200; // Tokens to overlap between chunks for context



/**
 * Split text into chunks based on token count with overlap
 */
export function chunkTextByTokens(text: string, maxTokens: number = MAX_TOKENS_PER_CHUNK, overlapTokens: number = TOKEN_OVERLAP): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  
  // If text is small enough, return as single chunk
  const totalTokens = countTokens(text);
  if (totalTokens <= maxTokens) {
    return [text];
  }
  
  let currentChunk = '';
  let currentTokens = 0;
  let overlapWords: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWithSpace = currentChunk ? ' ' + word : word;
    const testChunk = currentChunk + wordWithSpace;
    const testTokens = countTokens(testChunk);
    
    // If adding this word would exceed the limit, save current chunk and start new one
    if (testTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk);
      
      // Start new chunk with overlap
      const overlapText = overlapWords.join(' ');
      currentChunk = overlapText + (overlapText ? ' ' + word : word);
      currentTokens = countTokens(currentChunk);
      
      // Reset overlap for next chunk
      overlapWords = [];
    } else {
      // Add word to current chunk
      currentChunk = testChunk;
      currentTokens = testTokens;
    }
    
    // Track words for overlap (keep last N words based on token count)
    overlapWords.push(word);
    if (overlapWords.length > 50) { // Reasonable limit to prevent memory issues
      const overlapTestText = overlapWords.join(' ');
      if (countTokens(overlapTestText) > overlapTokens) {
        overlapWords.shift(); // Remove first word
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Check if document content needs token-based chunking
 */
export function shouldChunkDocumentByTokens(content: any, maxTokens: number = MAX_TOKENS_PER_CHUNK): boolean {
  const text = contentToText(content);
  const tokenCount = countTokens(text);
  return tokenCount > maxTokens;
}

/**
 * Chunk document content into manageable pieces based on token count
 */
export function chunkDocumentByTokens(content: any, maxTokens: number = MAX_TOKENS_PER_CHUNK, overlapTokens: number = TOKEN_OVERLAP): {
  chunks: string[];
  originalTokenCount: number;
  chunkCount: number;
  needsChunking: boolean;
  text: string; // Return the converted text to avoid double conversion
} {
  const text = contentToText(content);
  const originalTokenCount = countTokens(text);
  const needsChunking = originalTokenCount > maxTokens;
  
  if (!needsChunking) {
    return {
      chunks: [text],
      originalTokenCount,
      chunkCount: 1,
      needsChunking: false,
      text
    };
  }
  
  const chunks = chunkTextByTokens(text, maxTokens, overlapTokens);
  
  return {
    chunks,
    originalTokenCount,
    chunkCount: chunks.length,
    needsChunking: true,
    text
  };
}

/**
 * Analyze document and provide token-based chunking recommendations
 */
export function analyzeDocumentForTokenChunking(content: any): {
  analysis: ReturnType<typeof analyzeText>;
  recommendation: {
    shouldChunk: boolean;
    estimatedChunks: number;
    reason: string;
  };
  text: string; // Return converted text to avoid double conversion
} {
  const text = contentToText(content);
  const analysis = analyzeText(text);
  
  const shouldChunk = analysis.tokenCount > MAX_TOKENS_PER_CHUNK;
  const estimatedChunks = shouldChunk ? Math.ceil(analysis.tokenCount / (MAX_TOKENS_PER_CHUNK - TOKEN_OVERLAP)) : 1;
  
  let reason = '';
  if (!shouldChunk) {
    reason = `Document is ${analysis.tokenCount} tokens, which fits in a single chunk (limit: ${MAX_TOKENS_PER_CHUNK} tokens)`;
  } else {
    reason = `Document is ${analysis.tokenCount} tokens, exceeding the ${MAX_TOKENS_PER_CHUNK} token limit. Estimated ${estimatedChunks} chunks needed.`;
  }
  
  return {
    analysis,
    recommendation: {
      shouldChunk,
      estimatedChunks,
      reason
    },
    text
  };
} 