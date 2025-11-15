import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type { Document, DocumentMetadata, PromptLibrary } from '../types.js';

export class AzureBlobStorage {
  private blobServiceClient: BlobServiceClient;
  private documentsContainer: ContainerClient;
  private promptsContainer: ContainerClient;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.documentsContainer = this.blobServiceClient.getContainerClient('documents-texts');
    this.promptsContainer = this.blobServiceClient.getContainerClient('prompts');
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    const documents: DocumentMetadata[] = [];

    try {
      for await (const blob of this.documentsContainer.listBlobsFlat()) {
        if (blob.name.toLowerCase().endsWith('.txt')) {
          documents.push({
            id: blob.name,
            filename: blob.name,
            size_bytes: blob.properties.contentLength ?? undefined,
            last_modified: blob.properties.lastModified ?? undefined
          });
        }
      }
      console.log(`Found ${documents.length} text documents in Azure Blob Storage`);
    } catch (error) {
      console.error('Failed to list documents:', error);
      throw error;
    }

    return documents;
  }

  async getDocument(documentId: string): Promise<Document> {
    const blobClient = this.documentsContainer.getBlobClient(documentId);
    const downloadResponse = await blobClient.download();
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody!);
    const textContent = buffer.toString('utf-8');

    return {
      id: documentId,
      filename: documentId,
      text_content: textContent,
      extracted_text: textContent
    };
  }

  async getPromptLibrary(): Promise<PromptLibrary> {
    const blobClient = this.promptsContainer.getBlobClient('library.json');
    const downloadResponse = await blobClient.download();
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody!);
    return JSON.parse(buffer.toString('utf-8')) as PromptLibrary;
  }

  async savePromptLibrary(library: PromptLibrary): Promise<void> {
    const blobClient = this.promptsContainer.getBlockBlobClient('library.json');
    const content = JSON.stringify(library, null, 2);
    await blobClient.upload(content, Buffer.byteLength(content));
  }
}

async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

