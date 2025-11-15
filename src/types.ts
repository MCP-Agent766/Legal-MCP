export interface PromptDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  created_by: 'system' | 'user';
  created_at: string;
  prompt_text: string;
}

export interface PromptSummary {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface PromptLibrary {
  prompts: PromptDefinition[];
}

export interface DocumentMetadata {
  id: string;
  filename: string;
  size_bytes?: number;
  last_modified?: Date;
}

export interface Document extends DocumentMetadata {
  text_content: string;
  extracted_text: string;
}

