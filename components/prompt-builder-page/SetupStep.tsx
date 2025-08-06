'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FileUploadZone from '../ui/custom/FileUpload/FileUploadZone';
import { DocumentFile } from '../../types/document';
import { extractTextFromFile } from '../../lib/services/frontend/extractors';

type ToggleState = 'rubrics' | 'context';

interface FileWithChapter {
  file: DocumentFile;
  selectedChapter: string;
}

interface SetupStepProps {
  onPromptGeneration: (extractedDocuments: { fileName: string; chapter: string; text: string }[]) => void;
}

export default function SetupStep({ onPromptGeneration }: SetupStepProps) {
  const [selectedToggle, setSelectedToggle] = useState<ToggleState>('rubrics');
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [filesWithChapters, setFilesWithChapters] = useState<FileWithChapter[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);

  // Load chapters from JSON file
  useEffect(() => {
    const loadChapters = async () => {
      try {
        const response = await fetch('/data/prompt_builder/chapter_templates.json');
        if (!response.ok) {
          throw new Error('Failed to load chapters');
        }
        const data = await response.json();
        setChapters(Object.keys(data));
      } catch (error) {
        console.error('Error loading chapters:', error);
      } finally {
        setIsLoadingChapters(false);
      }
    };

    loadChapters();
  }, []);

  const handleFilesAdded = (newFiles: DocumentFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    
    // Add new files with empty chapter selection
    const newFilesWithChapters = newFiles.map(file => ({
      file,
      selectedChapter: ''
    }));
    
    setFilesWithChapters(prev => [...prev, ...newFilesWithChapters]);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
    setFilesWithChapters(prev => prev.filter(item => item.file.id !== fileId));
  };

  const handleChapterChange = (fileId: string, chapter: string) => {
    setFilesWithChapters(prev =>
      prev.map(item => {
        // If selecting a new chapter, clear it from any other file first
        if (item.file.id === fileId) {
          return { ...item, selectedChapter: chapter };
        } else if (item.selectedChapter === chapter && chapter !== '') {
          // Clear this chapter from other files since only one file per chapter allowed
          return { ...item, selectedChapter: '' };
        }
        return item;
      })
    );
  };

  const allChaptersSelected = filesWithChapters.length > 0 && filesWithChapters.every(item => item.selectedChapter !== '');

  const handleGeneratePrompts = async () => {
    if (!allChaptersSelected) return;
    
    try {
      console.log('Starting prompt generation for:', filesWithChapters);
      
      // Extract text from all files
      const extractedTexts: { fileName: string; chapter: string; text: string }[] = [];
      
      for (const item of filesWithChapters) {
        try {
          console.log(`Extracting text from: ${item.file.name}`);
          const text = await extractTextFromFile(item.file.file);
          
          extractedTexts.push({
            fileName: item.file.name,
            chapter: item.selectedChapter,
            text: text
          });
          
        } catch (error) {
          console.error(`Failed to extract text from ${item.file.name}:`, error);
          throw new Error(`Failed to extract text from ${item.file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Call the parent callback with extracted documents
      onPromptGeneration(extractedTexts);
      
      console.log('Extracted texts:', extractedTexts);
      
    } catch (error) {
      console.error('Error during prompt generation:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Prompt Builder</h1>
          <p className="text-gray-600">Dynamically generate project-specific prompts for memo generation</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            {/* Toggle Section */}
            <div className="flex justify-center">
              <div className="inline-flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSelectedToggle('rubrics')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedToggle === 'rubrics'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rubrics
                </button>
                <button
                  onClick={() => setSelectedToggle('context')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedToggle === 'context'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Context
                </button>
              </div>
            </div>

            {/* Content based on toggle */}
            {selectedToggle === 'rubrics' ? (
              <>
                {/* File Upload Zone */}
                <FileUploadZone 
                  onFilesAdded={handleFilesAdded} 
                  allowedFileTypes={['pdf', 'docx', 'txt']}
                />

                {/* File List with Chapter Dropdowns */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    {filesWithChapters.map((item) => (
                      <div key={item.file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.file.name}</p>
                            <p className="text-sm text-gray-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {/* Chapter Dropdown */}
                          <select
                            value={item.selectedChapter}
                            onChange={(e) => handleChapterChange(item.file.id, e.target.value)}
                            className="px-4 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:border-gray-400 focus:outline-none focus:border-gray-400 min-w-[150px]"
                            disabled={isLoadingChapters}
                          >
                            <option value="" className="text-gray-500">Select Chapter</option>
                            {chapters.map((chapter) => {
                              // Check if this chapter is already selected by another file
                              const isChapterTaken = filesWithChapters.some(
                                otherItem => otherItem.file.id !== item.file.id && otherItem.selectedChapter === chapter
                              );
                              return (
                                <option 
                                  key={chapter} 
                                  value={chapter}
                                  disabled={isChapterTaken}
                                  className={isChapterTaken ? 'text-gray-400' : 'text-gray-900'}
                                >
                                  {chapter}
                                </option>
                              );
                            })}
                          </select>
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemoveFile(item.file.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Generate Prompts Button */}
                {files.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleGeneratePrompts}
                      disabled={!allChaptersSelected}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        allChaptersSelected
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Generate Prompts
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Context Mode */
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Context Mode</h3>
                <p className="text-gray-600">Context-based prompt generation coming soon...</p>
              </div>
            )}
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}