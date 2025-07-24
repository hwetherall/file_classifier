import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Dynamic import for PDF.js to avoid SSR issues
let pdfjsLib: any = null;

// Configure PDF.js worker - use local worker instead of CDN
const initPdfJs = async () => {
  if (typeof window !== 'undefined' && !pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    if ('Worker' in window) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
    }
  }
};

export async function extractFileContent(file: File): Promise<string> {
  const fileType = file.type;
  
  try {
    if (fileType === 'application/pdf') {
      return await extractPDFContent(file);
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) {
      return await extractExcelContent(file);
    } else if (fileType.includes('word') || fileType.includes('document') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
      return await extractWordContent(file);
    } else if (fileType.includes('presentation') || file.name.endsWith('.pptx')) {
      return await extractPowerPointContent(file);
    } else if (fileType.includes('text') || file.name.endsWith('.txt')) {
      return await extractTextContent(file);
    } else if (fileType.includes('csv') || file.name.endsWith('.csv')) {
      return await extractCSVContent(file);
    }
    
    return `[Unsupported file type: ${file.name}]`;
  } catch (error) {
    console.error(`Error extracting content from ${file.name}:`, error);
    return `[Error extracting content from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

async function extractPDFContent(file: File): Promise<string> {
  try {
    // Ensure we're on the client side and PDF.js is loaded
    if (typeof window === 'undefined') {
      return `PDF file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - Server-side processing not supported`;
    }
    
    await initPdfJs();
    if (!pdfjsLib) {
      return `PDF file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - PDF.js not available`;
    }

    const arrayBuffer = await file.arrayBuffer();
    
    // Add timeout and better error handling
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0 // Reduce logging
    });
    
    const pdf = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF loading timeout')), 30000)
      )
    ]) as any;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 5); // Reduce to 5 pages for better performance
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      } catch (pageError) {
        console.warn(`Error extracting page ${i}:`, pageError);
        continue; // Skip problematic pages
      }
    }
    
    return fullText.trim() || `PDF file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
  } catch (error) {
    console.error('PDF extraction error:', error);
    // Return basic file info instead of empty string
    return `PDF file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - Content extraction failed`;
  }
}

async function extractExcelContent(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let content = '';
    const sheetNames = workbook.SheetNames;
    
    // Include sheet names in the content for classification
    content += `Excel workbook with sheets: ${sheetNames.join(', ')}\n\n`;
    
    // Extract content from each sheet (limit to first 3 sheets)
    const maxSheets = Math.min(sheetNames.length, 3);
    
    for (let i = 0; i < maxSheets; i++) {
      const sheetName = sheetNames[i];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to CSV for text extraction
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const rows = csv.split('\n').slice(0, 50); // Limit to first 50 rows
      
      content += `\nSheet: ${sheetName}\n`;
      content += rows.join('\n');
      content += '\n';
      
      // Check for key indicators
      if (sheetName.toLowerCase().includes('key metric') || 
          sheetName.toLowerCase().includes('financial') ||
          sheetName.toLowerCase().includes('p&l') ||
          sheetName.toLowerCase().includes('balance')) {
        content += `[IMPORTANT: Sheet "${sheetName}" appears to contain key financial data]\n`;
      }
    }
    
    return content.trim();
  } catch (error) {
    console.error('Excel extraction error:', error);
    return '';
  }
}

async function extractWordContent(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('Word extraction error:', error);
    return '';
  }
}

async function extractPowerPointContent(file: File): Promise<string> {
  // PowerPoint extraction is complex, for now return basic info
  // In production, you'd use a library like pptx-parser
  return `PowerPoint presentation: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
}

async function extractTextContent(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

async function extractCSVContent(file: File): Promise<string> {
  try {
    const text = await file.text();
    const lines = text.split('\n').slice(0, 100); // Limit to first 100 lines
    return lines.join('\n');
  } catch (error) {
    console.error('CSV extraction error:', error);
    return '';
  }
} 