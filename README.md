# Document Auto-Triage for Investment Memos

An intelligent document classification system that automatically categorizes uploaded documents for investment memo generation using AI.

## Features

- **AI-Powered Classification**: Uses Groq's Llama model to intelligently classify documents into four categories
- **Drag & Drop File Upload**: Easy file upload with support for PDF, Excel, Word, PowerPoint, and text files
- **Duplicate Detection**: Automatically identifies duplicate files based on name and size
- **Manual Override**: Drag and drop files between categories to manually adjust classifications
- **Export Results**: Download classification results as JSON or CSV
- **File Content Extraction**: Automatically extracts text from PDFs, Excel sheets, Word documents, and more

## Document Categories

1. **Universal Value** (Green): High-impact documents that inform strategic decision-making across the entire analysis
2. **Chapter Value** (Blue): Documents highly valuable for specific chapters
3. **Additional Context** (Yellow): Supporting documents that provide background context
4. **Noise** (Gray): Documents with minimal relevant information

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Groq API key (get one at [console.groq.com](https://console.groq.com))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd file-classifier
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env` (or create a new `.env` file)
   - Add your Groq API key:
```
REACT_APP_GROQ_API_KEY=your_groq_api_key_here
REACT_APP_GROQ_MODEL=llama-3.1-70b-versatile
```

4. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload Files**: 
   - Drag and drop files into the upload zone
   - Or click to browse and select files
   - Supports up to 50 files, 100MB per file

2. **Process Files**:
   - Click "Classify Documents with AI" to start the classification
   - The AI will analyze file content and categorize each document

3. **Review Results**:
   - Documents are organized into four categories
   - Each file shows its classification reasoning and confidence score
   - Chapter-specific documents show relevant chapter tags

4. **Manual Adjustments**:
   - Drag and drop files between categories to override AI classifications
   - Changes are reflected immediately in the UI

5. **Export Results**:
   - Click "Export as JSON" for detailed classification data
   - Click "Export as CSV" for a spreadsheet-friendly format

## Supported File Types

- **PDF** (.pdf) - Full text extraction from first 10 pages
- **Excel** (.xlsx) - Sheet names and content analysis
- **Word** (.docx) - Complete text extraction
- **PowerPoint** (.pptx) - Basic metadata extraction
- **Text** (.txt) - Direct text reading
- **CSV** (.csv) - First 100 rows analyzed

## Investment Memo Chapters

The system recognizes these chapters for chapter-specific classification:

1. Finance and Operations
2. Product and Technology
3. Opportunity Validation
4. Team and Talent
5. Market Analysis
6. Risk Assessment
7. Strategic Fit
8. Competitive Landscape
9. Business Model
10. Implementation Timeline

## Technical Details

### Built With

- React (Create React App) with TypeScript
- Tailwind CSS for styling
- react-dropzone for file uploads
- react-dnd for drag-and-drop functionality
- Groq SDK for AI integration
- pdf.js for PDF text extraction
- xlsx for Excel file parsing
- mammoth for Word document parsing

### Project Structure

```
src/
  components/
    FileUpload/         # File upload components
    Classification/     # Document classification views
  services/
    groqApi.ts         # AI classification service
    fileProcessing.ts  # File content extraction
  types/              # TypeScript type definitions
  utils/              # Utility functions
```

## Troubleshooting

### "Failed to classify documents"
- Check your Groq API key in the .env file
- Ensure you have an active internet connection
- Check the browser console for detailed error messages

### Files not uploading
- Verify file format is supported
- Check file size (max 100MB per file)
- Ensure total upload doesn't exceed 50 files

### Text extraction issues
- Large PDFs may take longer to process
- Some scanned PDFs may not extract text properly
- Complex Excel files might show limited content

## Development

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

### Running Tests

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.