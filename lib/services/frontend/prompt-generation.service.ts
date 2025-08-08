interface SectionPrompts {
  [key: string]: string;
}

/**
 * Generate section prompts from rubrics by calling the backend API
 * @param rubrics - The rubrics text to generate prompts from
 * @param maxMode - Whether to use multi-model consensus (defaults to false)
 * @returns Promise with section prompts object
 */
export async function generateFromRubrics(rubrics: string, maxMode: boolean = false): Promise<SectionPrompts> {
  try {

    // Make API call
    const response = await fetch(`/api/section-prompt-generator/from-rubrics${maxMode ? '?maxMode=true' : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rubrics: rubrics.trim()
      })
    });

    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error in prompt generation from rubrics. Status: ${response.status}`);
    }

    // Parse response
    const data = await response.json();

    // Validate response structure
    if (!data.data) {
      throw new Error('Invalid response format: missing data');
    }

    return data.data;

  } catch (error) {
    console.error(' Failed to generate prompts from rubrics:', error);
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Prompt generation failed: ${error.message}`);
    }
    
    throw new Error('Prompt generation failed: Unknown error');
  }
}

/**
 * Generate project context from project description
 * @param context - The project context/description text
 * @returns Promise with generated project context string
 */
export async function generateProjectContext(context: string): Promise<string> {
  try {
    // Validate input
    if (!context || typeof context !== 'string' || !context.trim()) {
      throw new Error('Project context is required and must be a non-empty string');
    }

    // Make API call
    const response = await fetch('/api/project-context-generator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: context.trim()
      })
    });

    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error in project context generation. Status: ${response.status}`);
    }

    // Parse response
    const data = await response.json();

    // Validate response structure
    if (!data.data) {
      throw new Error('Invalid response format: missing data');
    }

    return data.data;

  } catch (error) {
    console.error('Failed to generate project context:', error);
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Project context generation failed: ${error.message}`);
    }
    
    throw new Error('Project context generation failed: Unknown error');
  }
}
