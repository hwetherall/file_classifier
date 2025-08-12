'use client';

import { useState } from 'react';
import { generateFromRubrics } from '../lib/services/frontend/prompt-generation.service';

interface ExtractedDocument {
  fileName: string;
  chapter: string;
  text: string;
  fileType: 'rubric' | 'context';
}

interface ChapterPromptState {
  loading: boolean;
  error?: string;
  prompts?: { [key: string]: string };
}

export function usePromptGeneration() {
  const [chapterPromptStates, setChapterPromptStates] = useState<{ [chapter: string]: ChapterPromptState }>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePrompts = async (extractedDocuments: ExtractedDocument[], contextParagraph: string, maxMode: boolean = false) => {
    setIsGenerating(true);
    
    // Get unique chapters from extracted documents
    const chapters = [...new Set(extractedDocuments.map(doc => doc.chapter))];
    
    // Initialize loading states for all chapters
    const initialStates: { [chapter: string]: ChapterPromptState } = {};
    chapters.forEach(chapter => {
      initialStates[chapter] = { loading: true };
    });
    setChapterPromptStates(initialStates);

    // Generate prompts for each chapter in parallel
    const promptPromises = chapters.map(async (chapter) => {
      try {
        // Get the rubric document for this chapter
        const rubricDocument = extractedDocuments.find(doc => doc.chapter === chapter && doc.fileType === 'rubric');
        if (!rubricDocument) {
          throw new Error(`No rubric document found for chapter: ${chapter}`);
        }

        // Get all context documents for this chapter (if any)
        const contextDocuments = extractedDocuments.filter(doc => doc.chapter === chapter && doc.fileType === 'context');
        const contextText = contextDocuments.map(doc => `${doc.fileName}:\n${doc.text}`).join('\n\n');
        
        // Combine rubric text with context text for enhanced prompt generation
        const context = contextText 
          ? `Overall Project Context:\n${contextParagraph}\n\n=== ADDITIONAL CONTEXT ===\n${contextText}`
          : contextParagraph;

        console.log(`Generating prompts for chapter: ${chapter} (maxMode: ${maxMode})`);
        const prompts = await generateFromRubrics(rubricDocument.text, context, maxMode);
        
        // Update state with successful result
        setChapterPromptStates(prev => ({
          ...prev,
          [chapter]: { loading: false, prompts }
        }));

      } catch (error) {
        console.error(`Failed to generate prompts for chapter ${chapter}:`, error);
        
        // Update state with error
        setChapterPromptStates(prev => ({
          ...prev,
          [chapter]: { 
            loading: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }));
      }
    });

    // Wait for all to complete
    await Promise.allSettled(promptPromises);
    setIsGenerating(false);
    console.log('All chapter prompt generation completed');
  };

  const updatePromptContent = (chapter: string, sectionName: string, content: string) => {
    setChapterPromptStates(prev => ({
      ...prev,
      [chapter]: {
        ...prev[chapter],
        prompts: {
          ...prev[chapter].prompts!,
          [sectionName]: content
        }
      }
    }));
  };

  return {
    chapterPromptStates,
    isGenerating,
    generatePrompts,
    updatePromptContent
  };
}