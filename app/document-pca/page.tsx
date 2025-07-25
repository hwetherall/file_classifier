'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FileUploadZone from '../../components/FileUpload/FileUploadZone';
import { uploadFileToJuicer } from '../../lib/services/frontend/juicer.service';
import { DocumentFile } from '../../types/document';
import { analyzeText, contentToText, countTokens } from '../../utils/textAnalysis';
import { generateSummaryPDF } from '../../utils/pdfGenerator';
import { chunkDocumentByTokens } from '../../utils/documentChunking';

type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileStatus {
  file: DocumentFile;
  status: FileUploadStatus;
  error?: string;
  data?: any;
  summaryStatus?: 'pending' | 'summarizing' | 'completed' | 'failed';
  summary?: SummaryResponse;
  retryCount: number;
  chunkingAttempt?: number; // Track which chunking strategy was used
  isChunked?: boolean; // Whether file was chunked for upload
  isAutoChunked?: boolean; // Whether file was auto-chunked based on token count
  autoChunkCount?: number; // Number of auto chunks created
  selectedChunkCount?: number; // User-selected chunk count for retry
}

interface SummaryResponse {
  filename: string;
  summary: string;
  chunkCount: number;
  wordCount: number;
  tokenCount?: number;
  success: boolean;
  error?: string;
}

