import Anthropic from '@anthropic-ai/sdk';

export type StreamEvent =
  | { type: 'analysis_started'; message: string }
  | { type: 'section_started'; message: string; section: string }
  | { type: 'content_chunk'; chunk: string; section: string }
  | { type: 'analysis_complete'; message: string };

export class ClaudeClient {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async executePromptWithStreaming(
    promptText: string,
    documentBase64: string,
    onProgress: (event: StreamEvent) => void
  ): Promise<string> {
    onProgress({ type: 'analysis_started', message: 'Starting analysis...' });

    const stream = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      stream: true,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: documentBase64
              }
            },
            {
              type: 'text',
              text: promptText
            }
          ]
        }
      ]
    });

    let fullResponse = '';
    let currentSection = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const chunk: string = event.delta.text;
        fullResponse += chunk;

        const normalized = chunk.toUpperCase();
        if (normalized.includes('EXECUTIVE SUMMARY')) {
          currentSection = 'Executive Summary';
          onProgress({
            type: 'section_started',
            section: currentSection,
            message: 'Analyzing executive summary...'
          });
        } else if (normalized.includes('DETAILED ANALYSIS')) {
          currentSection = 'Detailed Analysis';
          onProgress({
            type: 'section_started',
            section: currentSection,
            message: 'Performing detailed analysis...'
          });
        } else if (normalized.includes('RISK ASSESSMENT')) {
          currentSection = 'Risk Assessment';
          onProgress({
            type: 'section_started',
            section: currentSection,
            message: 'Assessing risks...'
          });
        } else if (normalized.includes('RECOMMENDATIONS')) {
          currentSection = 'Recommendations';
          onProgress({
            type: 'section_started',
            section: currentSection,
            message: 'Generating recommendations...'
          });
        }

        onProgress({
          type: 'content_chunk',
          chunk,
          section: currentSection
        });
      }
    }

    onProgress({ type: 'analysis_complete', message: 'Analysis complete' });
    return fullResponse;
  }
}

