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
      // Test logging to see what args are being passed
      console.log('list_documents - _args type:', typeof _args);
      console.log('list_documents - _args value:', JSON.stringify(_args));
      console.log('list_documents - _args === undefined:', _args === undefined);
      console.log('list_documents - _args === null:', _args === null);
      console.log('list_documents - _args === {}:', JSON.stringify(_args) === '{}');
      
      try {
        const documents = await storage.listDocuments();
        console.log(`list_documents tool called, returning ${documents.length} documents`);
        const payload = documents.map((doc: DocumentMetadata) => ({
          ...doc,
          last_modified: doc.last_modified ? doc.last_modified.toISOString() : undefined
        }));

        return {
          content: [],
          structuredContent: {
            documents: payload
          }
        };
      } catch (error) {
        console.error('Error in list_documents tool:', error);
        return {
          content: [{
            type: 'text',
            text: `Error listing documents: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
};
