'use client';

import { useState } from 'react';
import UploadStep from '../../components/prompt-builder-page/UploadStep';
import DocumentViewer from '../../components/prompt-builder-page/DocumentViewer';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
}

export default function PromptBuilder() {
  const [extractedDocuments, setExtractedDocuments] = useState<ExtractedDocument[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handlePromptGeneration = (documents: ExtractedDocument[]) => {
    setExtractedDocuments(documents);
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
        onBackToUpload={handleBackToUpload}
      />
    );
  }

  return (
    <UploadStep onPromptGeneration={handlePromptGeneration} />
  );
}