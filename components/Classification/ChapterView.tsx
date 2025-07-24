import React, { useState } from 'react';
import { DocumentFile } from '../../types/document';

interface Classification {
  filename: string;
  category: 'universal' | 'chapter' | 'context' | 'noise';
  reasoning: string;
  confidence: number;
  relevantChapters: string[];
  keyInsights?: string[];
}

interface ChapterViewProps {
  files: DocumentFile[];
  classifications: Classification[];
  onRegenerateClassification?: (filename: string) => void;
  regeneratingFiles?: Set<string>;
}

const INVESTMENT_CHAPTERS = [
  {
    key: 'opportunity-validation',
    name: 'Opportunity Validation',
    description: 'Customer problem validation, demand evidence, market timing, early traction, product-market fit'
  },
  {
    key: 'product-technology',
    name: 'Product & Technology',
    description: 'Product functionality, technical architecture, roadmap, IP, differentiation, R&D'
  },
  {
    key: 'market-research',
    name: 'Market Research',
    description: 'Market size (TAM/SAM/SOM), segmentation, trends, customer landscape, industry analysis'
  },
  {
    key: 'competitive-analysis',
    name: 'Competitive Analysis',
    description: 'Competitor mapping, positioning, differentiation, barriers to entry, competitive landscape'
  },
  {
    key: 'business-model',
    name: 'Business Model',
    description: 'Revenue streams, pricing strategy, monetization, scalability, go-to-market approach'
  },
  {
    key: 'sales-marketing-gtm',
    name: 'Sales, Marketing, GTM',
    description: 'Customer acquisition, sales process, marketing channels, partnerships, distribution'
  },
  {
    key: 'unit-economics',
    name: 'Unit Economics',
    description: 'CAC, LTV, payback periods, cohort analysis, margin analysis, profitability metrics'
  },
  {
    key: 'finance-operations',
    name: 'Finance & Operations',
    description: 'Financial projections, historical performance, burn rate, capital requirements, operational metrics'
  },
  {
    key: 'team',
    name: 'Team',
    description: 'Founder backgrounds, team composition, hiring plans, organizational structure, key personnel'
  },
  {
    key: 'legal-ip',
    name: 'Legal and IP',
    description: 'Corporate structure, IP ownership, regulatory compliance, contracts, legal considerations'
  }
];

export default function ChapterView({ 
  files, 
  classifications, 
  onRegenerateClassification,
  regeneratingFiles 
}: ChapterViewProps) {
  const [selectedChapter, setSelectedChapter] = useState<string>(INVESTMENT_CHAPTERS[0].key);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDocumentsForChapter = (chapterKey: string) => {
    const selectedChapterInfo = INVESTMENT_CHAPTERS.find(c => c.key === chapterKey);
    if (!selectedChapterInfo) return [];

    return classifications
      .filter(classification => {
        // Include Universal Value documents (show in all chapters)
        if (classification.category === 'universal') {
          return true;
        }
        
        // Include Chapter Value documents that match this specific chapter
        if (classification.category === 'chapter') {
          return classification.relevantChapters.some(chapter => 
            chapter.toLowerCase().includes(selectedChapterInfo.name.toLowerCase()) ||
            selectedChapterInfo.name.toLowerCase().includes(chapter.toLowerCase()) ||
            // Handle various chapter name formats
            chapter.toLowerCase().replace(/[&,]/g, '').includes(selectedChapterInfo.name.toLowerCase().replace(/[&,]/g, ''))
          );
        }
        
        return false;
      })
      .map(classification => {
        const file = files.find(f => f.name === classification.filename);
        return file ? { file, classification } : null;
      })
      .filter((item): item is { file: DocumentFile; classification: Classification } => item !== null);
  };

  const selectedChapterInfo = INVESTMENT_CHAPTERS.find(c => c.key === selectedChapter);
  const chapterDocuments = getDocumentsForChapter(selectedChapter);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Chapter View
        </h2>
        <p className="text-gray-600">
          Documents organized by investment memo chapters
        </p>
      </div>

      {/* Chapter Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label htmlFor="chapter-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Chapter
        </label>
        <select
          id="chapter-select"
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {INVESTMENT_CHAPTERS.map((chapter) => (
            <option key={chapter.key} value={chapter.key}>
              {chapter.name}
            </option>
          ))}
        </select>

        {selectedChapterInfo && (
          <p className="text-sm text-gray-600 mt-2">
            {selectedChapterInfo.description}
          </p>
        )}
      </div>

      {/* Documents for Selected Chapter */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Documents for {selectedChapterInfo?.name}
          </h3>
          <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
            {chapterDocuments.length} documents
          </span>
        </div>

        {chapterDocuments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              No documents classified for this chapter
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chapterDocuments.map(({ file, classification }) => (
              <div
                key={file.id}
                className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${
                  regeneratingFiles?.has(file.name) ? 'ring-2 ring-blue-300' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {file.name}
                      </h4>
                      
                      {/* Category Badge */}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        classification.category === 'universal' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {classification.category === 'universal' ? 'Universal' : 'Chapter-Specific'}
                      </span>

                      {onRegenerateClassification && (
                        <button
                          onClick={() => onRegenerateClassification(file.name)}
                          disabled={regeneratingFiles?.has(file.name)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                          title="Regenerate classification"
                        >
                          {regeneratingFiles?.has(file.name) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      {classification.reasoning}
                    </p>
                    
                    {classification.category === 'chapter' && classification.relevantChapters.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {classification.relevantChapters.map((chapter: string, index: number) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                          >
                            {chapter}
                          </span>
                        ))}
                      </div>
                    )}

                    {classification.keyInsights && classification.keyInsights.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">Key Insights:</div>
                        <ul className="text-xs text-gray-600 list-disc list-inside">
                          {classification.keyInsights.map((insight: string, index: number) => (
                            <li key={index}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className={`text-sm font-medium ${getConfidenceColor(classification.confidence)}`}>
                      {Math.round(classification.confidence * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 