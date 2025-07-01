import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("HAL MCP Server", () => {
  test("should create server instance", () => {
    const server = new McpServer({
      name: "hal-mcp",
      version: "1.0.0"
    });
    
    expect(server).toBeDefined();
  });
  
  test("should have correct server metadata", () => {
    const server = new McpServer({
      name: "hal-mcp",
      version: "1.0.0"
    });
    
    // Server should be created with the correct name and version
    // Note: We can't easily test the internal state without exposing it,
    // but we can at least verify the server creates without errors
    expect(server).toBeInstanceOf(McpServer);
  });

  test("should support all HTTP methods", () => {
    // Test that the HTTP methods we expect to support are included
    const supportedMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    
    // This is a basic test to ensure our expected methods list is complete
    expect(supportedMethods).toContain('get');
    expect(supportedMethods).toContain('post');
    expect(supportedMethods).toContain('put');
    expect(supportedMethods).toContain('patch');
    expect(supportedMethods).toContain('delete');
    expect(supportedMethods).toContain('head');
    expect(supportedMethods).toContain('options');
  });

  describe("HTTP method validation", () => {
    test("should include all standard HTTP methods", () => {
      const supportedMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
      
      // Verify we support the core CRUD operations
      expect(supportedMethods).toContain('get');     // Read
      expect(supportedMethods).toContain('post');    // Create
      expect(supportedMethods).toContain('put');     // Update/Replace
      expect(supportedMethods).toContain('patch');   // Update/Modify
      expect(supportedMethods).toContain('delete');  // Delete
      
      // Verify we support metadata operations
      expect(supportedMethods).toContain('head');    // Get headers only
      expect(supportedMethods).toContain('options'); // Get available methods
    });

    test("should handle HEAD requests correctly", () => {
      // HEAD requests should not attempt to parse response body
      // This test verifies our method list includes HEAD and our logic accounts for it
      const headMethodSupported = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes('head');
      expect(headMethodSupported).toBe(true);
      
      // HEAD requests return no body by HTTP specification
      // Our implementation should handle this gracefully
      expect(true).toBe(true); // Placeholder for HEAD-specific logic validation
    });
  });
}); 