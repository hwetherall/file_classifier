'use client';

import { useState } from 'react';
import SetupStep from '../../components/prompt-builder-page/SetupStep';
import DocumentViewer from '../../components/prompt-builder-page/DocumentViewer';
import { usePromptGeneration } from '../../hooks/usePromptGeneration';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
}

export default function PromptBuilder() {
  const [extractedDocuments, setExtractedDocuments] = useState<ExtractedDocument[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { chapterPromptStates, generatePrompts, updatePromptContent } = usePromptGeneration();

  const handlePromptGeneration = async (documents: ExtractedDocument[]) => {
    setExtractedDocuments(documents);
    // Trigger prompt generation (don't await - let it run in background)
    generatePrompts(documents);
    setShowResults(true);
  };

  const handleBackToUpload = () => {
    setShowResults(false);
    setExtractedDocuments([]);
  };

  if (showResults) {
    return (
      <DocumentViewer 
        extractedDocuments={extractedDocuments}
        chapterPromptStates={chapterPromptStates}
        onBackToUpload={handleBackToUpload}
        onUpdatePromptContent={updatePromptContent}
      />
    );
  }

  return (
    <SetupStep 
      onPromptGeneration={handlePromptGeneration}
    />
  );
}