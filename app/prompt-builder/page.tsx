'use client';

import { useState } from 'react';
import SetupStep from '../../components/prompt-builder-page/SetupStep';
import DocumentViewer from '../../components/prompt-builder-page/DocumentViewer';
import { usePromptGeneration } from '../../hooks/usePromptGeneration';
import { useProjectContext } from '../../hooks/useProjectContext';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
  fileType: 'rubric' | 'context';
}

export default function PromptBuilder() {
  const [extractedDocuments, setExtractedDocuments] = useState<ExtractedDocument[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [showResults, setShowResults] = useState(false);
  const { chapterPromptStates, generatePrompts } = usePromptGeneration();
  const { projectContextState, generateContext } = useProjectContext();

  const handlePromptGeneration = async (documents: ExtractedDocument[], webSearch: boolean, maxMode: boolean, projectContextInputValue: string) => {
    setExtractedDocuments(documents);
    setWebSearchEnabled(webSearch);
    
    // Trigger project context generation
    await generateContext(projectContextInputValue.trim());
    
    // Use the generated context from state (fallback to empty string if not available)
    const contextParagraph = projectContextState.context || "";
    
    // Trigger prompt generation (don't await - let it run in background)
    generatePrompts(documents, contextParagraph, maxMode);
    setShowResults(true);
  };

  const handleBackToUpload = () => {
    setShowResults(false);
    setExtractedDocuments([]);
    setWebSearchEnabled(false);
  };

  if (showResults) {
    return (
      <DocumentViewer 
        extractedDocuments={extractedDocuments}
        chapterPromptStates={chapterPromptStates}
        webSearchEnabled={webSearchEnabled}
        projectContextState={projectContextState}
        onBackToUpload={handleBackToUpload}
      />
    );
  }

  return (
    <SetupStep 
      onPromptGeneration={handlePromptGeneration}
    />
  );
}