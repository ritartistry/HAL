#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// @ts-ignore
import SwaggerParser from "swagger-parser";
import { readFileSync, existsSync } from "fs";
// @ts-ignore
import * as YAML from "yaml";

// Environment configuration
const SWAGGER_FILE_PATH = process.env.HAL_SWAGGER_FILE;
const API_BASE_URL = process.env.HAL_API_BASE_URL;

// Secrets management
interface SecretsStore {
  [key: string]: string;
}

let secrets: SecretsStore = {};

// Load secrets from environment variables with HAL_SECRET_ prefix
function loadSecrets(): void {
  secrets = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('HAL_SECRET_') && value) {
      const secretKey = key.replace('HAL_SECRET_', '').toLowerCase();
      secrets[secretKey] = value;
    }
  }
  
  if (Object.keys(secrets).length > 0) {
    console.error(`Loaded ${Object.keys(secrets).length} secrets from environment variables`);
  }
}

// Template substitution function
function substituteSecrets(template: string): string {
  if (!template || typeof template !== 'string') {
    return template;
  }
  
  return template.replace(/\{secrets\.([^}]+)\}/g, (match, secretKey) => {
    const key = secretKey.toLowerCase();
    if (secrets[key]) {
      return secrets[key];
    } else {
      console.error(`Warning: Secret '${secretKey}' not found. Available secrets: ${Object.keys(secrets).join(', ')}`);
      return match; // Return original placeholder if secret not found
    }
  });
}

// Helper function to recursively substitute secrets in objects
function substituteSecretsInObject(obj: any): any {
  if (typeof obj === 'string') {
    return substituteSecrets(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => substituteSecretsInObject(item));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteSecretsInObject(value);
    }
    return result;
  }
  return obj;
}

// Types for OpenAPI/Swagger
interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

// Create the HAL MCP server
const server = new McpServer({
  name: "hal-mcp",
  version: "1.0.0"
});

// Helper function to convert OpenAPI parameter to Zod schema
function createZodSchemaFromParameter(param: any): z.ZodTypeAny {
  const { type, format, enum: enumValues, required } = param;
  
  let schema: z.ZodTypeAny;
  
  switch (type) {
    case 'string':
      if (format === 'email') {
        schema = z.string().email();
      } else if (format === 'uri' || format === 'url') {
        schema = z.string().url();
      } else if (enumValues) {
        schema = z.enum(enumValues);
      } else {
        schema = z.string();
      }
      break;
    case 'number':
    case 'integer':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = z.array(z.string()); // Simplified array handling
      break;
    default:
      schema = z.string();
  }
  
  return required ? schema : schema.optional();
}

// Helper function to create Zod schema from OpenAPI parameters
function createInputSchema(operation: any): Record<string, z.ZodTypeAny> {
  const schema: Record<string, z.ZodTypeAny> = {};
  
  // Handle parameters (query, path, header)
  if (operation.parameters) {
    for (const param of operation.parameters) {
      const zodSchema = createZodSchemaFromParameter({
        ...param.schema,
        required: param.required
      });
      schema[param.name] = zodSchema;
    }
  }
  
  // Handle request body
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    if (content) {
      if (content['application/json']) {
        schema.body = z.string().optional();
      } else if (content['application/x-www-form-urlencoded']) {
        schema.body = z.string().optional();
      } else {
        schema.body = z.string().optional();
      }
    }
  }
  
  // Always include headers as optional
  schema.headers = z.record(z.string()).optional();
  
  return schema;
}

// Helper function to make HTTP request
async function makeHttpRequest(
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: string;
    queryParams?: Record<string, any>;
  } = {}
) {
  try {
    const { headers = {}, body, queryParams = {} } = options;
    
    // Substitute secrets in URL, headers, body, and query parameters
    const processedUrl = substituteSecrets(url);
    const processedHeaders = substituteSecretsInObject(headers);
    const processedBody = body ? substituteSecrets(body) : body;
    const processedQueryParams = substituteSecretsInObject(queryParams);
    
    // Build URL with query parameters
    const urlObj = new URL(processedUrl);
    Object.entries(processedQueryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.set(key, String(value));
      }
    });
    
    const defaultHeaders = {
      'User-Agent': 'HAL-MCP/1.0.0',
      ...processedHeaders
    };
    
         // Add Content-Type for methods that typically send data
     if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && processedBody && !('Content-Type' in processedHeaders)) {
       (defaultHeaders as any)['Content-Type'] = 'application/json';
     }
    
    const response = await fetch(urlObj.toString(), {
      method: method.toUpperCase(),
      headers: defaultHeaders,
      body: processedBody
    });

    const contentType = response.headers.get('content-type') || 'text/plain';
    let content: string;
    
    // HEAD requests don't have a body by design
    if (method.toUpperCase() === 'HEAD') {
      content = '(No body - HEAD request)';
    } else {
      try {
        if (contentType.includes('application/json')) {
          const text = await response.text();
          if (text.trim()) {
            content = JSON.stringify(JSON.parse(text), null, 2);
          } else {
            content = '(Empty response)';
          }
        } else {
          content = await response.text();
        }
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        try {
          content = await response.text();
        } catch (textError) {
          content = '(Unable to parse response)';
        }
      }
    }

         return {
       content: [{
         type: "text" as const,
         text: `Status: ${response.status} ${response.statusText}\n\nHeaders:\n${
           Array.from(response.headers.entries())
             .map(([key, value]) => `${key}: ${value}`)
             .join('\n')
         }\n\nBody:\n${content}`
       }]
     };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         return {
       content: [{
         type: "text" as const,
         text: `Error making ${method.toUpperCase()} request: ${errorMessage}`
       }],
       isError: true
     };
  }
}

