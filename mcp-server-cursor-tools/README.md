# MCP Server for cursor-tools

This Node.js Express server acts as an MCP (Model Context Protocol) wrapper for the `cursor-tools` command-line interface.

It provides MCP endpoints that correspond to the various commands available in `cursor-tools`, allowing MCP clients to leverage `cursor-tools` functionality remotely.

## Features

- Exposes `cursor-tools` commands as MCP tool endpoints.
- Handles parameter translation from JSON requests to CLI arguments.
- Manages execution context (working directory) for relevant commands (`repo`, `plan`, `doc`, `github`, `xcode`).
- Returns command output (stdout) or detailed error information (stderr, exit code).

## Prerequisites

1.  **Node.js**: Version 18 or later recommended.
2.  **`cursor-tools`**: Must be installed globally (`npm install -g cursor-tools`) and available in the server's PATH.
3.  **API Keys**: The server's environment must have the necessary API keys configured for `cursor-tools` to function. This typically involves setting environment variables like `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `CLICKUP_API_TOKEN`. Check the `cursor-tools` documentation for specifics.
4.  **Playwright**: If using `browser` commands, Playwright must be installed (`npm install --global playwright`).
5.  **Dependencies**: Run `npm install` in the `mcp-server-cursor-tools` directory.

## Configuration

- **Workspace Root**: The `WORKSPACE_ROOT` constant in `server.js` **must** be set to the absolute path of the user's workspace where commands requiring local context should be executed.
- **Port**: The server listens on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Running the Server

```bash
npm start
```

The server will start, log the port it's listening on, the configured workspace root, and the status of required environment variables.

## MCP Tool Endpoints

The server provides the following POST endpoints under the `/mcp/tools/` path:

- `/ask`: Wraps `cursor-tools ask`
- `/plan`: Wraps `cursor-tools plan`
- `/web`: Wraps `cursor-tools web`
- `/repo`: Wraps `cursor-tools repo`
- `/doc`: Wraps `cursor-tools doc`
- `/youtube`: Wraps `cursor-tools youtube`
- `/github/pr`: Wraps `cursor-tools github pr`
- `/github/issue`: Wraps `cursor-tools github issue`
- `/clickup/task`: Wraps `cursor-tools clickup task`
- `/mcp/search`: Wraps `cursor-tools mcp search`
- `/mcp/run`: Wraps `cursor-tools mcp run`
- `/browser/open`: Wraps `cursor-tools browser open`
- `/browser/act`: Wraps `cursor-tools browser act`
- `/browser/observe`: Wraps `cursor-tools browser observe`
- `/browser/extract`: Wraps `cursor-tools browser extract`
- `/xcode/build`: Wraps `cursor-tools xcode build`
- `/xcode/run`: Wraps `cursor-tools xcode run`
- `/xcode/lint`: Wraps `cursor-tools xcode lint`

Refer to the `cursor-tools` documentation or the server code (`server.js`) for the specific JSON payload parameters expected by each endpoint.

## Notes

- **Security**: Ensure appropriate network security measures are in place if exposing this server.
- **Error Handling**: The server attempts to return detailed error information from `cursor-tools`, including stderr output.
- **Quoting**: The server attempts to quote arguments like queries and instructions appropriately for the shell, but complex inputs might require further refinement. 