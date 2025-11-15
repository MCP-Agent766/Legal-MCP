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
    async ({ search }) => {
      const prompts = await promptStore.list(search);
      return {
        content: [],
        structuredContent: { prompts }
      };
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
      const prompt = await promptStore.get(prompt_id);
      if (!prompt) {
        throw new Error(`Prompt ${prompt_id} not found`);
      }
      return {
        content: [],
        structuredContent: {
          prompt
        }
      };
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
      const newPrompt = await promptStore.add(title, prompt_text, category);
      await server.sendPromptListChanged();
      return {
        content: [],
        structuredContent: {
          prompt: newPrompt
        }
      };
    }
  );
};

