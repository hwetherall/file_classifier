import React, { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DocumentFile } from '../../types/document';
import ExportResults from '../ExportResults';

interface Classification {
  filename: string;
  category: 'universal' | 'chapter' | 'context' | 'noise';
  reasoning: string;
  confidence: number;
  relevantChapters: string[];
}

interface DraggableCategoryViewProps {
  files: DocumentFile[];
  classifications: Classification[];
  onClassificationChange: (filename: string, newCategory: string) => void;
  onRegenerateClassification?: (filename: string) => void;
  regeneratingFiles?: Set<string>;
}

interface DraggableFileProps {
  file: DocumentFile;
  classification: Classification;
  onRegenerateClassification?: (filename: string) => void;
  isRegenerating?: boolean;
}

const DraggableFile: React.FC<DraggableFileProps> = ({ 
  file, 
  classification, 
  onRegenerateClassification,
  isRegenerating = false
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'file',
    item: { file, classification },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div
      ref={drag as any}
      className={`bg-white rounded-lg p-4 border border-gray-200 cursor-move transition-opacity ${
        isDragging ? 'opacity-50' : 'hover:shadow-md'
      } ${isRegenerating ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">
              {file.name}
            </h4>
            {onRegenerateClassification && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerateClassification(file.name);
                }}
                disabled={isRegenerating}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                title="Regenerate classification"
              >
                {isRegenerating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            )}
            <div className="relative group">
              <svg
                className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 mb-1 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-xs">
                {classification.reasoning}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          
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
        
        <div className="text-right">
          <div className={`text-sm font-medium ${getConfidenceColor(classification.confidence)}`}>
            {Math.round(classification.confidence * 100)}%
          </div>
          <div className="text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </div>
        </div>
      </div>
    </div>
  );
};

interface CategorySectionProps {
  category: string;
  categoryInfo: {
    title: string;
    description: string;
    color: string;
    badge: string;
  };
  files: { file: DocumentFile; classification: Classification }[];
  onDrop: (item: any, category: string) => void;
  onRegenerateClassification?: (filename: string) => void;
  regeneratingFiles?: Set<string>;
}

const CategorySection: React.FC<CategorySectionProps> = ({ 
  category, 
  categoryInfo, 
  files, 
  onDrop,
  onRegenerateClassification,
  regeneratingFiles
}) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'file',
    drop: (item: any) => onDrop(item, category),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop as any}
      className={`rounded-lg border p-6 transition-all ${categoryInfo.color} ${
        isOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {categoryInfo.title}
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryInfo.badge}`}>
              {files.length}
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {categoryInfo.description}
          </p>
        </div>
      </div>

      <div className="min-h-[100px]">
        {files.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {isOver ? 'Drop file here' : 'No files in this category'}
          </p>
        ) : (
          <div className="space-y-3">
            {files.map(({ file, classification }) => (
              <DraggableFile
                key={file.id}
                file={file}
                classification={classification}
                onRegenerateClassification={onRegenerateClassification}
                isRegenerating={regeneratingFiles?.has(file.name) || false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function DraggableCategoryView({ 
  files, 
  classifications, 
  onClassificationChange,
  onRegenerateClassification,
  regeneratingFiles
}: DraggableCategoryViewProps) {
  const [localClassifications, setLocalClassifications] = useState(classifications);

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
    return localClassifications
      .filter(c => c.category === category)
      .map(c => {
        const file = files.find(f => f.name === c.filename);
        return file ? { file, classification: c } : null;
      })
      .filter((item): item is { file: DocumentFile; classification: Classification } => item !== null);
  };

  const handleDrop = (item: any, newCategory: string) => {
    const { file } = item;
    
    // Update local state
    const updatedClassifications = localClassifications.map(c => 
      c.filename === file.name 
        ? { ...c, category: newCategory as any, reasoning: `Manually moved to ${newCategory}` }
        : c
    );
    
    setLocalClassifications(updatedClassifications);
    
    // Notify parent component
    onClassificationChange(file.name, newCategory);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Document Classification Results
          </h2>
          <p className="text-gray-600">
            Files have been categorized based on their value for investment analysis
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Drag and drop files between categories to manually adjust classifications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
            const categoryFiles = getFilesByCategory(categoryKey);
            
            return (
              <CategorySection
                key={categoryKey}
                category={categoryKey}
                categoryInfo={categoryInfo}
                files={categoryFiles}
                onDrop={handleDrop}
                onRegenerateClassification={onRegenerateClassification}
                regeneratingFiles={regeneratingFiles}
              />
            );
          })}
        </div>

        <ExportResults files={files} classifications={localClassifications} />
      </div>
    </DndProvider>
  );
} 