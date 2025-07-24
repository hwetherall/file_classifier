import { 
  GroqClassificationRequest, 
  GroqClassificationResponse
} from '../../../types/classification';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
  dangerouslyAllowBrowser: true
});

const CLASSIFICATION_PROMPT = `# Document Classification Prompt for Investment Memo Auto-Triage

## Your Role
You are an expert document classifier for investment analysis across all industries. Your task is to analyze uploaded documents and classify them into categories based on their value for generating comprehensive investment memos. This includes startups, scaleups, real estate, medical devices, technology, manufacturing, and any other investment opportunities.

## Classification Categories

### 1. Universal Value
Documents that provide significant value across multiple chapters of the investment memo. These are high-impact documents that inform strategic decision-making across the entire analysis.
**Examples:** Comprehensive pitch decks, complete financial summaries, board presentations, investor updates

### 2. Chapter Value  
Documents that are highly valuable for specific chapters but may create noise in others. You must specify which chapters benefit from each document.
**Examples:** Customer interview transcripts (Opportunity Validation), technical architecture docs (Product & Technology), competitive analysis reports (Competitive Analysis)

### 3. Additional Context
Documents that might provide supporting value but are not of primary importance. Useful for background context but not essential for core analysis.
**Examples:** Industry news articles, basic company descriptions, high-level marketing materials

### 4. Noise
Documents that are neutral at best or harmful at worst. These either provide no relevant information or would increase processing costs without adding value.
**Examples:** Personal correspondence, unrelated legal documents, very large files with minimal relevant content, duplicate files

## Investment Memo Chapters (for Chapter Value classification)

1. **Opportunity Validation** - Customer problem validation, demand evidence, market timing, early traction, product-market fit
2. **Product & Technology** - Product functionality, technical architecture, roadmap, IP, differentiation, R&D
3. **Market Research** - Market size (TAM/SAM/SOM), segmentation, trends, customer landscape, industry analysis
4. **Competitive Analysis** - Competitor mapping, positioning, differentiation, barriers to entry, competitive landscape
5. **Business Model** - Revenue streams, pricing strategy, monetization, scalability, go-to-market approach
6. **Sales, Marketing, GTM** - Customer acquisition, sales process, marketing channels, partnerships, distribution
7. **Unit Economics** - CAC, LTV, payback periods, cohort analysis, margin analysis, profitability metrics
8. **Finance & Operations** - Financial projections, historical performance, burn rate, capital requirements, operational metrics
9. **Team** - Founder backgrounds, team composition, hiring plans, organizational structure, key personnel
10. **Legal and IP** - Corporate structure, IP ownership, regulatory compliance, contracts, legal considerations

## Classification Process

### Step 1: Document Analysis
- Extract and analyze document content (for PDFs, Word docs, PowerPoint)
- For Excel files: Examine tab names AND content to identify key data
- Look for the "golden snitch": Excel tabs named "Key Metrics" or similar (automatically Universal Value)
- Assess document completeness, recency, and relevance

### Step 2: Content Evaluation
- **Industry-Specific Documents:**
  - Real Estate: Architectural/Engineering proposals, construction contracts, cost estimates, site surveys
  - Medical Devices: Clinical trial data, FDA submissions, regulatory documents, technical specifications
  - Technology: Technical architecture docs, product roadmaps, API documentation, security audits
  - Manufacturing: Production plans, quality control docs, supply chain analysis, cost models
- **Financial Excel Files Priority:**
  - Key Metrics tabs = Universal Value
  - Balance Sheet/Income Statement/P&L = Chapter 8 (Finance & Operations)  
  - Proforma models = Chapter 8 (Finance & Operations)
  - Cost comparison sheets = Chapter 8 (Finance & Operations)
- **Document Quality Assessment:**
  - Comprehensive vs. partial information
  - Primary source vs. secondary/derivative  
  - Current vs. outdated information
  - Professional vs. informal documentation

### Step 3: Classification Logic
1. **Universal Value Test:** Does this document inform multiple chapters with high-value insights?
2. **Chapter Specificity Test:** Is this document highly valuable for 1-3 specific chapters?
3. **Context Value Test:** Does this provide useful background without core insights?
4. **Noise Test:** Is this irrelevant, outdated, or would it harm processing efficiency?

## Output Format

You MUST return a valid JSON object with the following structure:

\`\`\`json
{
  "classifications": [
    {
      "filename": "exact filename as provided",
      "classification": "universal|chapter|context|noise",
      "reasoning": "One sentence explaining the classification decision",
      "confidence": 0.95,
      "relevant_chapters": ["Chapter 1", "Chapter 8"],
      "key_insights": ["Brief description of primary value"]
    }
  ]
}
\`\`\`

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no text before or after
2. Use proper JSON syntax - all strings in double quotes
3. Numbers should NOT have quotes (e.g., "confidence": 0.95 not "confidence": "0.95")
4. **COPY THE FILENAME EXACTLY** - Do not modify, truncate, or change ANY character in the filename
5. The classification MUST be one of: 'universal', 'chapter', 'context', or 'noise'
6. relevant_chapters array is REQUIRED for 'chapter' classification, empty array [] for others
7. Ensure all JSON syntax is correct - no trailing commas, proper brackets, etc.
8. Return ALL documents in a single JSON object with a "classifications" array
9. DO NOT return individual JSON objects - wrap everything in a single "classifications" array
10. The response must be parseable as a single JSON object
11. **FILENAME ACCURACY IS CRITICAL** - Any filename mismatch will cause processing errors
12. ALL fields must be valid data types: filename (string), classification (string), reasoning (string), confidence (number), relevant_chapters (array), key_insights (array)

## Special Handling

### Excel Files
- Always examine tab names for indicators (Key Metrics, Financial Model, P&L, etc.)
- Chunk large spreadsheets to analyze content quality
- Financial models with complete data = Universal Value
- Operational tracking sheets = likely Additional Context or Noise

### Large Documents  
- Assess information density vs. file size
- Documents over 10MB should provide exceptional value to avoid Noise classification
- Long documents with sparse relevant content = Additional Context or Noise

### Edge Cases
- Draft or template documents = Additional Context (unless comprehensive)
- Duplicate information across files = flag for user review
- Unclear or corrupted files = Noise
- Documents requiring domain expertise to interpret = Additional Context

## Quality Checks
- Ensure Chapter Value documents specify relevant chapters
- Verify Universal Value documents truly span multiple chapters  
- Confirm Noise classification for cost/benefit consideration
- Flag any documents requiring human review due to ambiguity

## Examples by Category

**Universal Value:**
- "Series A Pitch Deck" with comprehensive business overview
- "Q4 Board Report" with metrics across all functions
- "Investment Memo Template" with complete financial model

**Chapter Value:**
- "Customer Discovery Interviews Summary" → Chapter 1 (Opportunity Validation)
- "Technical Architecture Overview" → Chapter 2 (Product & Technology)
- "Clinical Trial Results" → Chapter 2 (Product & Technology)
- "Construction Cost Estimate" → Chapter 8 (Finance & Operations)
- "Competitive Analysis Report" → Chapter 4 (Competitive Analysis)
- "Proforma Analysis" → Chapter 8 (Finance & Operations)

**Additional Context:**
- "Industry Trends Report 2024" 
- "Company One-Pager"
- "News Article About Market"

**Noise:**
- "Personal Email Thread"  
- "Unrelated Legal Contract"
- "Empty Template Documents"
- "Duplicate Files"`;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export async function classifyDocuments(
  request: GroqClassificationRequest
): Promise<GroqClassificationResponse> {
  // Validate API key before processing
  if (!validateApiKey()) {
    throw new Error('Groq API key is not configured. Please set NEXT_PUBLIC_GROQ_API_KEY in your .env.local file');
  }

  // Process documents in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const allClassifications: any[] = [];
  
  for (let i = 0; i < request.documents.length; i += BATCH_SIZE) {
    const batch = request.documents.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(request.documents.length / BATCH_SIZE)} (${batch.length} documents)`);
    
    const batchClassifications = await processBatch(batch, request.projectContext);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} processed: ${batchClassifications.length} classifications returned for ${batch.length} documents`);
    allClassifications.push(...batchClassifications);
  }
  
  return {
    classifications: allClassifications
  };
}

