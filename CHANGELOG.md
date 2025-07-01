# Changelog

All notable changes to HAL (HTTP API Layer) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.9] - 2024-12-26

### Added
- 🚀 **Namespace and URL Restrictions**: Organize secrets with namespaces and restrict them to specific URLs
- **Hierarchical namespace support**: Use `-` for namespace separators (e.g., `AZURE-STORAGE` → `azure.storage`)
- **URL pattern matching**: Restrict secrets to specific domains using `HAL_ALLOW_*` variables with wildcard support
- **Enhanced `list-secrets` tool**: Shows namespace groupings and URL restrictions for each secret
- **Defense in depth security**: Prevents cross-service secret leakage even with AI errors or prompt injection

### Enhanced
- **Namespace convention**: `HAL_SECRET_AZURE-STORAGE_ACCESS_KEY` → `{secrets.azure.storage.access_key}`
- **URL validation**: Secrets with restrictions throw errors if used with non-matching URLs
- **Backward compatibility**: Non-namespaced secrets continue to work without restrictions
- **Comprehensive documentation**: Updated README with namespace examples and security benefits

### Security
- **Principle of least privilege**: Secrets only work with their intended services
- **URL restriction enforcement**: Runtime validation prevents secrets from being sent to unauthorized domains
- **Clear error messages**: Failed URL validations provide helpful debugging information
- **Namespace isolation**: Different namespaces can have completely different URL restrictions

### Examples
- `HAL_SECRET_MICROSOFT_API_KEY` + `HAL_ALLOW_MICROSOFT="https://azure.microsoft.com/*"`
- `HAL_SECRET_AZURE-STORAGE_ACCESS_KEY` + `HAL_ALLOW_AZURE-STORAGE="https://*.blob.core.windows.net/*"`
- Multi-level namespaces: `HAL_SECRET_GOOGLE-CLOUD-STORAGE_SERVICE_ACCOUNT_KEY`

## [1.0.8] - 2024-12-25

### Added
- 🔐 **Secure Secret Management**: Environment-based secrets with `{secrets.key}` substitution
- **`list-secrets` tool**: Allows AI to discover available secret keys without exposing values
- **Secret substitution in all HTTP methods**: URLs, headers, and request bodies support `{secrets.key}` syntax
- **Comprehensive secrets documentation**: Usage examples and security best practices

### Enhanced
- All HTTP tools now support secret substitution (`http-get`, `http-post`, `http-put`, `http-patch`, `http-delete`, `http-head`, `http-options`)
- Updated tool descriptions to document secrets support
- Enhanced API documentation with secrets examples
- Swagger/OpenAPI integration works seamlessly with secrets

### Security
- Secrets are loaded from `HAL_SECRET_*` environment variables
- AI never sees actual secret values, only template placeholders
- Runtime substitution ensures secure handling
- No secret leakage in conversation logs

## [1.0.7] - 2024-07-01

### Added
- HTTP PUT request tool for full resource updates
- HTTP PATCH request tool for partial resource updates  
- HTTP DELETE request tool for resource deletion
- HTTP HEAD request tool for metadata-only requests
- HTTP OPTIONS request tool for capability discovery
- Comprehensive test coverage for all HTTP methods
- Updated documentation with examples for all new tools

### Enhanced
- Complete CRUD operation support (Create, Read, Update, Delete)
- Enhanced API interaction capabilities
- Improved test suite with method validation

### Fixed
- HEAD request handling no longer attempts to parse empty response body as JSON
- Improved error handling for empty or malformed JSON responses
- Better handling of responses with no content

## [1.0.6] - 2024-07-01

### Added
- Initial HTTP method extensions (PUT, PATCH, DELETE, HEAD, OPTIONS)

## [1.0.0] - 2024-07-01

### Added
- Initial release of HAL MCP server
- HTTP GET request tool with customizable headers
- HTTP POST request tool with body and header support
- Built-in API documentation resource
- Stdio transport support for MCP communication
- TypeScript implementation with full type safety
- Comprehensive test suite
- npm package with `npx` support
- Claude Desktop integration examples

### Features
- ✅ Secure HTTP request handling
- ✅ JSON and text response parsing
- ✅ Custom User-Agent headers
- ✅ Error handling and reporting
- ✅ Self-documenting API
- ✅ Cross-platform compatibility (Node.js 18+) 