// Function to register tools from OpenAPI spec
async function registerSwaggerTools(spec: OpenAPISpec) {
  const baseUrl = API_BASE_URL || (spec.servers?.[0]?.url) || '';
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
        continue;
      }
      
      const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const toolName = `swagger_${operationId}`;
      
      const inputSchema = createInputSchema(operation);
      
      server.registerTool(
        toolName,
        {
          title: operation.summary || `${method.toUpperCase()} ${path}`,
          description: operation.description || `Execute ${method.toUpperCase()} request to ${path}`,
          inputSchema: inputSchema
        },
        async (params: any) => {
          const { headers, body, ...queryParams } = params;
          
          // Replace path parameters
          let resolvedPath = path;
          for (const [key, value] of Object.entries(queryParams)) {
            const pathParam = `{${key}}`;
            if (resolvedPath.includes(pathParam)) {
              resolvedPath = resolvedPath.replace(pathParam, String(value));
              delete queryParams[key];
            }
          }
          
          const fullUrl = baseUrl.endsWith('/') || resolvedPath.startsWith('/') 
            ? `${baseUrl}${resolvedPath}` 
            : `${baseUrl}/${resolvedPath}`;
          
          return makeHttpRequest(method, fullUrl, {
            headers,
            body,
            queryParams
          });
        }
      );
    }
  }
}

// Function to load and parse Swagger/OpenAPI file
async function loadSwaggerSpec(): Promise<OpenAPISpec | null> {
  if (!SWAGGER_FILE_PATH) {
    return null;
  }
  
  try {
    if (!existsSync(SWAGGER_FILE_PATH)) {
      console.error(`Swagger file not found: ${SWAGGER_FILE_PATH}`);
      return null;
    }
    
    const fileContent = readFileSync(SWAGGER_FILE_PATH, 'utf-8');
    let spec: OpenAPISpec;
    
    if (SWAGGER_FILE_PATH.endsWith('.yaml') || SWAGGER_FILE_PATH.endsWith('.yml')) {
      spec = YAML.parse(fileContent);
    } else {
      spec = JSON.parse(fileContent);
    }
    
    // Validate the spec using swagger-parser
    try {
      const parsedSpec = await (SwaggerParser as any).validate(spec);
      return parsedSpec as OpenAPISpec;
    } catch (parseError) {
      console.error('Swagger validation failed, using raw spec:', parseError);
      return spec;
    }
    
  } catch (error) {
    console.error('Error loading Swagger spec:', error);
    return null;
  }
}

// Register original HTTP tools (always available)
server.registerTool(
  "http-get",
  {
    title: "HTTP GET Request",
    description: "Make an HTTP GET request to a specified URL. Supports secret substitution using {secrets.key} syntax where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: { 
      url: z.string().url(),
      headers: z.record(z.string()).optional()
    }
  },
  async ({ url, headers = {} }: { url: string; headers?: Record<string, string> }) => {
    return makeHttpRequest('GET', url, { headers });
  }
);

server.registerTool(
  "http-post",
  {
    title: "HTTP POST Request",
    description: "Make an HTTP POST request to a specified URL with optional body and headers. Supports secret substitution using {secrets.key} syntax in URL, headers, and body where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      body: z.string().optional(),
      headers: z.record(z.string()).optional(),
      contentType: z.string().default('application/json')
    }
  },
  async ({ url, body, headers = {}, contentType }: { url: string; body?: string; headers?: Record<string, string>; contentType: string }) => {
    const requestHeaders = {
      'Content-Type': contentType,
      ...headers
    };
    return makeHttpRequest('POST', url, { headers: requestHeaders, body });
  }
);

