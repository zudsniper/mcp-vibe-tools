# MCP Vibe Tools: cursor-tools Server

This project provides an MCP (Model Context Protocol) server that wraps the `cursor-tools` CLI, allowing AI agents or other services (like the Claude Desktop app) to interact with `cursor-tools` commands via HTTP requests.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Option 1: Running Locally (Recommended for Development)](#option-1-running-locally-recommended-for-development)
  - [Option 2: Adding to Claude Desktop Configuration](#option-2-adding-to-claude-desktop-configuration)
- [Running the Server](#running-the-server)
- [Available MCP Tools (Endpoints)](#available-mcp-tools-endpoints)
  - [Meta Tools](#meta-tools)
  - [`cursor-tools` Command Wrappers](#cursor-tools-command-wrappers)
- [Example Usage](#example-usage)
- [Development](#development)
  - [Running Tests](#running-tests)
  - [Linting/Formatting](#lintingformatting)
- [Contributing](#contributing)
- [License](#license)

## Overview

The server exposes endpoints corresponding to various `cursor-tools` commands (like `repo`, `plan`, `web`, `browser`, `xcode`, etc.). It handles translating JSON request bodies into the appropriate CLI arguments, executing the `cursor-tools` command in the correct context (working directory), and returning the output.

A key feature is the ability to dynamically set the working directory for context-dependent commands using the `set_working_directory` tool, enabling interaction with multiple projects without restarting the server.

## Features

*   Wraps most major `cursor-tools` commands.
*   Manages execution context (working directory) for relevant commands.
*   Allows dynamic configuration of the target project's working directory via the `/mcp/tools/set_working_directory` endpoint.
*   Handles parameter mapping from JSON to CLI flags.
*   Provides basic error handling and logging.
*   Includes unit tests for core functionality.

## Prerequisites

1.  **Node.js and pnpm:** Ensure you have Node.js (v18+) and pnpm installed.
2.  **`cursor-tools` Installation:** The `cursor-tools` CLI **must be installed globally** on the machine running this server. Follow the installation instructions in the [official cursor-tools repository](https://github.com/getcursor/cursor-tools).
3.  **`cursor-tools` Configuration:** `cursor-tools` requires API keys and potentially other configurations (like a `.repomixignore` or `repomix.config.json` in the target project). **Crucially, `cursor-tools` must be properly configured and initialized within the target project directory *before* using this MCP server to operate on that project.** This server *does not* handle the initial `cursor-tools` setup within a project. Refer to the `cursor-tools` documentation for configuration details.
4.  **Playwright:** For `cursor-tools browser` commands, Playwright needs to be installed. If not already present, `cursor-tools` might prompt for installation, or you can install it manually (`pnpm install -g playwright` or `npm install -g playwright`).

## Installation

Choose one of the following methods:

### Option 1: Running Locally (Recommended for Development)

This method is best if you are developing or modifying the server itself.

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url> # Replace with the actual repo URL
    cd mcp-vibe-tools
    ```

2.  **Navigate to the Server Directory:**
    ```bash
    cd mcp-server-cursor-tools
    ```

3.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

4.  **Run the Server:** (See [Running the Server](#running-the-server) section below)

### Option 2: Adding to Claude Desktop Configuration

To make this server automatically available within the Claude Desktop application:

1.  Ensure you have cloned the repository and installed dependencies as described in Option 1 (Steps 1-3).
2.  Find your `claude_desktop_config.json` file:
    *   **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
    *   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
    *   **Linux:** `~/.config/Claude/claude_desktop_config.json`
3.  Edit the file and add an entry to the `mcpServers` object. Replace `/path/to/mcp-vibe-tools/mcp-server-cursor-tools` with the **absolute path** to the `mcp-server-cursor-tools` directory on your machine.

    ```json
    {
      "mcpServers": {
        "cursor-tools-server": { // You can choose any name here
          "command": "node",
          "args": [
            "server.js"
          ],
          "options": {
            "cwd": "/path/to/mcp-vibe-tools/mcp-server-cursor-tools" // <-- IMPORTANT: Use absolute path here
          }
        }
        // ... any other servers ...
      }
      // ... other config ...
    }
    ```

4.  **Restart the Claude Desktop application.** The server should now be available as an MCP tool within Claude.

## Running the Server

If you installed using Option 1 or want to run the server manually:

```bash
cd /path/to/mcp-vibe-tools/mcp-server-cursor-tools # Use the correct absolute path
node server.js
```

By default, the server runs on port 3000. You can configure the port using the `PORT` environment variable:

```bash
PORT=3001 node server.js
```

The server will log its startup status, default workspace root, and initial working directory.

## Available MCP Tools (Endpoints)

The server exposes tools under the `/mcp/tools/` path.

### Meta Tools

*   **`POST /mcp/tools/set_working_directory`**
    *   **Description:** Sets the working directory for subsequent context-dependent `cursor-tools` commands (like `repo`, `plan`, `doc`, `github`, `xcode`). This allows the agent to target different projects without restarting the server. The server validates that the path exists and is a directory. **Important:** The target directory should already have `cursor-tools` configured/initialized.
    *   **Request Body:**
        ```json
        {
          "directoryPath": "/path/to/your/target/project"
        }
        ```
    *   **Response (Success):**
        ```json
        {
          "success": true,
          "message": "Working directory set to: /path/to/your/target/project"
        }
        ```
    *   **Response (Error):**
        ```json
        {
          "success": false,
          "error": "Directory not found: /invalid/path"
        }
        ```

### `cursor-tools` Command Wrappers

Each endpoint generally accepts a JSON body with parameters corresponding to the `cursor-tools` command flags. See `mcp-server-cursor-tools/server.js` for the exact parameter names and types for each endpoint.

*   `POST /mcp/tools/ask`
*   `POST /mcp/tools/plan`
*   `POST /mcp/tools/web`
*   `POST /mcp/tools/repo`
*   `POST /mcp/tools/doc`
*   `POST /mcp/tools/youtube`
*   `POST /mcp/tools/github/pr`
*   `POST /mcp/tools/github/issue`
*   `POST /mcp/tools/clickup/task`
*   `POST /mcp/tools/mcp/search`
*   `POST /mcp/tools/mcp/run`
*   `POST /mcp/tools/browser/act`
*   `POST /mcp/tools/browser/observe`
*   `POST /mcp/tools/browser/extract`
*   `POST /mcp/tools/xcode/build`
*   `POST /mcp/tools/xcode/run`
*   `POST /mcp/tools/xcode/lint`

**Note on Paths:** For parameters like `save_to`, `screenshot`, `video`, `buildPath`, etc., provide paths *relative* to the *currently set working directory* (via `set_working_directory`). The server will resolve these paths correctly.

## Example Usage

(Using `curl` assuming the server is running on `http://localhost:3000`)

1.  **Set the working directory:**
    ```bash
    curl -X POST -H "Content-Type: application/json" \
         -d '{ "directoryPath": "/path/to/my/project-alpha" }' \
         http://localhost:3000/mcp/tools/set_working_directory
    ```

2.  **Run a `repo` command in that directory:**
    ```bash
    curl -X POST -H "Content-Type: application/json" \
         -d '{ "query": "Explain the main function in main.py" }' \
         http://localhost:3000/mcp/tools/repo
    ```
    *(This command will execute `cursor-tools repo "Explain the main function in main.py"` within `/path/to/my/project-alpha`)*

3.  **Set a different working directory:**
    ```bash
    curl -X POST -H "Content-Type: application/json" \
         -d '{ "directoryPath": "/another/project/location" }' \
         http://localhost:3000/mcp/tools/set_working_directory
    ```
4.  **Run a `plan` command in the new directory:**
     ```bash
    curl -X POST -H "Content-Type: application/json" \
         -d '{ "query": "Refactor the login component" }' \
         http://localhost:3000/mcp/tools/plan
    ```
     *(This command will execute `cursor-tools plan "Refactor the login component"` within `/another/project/location`)*


## Development

### Running Tests

Unit tests are located in `mcp-server-cursor-tools/server.test.js` and use Jest and `supertest`.

```bash
cd mcp-server-cursor-tools
pnpm test
```

The tests mock the `child_process.spawn` function to verify that `cursor-tools` is called with the correct arguments and working directory for various scenarios.

### Linting/Formatting

Consider adding linters (like ESLint) and formatters (like Prettier) to maintain code quality.

## Contributing

Contributions are welcome! If you find a bug, have a feature request, or want to contribute code:

1.  **Issues:** Please check the existing issues or open a new one to discuss the bug or feature.
2.  **Pull Requests:** Fork the repository, create a feature branch, make your changes, and submit a pull request with a clear description of the changes.

## License

This project is licensed under the MIT License. See the LICENSE file for details (if one exists, otherwise state MIT). 