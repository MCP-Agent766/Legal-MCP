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
    documentText: string,
    onProgress: (event: StreamEvent) => void
  ): Promise<string> {
    try {
      console.log('ClaudeClient.executePromptWithStreaming: Starting, document length:', documentText.length, 'prompt length:', promptText.length);
      onProgress({ type: 'analysis_started', message: 'Starting analysis...' });

      // Create the API request
      console.log('ClaudeClient.executePromptWithStreaming: Creating Claude API request...');
      let stream;
      try {
        stream = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          stream: true,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Document:\n${documentText}`
                },
                {
                  type: 'text',
                  text: promptText
                }
              ]
            }
          ]
        });
        console.log('ClaudeClient.executePromptWithStreaming: Stream created successfully');
      } catch (error) {
        const errorMsg = `Failed to create Claude API stream: ${error instanceof Error ? error.message : String(error)}`;
        console.error('ClaudeClient.executePromptWithStreaming:', errorMsg, error);
        throw new Error(errorMsg);
      }

      let fullResponse = '';
      let currentSection = '';
      let chunkCount = 0;

      // Process the stream
      console.log('ClaudeClient.executePromptWithStreaming: Processing stream...');
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const chunk: string = event.delta.text;
            fullResponse += chunk;
            chunkCount++;

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
          } else {
            // Log other event types for debugging
            console.log(`ClaudeClient.executePromptWithStreaming: Received event type: ${event.type}`);
          }
        }
        console.log(`ClaudeClient.executePromptWithStreaming: Stream processing complete, received ${chunkCount} chunks, total response length: ${fullResponse.length}`);
      } catch (error) {
        const errorMsg = `Failed to process Claude API stream: ${error instanceof Error ? error.message : String(error)}`;
        console.error('ClaudeClient.executePromptWithStreaming:', errorMsg, error);
        throw new Error(errorMsg);
      }

      onProgress({ type: 'analysis_complete', message: 'Analysis complete' });
      console.log('ClaudeClient.executePromptWithStreaming: Returning response, length:', fullResponse.length);
      return fullResponse;
    } catch (error) {
      const errorMsg = `ClaudeClient.executePromptWithStreaming failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('ClaudeClient.executePromptWithStreaming:', errorMsg, error);
      throw error;
    }
  }
}