export default function DocumentPCA() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [selectedScope, setSelectedScope] = useState<string>('Memo - Overall');
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionScopes, setExtractionScopes] = useState<Record<string, string>>({});
  const [isLoadingScopes, setIsLoadingScopes] = useState(true);
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);

  // Load extraction scopes from JSON file
  useEffect(() => {
    const loadExtractionScopes = async () => {
      try {
        const response = await fetch('/data/extraction-scopes.json');
        if (!response.ok) {
          throw new Error('Failed to load extraction scopes');
        }
        const scopes = await response.json();
        setExtractionScopes(scopes);
        
        // Set default selection to first scope if available
        const firstScope = Object.keys(scopes)[0];
        if (firstScope) {
          setSelectedScope(firstScope);
        }
      } catch (error) {
        console.error('Error loading extraction scopes:', error);
        // Fallback to empty object or default scopes
        setExtractionScopes({
          "Memo - Overall": "Comprehensive overview covering all aspects of the business opportunity, technology, market position, and strategic considerations."
        });
      } finally {
        setIsLoadingScopes(false);
      }
    };

    loadExtractionScopes();
  }, []);

  const handleFilesAdded = (newFiles: DocumentFile[]) => {
    setFiles(newFiles);
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
  };

  const handleUploadFiles = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setFilesUploaded(true);
    
    // Initialize file statuses
    const initialStatuses: FileStatus[] = files.map(file => ({
      file,
      status: 'uploading',
      retryCount: 0,
      selectedChunkCount: 3 // Default to 3 chunks
    }));
    setFileStatuses(initialStatuses);

    try {
      // Convert DocumentFile to File objects for the service
      const fileObjects = files.map(df => df.file);
      
      // Upload files individually and track status
      const uploadPromises = fileObjects.map(async (file, index) => {
        try {
          // Update status to uploading
          setFileStatuses(prev => prev.map((fs, idx) => 
            idx === index ? { ...fs, status: 'uploading' } : fs
          ));

          const data = await uploadFileToJuicer(file);

          // Check if auto-chunking is needed based on token count
          const chunkResult = chunkDocumentByTokens(data, 10000); // Target 10k tokens per chunk
          let finalData = data;
          let isAutoChunked = false;
          let autoChunkCount = 0;

          if (chunkResult.needsChunking) {
            console.log(`Auto-chunking: ${chunkResult.originalTokenCount} tokens → ${chunkResult.chunkCount} chunks`);
            
            finalData = {
              isAutoChunked: true,
              autoChunkCount: chunkResult.chunkCount,
              chunks: chunkResult.chunks,
              originalData: data // Keep original for reference
            };
            isAutoChunked = true;
            autoChunkCount = chunkResult.chunkCount;
          }

          // Update status to success
          setFileStatuses(prev => prev.map((fs, idx) => 
            idx === index ? { 
              ...fs, 
              status: 'success', 
              data: finalData,
              isAutoChunked,
              autoChunkCount
            } : fs
          ));
        } catch (error: any) {
          // Update status to error
          setFileStatuses(prev => prev.map((fs, idx) => 
            idx === index ? { 
              ...fs, 
              status: 'error', 
              error: error.message, 
              retryCount: 0,
              selectedChunkCount: fs.selectedChunkCount || 3 // Ensure default chunk count
            } : fs
          ));
        }
      });

      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChunkCountChange = (fileIndex: number, chunkCount: number) => {
    setFileStatuses(prev => prev.map((fs, idx) => 
      idx === fileIndex ? { ...fs, selectedChunkCount: chunkCount } : fs
    ));
  };

  const handleRetryFile = async (fileIndex: number, retryAsOriginal: boolean = false) => {
    const fileStatus = fileStatuses[fileIndex];
    const newRetryCount = fileStatus.retryCount + 1;
    
    // Don't allow unlimited attempts
    if (newRetryCount > 10) {
      return;
    }
    
    // Determine if this should be a chunked retry
    const shouldChunk = !retryAsOriginal && fileStatus.selectedChunkCount && fileStatus.selectedChunkCount > 1;
    
    // Update status to uploading and increment retry count
    setFileStatuses(prev => prev.map((fs, idx) => 
      idx === fileIndex ? { 
        ...fs, 
        status: 'uploading' as FileUploadStatus, 
        error: undefined, 
        retryCount: newRetryCount,
        chunkingAttempt: shouldChunk ? fileStatus.selectedChunkCount : undefined,
        isChunked: shouldChunk ? true : undefined
      } : fs
    ));

    try {
      let data;
      
      if (!shouldChunk) {
        // Retry with original file
        console.log(`Retry ${newRetryCount}: Uploading original file`);
        data = await uploadFileToJuicer(fileStatus.file.file);
      } else {
        // Retry with user-selected chunk count
        const chunkCount = fileStatus.selectedChunkCount!;
        console.log(`Retry ${newRetryCount}: Chunking file into ${chunkCount} parts (user selected)`);
        
        // Read file content first
        const fileContent = await readFileContent(fileStatus.file.file);
        
        // Count actual tokens in the document and divide by requested chunk count
        const documentTokens = countTokens(fileContent);
        const idealTokensPerChunk = Math.floor(documentTokens / chunkCount);
        
        // Ensure minimum chunk size of 500 tokens to avoid too-small chunks
        const targetTokensPerChunk = Math.max(idealTokensPerChunk, 500);
        
        if (targetTokensPerChunk === idealTokensPerChunk) {
          console.log(`Document has ${documentTokens} tokens, creating ${chunkCount} chunks of ~${targetTokensPerChunk} tokens each`);
        } else {
          console.log(`Document has ${documentTokens} tokens, but enforcing minimum 500 tokens per chunk (would have been ${idealTokensPerChunk})`);
        }
        
        const { chunks } = chunkDocumentByTokens(fileContent, targetTokensPerChunk);
        
        console.log(`Created ${chunks.length} actual chunks, uploading each separately`);
        
        // Upload each chunk and collect results
        const chunkResults: any[] = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Uploading chunk ${i + 1}/${chunks.length}`);
          
          // Create a blob for the chunk
          const chunkBlob = new Blob([chunks[i]], { type: fileStatus.file.file.type });
          const chunkFile = new File([chunkBlob], `${fileStatus.file.name}_chunk_${i + 1}`, { 
            type: fileStatus.file.file.type 
          });
          
          const chunkResult = await uploadFileToJuicer(chunkFile);
          chunkResults.push(chunkResult);
        }
        
        // Keep chunk results separate (don't combine)
        data = {
          isChunked: true,
          chunkCount: chunks.length,
          chunks: chunkResults // Keep as array for summary API
        };
      }

      // Check if auto-chunking is needed for successful retry
      let finalData = data;
      let isAutoChunked = false;
      let autoChunkCount = 0;

      if (!data.isChunked) {
        // Only auto-chunk if it wasn't already manually chunked
        const chunkResult = chunkDocumentByTokens(data, 10000);
        
        if (chunkResult.needsChunking) {
          console.log(`Auto-chunking retry result: ${chunkResult.originalTokenCount} tokens → ${chunkResult.chunkCount} chunks`);
          
          finalData = {
            isAutoChunked: true,
            autoChunkCount: chunkResult.chunkCount,
            chunks: chunkResult.chunks,
            originalData: data
          };
          isAutoChunked = true;
          autoChunkCount = chunkResult.chunkCount;
        }
      }

                setFileStatuses(prev => prev.map((fs, idx) => 
            idx === fileIndex ? { 
              ...fs, 
              status: 'success', 
              data: finalData,
              isAutoChunked: isAutoChunked,
              autoChunkCount: autoChunkCount
            } : fs
          ));
      
      console.log(`✅ Retry ${newRetryCount} successful for ${fileStatus.file.name}`);
    } catch (error: any) {
      console.error(`❌ Retry ${newRetryCount} failed for ${fileStatus.file.name}:`, error);
      
      setFileStatuses(prev => prev.map((fs, idx) => 
        idx === fileIndex ? { 
          ...fs, 
          status: 'error', 
          error: `Retry ${newRetryCount} failed: ${error.message}` 
        } : fs
      ));
    }
  };

  // Helper function to read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleDownloadSummary = (fileStatus: FileStatus) => {
    if (!fileStatus.summary || fileStatus.summaryStatus !== 'completed') {
      alert('Summary not available for download');
      return;
    }
    
    try {
      generateSummaryPDF(
        fileStatus.file.name,
        fileStatus.summary.summary
      );
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message}`);
    }
  };

  const handleDownloadAllSummaries = () => {
    const completedSummaries = fileStatuses.filter(fs => 
      fs.summaryStatus === 'completed' && fs.summary
    );
    
    if (completedSummaries.length === 0) {
      alert('No completed summaries to download');
      return;
    }
    
    try {
      // Download each summary as individual PDF
      completedSummaries.forEach((fileStatus, index) => {
        // Add small delay between downloads to avoid overwhelming the browser
        setTimeout(() => {
          generateSummaryPDF(
            fileStatus.file.name,
            fileStatus.summary!.summary
          );
        }, index * 200); // 200ms delay between each download
      });
      
      console.log(`✅ Triggered ${completedSummaries.length} individual PDF downloads`);
    } catch (error: any) {
      console.error('Error generating PDFs:', error);
      alert(`Failed to generate PDFs: ${error.message}`);
    }
  };

  const handleGenerateSummaries = async () => {
    console.log('Generate summaries clicked');
    
    // Get all successfully processed files with their parsed data
    const successfulFiles = fileStatuses.filter(fs => fs.status === 'success' && fs.data);
    
    if (successfulFiles.length === 0) {
      alert('No successfully processed files to generate summaries from');
      return;
    }
    
    if (!selectedScope || !extractionScopes[selectedScope]) {
      alert('Please select a valid extraction scope');
      return;
    }
    
    setIsGeneratingSummaries(true);
    
    // Initialize summary status for all successful files
    setFileStatuses(prev => prev.map(fs => 
      fs.status === 'success' && fs.data 
        ? { ...fs, summaryStatus: 'pending' }
        : fs
    ));
    
    try {
      console.log(`Generating summaries for ${successfulFiles.length} documents`);
      
      // Process each document individually
      for (let i = 0; i < successfulFiles.length; i++) {
        const fileStatus = successfulFiles[i];
        const fileIndex = fileStatuses.findIndex(fs => fs.file.id === fileStatus.file.id);
        
        if (fileIndex === -1) continue;
        
        try {
          // Update status to summarizing
          setFileStatuses(prev => prev.map((fs, idx) => 
            idx === fileIndex ? { ...fs, summaryStatus: 'summarizing' } : fs
          ));
          
          console.log(`Summarizing document ${i + 1}/${successfulFiles.length}: ${fileStatus.file.name}`);
          
          // Prepare request for API call - handle chunked vs whole document
          let requestBody;
          
          if (fileStatus.data.isChunked || fileStatus.data.isAutoChunked) {
            // Send as document chunks array (either manually chunked or auto-chunked)
            const documentChunks = fileStatus.data.chunks.map((chunkContent: any) => ({
              filename: fileStatus.file.name,
              parsedContent: chunkContent
            }));
            
            requestBody = {
              documentChunks,
              extractionScope: selectedScope,
              scopeDescription: extractionScopes[selectedScope]
            };
            
            console.log(`Sending ${documentChunks.length} chunks to summary API for ${fileStatus.file.name}`);
          } else {
            // Send as single document
            const document = {
              filename: fileStatus.file.name,
              parsedContent: fileStatus.data,
              fileInfo: {
                size: fileStatus.file.size,
                type: fileStatus.file.type
              }
            };
            
            requestBody = {
              document,
              extractionScope: selectedScope,
              scopeDescription: extractionScopes[selectedScope]
            };
            
            console.log(`Sending whole document to summary API for ${fileStatus.file.name}`);
          }
          
          // Call the smart-summary API
          const response = await fetch('/api/smart-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
          }
          
          if (result.success) {
            // Update status to completed with summary
            setFileStatuses(prev => prev.map((fs, idx) => 
              idx === fileIndex ? { 
                ...fs, 
                summaryStatus: 'completed',
                summary: result
              } : fs
            ));
            
            console.log(`✅ Summary completed for ${fileStatus.file.name}`);
            console.log(`Word Count: ${result.wordCount}, Chunks: ${result.chunkCount}`);
            console.log('Summary:', result.summary);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
          
        } catch (error: any) {
          console.error(`❌ Failed to summarize ${fileStatus.file.name}:`, error);
          
          // Update status to failed
          setFileStatuses(prev => prev.map((fs, idx) => 
            idx === fileIndex ? { 
              ...fs, 
              summaryStatus: 'failed',
              summary: {
                filename: fileStatus.file.name,
                summary: '',
                chunkCount: 0,
                wordCount: 0,
                success: false,
                error: error.message
              }
            } : fs
          ));
        }
        
        // Add small delay between documents to avoid overwhelming the API
        if (i < successfulFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const completedSummaries = fileStatuses.filter(fs => fs.summaryStatus === 'completed').length;
      console.log(`Summarization complete: ${completedSummaries}/${successfulFiles.length} successful`);
      
    } catch (error: any) {
      console.error('Error in summarization process:', error);
      alert(`Failed to generate summaries: ${error.message}`);
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  if (!filesUploaded) {
    // Initial upload interface
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Document Squeezer</h1>
            <p className="text-gray-600">Extract key information and produce dense summarized versions</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
              <FileUploadZone onFilesAdded={handleFilesAdded} />
              
              {files.length > 0 && (
                <>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(file.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center">
                    <button
                      onClick={handleUploadFiles}
                      disabled={isProcessing}
                      className="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Files
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Two-column processing interface
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Document PCA</h1>
            <p className="text-gray-600">Extract key information and produce dense summarized versions</p>
          </div>
          <Link 
            href="/"
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Extraction Scope */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Extraction Scope</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="scope-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Scope
                </label>
                    <select
                        id="scope-select"
                        value={selectedScope}
                        onChange={(e) => setSelectedScope(e.target.value)}
                        disabled={isLoadingScopes}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                    >
                   {isLoadingScopes ? (
                     <option>Loading scopes...</option>
                   ) : (
                     Object.keys(extractionScopes).map((scope) => (
                       <option key={scope} value={scope}>
                         {scope}
                       </option>
                     ))
                   )}
                 </select>
              </div>
              
              <div>
                <label htmlFor="scope-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Extraction Focus Prompt
                </label>
                    <textarea
                        id="scope-description"
                        value={isLoadingScopes ? 'Loading description...' : (extractionScopes[selectedScope] || '')}
                        readOnly
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700"
                 />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGenerateSummaries}
                  disabled={isGeneratingSummaries || fileStatuses.filter(fs => fs.status === 'success').length === 0}
                  className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isGeneratingSummaries ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating Summaries...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Generate Summarized Versions
                    </>
                  )}
                </button>

                {/* Download All Summaries Button */}
                {fileStatuses.some(fs => fs.summaryStatus === 'completed') && (
                  <button
                    onClick={handleDownloadAllSummaries}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download All PDFs
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - File Status Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">File Processing Status</h2>
            
            {fileStatuses.map((fileStatus, index) => (
              <div key={fileStatus.file.id} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{fileStatus.file.name}</p>
                      <div className="text-sm text-gray-500">
                        <p>{(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        {fileStatus.data && (
                          <div>
                            <p>
                              {(() => {
                                if (fileStatus.data.isChunked || fileStatus.data.isAutoChunked) {
                                  // Calculate total from all chunks
                                  let totalWords = 0;
                                  let totalTokens = 0;
                                  const chunks = fileStatus.data.chunks;
                                  chunks.forEach((chunk: any) => {
                                    const analysis = analyzeText(contentToText(chunk));
                                    totalWords += analysis.wordCount;
                                    totalTokens += analysis.tokenCount;
                                  });
                                  return `${totalWords.toLocaleString()} words, ~${totalTokens.toLocaleString()} tokens`;
                                } else {
                                  const analysis = analyzeText(contentToText(fileStatus.data));
                                  return `${analysis.wordCount.toLocaleString()} words, ~${analysis.tokenCount.toLocaleString()} tokens`;
                                }
                              })()}
                            </p>
                            {fileStatus.isChunked && fileStatus.data.isChunked && (
                              <p className="text-blue-600">
                                Processed in {fileStatus.data.chunkCount} chunks
                              </p>
                            )}
                            {fileStatus.isAutoChunked && fileStatus.data.isAutoChunked && (
                              <p className="text-orange-600">
                                Auto-chunked into {fileStatus.data.autoChunkCount} parts (large content)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    {fileStatus.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    )}
                    
                    {fileStatus.status === 'success' && (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    
                    {fileStatus.status === 'error' && (
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <button
                          onClick={() => handleRetryFile(index, true)}
                          disabled={fileStatus.retryCount >= 10}
                          className={`px-2 py-1 text-white text-xs rounded transition-colors ${
                            fileStatus.retryCount >= 10 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-500 hover:bg-blue-600'
                          }`}
                        >
                          Retry Original
                        </button>
                        <button
                          onClick={() => handleRetryFile(index, false)}
                          disabled={fileStatus.retryCount >= 10 || !fileStatus.selectedChunkCount}
                          className={`px-2 py-1 text-white text-xs rounded transition-colors ${
                            fileStatus.retryCount >= 10 || !fileStatus.selectedChunkCount
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          Retry Chunked
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {fileStatus.status === 'error' && fileStatus.error && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm space-y-3">
                    <div>
                      <div className="text-red-700 font-medium">Upload Error:</div>
                      <div className="text-red-600">{fileStatus.error}</div>
                    </div>
                    
                    {fileStatus.retryCount > 0 && (
                      <div className="text-gray-600">
                        <div>Attempts: {fileStatus.retryCount}/10</div>
                        {fileStatus.chunkingAttempt && (
                          <div className="text-blue-600">
                            Last attempt: Chunked into {fileStatus.chunkingAttempt} parts
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="text-gray-700 font-medium">Retry Options:</div>
                      <div className="flex items-center space-x-2">
                        <label htmlFor={`chunk-select-${index}`} className="text-xs text-gray-600">
                          Chunk into:
                        </label>
                        <select
                          id={`chunk-select-${index}`}
                          value={fileStatus.selectedChunkCount || 3}
                          onChange={(e) => handleChunkCountChange(index, parseInt(e.target.value))}
                          className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value={2}>2 parts</option>
                          <option value={3}>3 parts</option>
                          <option value={5}>5 parts</option>
                          <option value={10}>10 parts</option>
                          <option value={15}>15 parts</option>
                          <option value={20}>20 parts</option>
                        </select>
                        <span className="text-xs text-gray-500">parts</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        • Use &ldquo;Retry Original&rdquo; to try the whole file again<br/>
                        • Use &ldquo;Retry Chunked&rdquo; to split the file into smaller pieces
                      </div>
                    </div>
                    
                    {fileStatus.retryCount >= 10 && (
                      <div className="text-gray-500 text-xs">
                        Maximum retry attempts reached (10/10)
                      </div>
                    )}
                  </div>
                )}
                
                {/* Summary Status */}
                {fileStatus.summaryStatus && (
                  <div className="mt-2 p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Summary Status:</span>
                      <div className="flex items-center">
                        {fileStatus.summaryStatus === 'pending' && (
                          <span className="text-sm text-gray-500">Pending</span>
                        )}
                        {fileStatus.summaryStatus === 'summarizing' && (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-2"></div>
                            <span className="text-sm text-purple-600">Summarizing...</span>
                          </div>
                        )}
                        {fileStatus.summaryStatus === 'completed' && (
                          <div className="flex items-center">
                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-sm text-green-600">Completed</span>
                          </div>
                        )}
                        {fileStatus.summaryStatus === 'failed' && (
                          <span className="text-sm text-red-600">Failed</span>
                        )}
                      </div>
                    </div>
                    
                    {fileStatus.summary && fileStatus.summaryStatus === 'completed' && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">
                          {(() => {
                            const summaryAnalysis = analyzeText(fileStatus.summary.summary);
                            return `Summary: ${summaryAnalysis.wordCount.toLocaleString()} words, ~${summaryAnalysis.tokenCount.toLocaleString()} tokens`;
                          })()}
                          {fileStatus.summary.chunkCount > 1 && ` (from ${fileStatus.summary.chunkCount} chunks)`}
                        </div>
                        <button
                          onClick={() => handleDownloadSummary(fileStatus)}
                          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download PDF
                        </button>
                      </div>
                    )}
                    
                    {fileStatus.summary && fileStatus.summaryStatus === 'failed' && fileStatus.summary.error && (
                      <div className="text-xs text-red-600">
                        Error: {fileStatus.summary.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