export async function regenerateDocumentClassification(
  document: {
    filename: string;
    content: string;
    metadata: {
      type: string;
      size: number;
    };
  },
  projectContext?: string
): Promise<any> {
  console.log(`Regenerating classification for: ${document.filename}`);
  
  const classifications = await processBatch([document], projectContext);
  
  if (classifications.length === 0) {
    throw new Error('Failed to regenerate classification');
  }
  
  return classifications[0];
}

async function processBatch(
  documents: any[], 
  projectContext?: string
): Promise<any[]> {
  let lastError: any;
  
  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const documentsInfo = documents.map(doc => {
        // For Excel files, include more content to capture sheet names
        const isExcel = doc.metadata.type.includes('excel') || doc.metadata.type.includes('spreadsheet');
        const contentLength = isExcel ? 3000 : 1500; // Increased for larger files
        
        return {
          filename: doc.filename,
          fileType: doc.metadata.type,
          fileSize: doc.metadata.size,
          fileSizeMB: (doc.metadata.size / 1024 / 1024).toFixed(2) + 'MB',
          preview: doc.content.substring(0, contentLength),
          hasMoreContent: doc.content.length > contentLength
        };
      });

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: CLASSIFICATION_PROMPT
          },
          {
            role: 'user',
            content: projectContext 
              ? `Project Context: ${projectContext}\n\nClassify these documents:\n${JSON.stringify(documentsInfo, null, 2)}`
              : `Classify these documents:\n${JSON.stringify(documentsInfo, null, 2)}`
          }
        ],
        model: process.env.NEXT_PUBLIC_GROQ_MODEL || 'llama-3.1-70b-versatile',
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from Groq API');
      }

      console.log(`Raw Groq response (attempt ${attempt + 1}):`, response);
      
      let parsed: any;
      try {
        parsed = JSON.parse(response);
      } catch (parseError) {
        console.error(`JSON parse error on attempt ${attempt + 1}:`, parseError);
        console.error('Invalid JSON response:', response);
        
        // If this is a JSON parse error and we have retries left, continue
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }
      
      console.log('Parsed Groq response:', parsed);
      
      // Validate response structure - handle both old and new formats
      let classifications = parsed.classifications || parsed;
      if (!Array.isArray(classifications)) {
        // If it's a single classification object, wrap it in an array
        classifications = [parsed];
      }
      
      // Transform and validate each classification entry
      const transformedClassifications = classifications.map((classification: any) => {
        // Validate required fields and data types
        if (!classification.filename || typeof classification.filename !== 'string') {
          throw new Error(`Invalid filename in classification: ${JSON.stringify(classification)}`);
        }
        
        if (!classification.category && !classification.classification) {
          throw new Error(`Missing classification category: ${JSON.stringify(classification)}`);
        }
        
        if (!classification.reasoning || typeof classification.reasoning !== 'string') {
          throw new Error(`Invalid reasoning field (must be string): ${JSON.stringify(classification)}`);
        }
        
        if (typeof classification.confidence !== 'number') {
          throw new Error(`Invalid confidence field (must be number): ${JSON.stringify(classification)}`);
        }

        // Handle both old and new field names
        const transformed = {
          filename: classification.filename.trim(), // Trim any extra whitespace
          category: classification.category || classification.classification,
          reasoning: classification.reasoning,
          confidence: classification.confidence,
          relevantChapters: classification.relevantChapters || classification.relevant_chapters || [],
          keyInsights: classification.keyInsights || classification.key_insights || []
        };
        
        return transformed;
      });
      
      // Create a flexible filename matching function
      const normalizeFilename = (filename: string) => {
        return filename.toLowerCase()
          .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
          .replace(/\s*-\s*/g, '-') // Normalize spaces around dashes
          .trim();
      };
      
      // Build lookup maps for both exact and normalized filename matching
      const documentsByExactFilename = new Map(documents.map(doc => [doc.filename, doc]));
      const documentsByNormalizedFilename = new Map(documents.map(doc => [normalizeFilename(doc.filename), doc]));
      
      // Check which documents were classified and fix filename mismatches
      const finalClassifications: any[] = [];
      const matchedDocuments = new Set<string>();
      
      for (const classification of transformedClassifications) {
        let matchedDoc = null;
        
        // Try exact match first
        if (documentsByExactFilename.has(classification.filename)) {
          matchedDoc = documentsByExactFilename.get(classification.filename);
          matchedDocuments.add(matchedDoc.filename);
        } else {
          // Try normalized filename matching
          const normalizedClassificationFilename = normalizeFilename(classification.filename);
          if (documentsByNormalizedFilename.has(normalizedClassificationFilename)) {
            matchedDoc = documentsByNormalizedFilename.get(normalizedClassificationFilename);
            matchedDocuments.add(matchedDoc.filename);
            // Update the classification to use the correct filename
            classification.filename = matchedDoc.filename;
            console.log(`Fixed filename mismatch: "${classification.filename}" -> "${matchedDoc.filename}"`);
          }
        }
        
        if (matchedDoc) {
          finalClassifications.push(classification);
        } else {
          console.warn(`No document found matching classification filename: "${classification.filename}"`);
        }
      }
      
      // Add fallback classifications for any unmatched documents
      const unmatchedDocuments = documents.filter(doc => !matchedDocuments.has(doc.filename));
      
      if (unmatchedDocuments.length > 0) {
        console.warn(`API response missing classifications for ${unmatchedDocuments.length} documents:`, unmatchedDocuments.map(d => d.filename));
        
        const missingClassifications = unmatchedDocuments.map(doc => ({
          filename: doc.filename,
          category: 'context' as const,
          reasoning: 'Document not classified by API - defaulting to context category',
          confidence: 0.3,
          relevantChapters: [],
          keyInsights: []
        }));
        
        finalClassifications.push(...missingClassifications);
      }
      
      // Success! Return the final classifications
      return finalClassifications;
      
    } catch (error: any) {
      lastError = error;
      console.error(`Groq API error on attempt ${attempt + 1}:`, error);
      
      // Check if this is a specific JSON validation error from Groq
      if (error.message?.includes('json_validate_failed') && attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`JSON validation failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, only retry if we have attempts left
      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  // All retries exhausted
  console.error('All retry attempts exhausted. Last error:', lastError);
  
  // Fallback: Return basic classifications to allow the app to continue
  console.warn('Using fallback classifications due to API failure');
  
  const fallbackClassifications = documents.map((doc: any) => ({
    filename: doc.filename,
    category: 'context' as const,
    reasoning: 'Classification unavailable due to API error - defaulting to context',
    confidence: 0.5,
    relevantChapters: [],
    keyInsights: []
  }));
  
  return fallbackClassifications;
}

export function validateApiKey(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    console.error('Groq API key not found. Please set NEXT_PUBLIC_GROQ_API_KEY in your .env.local file');
    return false;
  }
  return true;
} 