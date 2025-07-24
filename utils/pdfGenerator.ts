import jsPDF from 'jspdf';

/**
 * Generate and download a PDF from summary content
 * @param filename - Original filename (will be used as base for PDF name)
 * @param summaryContent - The summary text content (markdown)
 */
export function generateSummaryPDF(
  filename: string,
  summaryContent: string
): void {
  try {
    // Create new PDF document
    const doc = new jsPDF();
    
    // Set up document properties
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let yPosition = margin;
    
    // Helper function to add text with word wrapping and proper pagination
    const addWrappedText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      if (isBold) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      
      const lines = doc.splitTextToSize(text, contentWidth);
      const lineHeight = fontSize * 0.4;
      
      // Add lines one by one, checking for page breaks
      for (let i = 0; i < lines.length; i++) {
        // Check if we need a new page for this line
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Add the line
        doc.text(lines[i], margin, yPosition);
        yPosition += lineHeight;
      }
      
      // Add extra spacing after the text block
      yPosition += 5;
      
      return yPosition;
    };
    
    // Process and add summary content only
    const cleanedContent = cleanMarkdownForPDF(summaryContent);
    addWrappedText(cleanedContent, 12);
    
    // Generate PDF filename
    const pdfFilename = generatePDFFilename(filename);
    
    // Save the PDF
    doc.save(pdfFilename);
    
    console.log(`✅ PDF generated: ${pdfFilename}`);
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean markdown content for PDF display
 */
function cleanMarkdownForPDF(markdownText: string): string {
  return markdownText
    // Remove markdown headers (convert to plain text)
    .replace(/^#{1,6}\s+/gm, '')
    // Convert bullet points
    .replace(/^\s*[-*+]\s+/gm, '• ')
    // Convert numbered lists
    .replace(/^\s*\d+\.\s+/gm, (match, offset, string) => {
      const num = match.match(/\d+/)?.[0];
      return `${num}. `;
    })
    // Remove bold/italic markdown (keep text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Get base filename without extension
 */
function getBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Generate appropriate PDF filename
 */
function generatePDFFilename(originalFilename: string): string {
  const baseName = getBaseName(originalFilename);
  return `${baseName}.pdf`;
}

 