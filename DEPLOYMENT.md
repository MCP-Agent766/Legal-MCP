# Azure Deployment Plan - Legal MCP Server

## Current State Assessment

✅ **Existing Resources:**
- Resource Group: `Legal-MCP` (Canada Central)
- App Service Plan: `Legal-MCP` (F1 - Free tier, Canada Central)

❌ **Missing Resources:**
- Storage Account: `legalmcpstore` (needs to be created)
- App Service (Web App): `legal-mcp` (needs to be created)

## Pre-Deployment Checklist

### 1. Storage Account Setup
- [ ] Create storage account `legalmcpstore` in Canada Central
- [ ] Create `documents` container (Private access)
- [ ] Create `prompts` container (Private access)
- [ ] Upload `prompts/library.json` to prompts container
- [ ] Upload at least one test PDF to documents container
- [ ] Get connection string for App Service configuration

### 2. Code Preparation
- [x] Code compiles successfully (`npm run build`)
- [x] All dependencies in package.json
- [x] TypeScript configuration correct
- [ ] Verify PORT environment variable handling (Azure uses PORT env var)
- [ ] Test that server starts correctly locally

### 3. Environment Variables Required
- `AZURE_STORAGE_CONNECTION_STRING` - From storage account
- `ANTHROPIC_API_KEY` - From Anthropic console
- `PORT` - Azure will set this automatically (defaults to 8080)
- `NODE_ENV` - Set to "production"

## Deployment Steps

### Step 1: Create Storage Account
```bash
az storage account create \
  --name legalmcpstore \
  --resource-group Legal-MCP \
  --location canadacentral \
  --sku Standard_LRS
```

### Step 2: Create Blob Containers
```bash
# Get storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name legalmcpstore \
  --resource-group Legal-MCP \
  --query '[0].value' -o tsv)

# Create containers
az storage container create \
  --name documents \
  --account-name legalmcpstore \
  --account-key $STORAGE_KEY

az storage container create \
  --name prompts \
  --account-name legalmcpstore \
  --account-key $STORAGE_KEY
```

### Step 3: Upload Initial Files
```bash
# Get connection string
CONN_STRING=$(az storage account show-connection-string \
  --name legalmcpstore \
  --resource-group Legal-MCP \
  --query connectionString -o tsv)

# Upload prompt library
az storage blob upload \
  --account-name legalmcpstore \
  --container-name prompts \
  --name "library.json" \
  --file ./prompts/library.json \
  --connection-string "$CONN_STRING"
```

### Step 4: Create App Service
```bash
az webapp create \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --plan Legal-MCP \
  --runtime "NODE:20-lts"
```

### Step 5: Configure App Service Settings
```bash
# Get storage connection string
CONN_STRING=$(az storage account show-connection-string \
  --name legalmcpstore \
  --resource-group Legal-MCP \
  --query connectionString -o tsv)

# Set environment variables
az webapp config appsettings set \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    AZURE_STORAGE_CONNECTION_STRING="$CONN_STRING" \
    ANTHROPIC_API_KEY="<YOUR_ANTHROPIC_KEY>"
```

### Step 6: Configure Node.js Version
```bash
az webapp config appsettings set \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --settings \
    WEBSITE_NODE_DEFAULT_VERSION="20-lts"
```

### Step 7: Configure Startup Command
```bash
az webapp config set \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --startup-file "npm start"
```

### Step 8: Deploy Code
**Option A: Deploy from Local (ZIP)**
```bash
# Build the project
npm run build

# Create deployment package (exclude node_modules, include dist and package.json)
zip -r deploy.zip dist package.json package-lock.json

# Deploy
az webapp deployment source config-zip \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --src deploy.zip
```

**Option B: Deploy from GitHub (Recommended)**
```bash
# Configure GitHub deployment
az webapp deployment source config \
  --name legal-mcp \
  --resource-group Legal-MCP \
  --repo-url https://github.com/MCP-Agent766/Legal-MCP \
  --branch main \
  --manual-integration

# Then trigger deployment
az webapp deployment source sync \
  --name legal-mcp \
  --resource-group Legal-MCP
```

**Option C: Use Azure DevOps or GitHub Actions (Future)**

### Step 9: Verify Deployment
```bash
# Check logs
az webapp log tail \
  --name legal-mcp \
  --resource-group Legal-MCP

# Test endpoint
curl https://legal-mcp.azurewebsites.net/mcp
```

## Important Considerations

### 1. Free Tier Limitations
- F1 (Free) tier has limitations:
  - 60 minutes compute time per day
  - App sleeps after inactivity
  - Limited to 1GB storage
  - No custom domains on free tier
  - Consider upgrading to Basic tier for production

### 2. Node.js Version
- Azure App Service supports Node.js 20 LTS
- Verify compatibility with all dependencies
- Set `WEBSITE_NODE_DEFAULT_VERSION` to ensure correct version

### 3. Build Process
- Azure can build from source if needed
- For ZIP deployment, pre-build locally
- Ensure `package.json` has correct `start` script

### 4. Environment Variables
- Never commit `.env` file
- Use Azure App Service Configuration for secrets
- Connection strings should be stored securely

### 5. Port Configuration
- Azure sets `PORT` environment variable automatically
- Our code uses `process.env.PORT || 3000`
- Should work correctly, but verify

### 6. CORS Configuration
- Currently allows all origins (`origin: '*'`)
- Consider restricting for production
- Update in `src/index.ts` if needed

## Post-Deployment Verification

1. **Health Check:**
   - Server starts without errors
   - Logs show successful initialization
   - No missing environment variable errors

2. **Functionality Test:**
   - MCP endpoint responds
   - Tools are registered correctly
   - Can list documents
   - Can list prompts
   - Can execute analysis (if test document exists)

3. **Performance:**
   - Response times are acceptable
   - No memory leaks
   - Handles concurrent requests

## Rollback Plan

If deployment fails:
1. Check logs: `az webapp log tail --name legal-mcp --resource-group Legal-MCP`
2. Verify environment variables are set correctly
3. Check that storage account is accessible
4. Verify Anthropic API key is valid
5. Rollback to previous deployment if needed

## Next Steps After Deployment

1. Set up monitoring and alerts
2. Configure custom domain (if needed, requires paid tier)
3. Set up CI/CD pipeline
4. Configure backup strategy
5. Set up application insights for monitoring

