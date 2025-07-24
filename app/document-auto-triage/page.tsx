'use client';

import { useState } from 'react';
import Link from 'next/link';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import FileList from '../../components/FileUpload/FileList';
import DraggableCategoryView from '../../components/Classification/DraggableCategoryView';
import ChapterView from '../../components/Classification/ChapterView';
import ProcessingIndicator from '../../components/ProcessingIndicator';
import { classifyDocuments, regenerateDocumentClassification } from '../../lib/services/frontend/groqApi';
import { findDuplicateFiles } from '../../utils/duplicateDetection';
import { extractFileContent } from '../../lib/services/frontend/fileProcessing';
import { DocumentFile } from '../../types/document';
import { GroqClassificationResponse } from '../../types/classification';

export default function DocumentAutoTriage() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [duplicates, setDuplicates] = useState<DocumentFile[][]>([]);
  const [classifications, setClassifications] = useState<GroqClassificationResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [regeneratingFiles, setRegeneratingFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<string>('');
  const [currentView, setCurrentView] = useState<'category' | 'chapter'>('category');

  const SAMPLE_PROJECT_CONTEXT = "These files are going to be used to analyse a potential Affordable Housing Development Project in Los Angeles. We are deciding whether to invest in this project. ";

  const handleFilesAdded = (newFiles: DocumentFile[]) => {
    const allFiles = [...files, ...newFiles];
    setFiles(allFiles);
    const duplicateGroups = findDuplicateFiles(allFiles);
    setDuplicates(duplicateGroups);
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    setDuplicates(findDuplicateFiles(updatedFiles));
  };

  const handleClassificationChange = (filename: string, newCategory: string) => {
    if (!classifications) return;
    
    const updatedClassifications = {
      ...classifications,
      classifications: classifications.classifications.map(c => 
        c.filename === filename 
          ? { ...c, category: newCategory as any, reasoning: `Manually moved to ${newCategory}` }
          : c
      )
    };
    
    setClassifications(updatedClassifications);
  };

  const handleProcessFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      // Extract content from all files
      console.log(`Starting content extraction for ${files.length} files`);
      const documentsWithContent = await Promise.all(
        files.map(async (file, index) => {
          console.log(`Extracting content from file ${index + 1}/${files.length}: ${file.name}`);
          const content = await extractFileContent(file.file);
          
          const doc = {
            filename: file.name,
            content: content || `[Unable to extract content from ${file.name}]`,
            metadata: {
              type: file.type,
              size: file.size
            }
          };
          
          console.log(`Content extracted for ${file.name}: ${content ? content.length + ' chars' : 'FAILED'}`);
          return doc;
        })
      );
      
      console.log(`Content extraction complete. Processing ${documentsWithContent.length} documents for classification`);

      const response = await classifyDocuments({
        documents: documentsWithContent,
        projectContext: projectContext.trim() || undefined
      });

      console.log(`Classification complete. Received ${response.classifications.length} classifications for ${documentsWithContent.length} documents`);
      
      // Log any missing documents
      const classifiedFilenames = new Set(response.classifications.map((c: any) => c.filename));
      const missingDocuments = documentsWithContent.filter(doc => !classifiedFilenames.has(doc.filename));
      if (missingDocuments.length > 0) {
        console.warn(`Missing classifications for ${missingDocuments.length} documents:`, missingDocuments.map(d => d.filename));
      }

      setClassifications(response);
    } catch (err) {
      setError('Failed to classify documents. Please try again.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateClassification = async (filename: string) => {
    if (!classifications) return;
    
    const file = files.find(f => f.name === filename);
    if (!file) {
      console.error(`File not found: ${filename}`);
      return;
    }
    
    // Add file to regenerating set
    setRegeneratingFiles(prev => new Set([...Array.from(prev), filename]));
    
    try {
      // Extract content from the file
      const content = await extractFileContent(file.file);
      
      const document = {
        filename: file.name,
        content: content || `[Unable to extract content from ${file.name}]`,
        metadata: {
          type: file.type,
          size: file.size
        }
      };
      
      // Regenerate classification
      const newClassification = await regenerateDocumentClassification(
        document, 
        projectContext.trim() || undefined
      );
      
      // Update classifications state
      const updatedClassifications = {
        ...classifications,
        classifications: classifications.classifications.map(c => 
          c.filename === filename ? newClassification : c
        )
      };
      
      setClassifications(updatedClassifications);
      console.log(`Successfully regenerated classification for: ${filename}`);
      
    } catch (err) {
      console.error(`Failed to regenerate classification for ${filename}:`, err);
      // You could add a toast notification here
    } finally {
      // Remove file from regenerating set
      setRegeneratingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Document Auto-Triage</h1>
          <p className="text-gray-600">Automatically classify documents for investment memos using AI</p>
        </div>

        {!classifications ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-200 pb-6">
                <label htmlFor="project-context" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Context (Optional)
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Provide additional context about your investment analysis to help the AI make better classifications.
                </p>
                <div className="space-y-3">
                  <textarea
                    id="project-context"
                    value={projectContext}
                    onChange={(e) => setProjectContext(e.target.value)}
                    placeholder="e.g., This is a Series A investment analysis for a B2B SaaS company in the healthcare space..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => setProjectContext(SAMPLE_PROJECT_CONTEXT)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Sample Text
                    </button>
                  </div>
                </div>
              </div>
              
              <FileUploadZone onFilesAdded={handleFilesAdded} />
              
              {files.length > 0 && (
                <>
                  <FileList 
                    files={files} 
                    onRemove={handleRemoveFile}
                    duplicates={duplicates.flatMap(group => group.map(f => f.id))} 
                  />
                  
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={handleProcessFiles}
                      disabled={isProcessing}
                      className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          Classify Documents with AI
                        </>
                      )}
                    </button>
                    
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {isProcessing ? (
              <ProcessingIndicator isProcessing={isProcessing} />
            ) : (
              <>
                <div className="mb-6 text-center flex gap-4 items-center justify-center">
                  <Link 
                    href="/"
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Home
                  </Link>
                  <button
                    onClick={() => {
                      setClassifications(null);
                      setFiles([]);
                      setDuplicates([]);
                      setProjectContext('');
                      setCurrentView('category');
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Start New Classification
                  </button>
                </div>
                
                {/* View Toggle Tabs */}
                <div className="mb-6">
                  <div className="flex justify-center">
                    <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                      <button
                        onClick={() => setCurrentView('category')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentView === 'category'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Category View
                      </button>
                      <button
                        onClick={() => setCurrentView('chapter')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentView === 'chapter'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Chapter View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Render appropriate view */}
                {currentView === 'category' ? (
                  <DraggableCategoryView 
                    files={files}
                    classifications={classifications.classifications}
                    onClassificationChange={handleClassificationChange}
                    onRegenerateClassification={handleRegenerateClassification}
                    regeneratingFiles={regeneratingFiles}
                  />
                ) : (
                  <ChapterView
                    files={files}
                    classifications={classifications.classifications}
                    onRegenerateClassification={handleRegenerateClassification}
                    regeneratingFiles={regeneratingFiles}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}