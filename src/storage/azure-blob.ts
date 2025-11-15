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
    this.documentsContainer = this.blobServiceClient.getContainerClient('documents');
    this.promptsContainer = this.blobServiceClient.getContainerClient('prompts');
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    const documents: DocumentMetadata[] = [];

    for await (const blob of this.documentsContainer.listBlobsFlat()) {
      if (blob.name.endsWith('.pdf')) {
        documents.push({
          id: blob.name,
          filename: blob.name,
          size_bytes: blob.properties.contentLength ?? undefined,
          last_modified: blob.properties.lastModified ?? undefined
        });
      }
    }

    return documents;
  }

  async getDocument(documentId: string): Promise<Document> {
    const blobClient = this.documentsContainer.getBlobClient(documentId);
    const downloadResponse = await blobClient.download();
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody!);

    const pdfModule = (await import('pdf-parse')) as any;
    const parsePdf = pdfModule.default ?? pdfModule;
    const pdfData = await parsePdf(buffer);

    return {
      id: documentId,
      filename: documentId,
      pdf_base64: buffer.toString('base64'),
      extracted_text: pdfData.text,
      page_count: pdfData.numpages
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

