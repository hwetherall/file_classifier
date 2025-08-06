import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.rubrics || typeof body.rubrics !== 'string' || !body.rubrics.trim()) {
      return Response.json(
        { error: 'Rubrics is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Read instructions from JSON file
    const sectionInstructionsPath = path.join(process.cwd(), 'data', 'instructions', 'section-prompts.json');
    let instructions = '';
    
    try {
      const fileContent = fs.readFileSync(sectionInstructionsPath, 'utf8');
      const instructionsData = JSON.parse(fileContent);
      instructions = instructionsData['section-general'];
    } catch (error) {
      console.error('Error reading instructions file:', error);
      return Response.json(
        { error: 'Failed to load instructions from data file' },
        { status: 500 }
      );
    }
    
    // 3. Call OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    const prompt = `
You are a prompt generation assistant. Your task is to create the prompts for several sections of a chapter in an investment memo. 

Analyze the RUBRICS to define the sections that should be created. Then, for each section, follow the INSTRUCTIONS to write those sections as prompts. A section prompt is a prompt that will be used to generate a section of the investment memo.

Ensure to follow the INSTRUCTIONS.

## RUBRICS:
${body.rubrics}

## INSTRUCTIONS:
${instructions}

## OUTPUT FORMAT:
Format your response as a JSON object with the following fields:
{
  "section_prompts": {
    "section-prompt-1": "Your generated prompt here...",
    "section-prompt-2": "Your generated prompt here...",
    "section-prompt-3": "Your generated prompt here...",
    ...
  }
}
Verify that the OUTPUT FORMAT is correct and that the JSON is properly formatted. Only return the JSON object, nothing else.
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini', // anthropic/claude-opus-4.1 / openai/gpt-4.1-mini
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
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
    
    const cleanedContent = cleanJsonResponse(content);
    
    try {
      const parsedResponse = JSON.parse(cleanedContent);
      // Validate the structure of the response
      if (
        parsedResponse.section_prompts && 
        typeof parsedResponse.section_prompts === 'object' &&
        Object.keys(parsedResponse.section_prompts).length > 0
      ) {
        return NextResponse.json({
          data: parsedResponse.section_prompts
        });
      } else {
        throw new Error('Malformed response from LLM');
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      console.error('Raw content:', content);
      console.error('Cleaned content:', cleanedContent);
      
      // Provide more helpful error message
      let errorMessage = 'Invalid JSON response from LLM';
      if (parseError instanceof SyntaxError) {
        errorMessage = `JSON parsing failed: ${parseError.message}`;
      }
      
      return NextResponse.json({
        error: errorMessage
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in section prompt generation:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}