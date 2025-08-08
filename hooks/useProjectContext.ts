'use client';

import { useState } from 'react';
import { generateProjectContext } from '../lib/services/frontend/prompt-generation.service';

interface ProjectContextState {
  loading: boolean;
  error?: string;
  context?: string;
}

export function useProjectContext() {
  const [projectContextState, setProjectContextState] = useState<ProjectContextState>({
    loading: false
  });

  const generateContext = async (inputContext: string): Promise<void> => {
    try {
      setProjectContextState({ loading: true });
      
      console.log('Generating project context from input:', inputContext);
      const generatedContext = await generateProjectContext(inputContext);
      
      setProjectContextState({
        loading: false,
        context: generatedContext
      });
      
      console.log('Project context generated successfully');
    } catch (error) {
      console.error('Failed to generate project context:', error);
      
      setProjectContextState({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const clearContext = () => {
    setProjectContextState({ loading: false });
  };

  const updateContext = (context: string) => {
    setProjectContextState(prev => ({
      ...prev,
      context
    }));
  };

  return {
    projectContextState,
    generateContext,
    clearContext,
    updateContext
  };
}
