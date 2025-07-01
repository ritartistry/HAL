# HAL (HTTP API Layer)

HAL is a Model Context Protocol (MCP) server that provides HTTP API capabilities to Large Language Models. It allows LLMs to make HTTP requests and interact with web APIs through a secure, controlled interface. HAL can also automatically generate tools from OpenAPI/Swagger specifications for seamless API integration.

## Features

- 🌐 **HTTP GET/POST Requests**: Fetch and send data to any HTTP endpoint
- 📄 **Swagger/OpenAPI Integration**: Automatically generate tools from API specifications
- 📚 **Built-in Documentation**: Self-documenting API reference
- 🔒 **Secure**: Runs in isolated environment with controlled access
- ⚡ **Fast**: Built with TypeScript and optimized for performance

## Installation

### Via npx (Recommended)

```bash
npx hal-mcp
```

### Via npm

```bash
npm install -g hal-mcp
hal-mcp
```

## Usage

HAL is designed to work with MCP-compatible clients. Here are some examples:

### Basic Usage (Claude Desktop)

Add HAL to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "hal": {
      "command": "npx",
      "args": ["hal-mcp"]
    }
  }
}
```

### With Swagger/OpenAPI Integration

To enable automatic tool generation from an OpenAPI specification:

```json
{
  "mcpServers": {
    "hal": {
      "command": "npx",
      "args": ["hal-mcp"],
      "env": {
        "HAL_SWAGGER_FILE": "/path/to/your/openapi.json",
        "HAL_API_BASE_URL": "https://api.example.com"
      }
    }
  }
}
```

### Direct Usage

```bash
# Start the HAL server with default tools
npx hal-mcp

# Or with Swagger/OpenAPI integration
HAL_SWAGGER_FILE=/path/to/api.yaml HAL_API_BASE_URL=https://api.example.com npx hal-mcp
```

## Configuration

HAL supports the following environment variables:

- `HAL_SWAGGER_FILE`: Path to OpenAPI/Swagger specification file (JSON or YAML format)
- `HAL_API_BASE_URL`: Base URL for API requests (overrides the servers specified in the OpenAPI spec)

## Available Tools

### Built-in HTTP Tools

These tools are always available regardless of configuration:

#### `http-get`

Make HTTP GET requests to any URL.

**Parameters:**
- `url` (string, required): The URL to request
- `headers` (object, optional): Additional headers to send

**Example:**
```json
{
  "url": "https://api.github.com/users/octocat",
  "headers": {
    "Accept": "application/vnd.github.v3+json"
  }
}
```

#### `http-post`

Make HTTP POST requests with optional body and headers.

**Parameters:**
- `url` (string, required): The URL to request
- `body` (string, optional): Request body content
- `headers` (object, optional): Additional headers to send
- `contentType` (string, optional): Content-Type header (default: "application/json")

**Example:**
```json
{
  "url": "https://httpbin.org/post",
  "body": "{\"message\": \"Hello, World!\"}",
  "headers": {
    "Authorization": "Bearer your-token-here"
  },
  "contentType": "application/json"
}
```

### Auto-generated Swagger/OpenAPI Tools

When you provide a Swagger/OpenAPI specification via `HAL_SWAGGER_FILE`, HAL will automatically generate tools for each endpoint defined in the specification. These tools are named using the pattern `swagger_{operationId}` and include:

- **Automatic parameter validation** based on the OpenAPI schema
- **Path parameter substitution** (e.g., `/users/{id}` → `/users/123`)
- **Query parameter handling**
- **Request body support** for POST/PUT/PATCH operations
- **Proper HTTP method mapping**

For example, if your OpenAPI spec defines an operation with `operationId: "getUser"`, HAL will create a tool called `swagger_getUser` that you can use directly.

## Available Resources

### `docs://hal/api`

Access comprehensive API documentation and usage examples, including documentation for any auto-generated Swagger tools.

## OpenAPI/Swagger Integration Details

### Supported OpenAPI Features

- ✅ OpenAPI 3.x and Swagger 2.x specifications
- ✅ JSON and YAML format support
- ✅ Path parameters (`/users/{id}`)
- ✅ Query parameters
- ✅ Request body (JSON, form-encoded)
- ✅ All HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- ✅ Parameter validation (string, number, boolean, arrays)
- ✅ Required/optional parameter handling
- ✅ Custom headers support

### Example OpenAPI Integration

Given this OpenAPI specification:

```yaml
openapi: 3.0.0
info:
  title: Example API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /users/{id}:
    get:
      operationId: getUser
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
```

HAL will automatically create a `swagger_getUser` tool that the LLM can use like:

```json
{
  "id": "123"
}
```

This will make a GET request to `https://api.example.com/v1/users/123`.

## Development

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/hal-mcp.git
cd hal-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with hot reload
- `npm start` - Start the built server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Security Considerations

- HAL makes actual HTTP requests to external services
- Use appropriate authentication and authorization for your APIs
- Be mindful of rate limits and API quotas
- Consider network security and firewall rules
- When using Swagger integration, ensure your OpenAPI specifications are from trusted sources

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with the [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Inspired by the need for LLMs to interact with web APIs safely and efficiently
- OpenAPI integration powered by [swagger-parser](https://github.com/APIDevTools/swagger-parser) 