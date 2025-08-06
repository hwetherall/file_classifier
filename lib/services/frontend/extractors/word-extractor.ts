import mammoth from 'mammoth'; // For Word documents

/**
 * Extract content from Word documents (only .docx)
 */
export async function extractWord(buffer: Buffer): Promise<string> {
  // Handle DOCX files with mammoth
  try {
    // Convert Buffer to ArrayBuffer for mammoth
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    // Check if we got meaningful content
    if (result.value && result.value.trim().length > 0) {
      return result.value;
    }
    
    // If no text content found, throw error
    throw new Error('DOCX file contains no extractable text content. Document may be empty or contain only images/graphics.');
    
  } catch (error) {
    console.error('Mammoth DOCX extraction failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Re-throw with more specific error message
    throw new Error(`DOCX extraction failed: ${errorMessage}`);
  }
}