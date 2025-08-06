import { extractText } from './text-extractor';
import { extractWord } from './word-extractor';
import { extractPDF } from './pdf-extractor';

export { extractText, extractWord, extractPDF };

/**
 * Extract text content from supported file types
 */
export async function extractTextFromFile(file: File): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('File extraction is only available in browser environments');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Get file extension
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'txt':
      return await extractText(buffer);
    
    case 'docx':
      return await extractWord(buffer);
    
    case 'pdf':
      return await extractPDF(buffer);
    
    default:
      throw new Error(`Unsupported file type: ${extension}. Only PDF, DOCX, and TXT files are supported.`);
  }
}