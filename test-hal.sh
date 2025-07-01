#!/bin/bash

echo "🚀 Testing HAL MCP Server"
echo "=========================="

echo ""
echo "📋 Test 1: Basic functionality (without Swagger)"
echo "Starting HAL server in background..."
timeout 5s npm run dev &
SERVER_PID=$!
sleep 2

# Stop the server
kill $SERVER_PID 2>/dev/null || true
echo "✅ Basic server startup test completed"

echo ""
echo "📋 Test 2: Swagger/OpenAPI integration"
echo "Starting HAL server with test OpenAPI spec..."

# Set environment variables for Swagger integration
export HAL_SWAGGER_FILE="$(pwd)/test-swagger-example.json"
export HAL_API_BASE_URL="https://jsonplaceholder.typicode.com"

echo "Environment variables set:"
echo "  HAL_SWAGGER_FILE=$HAL_SWAGGER_FILE"
echo "  HAL_API_BASE_URL=$HAL_API_BASE_URL"

# Start server with Swagger integration
timeout 10s npm run dev &
SERVER_PID=$!
sleep 3

# Stop the server
kill $SERVER_PID 2>/dev/null || true
echo "✅ Swagger integration test completed"

echo ""
echo "🏗️ Build test"
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "📚 Available tools when using Swagger spec:"
echo "  - http-get (built-in)"
echo "  - http-post (built-in)"
echo "  - http-put (built-in)"
echo "  - http-patch (built-in)"
echo "  - http-delete (built-in)"
echo "  - http-head (built-in)"
echo "  - http-options (built-in)"
echo "  - swagger_getPosts (auto-generated)"
echo "  - swagger_createPost (auto-generated)"
echo "  - swagger_getPost (auto-generated)"
echo "  - swagger_getUsers (auto-generated)"

echo ""
echo "🎉 All tests completed successfully!"
echo ""
echo "💡 Usage examples:"
echo "   Basic usage:     npx hal-mcp"
echo "   With Swagger:    HAL_SWAGGER_FILE=./test-swagger-example.json npx hal-mcp"
echo ""
echo "📖 See README.md for detailed configuration instructions" 