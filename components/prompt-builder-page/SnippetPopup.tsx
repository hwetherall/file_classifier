'use client';

import { useEffect, useState } from 'react';

interface SnippetPopupProps {
  isOpen: boolean;
  snippetName: string;
  onClose: () => void;
}

export default function SnippetPopup({ isOpen, snippetName, onClose }: SnippetPopupProps) {
  const [snippetContent, setSnippetContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load snippet content when popup opens
  useEffect(() => {
    if (isOpen && snippetName) {
      setLoading(true);
      fetch('/data/prompt_builder/snippets.json')
        .then(response => response.json())
        .then(data => {
          setSnippetContent(data[snippetName] || `Snippet "${snippetName}" not present in local database.`);
        })
        .catch(error => {
          console.error('Error loading snippet:', error);
          setSnippetContent(`Error loading snippet: ${error.message}`);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, snippetName]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const popup = document.getElementById('snippet-popup');
      if (popup && !popup.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100); // Small delay to prevent immediate closing
      
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-30" />
      
      {/* Popup */}
      <div
        id="snippet-popup"
        className="relative bg-white rounded-lg shadow-xl border border-gray-200 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Snippet: {snippetName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-2 text-gray-600">Loading snippet...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-2 rounded border">
                {snippetContent}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}