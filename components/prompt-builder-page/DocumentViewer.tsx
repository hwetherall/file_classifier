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
  const [masterTemplate, setMasterTemplate] = useState<string>('');
  const [chapterPrompts, setChapterPrompts] = useState<{ [chapter: string]: string }>({});
  const [filledTemplates, setFilledTemplates] = useState<{ [chapter: string]: string }>({});
  const [snippetPopup, setSnippetPopup] = useState<{ isOpen: boolean; snippetName: string }>({
    isOpen: false,
    snippetName: ''
  });
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [snippets, setSnippets] = useState<{ [key: string]: string }>({});

  // Get unique chapters from extracted documents
  const availableChapters = useMemo(() => 
    [...new Set(extractedDocuments.map(doc => doc.chapter))],
    [extractedDocuments]
  );

  // Load master template and chapter prompts
  useEffect(() => {
    const loadTemplateData = async () => {
      try {
        const response = await fetch('/data/prompt_builder/chapter_templates.json');
        if (!response.ok) {
          throw new Error('Failed to load chapter templates');
        }
        const data = await response.json();
        setMasterTemplate(data['chapter-general'] || '');
        setChapterPrompts(data.chapters || {});
      } catch (error) {
        console.error('Error loading template data:', error);
      }
    };

    const loadSnippets = async () => {
      try {
        const response = await fetch('/data/prompt_builder/snippets.json');
        if (!response.ok) {
          throw new Error('Failed to load snippets');
        }
        const data = await response.json();
        setSnippets(data);
      } catch (error) {
        console.error('Error loading snippets:', error);
      }
    };

    loadTemplateData();
    loadSnippets();
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
    // Only process if master template is loaded
    if (!masterTemplate || masterTemplate.trim() === '') {
      return;
    }

    // Process each chapter that has prompts ready
    Object.keys(chapterPromptStates).forEach((chapter) => {
      const state = chapterPromptStates[chapter];
      const chapterSpecificPrompt = chapterPrompts[chapter];
      
      // Only process if chapter has prompts ready and chapter-specific prompt exists
      if (!state || !state.prompts || state.loading || state.error || !chapterSpecificPrompt) {
        return;
      }
        
      // Check if we need to fill/refill this template
      setFilledTemplates(prev => {
        const currentTemplate = prev[chapter];
        const hasProjectContext = projectContextState.context;
        const needsProjectContextUpdate = hasProjectContext && (!currentTemplate || !currentTemplate.includes(projectContextState.context || ''));
        
        // Only fill if template doesn't exist or needs project context update
        if (!currentTemplate || needsProjectContextUpdate) {
          // Fill the master template
          let filledTemplate = masterTemplate;
        
          // Replace chapter-specific content
          filledTemplate = filledTemplate.replace(/<replace-chapter-specific><\/replace-chapter-specific>/g, `<span style="color: #1e3a8a;">${chapterSpecificPrompt}</span>`);

          // Replace chapter number and chapter list
          const allSelectedChapters = Object.keys(chapterPromptStates);
          const chapterCount = allSelectedChapters.length;
          const chapterListText = allSelectedChapters.join(', ');
          
          filledTemplate = filledTemplate.replace(/<replace-chapter-number><\/replace-chapter-number>/g, chapterCount.toString());
          
          filledTemplate = filledTemplate.replace(/<replace-chapter-list><\/replace-chapter-list>/g, chapterListText);

          // Replace sections number (with type guard)
          if (!state.prompts) return prev;
          const sectionsCount = Object.keys(state.prompts).length;
          const sectionsNumberText = sectionsCount === 1 
            ? "Your analysis will focus on one critical aspect, defined as a section:"
            : `Your analysis will be divided into ${sectionsCount} critical aspects, defined as sections:`;
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
  }, [chapterPromptStates, masterTemplate, chapterPrompts, projectContextState.context]);

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

  // Function to replace snippet placeholders with actual content
  const replaceSnippets = useCallback((text: string): string => {
    let processedText = text;
    
    // First apply web search filtering
    processedText = filterSnippets(processedText);
    
    // Replace snippet placeholders with their actual content
    processedText = processedText.replace(
      /\{\{>([^}]+)\}\}/g,
      (match, snippetName) => {
        const snippetContent = snippets[snippetName];
        return snippetContent || match; // Keep original if snippet not found
      }
    );
    
    return processedText;
  }, [snippets, filterSnippets]);

  // Function to strip HTML tags and get plain text
  const stripHtmlTags = useCallback((html: string): string => {
    // Create a temporary div element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get text content and clean up extra whitespace
    return tempDiv.textContent || tempDiv.innerText || '';
  }, []);

  // Function to copy text to clipboard
  const copyToClipboard = useCallback(async () => {
    const filledTemplate = filledTemplates[selectedChapter];
    if (!filledTemplate) return;

    try {
      // First replace snippets with their actual content, then strip HTML tags
      const textWithSnippets = replaceSnippets(filledTemplate);
      const plainText = stripHtmlTags(textWithSnippets);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(plainText);
      
      // Show success feedback
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error);
      // Fallback for older browsers
      try {
        const textWithSnippets = replaceSnippets(filledTemplate);
        const plainText = stripHtmlTags(textWithSnippets);
        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Show success feedback for fallback method too
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy method also failed:', fallbackError);
      }
    }
  }, [filledTemplates, selectedChapter, stripHtmlTags, replaceSnippets]);

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
                    {promptState?.prompts && !promptState.loading && !promptState.error && projectContextState.loading && (
                      <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                    )}
                    {promptState?.prompts && !promptState.loading && !promptState.error && !projectContextState.loading && (
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-normal text-gray-800">
                {selectedChapter || 'Select a Chapter'}
              </h1>
              <p className="text-sm text-gray-500">Dynamically generated chapter prompt</p>
            </div>
            
            {/* Copy Button */}
            {selectedChapter && filledTemplates[selectedChapter] && 
             chapterPromptStates[selectedChapter]?.prompts && 
             !chapterPromptStates[selectedChapter]?.loading && 
             !projectContextState.loading && (
              <button
                onClick={copyToClipboard}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  copySuccess 
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
                title="Copy prompt without HTML tags"
              >
                {copySuccess ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Document Display Area - Google Docs style */}
        <div className="flex-1 overflow-y-auto bg-[#f9fbff] relative">
          
          <div className="pt-8">
            <div className="max-w-[8.5in] mx-auto">
              {selectedChapter ? (
                <>
                  {/* Loading state - Prompt Generation */}
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

                  {/* Loading state - Project Context Generation */}
                  {chapterPromptStates[selectedChapter]?.prompts && !chapterPromptStates[selectedChapter]?.loading && projectContextState.loading && (
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
                          <h3 className="text-lg font-medium text-gray-800 mb-2">Generating Project Context</h3>
                          <p className="text-gray-600">Processing your project information to create the project context paragraph...</p>
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
                  
                  {/* Display filled template */}
                  {chapterPromptStates[selectedChapter]?.prompts && !chapterPromptStates[selectedChapter]?.loading && !projectContextState.loading &&
                    (() => {
                      const filledTemplate = filledTemplates[selectedChapter];
                      
                      // Display the filled master template
                      if (filledTemplate) {
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
                      }
                      
                      return null;
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