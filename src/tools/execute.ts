import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { AzureBlobStorage } from '../storage/azure-blob.js';
import { PromptStore } from '../storage/prompts.js';
import { ClaudeClient, StreamEvent } from '../claude/client.js';

const ExecuteResultSchema = z.object({
  prompt_title: z.string(),
  document_filename: z.string(),
  analysis: z.string()
});

const ExecuteInputSchema = z.object({
  prompt_id: z.string(),
  document_id: z.string()
});

export const registerExecuteTool = (
  server: McpServer,
  storage: AzureBlobStorage,
  promptStore: PromptStore,
  claudeClient: ClaudeClient
): void => {
  server.registerTool(
    'execute_analysis',
    {
      title: 'Execute Analysis',
      description: 'Analyze a document with a selected prompt and stream the results',
      inputSchema: ExecuteInputSchema,
      outputSchema: ExecuteResultSchema
    },
    async (args, extra) => {
      try {
        console.log(`execute_analysis: Starting analysis with prompt_id=${args.prompt_id}, document_id=${args.document_id}`);
        
        // Step 1: Retrieve prompt
        console.log(`execute_analysis: Retrieving prompt ${args.prompt_id}...`);
        const prompt = await promptStore.get(args.prompt_id);
        if (!prompt) {
          const error = `Prompt ${args.prompt_id} not found`;
          console.error(`execute_analysis: ${error}`);
          throw new Error(error);
        }
        console.log(`execute_analysis: Prompt retrieved successfully: ${prompt.title} (${prompt.prompt_text.length} chars)`);

        // Step 2: Retrieve document
        console.log(`execute_analysis: Retrieving document ${args.document_id}...`);
        let document;
        try {
          document = await storage.getDocument(args.document_id);
          console.log(`execute_analysis: Document retrieved successfully: ${document.filename} (${document.text_content.length} chars)`);
        } catch (error) {
          const errorMsg = `Failed to retrieve document ${args.document_id}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`execute_analysis: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        const progressToken = extra._meta?.progressToken;
        let progressValue = 0;

        const emitProgress = (message: string) => {
          if (!progressToken) {
            return;
          }
          progressValue += 1;
          extra
            .sendNotification({
              method: 'notifications/progress',
              params: {
                progress: progressValue,
                message,
                progressToken
              }
            })
            .catch((error) => {
              console.error('execute_analysis: Progress notification error', error);
            });
        };

        // Step 3: Call Claude API
        console.log(`execute_analysis: Calling Claude API with document (${document.text_content.length} chars) and prompt (${prompt.prompt_text.length} chars)...`);
        let analysis: string;
        try {
          analysis = await claudeClient.executePromptWithStreaming(
            prompt.prompt_text,
            document.text_content,
            (event: StreamEvent) => {
              if (event.type === 'analysis_started') {
                console.log('execute_analysis: Claude analysis started');
                emitProgress(event.message ?? 'Analysis started');
                return;
              }
              if (event.type === 'section_started') {
                console.log(`execute_analysis: Claude section started: ${event.section}`);
                emitProgress(event.message ?? `${event.section} started`);
                return;
              }
              if (event.type === 'content_chunk') {
                const chunkSummary = event.chunk?.slice(0, 120).trim();
                emitProgress(`Chunk ${event.section ?? 'unknown'}: ${chunkSummary}`);
                return;
              }
              if (event.type === 'analysis_complete') {
                console.log(`execute_analysis: Claude analysis complete`);
                emitProgress(event.message ?? 'Analysis complete');
              }
            }
          );
          console.log(`execute_analysis: Claude API returned analysis (${analysis.length} chars)`);
        } catch (error) {
          const errorMsg = `Claude API call failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`execute_analysis: ${errorMsg}`, error);
          throw new Error(errorMsg);
        }

        // Step 4: Return result
        console.log(`execute_analysis: Analysis complete, returning result`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              prompt_title: prompt.title,
              document_filename: document.filename,
              analysis
            }, null, 2)
          }],
          structuredContent: {
            prompt_title: prompt.title,
            document_filename: document.filename,
            analysis
          }
        };
      } catch (error) {
        const errorMsg = `execute_analysis failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`execute_analysis: ${errorMsg}`, error);
        throw error;
      }
    }
  );
};

