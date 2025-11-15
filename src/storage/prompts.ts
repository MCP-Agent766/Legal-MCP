import { AzureBlobStorage } from './azure-blob.js';
import type { PromptDefinition, PromptSummary, PromptLibrary } from '../types.js';

export class PromptStore {
  private storage: AzureBlobStorage;
  private prompts: PromptDefinition[] = [];

  constructor(storage: AzureBlobStorage) {
    this.storage = storage;
  }

  async load(): Promise<void> {
    try {
      const library = await this.storage.getPromptLibrary();
      this.prompts = Array.isArray(library.prompts) ? library.prompts as PromptDefinition[] : [];
      console.log(`Loaded ${this.prompts.length} prompts from Azure Blob Storage`);
    } catch (error) {
      console.error('Failed to load prompt library:', error);
      this.prompts = [];
      throw error;
    }
  }

  async list(searchQuery?: string): Promise<PromptSummary[]> {
    let filtered = this.prompts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((prompt) => {
        return (
          prompt.title.toLowerCase().includes(query) ||
          prompt.description.toLowerCase().includes(query) ||
          prompt.category.toLowerCase().includes(query)
        );
      });
    }

    return filtered.map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      category: prompt.category
    }));
  }

  async get(promptId: string): Promise<PromptDefinition | undefined> {
    return this.prompts.find((prompt) => prompt.id === promptId);
  }

  async add(title: string, promptText: string, category: string): Promise<PromptDefinition> {
    const { v4: uuidv4 } = await import('uuid');

    const newPrompt: PromptDefinition = {
      id: `prompt_${uuidv4().substring(0, 8)}`,
      title,
      description: `User-contributed prompt: ${title}`,
      category,
      created_by: 'user',
      created_at: new Date().toISOString(),
      prompt_text: promptText
    };

    this.prompts.push(newPrompt);
    await this.save();

    return newPrompt;
  }

  private async save(): Promise<void> {
    const library: PromptLibrary = {
      prompts: this.prompts
    };
    await this.storage.savePromptLibrary(library);
  }
}

