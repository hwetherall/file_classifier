/**
 * Extract content from plain text files
 */
export async function extractText(buffer: Buffer): Promise<string> {
    try {
      // Try different encodings
      const encodings = ['utf-8', 'latin1', 'ascii'];
      
      for (const encoding of encodings) {
        try {
          const content = buffer.toString(encoding as BufferEncoding);
          // Basic validation - check if content seems readable
          if (content && !content.includes('\uFFFD')) {
            return content;
          }
        } catch {
          continue;
        }
      }
      
      // If all encodings failed, throw error
      throw new Error('Unable to decode text file with any supported encoding (utf-8, latin1, ascii)');
      
    } catch (error) {
      console.error('Text extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text content: ${errorMessage}`);
    }
  } 