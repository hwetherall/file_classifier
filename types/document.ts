export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  lastModified: number;
  file: File; // Store the actual File object for content extraction
}

export const INVESTMENT_CHAPTERS = [
  'Finance and Operations',
  'Product and Technology',
  'Opportunity Validation',
  'Team and Talent',
  'Market Analysis',
  'Risk Assessment',
  'Strategic Fit',
  'Competitive Landscape',
  'Business Model',
  'Implementation Timeline'
]; 