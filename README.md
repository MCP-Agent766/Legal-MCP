# Legal MCP Server

A Model Context Protocol (MCP) compliant server for legal document analysis using Azure Blob Storage and Anthropic Claude API.

## Features

- **Document Management**: List and retrieve pre-loaded `.txt` documents from Azure Blob Storage
- **Prompt Library**: Manage curated prompts for legal document analysis
- **Streaming Analysis**: Execute document analysis with real-time progress updates via MCP progress notifications
- **MCP SSE Transport**: Full compliance with MCP specification using Server-Sent Events

## Prerequisites

- Node.js 18+ 
- Azure Storage Account with:
  - `documents-texts` container (for `.txt` documents)
  - `prompts` container (for prompt library JSON)
- Anthropic Claude API key with credits

## Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd Legal-MCP
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Upload initial prompt library to Azure:**
   ```bash
   # Using Azure CLI (after setting up connection)
   az storage blob upload \
     --account-name legalmcpstore \
     --container-name prompts \
     --name "library.json" \
     --file ./prompts/library.json \
     --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
   ```

4. **Upload documents to Azure:**
   ```bash
   # Upload `.txt` files to the documents-texts container
   az storage blob upload \
     --account-name legalmcpstore \
     --container-name documents-texts \
     --name "your-document.txt" \
     --file ./path/to/your-document.txt \
     --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
   ```

## Running Locally

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `PORT` env var).

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "legal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Legal-MCP/dist/index.js"],
      "env": {
        "AZURE_STORAGE_CONNECTION_STRING": "...",
        "ANTHROPIC_API_KEY": "..."
      }
    }
  }
}
```

**Note**: For SSE transport, you'll need to configure the HTTP endpoint instead. See MCP documentation for SSE client setup.

### Testing with MCP Inspector

You can test the server using the MCP Inspector or any MCP-compatible client:

```bash
# Server should be running on http://localhost:3000/mcp
# Use an MCP client that supports SSE transport
```

## Available Tools

1. **list_documents**: Returns all available `.txt` documents
2. **list_prompts**: Lists available analysis prompts (with optional search)
3. **get_prompt**: Retrieves full prompt details by ID
4. **add_prompt**: Adds a new user-contributed prompt
5. **execute_analysis**: Executes document analysis with streaming progress updates

## Project Structure

```
legal-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── storage/
│   │   ├── azure-blob.ts     # Azure Blob Storage client
│   │   └── prompts.ts         # Prompt library management
│   ├── claude/
│   │   └── client.ts         # Claude API client with streaming
│   ├── tools/
│   │   ├── documents.ts      # Document listing tool
│   │   ├── prompts.ts         # Prompt management tools
│   │   └── execute.ts         # Analysis execution tool
│   └── types.ts              # Shared TypeScript types
├── prompts/
│   └── library.json          # Initial prompt library
└── package.json
```

## Deployment to Azure

See the deployment section in the original plan for Azure App Service deployment instructions.

## License

ISC

