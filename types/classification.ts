export interface GroqClassificationRequest {
  documents: Array<{
    filename: string;
    content: string;
    metadata: {
      type: string;
      size: number;
    };
  }>;
  projectContext?: string;
}

export interface GroqClassificationResponse {
  classifications: Array<{
    filename: string;
    category: 'universal' | 'chapter' | 'context' | 'noise';
    reasoning: string;
    confidence: number;
    relevantChapters: string[];
    keyInsights?: string[];
  }>;
}

export interface ClassificationError {
  message: string;
  code?: string;
  details?: any;
} 