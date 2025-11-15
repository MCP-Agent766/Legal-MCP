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
    async () => {
      const documents = await storage.listDocuments();
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
    }
  );
};
