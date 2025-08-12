import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter } from '@/lib/services/backend/openrouter.service';
import fs from 'fs';
import path from 'path';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.context || typeof body.context !== 'string' || !body.context.trim()) {
      return Response.json(
        { error: 'Context is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Read instructions from JSON file
    const sectionInstructionsPath = path.join(process.cwd(), 'data', 'instructions', 'general-prompts.json');
    let instructions = '';
    
    try {
      const fileContent = fs.readFileSync(sectionInstructionsPath, 'utf8');
      const instructionsData = JSON.parse(fileContent);
      instructions = instructionsData['project-context'];
    } catch (error) {
      console.error('Error reading instructions file:', error);
      return Response.json(
        { error: 'Failed to load instructions from data file' },
        { status: 500 }
      );
    }

    const prompt = `
You are a tasked with generating a project context paragraph based on the provided project information. Refer to INSTRUCTIONS for the instructions and CONTEXT for the provided project context

Ensure to follow the INSTRUCTIONS.

## INSTRUCTIONS:
${instructions}

## CONTEXT:
${body.context}

## OUTPUT FORMAT:
Format your response as a JSON object with the following fields:
{
  "response": "Your generated response here..."
}
Verify that the OUTPUT FORMAT is correct and that the JSON is properly formatted. Only return the JSON object, nothing else.
`;
   
    // Standard mode: Single model call
    const parsedResponse = await callOpenRouter(prompt, 'openai/gpt-5-mini', 'json_object');

    try {
      if (parsedResponse.response) {
        return NextResponse.json({
          data: parsedResponse.response
        });
      } else {
        throw new Error('Malformed response from LLM');
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      console.error('Content:', parsedResponse);
      
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