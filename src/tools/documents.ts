import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DocumentMetadata } from '../types.js';
import type { AzureBlobStorage } from '../storage/azure-blob.js';

const DocumentSummarySchema = z.object({
  id: z.string(),
  filename: z.string(),
  size_bytes: z.number().optional(),
  last_modified: z.string().optional()
});

const ListDocumentsResultSchema = z.object({
  documents: z.array(DocumentSummarySchema)
});

export const registerDocumentTool = (server: McpServer, storage: AzureBlobStorage): void => {
  server.registerTool(
    'list_documents',
    {
      title: 'List Documents',
      description: 'Return all legal documents stored in Azure Blob Storage',
      inputSchema: z.object({}),
      outputSchema: ListDocumentsResultSchema
    },
    async (_args = {}) => {
      try {
        const documents = await storage.listDocuments();
        console.log(`list_documents tool called, returning ${documents.length} documents`);
        
        const payload = documents.map((doc: DocumentMetadata) => ({
          ...doc,
          last_modified: doc.last_modified ? doc.last_modified.toISOString() : undefined
        }));

        // Format documents for display - include IDs prominently
        const documentsText = documents.length === 0
          ? 'No documents found in storage'
          : documents.map((doc, index) => {
              const size = doc.size_bytes 
                ? `${(doc.size_bytes / 1024).toFixed(2)} KB` 
                : 'unknown size';
              const modified = doc.last_modified 
                ? new Date(doc.last_modified).toLocaleString() 
                : 'unknown date';
              return `${index + 1}. ID: ${doc.id} | ${doc.filename} (${size}, modified: ${modified})`;
            }).join('\n');

        const usageHint = documents.length > 0
          ? `\n\nTo execute analysis, use execute_analysis with document_id="${documents[0].id}" and a prompt_id from list_prompts.`
          : '';

        return {
          content: [{
            type: 'text',
            text: `Found ${documents.length} document(s):\n\n${documentsText}${usageHint}`
          }],
          structuredContent: {
            documents: payload
          }
        };
      } catch (error) {
        console.error('Error in list_documents tool:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{
            type: 'text',
            text: `Error listing documents: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
};
