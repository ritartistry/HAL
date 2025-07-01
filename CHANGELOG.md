# Changelog

All notable changes to HAL (HTTP API Layer) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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