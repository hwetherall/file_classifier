/**
 * Count words in a text string
 * @param text - The text to count words in
 * @returns Number of words
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count tokens using OpenAI's tokenization approach
 * This is an approximation since we can't use tiktoken in the browser
 * @param text - The text to count tokens in
 * @returns Approximate number of tokens
 */
export function countTokens(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified approach since tiktoken can't be used in browser
  // For more accuracy, this should be calculated server-side
  const characters = text.length;
  return Math.ceil(characters / 4);
}

/**
 * Get comprehensive text analysis
 * @param text - The text to analyze
 * @returns Object with word count and estimated token count
 */
export function analyzeText(text: string): {
  wordCount: number;
  tokenCount: number;
} {
  if (!text || typeof text !== 'string') {
    return {
      wordCount: 0,
      tokenCount: 0
    };
  }
  
  return {
    wordCount: countWords(text),
    tokenCount: countTokens(text)
  };
}

/**
 * Convert document content to text string for analysis
 * @param content - Document content (string or object)
 * @returns Text string ready for analysis
 */
export function contentToText(content: any): string {
  if (typeof content === 'string') {
    return content;
  } else if (typeof content === 'object') {
    // Convert JSON object to readable text
    return JSON.stringify(content, null, 2);
  } else {
    return String(content);
  }
} 