import React from 'react';

interface ProcessingIndicatorProps {
  isProcessing: boolean;
  message?: string;
  progress?: number;
}

export default function ProcessingIndicator({ 
  isProcessing, 
  message = 'Processing files...', 
  progress 
}: ProcessingIndicatorProps) {
  if (!isProcessing) return null;

  return (
    <div className="flex items-center justify-center p-16">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {message}
        </h3>
        
        {progress !== undefined && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-xs mx-auto">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>
        )}
        
        <p className="text-sm text-gray-500">
          Please wait while we classify your documents with AI...
        </p>
      </div>
    </div>
  );
} 