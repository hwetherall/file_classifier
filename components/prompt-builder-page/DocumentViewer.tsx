'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import SnippetPopup from './SnippetPopup';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
}

interface ChapterPromptState {
  loading: boolean;
  error?: string;
  prompts?: { [key: string]: string };
}

interface ProjectContextState {
  loading: boolean;
  error?: string;
  context?: string;
}

interface DocumentViewerProps {
  extractedDocuments: ExtractedDocument[];
  chapterPromptStates: { [chapter: string]: ChapterPromptState };
  webSearchEnabled: boolean;
  projectContextState: ProjectContextState;
  onBackToUpload: () => void;
}

export default function DocumentViewer({ extractedDocuments, chapterPromptStates, webSearchEnabled, projectContextState, onBackToUpload }: DocumentViewerProps) {
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [chapterTemplates, setChapterTemplates] = useState<{ [chapter: string]: string }>({});
  const [filledTemplates, setFilledTemplates] = useState<{ [chapter: string]: string }>({});
  const [snippetPopup, setSnippetPopup] = useState<{ isOpen: boolean; snippetName: string }>({
    isOpen: false,
    snippetName: ''
  });

  // Get unique chapters from extracted documents
  const availableChapters = useMemo(() => 
    [...new Set(extractedDocuments.map(doc => doc.chapter))],
    [extractedDocuments]
  );

  // Load chapter templates
  useEffect(() => {
    const loadChapterTemplates = async () => {
      try {
        const response = await fetch('/data/prompt_builder/chapter_templates.json');
        if (!response.ok) {
          throw new Error('Failed to load chapter templates');
        }
        const data = await response.json();
        setChapterTemplates(data);
      } catch (error) {
        console.error('Error loading chapter templates:', error);
      }
    };

    loadChapterTemplates();
  }, []);

  // Calculate visual lines for a single paragraph (reusable function)
  // Strip HTML tags before measuring text width to avoid counting tags
  const calculateParagraphLines = useCallback((paragraph: string): number => {
    const textOnly = paragraph.replace(/<[^>]*>/g, '');
    if (textOnly === '') return 1;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = '11pt system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const maxWidth = 654;
    
    const lineWidth = context.measureText(textOnly).width;
    if (lineWidth <= maxWidth) {
      return 1; // Line fits in one visual line
    }
    
    // Line needs to be wrapped - calculate how many visual lines it needs
    const words = textOnly.split(' ');
    let currentLineWidth = 0;
    let wrappedLines = 1;
    
    for (const word of words) {
      const wordWidth = context.measureText(word + ' ').width;
      if (currentLineWidth + wordWidth > maxWidth) {
        wrappedLines += 1;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }
    
    return wrappedLines;
  }, []);



  // Helper to find open tags at the end of an HTML segment
  const findOpenTags = useCallback((htmlSegment: string): { name: string; openTag: string }[] => {
    const stack: { name: string; openTag: string }[] = [];
    // Updated regex to handle more HTML tag patterns including attributes with quotes
    const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s[^>]*)?>/g;

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(htmlSegment)) !== null) {
      const full = match[0];
      const name = match[1].toLowerCase();
      const isClosing = full.startsWith('</');
      const isSelfClosing = full.endsWith('/>') || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(name);

      if (isSelfClosing) continue;
      
      if (!isClosing) {
        // opening tag - keep full for attributes
        stack.push({ name, openTag: full });
      } else {
        // closing tag - pop the most recent matching opening tag (LIFO for proper nesting)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
            stack.splice(i, 1);
            break;
          }
        }
      }
    }

    return stack;
  }, []);

  // Split text into pages based on actual visual lines, while ensuring HTML tag continuity across page breaks
  // Content area: 654px x 894px
  // Font: 11pt = 14.67px, Line height: 1.5 = 22px  
  // Lines per page: 894px / 22px = 40.6 ≈ 40 lines
  const splitIntoPages = useCallback((text: string, linesPerPage: number = 40): string[] => {
    if (!text) return [''];
    
    const paragraphs = text.split('\n');
    const pages: string[] = [];
    let currentPageContent: string[] = []; // Store paragraphs for current page
    let currentPageLines = 0;
    let carryOpenTagsPrefix = ''; // Opening tags to prepend on next page
    
    for (const paragraph of paragraphs) {
      // Calculate lines for this paragraph (without carry tags for line calculation)
      const paragraphLines = calculateParagraphLines(paragraph);
      
      if (currentPageLines + paragraphLines > linesPerPage && currentPageContent.length > 0) {
        // Build current page content string and find open tags
        const pageStr = currentPageContent.join('\n');
        const openTags = findOpenTags(pageStr);
        const closingSuffix = openTags.slice().reverse().map(t => `</${t.name}>`).join('');
        const balancedPage = pageStr + closingSuffix;
        pages.push(balancedPage);

        // Prepare next page prefix with reopened tags
        carryOpenTagsPrefix = openTags.map(t => t.openTag).join('');
        
        // Start new page with carry tags and current paragraph
        if (carryOpenTagsPrefix) {
          currentPageContent = [carryOpenTagsPrefix + paragraph];
        } else {
          currentPageContent = [paragraph];
        }
        currentPageLines = paragraphLines;
      } else {
        // Add to current page - apply carry tags only to first paragraph of page
        if (currentPageContent.length === 0 && carryOpenTagsPrefix) {
          currentPageContent.push(carryOpenTagsPrefix + paragraph);
          carryOpenTagsPrefix = ''; // Clear after using
        } else {
          currentPageContent.push(paragraph);
        }
        currentPageLines += paragraphLines;
      }
    }
    
    // Add the last page
    if (currentPageContent.length > 0) {
      const lastStr = currentPageContent.join('\n');
      const openTags = findOpenTags(lastStr);
      const closingSuffix = openTags.slice().reverse().map(t => `</${t.name}>`).join('');
      pages.push(lastStr + closingSuffix);
    }
    
    return pages.length > 0 ? pages : [''];
  }, [calculateParagraphLines, findOpenTags]);

  // Fill templates when prompts are generated or project context changes
  useEffect(() => {
    // Only process chapters that have templates defined in chapter_templates.json
    Object.entries(chapterTemplates).forEach(([chapter, template]) => {
      // Skip empty templates
      if (!template || template.trim() === '') {
        return;
      }
      
      const state = chapterPromptStates[chapter];
      
      // Only process if chapter has prompts ready
      if (!state || !state.prompts || state.loading || state.error) {
        return;
      }
        
      // Check if we need to fill/refill this template
      setFilledTemplates(prev => {
        const currentTemplate = prev[chapter];
        const hasProjectContext = projectContextState.context;
        const needsProjectContextUpdate = hasProjectContext && (!currentTemplate || !currentTemplate.includes(projectContextState.context || ''));
        
        // Only fill if template doesn't exist or needs project context update
        if (!currentTemplate || needsProjectContextUpdate) {
          // Fill the template
          let filledTemplate = template;
        
          // Replace sections number (with type guard)
          if (!state.prompts) return prev;
          const sectionsCount = Object.keys(state.prompts).length;
          const sectionsNumberText = sectionsCount === 1 
            ? "\n\nYour analysis will focus on one critical aspect, defined as a section:"
            : `\n\nYour analysis will be divided into ${sectionsCount} critical aspects, defined as sections:`;
          filledTemplate = filledTemplate.replace(/<replace-sections-number><\/replace-sections-number>/g, `<span style="color: #1e3a8a;">${sectionsNumberText}</span>`);
          
          // Replace name-role
          const nameRoleEntries = Object.entries(state.prompts).map(([, promptContent]) => {
            const lines = promptContent.split('\n');
            let name = '';
            let role = '';
            
            // Extract name from first line after "## Section:"
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('## Section:')) {
                name = lines[i].replace('## Section:', '').trim();
                break;
              }
            }
            
            // Extract role from line after "**Role**:"
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('**Role**:')) {
                role = lines[i].replace('**Role**:', '').trim();
                break;
              }
            }
            
            return `- ${name}: ${role}`;
          });
          
          const nameRoleText = nameRoleEntries.join('\n');
          filledTemplate = filledTemplate.replace(/<replace-name-role><\/replace-name-role>/g, `<span style="color: #1e3a8a;">${nameRoleText}</span>`);
          
          // Replace section prompts
          const sectionPromptsText = Object.values(state.prompts).join('\n\n');
          filledTemplate = filledTemplate.replace(/<replace-section_prompts><\/replace-section_prompts>/g, `<span style="color: #1e3a8a;">${sectionPromptsText}</span>`);
          
          // Replace project context
          const projectContextText = projectContextState.context || '';
          filledTemplate = filledTemplate.replace(/<replace-project-context><\/replace-project-context>/g, `<span style="color: #1e3a8a;">${projectContextText}</span>`);
          
          return {
            ...prev,
            [chapter]: filledTemplate
          };
        }
        
        return prev; // No changes needed
      });
    });
  }, [chapterPromptStates, chapterTemplates, projectContextState.context]);

  // Function to filter out snippets based on web search configuration
  const filterSnippets = useCallback((text: string): string => {
    if (webSearchEnabled) {
      // Remove {{>source_evidence_requirements_without_websearch}} if web search is enabled
      return text.replace(/\{\{>source_evidence_requirements_without_websearch\}\}/g, '');
    } else {
      // Remove {{>source_evidence_requirements_with_websearch}} if web search is disabled
      return text.replace(/\{\{>source_evidence_requirements_with_websearch\}\}/g, '');
    }
  }, [webSearchEnabled]);

  // Function to prepare HTML with clickable snippets
  const prepareHtmlWithSnippets = useCallback((text: string) => {
    // First filter the text based on web search configuration
    const filteredText = filterSnippets(text);
    
    // Convert newlines to HTML line breaks for proper rendering
    const textWithBreaks = filteredText.replace(/\n/g, '<br/>');
    
    // Replace snippet placeholders with clickable HTML elements
    const htmlWithSnippets = textWithBreaks.replace(
      /\{\{>([^}]+)\}\}/g,
      (match, snippetName) => {
        const snippetId = `snippet-${Math.random().toString(36).substr(2, 9)}`;
        
        // Store snippet handler for later attachment
        setTimeout(() => {
          const element = document.getElementById(snippetId);
          if (element) {
            element.onclick = () => {
              setSnippetPopup({
                isOpen: true,
                snippetName
              });
            };
          }
        }, 0);
        
        return `<span id="${snippetId}" class="inline-block bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100">${match}</span>`;
      }
    );

    console.log(htmlWithSnippets);
    
    return htmlWithSnippets;
  }, [filterSnippets]);

  // Function to close snippet popup
  const closeSnippetPopup = useCallback(() => {
    setSnippetPopup(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Set initial chapter selection
  useEffect(() => {
    if (availableChapters.length > 0 && !selectedChapter) {
      setSelectedChapter(availableChapters[0]);
    }
  }, [availableChapters, selectedChapter]);

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
            {availableChapters.map((chapter) => {
              const promptState = chapterPromptStates[chapter];
              return (
              <button
                key={chapter}
                onClick={() => setSelectedChapter(chapter)}
                className={`box-border w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1 ${
                  selectedChapter === chapter
                    ? 'bg-green-100 text-green-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                  <div className="flex items-center justify-between">
                    <span>{chapter}</span>
                    {promptState?.loading && (
                      <div className="flex items-center">
                        <svg className="w-3 h-3 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
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
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      </div>
                    )}
                    {promptState?.error && (
                      <div className="flex items-center">
                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    {promptState?.prompts && !promptState.loading && !promptState.error && (
                      <div className="flex items-center">
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
              </button>
              );
            })}
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
        <div className="flex-1 overflow-y-auto bg-[#f9fbff] relative">
          
          <div className="pt-8">
            <div className="max-w-[8.5in] mx-auto">
              {selectedChapter ? (
                <>
                  {/* Loading state */}
                  {chapterPromptStates[selectedChapter]?.loading && (
                    <div className="bg-white shadow-sm border border-gray-200 mx-auto mb-6 py-[80px] px-[80px]"
                         style={{ width: '8.5in', height: '11in' }}>
                      <div className="pt-20">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
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
                          <h3 className="text-lg font-medium text-gray-800 mb-2">Generating Prompts</h3>
                          <p className="text-gray-600">Creating dynamic prompts for {selectedChapter} chapter...</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Error state */}
                  {chapterPromptStates[selectedChapter]?.error && (
                    <div className="bg-white shadow-sm border border-red-200 mx-auto mb-6 py-[80px] px-[80px]"
                         style={{ width: '8.5in', height: '11in' }}>
                      <div className="pt-20">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-800 mb-2">Error Generating Prompts</h3>
                          <p className="text-gray-600 mb-4">{chapterPromptStates[selectedChapter].error}</p>
                          <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Display chapter template or fallback to sections */}
                  {chapterPromptStates[selectedChapter]?.prompts && !chapterPromptStates[selectedChapter]?.loading && 
                    (() => {
                      const prompts = chapterPromptStates[selectedChapter].prompts!;
                      const template = chapterTemplates[selectedChapter];
                      const filledTemplate = filledTemplates[selectedChapter];
                      
                      // If template exists and is not empty, display the filled version
                      if (template && template.trim() !== '' && filledTemplate) {
                        const pages = splitIntoPages(filledTemplate);
                        return pages.map((pageContent, pageIndex) => (
                          <div 
                            key={`template-page-${pageIndex}`} 
                            className="bg-white shadow-sm border border-gray-200 mx-auto mb-6 py-[80px] px-[80px]"
                            style={{ 
                              width: '8.5in', 
                              height: '11in',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="text-sm leading-normal text-gray-900 w-full h-full overflow-hidden"
                              style={{
                                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                fontSize: '11pt',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                padding: '0',
                                margin: '0',
                              }}
                              dangerouslySetInnerHTML={{
                                __html: prepareHtmlWithSnippets(pageContent)
                              }}
                            />
                          </div>
                        ));
                      } else {
                        // Fallback: display individual sections as before
                        const promptEntries = Object.entries(prompts);
                      
                      return promptEntries.map(([sectionName, promptContent], sectionIndex) => {
                        const pages = splitIntoPages(promptContent);
                  return (
                          <div key={`${sectionName}-${sectionIndex}`}>
                            {/* Section Header */}
                            <div className="mb-4">
                              <h2 className="text-xl font-semibold text-gray-800 mb-2">{sectionName}</h2>
                            </div>
                            
                      {/* Pages for this section */}
                      {pages.map((pageContent, pageIndex) => (
                        <div 
                            key={`${sectionName}-page-${pageIndex}`} 
                            className="bg-white shadow-sm border border-gray-200 mx-auto mb-6 py-[80px] px-[80px]"
                            style={{ 
                              width: '8.5in', 
                              height: '11in',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="text-sm leading-normal text-gray-900 w-full h-full overflow-hidden"
                              style={{
                                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                fontSize: '11pt',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                padding: '0',
                                margin: '0',
                              }}
                              dangerouslySetInnerHTML={{
                                __html: prepareHtmlWithSnippets(pageContent)
                              }}
                            />
                        </div>
                      ))}
                      
                        {/* Section separator */}
                        {sectionIndex < promptEntries.length - 1 && (
                        <div className="my-16 flex items-center justify-center">
                          <div className="w-32 h-px bg-gray-300"></div>
                        </div>
                      )}
                    </div>
                  );
                      });
                      }
                    })()
                  }
                </>
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
      
      {/* Snippet Popup */}
      <SnippetPopup
        isOpen={snippetPopup.isOpen}
        snippetName={snippetPopup.snippetName}
        onClose={closeSnippetPopup}
      />
    </div>
  );
}