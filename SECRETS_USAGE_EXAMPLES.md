# HAL Secrets Usage Examples

This document provides practical examples of using HAL's secret management feature.

## Setup

First, configure your secrets in the environment. For Claude Desktop, add them to your configuration:

```json
{
  "mcpServers": {
    "hal": {
      "command": "npx",
      "args": ["hal-mcp"],
      "env": {
        "HAL_SECRET_GITHUB_TOKEN": "ghp_your_actual_token_here",
        "HAL_SECRET_API_KEY": "your_api_key_here",
        "HAL_SECRET_USERNAME": "your_username",
        "HAL_SECRET_PASSWORD": "your_password"
      }
    }
  }
}
```

## Discovering Available Secrets

Before using secrets, you can check what secret keys are available using the `list-secrets` tool:

**Tool call:**
```json
{}
```

**Response:**
```
Available secrets (4 total):

You can use these secret keys in your HTTP requests using the {secrets.key} syntax:

1. {secrets.github_token}
2. {secrets.api_key}
3. {secrets.username}
4. {secrets.password}

Usage examples:
- URL: "https://api.example.com/data?token={secrets.github_token}"
- Header: {"Authorization": "Bearer {secrets.github_token}"}
- Body: {"username": "{secrets.username}"}
```

This tool only shows the key names - the actual secret values are never exposed to the AI.

## Example Use Cases

### 1. GitHub API with Personal Access Token

**Tool call:**
```json
{
  "url": "https://api.github.com/user/repos",
  "headers": {
    "Authorization": "Bearer {secrets.github_token}",
    "Accept": "application/vnd.github.v3+json"
  }
}
```

**What happens:**
- AI sees: `"Authorization": "Bearer {secrets.github_token}"`
- HAL sends: `"Authorization": "Bearer ghp_your_actual_token_here"`

### 2. Authentication with API Key in Query Parameter

**Tool call:**
```json
{
  "url": "https://api.example.com/data?api_key={secrets.api_key}&limit=10"
}
```

**What happens:**
- AI sees: `https://api.example.com/data?api_key={secrets.api_key}&limit=10`
- HAL sends: `https://api.example.com/data?api_key=your_api_key_here&limit=10`

### 3. Login with Username and Password

**Tool call:**
```json
{
  "url": "https://api.example.com/auth/login",
  "body": "{\"username\": \"{secrets.username}\", \"password\": \"{secrets.password}\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

**What happens:**
- AI sees: `{"username": "{secrets.username}", "password": "{secrets.password}"}`
- HAL sends: `{"username": "your_username", "password": "your_password"}`

### 4. Custom Headers with Multiple Secrets

**Tool call:**
```json
{
  "url": "https://api.service.com/endpoint",
  "headers": {
    "X-API-Key": "{secrets.api_key}",
    "X-Client-ID": "{secrets.client_id}",
    "Authorization": "Bearer {secrets.access_token}"
  }
}
```

### 5. OAuth 2.0 Token Exchange

**Tool call:**
```json
{
  "url": "https://oauth2.googleapis.com/token",
  "body": "grant_type=client_credentials&client_id={secrets.client_id}&client_secret={secrets.client_secret}",
  "headers": {
    "Content-Type": "application/x-www-form-urlencoded"
  }
}
```

### 6. Database Connection String (for API endpoints that accept connection strings)

**Tool call:**
```json
{
  "url": "https://api.example.com/query",
  "body": "{\"connection\": \"postgresql://user:{secrets.database_password}@localhost:5432/mydb\", \"query\": \"SELECT * FROM users\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

## Security Benefits

1. **AI Never Sees Secrets**: The AI only sees template placeholders like `{secrets.api_key}`, never the actual values.

2. **Environment-Based Configuration**: Secrets are managed through environment variables, following security best practices.

3. **No Secret Leakage**: Even if conversation logs are stored, they only contain placeholders, not actual secrets.

4. **Flexible Key Naming**: Environment variables use the `HAL_SECRET_` prefix, and keys are case-insensitive in templates.

## Best Practices

1. **Use Descriptive Names**: 
   - ✅ `HAL_SECRET_GITHUB_TOKEN`
   - ❌ `HAL_SECRET_T1`

2. **Scope Secrets Appropriately**:
   - Use separate tokens for different services
   - Don't reuse the same secret for multiple purposes

3. **Regular Rotation**:
   - Rotate secrets regularly
   - Update environment variables when secrets change

4. **Least Privilege**:
   - Use API keys with minimal required permissions
   - Create service-specific tokens when possible

## Troubleshooting

If a secret substitution fails, you'll see a warning like:
```
Warning: Secret 'api_key' not found. Available secrets: github_token, username, password
```

**Common issues:**
1. **Case mismatch**: `HAL_SECRET_API_KEY` → use `{secrets.api_key}` (lowercase)
2. **Missing prefix**: Environment variable must start with `HAL_SECRET_`
3. **Typo in template**: Make sure you use `{secrets.key}` format exactly

## Advanced Usage with Swagger/OpenAPI

When using HAL with Swagger/OpenAPI integration, secrets work seamlessly with auto-generated tools:

```json
{
  "id": "user123",
  "headers": {
    "Authorization": "Bearer {secrets.api_key}"
  }
}
```

The secrets will be substituted before making the request to any Swagger-generated endpoint. 