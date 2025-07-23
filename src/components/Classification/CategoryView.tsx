import React from 'react';
import { DocumentFile } from '../../types/document';

interface Classification {
  filename: string;
  category: 'universal' | 'chapter' | 'context' | 'noise';
  reasoning: string;
  confidence: number;
  relevantChapters: string[];
}

interface CategoryViewProps {
  files: DocumentFile[];
  classifications: Classification[];
  onFileSelect?: (file: DocumentFile) => void;
}

export default function CategoryView({ files, classifications, onFileSelect }: CategoryViewProps) {
  const categories = {
    universal: {
      title: 'Universal Value',
      description: 'High-impact documents that inform strategic decision-making across the entire analysis',
      color: 'bg-green-50 border-green-200',
      badge: 'bg-green-100 text-green-800'
    },
    chapter: {
      title: 'Chapter Value',
      description: 'Documents highly valuable for specific chapters',
      color: 'bg-blue-50 border-blue-200',
      badge: 'bg-blue-100 text-blue-800'
    },
    context: {
      title: 'Additional Context',
      description: 'Supporting documents that provide background context',
      color: 'bg-yellow-50 border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    noise: {
      title: 'Noise',
      description: 'Documents with minimal relevant information',
      color: 'bg-gray-50 border-gray-200',
      badge: 'bg-gray-100 text-gray-800'
    }
  };

  const getFilesByCategory = (category: string) => {
    return classifications
      .filter(c => c.category === category)
      .map(c => {
        const file = files.find(f => f.name === c.filename);
        return file ? { file, classification: c } : null;
      })
      .filter((item): item is { file: DocumentFile; classification: Classification } => item !== null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Document Classification Results
        </h2>
        <p className="text-gray-600">
          Files have been categorized based on their value for investment analysis
        </p>
      </div>

      {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
        const categoryFiles = getFilesByCategory(categoryKey);
        
        return (
          <div key={categoryKey} className={`rounded-lg border p-6 ${categoryInfo.color}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {categoryInfo.title}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryInfo.badge}`}>
                    {categoryFiles.length}
                  </span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {categoryInfo.description}
                </p>
              </div>
            </div>

            {categoryFiles.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No files in this category
              </p>
            ) : (
              <div className="space-y-3">
                {categoryFiles.map(({ file, classification }) => (
                  <div
                    key={file.id}
                    className={`bg-white rounded-lg p-4 border border-gray-200 ${
                      onFileSelect ? 'cursor-pointer hover:shadow-sm' : ''
                    }`}
                    onClick={() => onFileSelect?.(file)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {file.name}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {classification.reasoning}
                        </p>
                        
                        {classification.category === 'chapter' && classification.relevantChapters.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {classification.relevantChapters.map((chapter: string, index: number) => (
                              <span
                                key={index}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                              >
                                {chapter}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className={`text-sm font-medium ${getConfidenceColor(classification.confidence)}`}>
                          {Math.round(classification.confidence * 100)}% confidence
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
        );
      })}
    </div>
  );
} 