'use client';

import { useState, useEffect, useMemo } from 'react';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
}

interface DocumentViewerProps {
  extractedDocuments: ExtractedDocument[];
  onBackToUpload: () => void;
}

export default function DocumentViewer({ extractedDocuments, onBackToUpload }: DocumentViewerProps) {
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showPagePopup, setShowPagePopup] = useState(false);
  const [editableDocuments, setEditableDocuments] = useState<ExtractedDocument[]>([]);

  // Get unique chapters from extracted documents
  const availableChapters = useMemo(() => 
    [...new Set(extractedDocuments.map(doc => doc.chapter))],
    [extractedDocuments]
  );

  // Initialize editable documents when extractedDocuments change
  useEffect(() => {
    setEditableDocuments([...extractedDocuments]);
  }, [extractedDocuments]);

  // Get documents for selected chapter
  const selectedDocuments = editableDocuments.filter(doc => doc.chapter === selectedChapter);

  // Split text into pages based on calculated lines per page
  // Usable content area: 654x894 pixels
  // Font: 11pt = 14.67px, Line height: 1.5 = 22px
  // Lines per page: 894px / 22px = 40.6 ≈ 40 lines
  const splitIntoPages = (text: string, linesPerPage: number = 40): string[] => {
    // Split text into lines first, preserving original line breaks
    const lines = text.split('\n');
    const pages: string[] = [];
    
    for (let i = 0; i < lines.length; i += linesPerPage) {
      const pageLines = lines.slice(i, i + linesPerPage);
      pages.push(pageLines.join('\n'));
    }
    
    return pages.length > 0 ? pages : [''];
  };

  // Calculate total pages for selected documents
  useEffect(() => {
    if (selectedDocuments.length > 0) {
      const total = selectedDocuments.reduce((sum, doc) => {
        const pages = splitIntoPages(doc.text);
        return sum + pages.length;
      }, 0);
      setTotalPages(total);
      setCurrentPage(1);
    } else {
      setTotalPages(0);
      setCurrentPage(1);
    }
  }, [selectedDocuments]);

  // Set initial chapter selection
  useEffect(() => {
    if (availableChapters.length > 0 && !selectedChapter) {
      setSelectedChapter(availableChapters[0]);
    }
  }, [availableChapters, selectedChapter]);

  // Handle text changes
  const handleTextChange = (docIndex: number, pageIndex: number, newContent: string) => {
    setEditableDocuments(prev => {
      const newDocs = [...prev];
      const docToUpdate = newDocs.find((doc, idx) => 
        doc.chapter === selectedChapter && idx === docIndex
      );
      
      if (docToUpdate) {
        const pages = splitIntoPages(docToUpdate.text);
        pages[pageIndex] = newContent;
        docToUpdate.text = pages.join('\n');
      }
      
      return newDocs;
    });
  };

  // Handle scroll to track current page and show popup
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const pageHeight = 11 * 96; // Approximate height of a page in pixels (11 inches * 96 DPI)
    
    const newCurrentPage = Math.floor(scrollTop / pageHeight) + 1;
    
    if (newCurrentPage !== currentPage) {
      setCurrentPage(newCurrentPage);
      setShowPagePopup(true);
      
      // Hide popup after 2 seconds
      setTimeout(() => setShowPagePopup(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-72 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={onBackToUpload}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-gray-800">Chapters</h2>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <nav className="py-2 px-2">
            {availableChapters.map((chapter) => (
              <button
                key={chapter}
                onClick={() => setSelectedChapter(chapter)}
                className={`box-border w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1 ${
                  selectedChapter === chapter
                    ? 'bg-green-100 text-green-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {chapter}
              </button>
            ))}
          </nav>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header - Google Docs style */}
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-lg font-normal text-gray-800">
                {selectedChapter || 'Select a Chapter'}
              </h1>
              <p className="text-sm text-gray-500">Dynamically generated chapter prompt</p>
            </div>
          </div>
        </div>

        {/* Document Display Area - Google Docs style */}
        <div className="flex-1 overflow-y-auto bg-[#f9fbff] relative" onScroll={handleScroll}>
          {/* Page Popup */}
          {showPagePopup && totalPages > 0 && (
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 bg-opacity-90 text-white px-3 py-2 rounded-md text-xs font-medium z-50 pointer-events-none">
              Page {currentPage} of {totalPages}
            </div>
          )}
          
          <div className="py-8">
            <div className="max-w-[8.5in] mx-auto">
              {selectedChapter ? (
                selectedDocuments.map((doc, docIndex) => {
                  const pages = splitIntoPages(doc.text);
                  return (
                    <div key={`${doc.fileName}-${docIndex}`}>
                      {/* Pages */}
                      {pages.map((pageContent, pageIndex) => (
                        <div 
                          key={`page-${pageIndex}`} 
                          className="bg-white shadow-sm border border-gray-200 mx-auto mb-6"
                          style={{ 
                            width: '8.5in', 
                            height: '11in',
                            overflow: 'hidden',
                          }}
                        >
                          <textarea
                             className="px-20 text-sm leading-normal text-gray-900 w-full h-full resize-none border-none outline-none bg-transparent [&::-webkit-scrollbar]:hidden"
                             style={{
                               fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               fontSize: '11pt',
                               lineHeight: '1.5',
                               whiteSpace: 'pre-wrap',
                               wordWrap: 'break-word',
                               paddingTop: '80px', // Reserve space at top like Google Docs header
                               paddingBottom: '80px', // Reserve space at bottom like Word documents
                               overflow: 'hidden', // Prevent scrolling within the page
                             }}
                             value={pageContent}
                             onChange={(e) => handleTextChange(docIndex, pageIndex, e.target.value)}
                             spellCheck={false}
                           />
                        </div>
                      ))}
                      
                      {/* Document separator */}
                      {docIndex < selectedDocuments.length - 1 && (
                        <div className="my-16 flex items-center justify-center">
                          <div className="w-32 h-px bg-gray-300"></div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-normal text-gray-800 mb-2">Select a Chapter</h3>
                  <p className="text-gray-500">Choose a chapter from the sidebar to view its documents</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}