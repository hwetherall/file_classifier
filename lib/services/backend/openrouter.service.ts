// Clean the response - remove markdown code blocks if present
const cleanJsonResponse = (text: string): string => {
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    let cleaned = text.trim();
    
    // Remove leading ```json, ```JSON, or ``` (case insensitive)
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*/i, '');
    
    // Remove trailing ```
    cleaned = cleaned.replace(/\s*```\s*$/, '');
    
    // Remove any extra whitespace
    cleaned = cleaned.trim();
    
    // Handle edge case where JSON might be inside other markdown formatting
    // Look for the first { and last } to extract just the JSON part
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
};

export async function callOpenRouter(prompt: string, model: string, response_format: string = 'json_object') {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OpenRouter API key is not configured');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model, // anthropic/claude-opus-4.1 / openai/gpt-4.1-mini
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: response_format }
            })
        });
      
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
          }

        const data = await response.json();

        if (response_format === 'json_object') {
            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Invalid response structure: missing content');
            }
            
            const content = data.choices[0].message.content;
            const cleanedContent = cleanJsonResponse(content);
            
            try {
                return JSON.parse(cleanedContent);
            } catch {
                throw new Error(`Failed to parse LLM JSON response. Content: ${cleanedContent.substring(0, 200)}...`);
            }

        } else {
            return data;
        }
        
    } catch (error) {
        // Re-throw our custom errors as-is
        if (error instanceof Error) {
            throw error;
        }
        // Handle unexpected errors
        throw new Error(`Unexpected error in OpenRouter service: ${String(error)}`);
    }
}