import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PromptStore } from '../storage/prompts.js';

const PromptSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string()
});

const PromptDetailsSchema = PromptSummarySchema.extend({
  created_by: z.enum(['system', 'user']),
  created_at: z.string(),
  prompt_text: z.string()
});

const ListPromptsResultSchema = z.object({
  prompts: z.array(PromptSummarySchema)
});

const GetPromptResultSchema = z.object({
  prompt: PromptDetailsSchema
});

const AddPromptResultSchema = z.object({
  prompt: PromptDetailsSchema
});

export const registerPromptTools = (server: McpServer, promptStore: PromptStore): void => {
  server.registerTool(
    'list_prompts',
    {
      title: 'List Prompts',
      description: 'List available prompts, optionally filtered by search text',
      inputSchema: z.object({
        search: z.string().optional()
      }),
      outputSchema: ListPromptsResultSchema
    },
    async (args: { search?: string } = {}) => {
      try {
        const search = args?.search;
        const prompts = await promptStore.list(search);
        console.log(`list_prompts tool called (search: ${search || 'none'}), returning ${prompts.length} prompts`);
        
        // Format prompts for display
        const promptsText = prompts.length === 0
          ? 'No prompts found' + (search ? ` matching "${search}"` : '')
          : prompts.map(p => `- ${p.title} (${p.category}): ${p.description}`).join('\n');
        
        return {
          content: [{
            type: 'text',
            text: `Found ${prompts.length} prompt(s):\n\n${promptsText}`
          }],
          structuredContent: { prompts }
        };
      } catch (error) {
        console.error('Error in list_prompts tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `Error listing prompts: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get Prompt',
      description: 'Retrieve full prompt details',
      inputSchema: z.object({
        prompt_id: z.string()
      }),
      outputSchema: GetPromptResultSchema
    },
    async ({ prompt_id }) => {
      try {
        const prompt = await promptStore.get(prompt_id);
        if (!prompt) {
          throw new Error(`Prompt ${prompt_id} not found`);
        }
        
        console.log(`get_prompt tool called for prompt_id: ${prompt_id}`);
        
        // Format prompt for display
        const promptText = `Prompt: ${prompt.title}\n` +
          `Category: ${prompt.category}\n` +
          `Description: ${prompt.description}\n` +
          `Created by: ${prompt.created_by}\n` +
          `Created at: ${prompt.created_at}\n\n` +
          `Prompt Text:\n${prompt.prompt_text}`;
        
        return {
          content: [{
            type: 'text',
            text: promptText
          }],
          structuredContent: {
            prompt
          }
        };
      } catch (error) {
        console.error('Error in get_prompt tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `Error retrieving prompt: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'add_prompt',
    {
      title: 'Add Prompt',
      description: 'Store a user-contributed prompt in the shared library',
      inputSchema: z.object({
        title: z.string(),
        category: z.string(),
        prompt_text: z.string()
      }),
      outputSchema: AddPromptResultSchema
    },
    async ({ title, category, prompt_text }, extra) => {
      try {
        const newPrompt = await promptStore.add(title, prompt_text, category);
        await server.sendPromptListChanged();
        
        console.log(`add_prompt tool called, created prompt: ${newPrompt.id}`);
        
        // Format new prompt for display
        const promptText = `Successfully added new prompt:\n\n` +
          `ID: ${newPrompt.id}\n` +
          `Title: ${newPrompt.title}\n` +
          `Category: ${newPrompt.category}\n` +
          `Description: ${newPrompt.description}\n` +
          `Created at: ${newPrompt.created_at}`;
        
        return {
          content: [{
            type: 'text',
            text: promptText
          }],
          structuredContent: {
            prompt: newPrompt
          }
        };
      } catch (error) {
        console.error('Error in add_prompt tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `Error adding prompt: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
};

