interface SectionPrompts {
  [key: string]: string;
}

/**
 * Generate section prompts from rubrics by calling the backend API
 * @param rubrics - The rubrics text to generate prompts from
 * @returns Promise with section prompts object
 */
export async function generateFromRubrics(rubrics: string): Promise<SectionPrompts> {
  try {
    // Validate input
    if (!rubrics || typeof rubrics !== 'string' || !rubrics.trim()) {
      throw new Error('Rubrics is required and must be a non-empty string');
    }

    // Make API call
    const response = await fetch('/api/section-prompt-generator/from-rubrics', {
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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Parse response
    const data = await response.json();

    // Validate response structure
    if (!data.data || typeof data.data !== 'object') {
      throw new Error('Invalid response format: missing data');
    }

    // Check if we got any prompts
    const promptKeys = Object.keys(data.data);
    if (promptKeys.length === 0) {
      throw new Error('No section prompts were generated');
    }

    console.log(`✅ Generated ${promptKeys.length} section prompts:`, promptKeys);
    
    return data.data;

  } catch (error) {
    console.error('❌ Failed to generate prompts from rubrics:', error);
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Prompt generation failed: ${error.message}`);
    }
    
    throw new Error('Prompt generation failed: Unknown error');
  }
}
