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
      console.log('PromptStore.load: Starting to load prompts from Azure Blob Storage...');
      const library = await this.storage.getPromptLibrary();
      console.log('PromptStore.load: Retrieved library from Azure, checking prompts array...');
      this.prompts = Array.isArray(library.prompts) ? library.prompts as PromptDefinition[] : [];
      console.log(`PromptStore.load: Loaded ${this.prompts.length} prompts from Azure Blob Storage`);
      if (this.prompts.length > 0) {
        console.log(`PromptStore.load: Prompt IDs: ${this.prompts.map(p => p.id).join(', ')}`);
      } else {
        console.warn('PromptStore.load: WARNING - No prompts loaded! Library structure:', JSON.stringify(library, null, 2));
      }
    } catch (error) {
      console.error('PromptStore.load: Failed to load prompt library:', error);
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
    console.log(`PromptStore.get called with promptId: ${promptId}`);
    console.log(`PromptStore has ${this.prompts.length} prompts loaded`);
    console.log(`Available prompt IDs: ${this.prompts.map(p => p.id).join(', ')}`);
    const prompt = this.prompts.find((prompt) => prompt.id === promptId);
    console.log(`PromptStore.get result: ${prompt ? `found (${prompt.title})` : 'not found'}`);
    return prompt;
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

