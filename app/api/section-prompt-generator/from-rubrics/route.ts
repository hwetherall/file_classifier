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
    const sectionInstructionsPath = path.join(process.cwd(), 'data', 'section-prompts.json');
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
You are a prompt generation assistant. Your task is to create the prompts for several sections of a chapter in an investment memo. The RUBRICS define the sections that should be created and the INSTRUCTIONS stablishes how the sections should be written as prompts.

Ensure the final prompt maintains consistency with the original instructions while incorporating the evaluation criteria and requirements specified in the rubrics.

## INSTRUCTIONS:
${instructions}

## RUBRICS:
${body.rubrics}

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
        model: 'anthropic/claude-opus-4.1',
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
    
    try {
      const parsedResponse = JSON.parse(content);
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
        throw new Error('Malformed response from OpenRouter');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenRouter response:', parseError);
      return NextResponse.json({
        error: "Failed to generate prompt due to an error"
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in section prompt generation:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}