server.registerTool(
  "http-put",
  {
    title: "HTTP PUT Request",
    description: "Make an HTTP PUT request to a specified URL with optional body and headers. Supports secret substitution using {secrets.key} syntax in URL, headers, and body where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      body: z.string().optional(),
      headers: z.record(z.string()).optional(),
      contentType: z.string().default('application/json')
    }
  },
  async ({ url, body, headers = {}, contentType }: { url: string; body?: string; headers?: Record<string, string>; contentType: string }) => {
    const requestHeaders = {
      'Content-Type': contentType,
      ...headers
    };
    return makeHttpRequest('PUT', url, { headers: requestHeaders, body });
  }
);

server.registerTool(
  "http-patch",
  {
    title: "HTTP PATCH Request",
    description: "Make an HTTP PATCH request to a specified URL with optional body and headers. Supports secret substitution using {secrets.key} syntax in URL, headers, and body where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      body: z.string().optional(),
      headers: z.record(z.string()).optional(),
      contentType: z.string().default('application/json')
    }
  },
  async ({ url, body, headers = {}, contentType }: { url: string; body?: string; headers?: Record<string, string>; contentType: string }) => {
    const requestHeaders = {
      'Content-Type': contentType,
      ...headers
    };
    return makeHttpRequest('PATCH', url, { headers: requestHeaders, body });
  }
);

server.registerTool(
  "http-delete",
  {
    title: "HTTP DELETE Request",
    description: "Make an HTTP DELETE request to a specified URL with optional headers. Supports secret substitution using {secrets.key} syntax in URL and headers where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      headers: z.record(z.string()).optional()
    }
  },
  async ({ url, headers = {} }: { url: string; headers?: Record<string, string> }) => {
    return makeHttpRequest('DELETE', url, { headers });
  }
);

server.registerTool(
  "http-head",
  {
    title: "HTTP HEAD Request",
    description: "Make an HTTP HEAD request to a specified URL with optional headers (returns only headers, no body). Supports secret substitution using {secrets.key} syntax in URL and headers where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      headers: z.record(z.string()).optional()
    }
  },
  async ({ url, headers = {} }: { url: string; headers?: Record<string, string> }) => {
    return makeHttpRequest('HEAD', url, { headers });
  }
);

server.registerTool(
  "http-options",
  {
    title: "HTTP OPTIONS Request",
    description: "Make an HTTP OPTIONS request to a specified URL to check available methods and headers. Supports secret substitution using {secrets.key} syntax in URL and headers where 'key' corresponds to HAL_SECRET_KEY environment variables.",
    inputSchema: {
      url: z.string().url(),
      headers: z.record(z.string()).optional()
    }
  },
  async ({ url, headers = {} }: { url: string; headers?: Record<string, string> }) => {
    return makeHttpRequest('OPTIONS', url, { headers });
  }
);

