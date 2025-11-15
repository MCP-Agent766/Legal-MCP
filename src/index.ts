import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { AzureBlobStorage } from './storage/azure-blob.js';
import { PromptStore } from './storage/prompts.js';
import { ClaudeClient } from './claude/client.js';
import { registerDocumentTool } from './tools/documents.js';
import { registerPromptTools } from './tools/prompts.js';
import { registerExecuteTool } from './tools/execute.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  const storage = new AzureBlobStorage();
  const promptStore = new PromptStore(storage);
  await promptStore.load();

  const claudeClient = new ClaudeClient();

  const createServer = (): McpServer => {
    const server = new McpServer(
      {
        name: 'Legal MCP Server',
        version: '1.0.0',
        websiteUrl: 'https://legal-mcp.example.com'
      },
      {
        capabilities: {
          logging: {},
          tools: { listChanged: true },
          prompts: { listChanged: true }
        },
        instructions: [
          'Use the provided tools to browse pre-loaded documents, review curated prompts, and execute live lease analysis.',
          'The document and prompt libraries are read-only; add prompts only through the MCP prompt tool.'
        ].join(' ')
      }
    );

    registerDocumentTool(server, storage);
    registerPromptTools(server, promptStore);
    registerExecuteTool(server, storage, promptStore, claudeClient);

    return server;
  };

  interface SessionEntry {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
  }

  const sessions = new Map<string, SessionEntry>();

  const app = express();
  app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));
  app.use(express.json({ limit: '5mb' }));

  const cleanupSession = async (sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) {
      return;
    }
    await entry.server.close();
    sessions.delete(sessionId);
  };

  const handleMcpPost = async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = Array.isArray(req.headers['mcp-session-id'])
        ? req.headers['mcp-session-id'][0]
        : req.headers['mcp-session-id'];
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.transport.handleRequest(req, res, req.body);
        return;
      }

      if (isInitializeRequest(req.body)) {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableDnsRebindingProtection: false,
          onsessioninitialized: (id) => {
            if (id) {
              sessions.set(id, { server, transport });
            }
          },
          onsessionclosed: async (id) => {
            if (id) {
              await cleanupSession(id);
            }
          }
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
          }
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad request: unable to route MCP POST' },
        id: null
      });
    } catch (error) {
      console.error('MCP POST failed', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  };

  const handleMcpGet = async (req: express.Request, res: express.Response) => {
    const sessionId = Array.isArray(req.headers['mcp-session-id'])
      ? req.headers['mcp-session-id'][0]
      : req.headers['mcp-session-id'];

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).send('Missing or unknown Mcp-Session-Id');
      return;
    }

    await sessions.get(sessionId)!.transport.handleRequest(req, res);
  };

  const handleMcpDelete = async (req: express.Request, res: express.Response) => {
    const sessionId = Array.isArray(req.headers['mcp-session-id'])
      ? req.headers['mcp-session-id'][0]
      : req.headers['mcp-session-id'];

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).send('Missing or unknown Mcp-Session-Id');
      return;
    }

    await sessions.get(sessionId)!.transport.handleRequest(req, res);
  };

  app.post('/mcp', handleMcpPost);
  app.get('/mcp', handleMcpGet);
  app.delete('/mcp', handleMcpDelete);

  app.listen(PORT, () => {
    console.log(`Legal MCP Server listening on port ${PORT}`);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down MCP server');
    for (const [sessionId, entry] of sessions) {
      try {
        await entry.transport.close();
        await entry.server.close();
        sessions.delete(sessionId);
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
    process.exit(0);
  });
};

startServer().catch((error) => {
  console.error('Failed to start MCP server', error);
  process.exit(1);
});

