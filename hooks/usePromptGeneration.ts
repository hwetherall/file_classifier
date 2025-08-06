'use client';

import { useState } from 'react';
import { generateFromRubrics } from '../lib/services/frontend/prompt-generation.service';

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

export function usePromptGeneration() {
  const [chapterPromptStates, setChapterPromptStates] = useState<{ [chapter: string]: ChapterPromptState }>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePrompts = async (extractedDocuments: ExtractedDocument[]) => {
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
        // Get the text content for this chapter (rubrics)
        const chapterDocument = extractedDocuments.find(doc => doc.chapter === chapter);
        if (!chapterDocument) {
          throw new Error(`No document found for chapter: ${chapter}`);
        }

        console.log(`Generating prompts for chapter: ${chapter}`);
        const prompts = await generateFromRubrics(chapterDocument.text);
        
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