/**
 * Extract content from PDF files using pdfjs-dist (browser-compatible)
 */
export async function extractPDF(buffer: Buffer): Promise<string> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction is only available in browser environments');
  }

  try {
    // Dynamic import to prevent SSR issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set the worker source to the public directory
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
        // Continue with other pages even if one fails
      }
    }
    
    // Clean up and validate the extracted text
    const cleanText = fullText.trim();
    
    if (cleanText.length === 0) {
      throw new Error('No text content found in PDF. The PDF may contain only images or be password protected.');
    }
    
    return cleanText;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    throw new Error(`PDF extraction failed: ${errorMessage}. This PDF may contain image-based text requiring OCR, be password protected, corrupted, or have complex layouts that interfere with text extraction.`);
  }
} 