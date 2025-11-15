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
      description: 'Analyze a document with a selected prompt and stream the results. Requires both prompt_id (from list_prompts) and document_id (from list_documents).',
      inputSchema: ExecuteInputSchema,
      outputSchema: ExecuteResultSchema
    },
    async (args, extra) => {
      try {
        const prompt = await promptStore.get(args.prompt_id);
        if (!prompt) {
          throw new Error(`Prompt ${args.prompt_id} not found`);
        }

        const document = await storage.getDocument(args.document_id);
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
              console.error('Progress notification error', error);
            });
        };

        console.log(`execute_analysis tool called for prompt: ${prompt.title}, document: ${document.filename}`);

        const analysis = await claudeClient.executePromptWithStreaming(
          prompt.prompt_text,
          document.pdf_base64,
          (event: StreamEvent) => {
            if (event.type === 'analysis_started') {
              emitProgress(event.message ?? 'Analysis started');
              return;
            }
            if (event.type === 'section_started') {
              emitProgress(event.message ?? `${event.section} started`);
              return;
            }
            if (event.type === 'content_chunk') {
              const chunkSummary = event.chunk?.slice(0, 120).trim();
              emitProgress(`Chunk ${event.section ?? 'unknown'}: ${chunkSummary}`);
              return;
            }
            if (event.type === 'analysis_complete') {
              emitProgress(event.message ?? 'Analysis complete');
            }
          }
        );

        // Format analysis result for display
        const resultText = `Analysis Complete\n\n` +
          `Prompt: ${prompt.title}\n` +
          `Document: ${document.filename}\n` +
          `Pages: ${document.page_count}\n\n` +
          `Analysis Results:\n${analysis}`;

        return {
          content: [{
            type: 'text',
            text: resultText
          }],
          structuredContent: {
            prompt_title: prompt.title,
            document_filename: document.filename,
            analysis
          }
        };
      } catch (error) {
        console.error('Error in execute_analysis tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `Error executing analysis: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
};