// Register secrets listing tool
server.registerTool(
  "list-secrets",
  {
    title: "List Available Secrets",
    description: "Get a list of available secret keys that can be used with {secrets.key} syntax. Only shows the key names, never the actual secret values.",
    inputSchema: {}
  },
  async () => {
    try {
      const secretKeys = Object.keys(secrets);
      
      if (secretKeys.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No secrets are currently configured. To add secrets, set environment variables with the HAL_SECRET_ prefix.\n\nExample:\n  HAL_SECRET_API_KEY=your_api_key\n  HAL_SECRET_TOKEN=your_token\n\nThen use them in requests like: {secrets.api_key} or {secrets.token}"
          }]
        };
      }
      
      let response = `Available secrets (${secretKeys.length} total):\n\n`;
      response += "You can use these secret keys in your HTTP requests using the {secrets.key} syntax:\n\n";
      
      secretKeys.forEach((key, index) => {
        response += `${index + 1}. {secrets.${key}}\n`;
      });
      
      response += "\n**Usage examples:**\n";
      response += `- URL: "https://api.example.com/data?token={secrets.${secretKeys[0] || 'token'}}"\n`;
      response += `- Header: {"Authorization": "Bearer {secrets.${secretKeys[0] || 'api_key'}}"}\n`;
      response += `- Body: {"username": "{secrets.${secretKeys.find(k => k.includes('user')) || 'username'}}"}\n\n`;
      response += "**Security Note:** Only the key names are shown here. The actual secret values are never exposed to the AI and are substituted securely at request time.";
      
      return {
        content: [{
          type: "text" as const,
          text: response
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Error listing secrets: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// In-memory documentation store for search
interface DocSection {
  id: string;
  title: string;
  content: string;
  type: 'endpoint' | 'schema' | 'component' | 'example';
  tags: string[];
}

let documentationStore: DocSection[] = [];

// Simple search function
function searchDocumentation(query: string, limit: number = 5): DocSection[] {
  if (!query.trim()) {
    return documentationStore.slice(0, limit);
  }
  
  const searchTerms = query.toLowerCase().split(/\s+/);
  
  const results = documentationStore
    .map(doc => {
      let score = 0;
      const searchableText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase();
      
      // Exact phrase match gets highest score
      if (searchableText.includes(query.toLowerCase())) {
        score += 100;
      }
      
      // Title matches get high score
      searchTerms.forEach(term => {
        if (doc.title.toLowerCase().includes(term)) {
          score += 50;
        }
        if (doc.tags.some(tag => tag.toLowerCase().includes(term))) {
          score += 30;
        }
        // Count occurrences in content
        const regex = new RegExp(term, 'gi');
        const matches = searchableText.match(regex);
        if (matches) {
          score += matches.length * 10;
        }
      });
      
      return { doc, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.doc);
    
  return results;
}

// Function to register Swagger documentation tools
async function registerSwaggerDocTools(spec: OpenAPISpec) {
  // Build documentation store
  documentationStore = [];
  
  // Add API overview
  documentationStore.push({
    id: 'api-overview',
    title: `${spec.info.title} Overview`,
    content: `${spec.info.title} v${spec.info.version}\n\n${spec.info.description || ''}\n\nBase URL: ${API_BASE_URL || spec.servers?.[0]?.url || 'Not specified'}`,
    type: 'endpoint',
    tags: ['api', 'overview', 'info', spec.info.title.toLowerCase()]
  });
  
  // Add endpoints
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
        continue;
      }
      
      let content = `${method.toUpperCase()} ${path}\n\n`;
      if (operation.summary) content += `${operation.summary}\n\n`;
      if (operation.description) content += `${operation.description}\n\n`;
      
      // Parameters
      if (operation.parameters && operation.parameters.length > 0) {
        content += `Parameters:\n`;
        for (const param of operation.parameters) {
          content += `- ${param.name} (${param.in}) - ${param.description || 'No description'}\n`;
          if (param.required) content += `  Required: Yes\n`;
          if (param.schema) {
            content += `  Type: ${param.schema.type || 'object'}\n`;
            if (param.schema.example) content += `  Example: ${param.schema.example}\n`;
          }
        }
        content += `\n`;
      }
      
      // Request body
      if (operation.requestBody) {
        content += `Request Body: ${operation.requestBody.required ? 'Required' : 'Optional'}\n`;
        if (operation.requestBody.content) {
          for (const [contentType] of Object.entries(operation.requestBody.content)) {
            content += `Content-Type: ${contentType}\n`;
          }
        }
        content += `\n`;
      }
      
      const tags = [
        method,
        path.split('/').filter(p => p && !p.startsWith('{')).join(' '),
        operation.summary?.toLowerCase() || '',
        ...(operation.tags || [])
      ].filter(Boolean);
      
      documentationStore.push({
        id: `${method}-${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: `${method.toUpperCase()} ${path}`,
        content,
        type: 'endpoint',
        tags
      });
    }
  }
  
  // Add schemas
  if (spec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      let content = `${schemaName}\n\n`;
      
      if ((schema as any).description) {
        content += `${(schema as any).description}\n\n`;
      }
      
      content += `Type: ${(schema as any).type || 'object'}\n\n`;
      
      if ((schema as any).properties) {
        content += `Properties:\n`;
        for (const [propName, prop] of Object.entries((schema as any).properties)) {
          const isRequired = (schema as any).required?.includes(propName);
          content += `- ${propName}${isRequired ? ' (required)' : ''} - ${(prop as any).description || 'No description'}\n`;
          content += `  Type: ${(prop as any).type || 'object'}\n`;
          if ((prop as any).example !== undefined) {
            content += `  Example: ${JSON.stringify((prop as any).example)}\n`;
          }
          if ((prop as any).enum) {
            content += `  Allowed values: ${(prop as any).enum.map((v: any) => v).join(', ')}\n`;
          }
        }
        content += `\n`;
      }
      
      if ((schema as any).example) {
        content += `Example:\n${JSON.stringify((schema as any).example, null, 2)}\n\n`;
      }
      
      documentationStore.push({
        id: `schema-${schemaName}`,
        title: `${schemaName} Schema`,
        content,
        type: 'schema',
        tags: ['schema', 'model', 'data', schemaName.toLowerCase()]
      });
    }
  }
  
  // Add presentation components (specific to your API)
  if (spec.components?.schemas?.Slide?.properties?.content?.properties?.elements?.items?.properties?.type?.enum) {
    const slideSchema = spec.components?.schemas?.Slide as any;
    const elementTypes = slideSchema?.properties?.content?.properties?.elements?.items?.properties?.type?.enum || [];
    
    const componentDescriptions = {
      'h1': 'Main heading - largest text size',
      'h2': 'Secondary heading',
      'h3': 'Tertiary heading',
      'h4': 'Quaternary heading', 
      'p': 'Paragraph text',
      'ul': 'Unordered (bulleted) list',
      'ol': 'Ordered (numbered) list',
      'li': 'List item',
      'image': 'Image element with src, alt, width properties',
      'button': 'Interactive button element',
      'company-logo': 'Company logo display',
      'stats-section': 'Statistics display section with items array',
      'opportunity-box': 'Highlighted opportunity or feature box',
      'alert-success': 'Success message alert',
      'alert-warning': 'Warning message alert', 
      'alert-info': 'Information alert',
      'risk-warning': 'Risk warning alert',
      'key-points': 'Key points section',
      'two-column': 'Two-column layout',
      'three-column': 'Three-column layout',
      'competitive-advantage': 'Competitive advantage showcase',
      'info-card': 'Information card display',
      'ai-query-demo': 'AI query demonstration',
      'product-showcase': 'Product showcase with title, features, and certifications'
    };
    
    for (const elementType of elementTypes) {
      let content = `${elementType}\n\n`;
      
      if (componentDescriptions[elementType as keyof typeof componentDescriptions]) {
        content += `${componentDescriptions[elementType as keyof typeof componentDescriptions]}\n\n`;
      }
      
      // Add property info for complex components
      if (elementType === 'stats-section') {
        content += `Properties:\n- items: Array of statistics strings\n- style: CSS styling\n\n`;
      } else if (elementType === 'product-showcase') {
        content += `Properties:\n- title: Product title\n- features: Array of feature strings\n- certifications: Array of certification strings\n- style: CSS styling\n\n`;
      } else if (elementType === 'image') {
        content += `Properties:\n- src: Image URL\n- alt: Alt text\n- width: Width specification\n- style: CSS styling\n\n`;
      } else if (['ul', 'ol'].includes(elementType)) {
        content += `Properties:\n- text: HTML list items as text (e.g., "<li>Item 1</li><li>Item 2</li>")\n- style: CSS styling\n\n`;
      } else {
        content += `Properties:\n- text: Text content\n- style: CSS styling\n\n`;
      }
      
      documentationStore.push({
        id: `component-${elementType}`,
        title: `${elementType} Component`,
        content,
        type: 'component',
        tags: ['component', 'element', 'presentation', elementType]
      });
    }
    
    // Add complete example
    if (spec.components?.schemas?.PresentationData?.example) {
      documentationStore.push({
        id: 'complete-example',
        title: 'Complete Presentation Example',
        content: `Complete example of presentation data structure:\n\n${JSON.stringify((spec.components.schemas.PresentationData as any).example, null, 2)}`,
        type: 'example',
        tags: ['example', 'presentation', 'sample', 'template']
      });
    }
  }
  
  // Register documentation search tool
  server.registerTool(
    "docs_search",
    {
      title: "Search API Documentation",
      description: "Search through the API documentation, schemas, components, and examples. Returns relevant matches based on your query.",
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'presentation components', 'generate endpoint', 'stats section')"),
        limit: z.number().optional().default(5).describe("Maximum number of results to return (default: 5)")
      }
    },
    async ({ query, limit = 5 }: { query: string; limit?: number }) => {
      try {
        const results = searchDocumentation(query, limit);
        
        if (results.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No documentation found for "${query}". Try broader search terms like "components", "schemas", "endpoints", or "examples".`
            }]
          };
        }
        
        let response = `Found ${results.length} result(s) for "${query}":\n\n`;
        
        results.forEach((doc, index) => {
          response += `## ${index + 1}. ${doc.title}\n`;
          response += `Type: ${doc.type}\n\n`;
          response += `${doc.content}\n`;
          response += `---\n\n`;
        });
        
        return {
          content: [{
            type: "text" as const,
            text: response
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
  
  // Register specific documentation lookup tools
  server.registerTool(
    "docs_components",
    {
      title: "List All Presentation Components",
      description: "Get a complete list of all available presentation components and their descriptions",
      inputSchema: {}
    },
    async () => {
      try {
        const components = documentationStore.filter(doc => doc.type === 'component');
        
        if (components.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No presentation components found in the documentation."
            }]
          };
        }
        
        let response = `Available Presentation Components (${components.length} total):\n\n`;
        
        components.forEach(comp => {
          response += `## ${comp.title}\n${comp.content}\n---\n\n`;
        });
        
        return {
          content: [{
            type: "text" as const,
            text: response
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving components: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
  
  server.registerTool(
    "docs_schemas",
    {
      title: "List All Data Schemas",
      description: "Get all available data schemas and their structure",
      inputSchema: {}
    },
    async () => {
      try {
        const schemas = documentationStore.filter(doc => doc.type === 'schema');
        
        let response = `Available Data Schemas (${schemas.length} total):\n\n`;
        
        schemas.forEach(schema => {
          response += `## ${schema.title}\n${schema.content}\n---\n\n`;
        });
        
        return {
          content: [{
            type: "text" as const,
            text: response
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving schemas: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
  
  server.registerTool(
    "docs_endpoints",
    {
      title: "List All API Endpoints",
      description: "Get all available API endpoints and their documentation",
      inputSchema: {}
    },
    async () => {
      try {
        const endpoints = documentationStore.filter(doc => doc.type === 'endpoint');
        
        let response = `Available API Endpoints (${endpoints.length} total):\n\n`;
        
        endpoints.forEach(endpoint => {
          response += `## ${endpoint.title}\n${endpoint.content}\n---\n\n`;
        });
        
        return {
          content: [{
            type: "text" as const,
            text: response
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
  
  server.registerTool(
    "docs_example",
    {
      title: "Get Complete Presentation Example",
      description: "Get a complete example of how to structure presentation data",
      inputSchema: {}
    },
    async () => {
      try {
        const examples = documentationStore.filter(doc => doc.type === 'example');
        
        if (examples.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No examples found in the documentation."
            }]
          };
        }
        
        let response = `Available Examples:\n\n`;
        
        examples.forEach(example => {
          response += `## ${example.title}\n${example.content}\n\n`;
        });
        
        return {
          content: [{
            type: "text" as const,
            text: response
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error retrieving examples: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}

// Function to register Swagger resources
async function registerSwaggerResources(spec: OpenAPISpec) {
  // Register main API documentation resource
  server.registerResource(
    "swagger-api-docs",
    "docs://swagger/api",
    {
      title: `${spec.info.title} - API Documentation`,
      description: `Complete API documentation for ${spec.info.title}`,
      mimeType: "text/markdown"
    },
    async (uri: { href: string }) => {
      let content = `# ${spec.info.title} v${spec.info.version}\n\n`;
      
      if (spec.info.description) {
        content += `${spec.info.description}\n\n`;
      }
      
      content += `## Base URL\n${API_BASE_URL || spec.servers?.[0]?.url || 'Not specified'}\n\n`;
      
      content += `## Available Endpoints\n\n`;
      
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
            continue;
          }
          
          content += `### ${method.toUpperCase()} ${path}\n`;
          if (operation.summary) content += `**${operation.summary}**\n\n`;
          if (operation.description) content += `${operation.description}\n\n`;
          
          // Parameters
          if (operation.parameters && operation.parameters.length > 0) {
            content += `**Parameters:**\n`;
            for (const param of operation.parameters) {
              content += `- \`${param.name}\` (${param.in}) - ${param.description || 'No description'}\n`;
              if (param.required) content += `  - Required: Yes\n`;
              if (param.schema) {
                content += `  - Type: ${param.schema.type || 'object'}\n`;
                if (param.schema.example) content += `  - Example: \`${param.schema.example}\`\n`;
              }
            }
            content += `\n`;
          }
          
          // Request body
          if (operation.requestBody) {
            content += `**Request Body:**\n`;
            content += `- Required: ${operation.requestBody.required ? 'Yes' : 'No'}\n`;
            if (operation.requestBody.content) {
              for (const [contentType, contentSchema] of Object.entries(operation.requestBody.content)) {
                content += `- Content-Type: \`${contentType}\`\n`;
              }
            }
            content += `\n`;
          }
          
          content += `---\n\n`;
        }
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: content
        }]
      };
    }
  );

  // Register components/schemas resource
  if (spec.components?.schemas) {
    server.registerResource(
      "swagger-schemas",
      "docs://swagger/schemas",
      {
        title: `${spec.info.title} - Data Schemas`,
        description: "Data models and schemas used by the API",
        mimeType: "text/markdown"
      },
      async (uri: { href: string }) => {
        let content = `# ${spec.info.title} - Data Schemas\n\n`;
        
                 for (const [schemaName, schema] of Object.entries(spec.components?.schemas || {})) {
           content += `## ${schemaName}\n\n`;
           
           if ((schema as any).description) {
             content += `${(schema as any).description}\n\n`;
           }
           
           content += `**Type:** ${(schema as any).type || 'object'}\n\n`;
           
           if ((schema as any).properties) {
             content += `**Properties:**\n`;
             for (const [propName, prop] of Object.entries((schema as any).properties)) {
               const isRequired = (schema as any).required?.includes(propName);
               content += `- \`${propName}\`${isRequired ? ' (required)' : ''} - ${(prop as any).description || 'No description'}\n`;
               content += `  - Type: ${(prop as any).type || 'object'}\n`;
               if ((prop as any).example !== undefined) {
                 content += `  - Example: \`${JSON.stringify((prop as any).example)}\`\n`;
               }
               if ((prop as any).enum) {
                 content += `  - Allowed values: ${(prop as any).enum.map((v: any) => `\`${v}\``).join(', ')}\n`;
               }
             }
             content += `\n`;
           }
           
           if ((schema as any).example) {
             content += `**Example:**\n\`\`\`json\n${JSON.stringify((schema as any).example, null, 2)}\n\`\`\`\n\n`;
           }
           
           content += `---\n\n`;
         }
        
        return {
          contents: [{
            uri: uri.href,
            text: content
          }]
        };
      }
    );
  }

  // Register presentation components resource (specific to your API)
  if (spec.components?.schemas?.Slide?.properties?.content?.properties?.elements?.items?.properties?.type?.enum) {
    server.registerResource(
      "swagger-components",
      "docs://swagger/components",
      {
        title: `${spec.info.title} - Presentation Components`,
        description: "Available presentation components and their usage",
        mimeType: "text/markdown"
      },
      async (uri: { href: string }) => {
        const slideSchema = spec.components?.schemas?.Slide as any;
        const elementTypes = slideSchema?.properties?.content?.properties?.elements?.items?.properties?.type?.enum || [];
        
        let content = `# ${spec.info.title} - Presentation Components\n\n`;
        content += `This API supports the following presentation element types:\n\n`;
        
        for (const elementType of elementTypes) {
          content += `## ${elementType}\n`;
          
          // Add descriptions for known component types
          const descriptions = {
            'h1': 'Main heading - largest text size',
            'h2': 'Secondary heading',
            'h3': 'Tertiary heading',
            'h4': 'Quaternary heading', 
            'p': 'Paragraph text',
            'ul': 'Unordered (bulleted) list',
            'ol': 'Ordered (numbered) list',
            'li': 'List item',
            'image': 'Image element with src, alt, width properties',
            'button': 'Interactive button element',
            'company-logo': 'Company logo display',
            'stats-section': 'Statistics display section with items array',
            'opportunity-box': 'Highlighted opportunity or feature box',
            'alert-success': 'Success message alert',
            'alert-warning': 'Warning message alert', 
            'alert-info': 'Information alert',
            'risk-warning': 'Risk warning alert',
            'key-points': 'Key points section',
            'two-column': 'Two-column layout',
            'three-column': 'Three-column layout',
            'competitive-advantage': 'Competitive advantage showcase',
            'info-card': 'Information card display',
            'ai-query-demo': 'AI query demonstration',
            'product-showcase': 'Product showcase with title, features, and certifications'
          };
          
                     if (descriptions[elementType as keyof typeof descriptions]) {
             content += `${descriptions[elementType as keyof typeof descriptions]}\n\n`;
           }
          
          // Add special property info for complex components
          if (elementType === 'stats-section') {
            content += `**Properties:**\n- \`items\`: Array of statistics strings\n- \`style\`: CSS styling\n\n`;
          } else if (elementType === 'product-showcase') {
            content += `**Properties:**\n- \`title\`: Product title\n- \`features\`: Array of feature strings\n- \`certifications\`: Array of certification strings\n- \`style\`: CSS styling\n\n`;
          } else if (elementType === 'image') {
            content += `**Properties:**\n- \`src\`: Image URL\n- \`alt\`: Alt text\n- \`width\`: Width specification\n- \`style\`: CSS styling\n\n`;
          } else if (['ul', 'ol'].includes(elementType)) {
            content += `**Properties:**\n- \`text\`: HTML list items as text (e.g., "<li>Item 1</li><li>Item 2</li>")\n- \`style\`: CSS styling\n\n`;
          } else {
            content += `**Properties:**\n- \`text\`: Text content\n- \`style\`: CSS styling\n\n`;
          }
        }
        
                 // Add example from schema
         if (spec.components?.schemas?.PresentationData?.example) {
           content += `## Complete Example\n\n`;
           content += `\`\`\`json\n${JSON.stringify((spec.components.schemas.PresentationData as any).example, null, 2)}\n\`\`\`\n\n`;
         }
        
        return {
          contents: [{
            uri: uri.href,
            text: content
          }]
        };
      }
    );
  }
}

// Register a resource for API documentation
server.registerResource(
  "api-docs",
  "docs://hal/api",
  {
    title: "HAL API Documentation",
    description: "Documentation for available HTTP API tools",
    mimeType: "text/markdown"
  },
  async (uri: { href: string }) => {
    let docsContent = `# HAL (HTTP API Layer) Documentation

## Features

### Secret Management

HAL supports secure secret management through environment variables. You can define secrets using the \`HAL_SECRET_\` prefix and reference them in your HTTP requests using the \`{secrets.key}\` syntax.

**Setup:**
1. Set environment variables with the \`HAL_SECRET_\` prefix:
   - \`HAL_SECRET_TOKEN=your_api_token\`
   - \`HAL_SECRET_USERNAME=your_username\`
   - \`HAL_SECRET_PASSWORD=your_password\`

2. Use the secrets in your requests:
   - URLs: \`https://api.example.com/user?token={secrets.token}\`
   - Headers: \`{"Authorization": "Bearer {secrets.token}"}\`
   - Request bodies: \`{"username": "{secrets.username}", "password": "{secrets.password}"}\`

**Security Benefits:**
- Secret values are never visible to the AI
- Secrets are substituted at request time
- Environment-based configuration supports different deployment environments

## Available Tools

### Built-in HTTP Tools

#### list-secrets
Get a list of available secret keys that can be used with {secrets.key} syntax.

**Parameters:** None

**Example Response:**
\`\`\`
Available secrets (3 total):

You can use these secret keys in your HTTP requests using the {secrets.key} syntax:

1. {secrets.api_key}
2. {secrets.github_token}
3. {secrets.username}
\`\`\`

#### http-get
Make HTTP GET requests to any URL with secret substitution support.

**Parameters:**
- \`url\` (required): The URL to request (supports {secrets.key} substitution)
- \`headers\` (optional): Object of additional headers to send (supports {secrets.key} substitution)

**Example:**
\`\`\`
{
  "url": "https://api.github.com/user?access_token={secrets.github_token}",
  "headers": {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": "Bearer {secrets.github_token}"
  }
}
\`\`\`

#### http-post
Make HTTP POST requests with optional body and headers with secret substitution support.

**Parameters:**
- \`url\` (required): The URL to request (supports {secrets.key} substitution)
- \`body\` (optional): Request body content (supports {secrets.key} substitution)
- \`headers\` (optional): Object of additional headers to send (supports {secrets.key} substitution)
- \`contentType\` (optional): Content-Type header (default: application/json)

**Example:**
\`\`\`
{
  "url": "https://api.example.com/login",
  "body": "{\\"username\\": \\"{secrets.username}\\", \\"password\\": \\"{secrets.password}\\"}",
  "headers": {
    "Authorization": "Bearer {secrets.api_key}"
  },
  "contentType": "application/json"
}
\`\`\`
`;

    // Add Swagger-generated tools documentation if available
    if (SWAGGER_FILE_PATH) {
      try {
        const spec = await loadSwaggerSpec();
        if (spec) {
          docsContent += `

### Auto-generated API Tools (from Swagger/OpenAPI)

**API:** ${spec.info.title} v${spec.info.version}
${spec.info.description ? `**Description:** ${spec.info.description}` : ''}
**Base URL:** ${API_BASE_URL || spec.servers?.[0]?.url || 'Not specified'}

#### Documentation Tools
- **docs_search** - Search through API documentation with intelligent matching
- **docs_components** - List all available presentation components
- **docs_schemas** - List all data schemas and models
- **docs_endpoints** - List all API endpoints with documentation
- **docs_example** - Get complete presentation examples

#### API Operation Tools
The following tools have been automatically generated from the OpenAPI specification:

`;
          
          for (const [path, pathItem] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
              if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
                continue;
              }
              
              const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
              const toolName = `swagger_${operationId}`;
              
              docsContent += `#### ${toolName}
**${method.toUpperCase()} ${path}**
${operation.summary ? `*${operation.summary}*` : ''}
${operation.description ? `\n${operation.description}` : ''}

`;
            }
          }
        }
      } catch (error) {
        docsContent += `\n\n**Note:** Error loading Swagger documentation: ${error}`;
      }
    }

    docsContent += `

## Configuration

HAL supports the following environment variables:

- \`HAL_SWAGGER_FILE\`: Path to OpenAPI/Swagger specification file (JSON or YAML)
- \`HAL_API_BASE_URL\`: Base URL for API requests (overrides servers in spec)
- \`HAL_SECRET_*\`: Secret values for substitution (e.g., \`HAL_SECRET_TOKEN=abc123\` allows using \`{secrets.token}\` in requests)

## Usage

HAL can be used with any MCP-compatible client to provide HTTP API capabilities to Large Language Models.
`;

    return {
      contents: [{
        uri: uri.href,
        text: docsContent
      }]
    };
  }
);

// Start the server with stdio transport
async function main() {
  try {
    // Load secrets from environment variables
    loadSecrets();
    
    // Load and register Swagger tools if configured
    if (SWAGGER_FILE_PATH) {
      console.error(`Loading Swagger specification from: ${SWAGGER_FILE_PATH}`);
      const spec = await loadSwaggerSpec();
      if (spec) {
        console.error(`Successfully loaded ${spec.info.title} v${spec.info.version}`);
        await registerSwaggerTools(spec);
        await registerSwaggerResources(spec);
        await registerSwaggerDocTools(spec);
        console.error(`Registered tools for ${Object.keys(spec.paths).length} API paths`);
      } else {
        console.error('No valid Swagger specification found, using built-in tools only');
      }
    } else {
      console.error('No HAL_SWAGGER_FILE specified, using built-in tools only');
    }
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Failed to start HAL server:', error);
  process.exit(1);
}); 