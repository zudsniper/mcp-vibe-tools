# MCP Vibe Tools: Python FastMCP Server for cursor-tools

This project provides an **MCP (Model Context Protocol) server** built with **FastMCP (Python)** that wraps the `cursor-tools` CLI, allowing AI agents or other services (like Claude Desktop) to interact with `cursor-tools` commands via HTTP requests.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [Available MCP Tools (Endpoints)](#available-mcp-tools-endpoints)
- [Example Usage](#example-usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This server exposes endpoints corresponding to various `cursor-tools` commands (like `repo`, `plan`, `web`, `browser`, `xcode`, etc.). It translates JSON request bodies into CLI arguments, executes the `cursor-tools` command in the correct working directory, and returns the output.

It is implemented in **Python** using **FastMCP** (https://github.com/jlowin/fastmcp), providing an SSE-capable MCP server.

A key feature is the ability to dynamically set the working directory for context-dependent commands, enabling interaction with multiple projects without restarting the server.

---

## Features

- Wraps most major `cursor-tools` commands.
- Manages execution context (working directory) dynamically.
- Allows changing the target project directory via an MCP tool.
- Handles parameter mapping from JSON to CLI flags.
- Provides async tool support with proper context injection.
- Includes unit tests for core functionality.

---

## Prerequisites

1. **Python 3.8+**

2. **cursor-tools CLI**

   - Must be installed globally (`npm install -g vibe-tools` or `pnpm install -g vibe-tools`)
   - Properly configured with API keys, `.repomixignore`, etc.
   - See [cursor-tools repo](https://github.com/getcursor/cursor-tools)

3. **Install Python dependencies**

```bash
pip install -r requirements.txt
```

---

## Installation

1. **Clone this repository**

```bash
git clone <your-repo-url>
cd mcp-vibe-tools
```

2. **Install Python dependencies**

```bash
pip install -r requirements.txt
```

3. **Ensure `cursor-tools` CLI is installed globally**

---

## Running the Server

Start the FastMCP server:

```bash
python server.py
```

- By default, it runs on port **3000**.
- To change the port:

```bash
PORT=3001 python server.py
```

The server will log its startup status, workspace root, and initial working directory.

---

## Available MCP Tools (Endpoints)

The server exposes tools under `/mcp/tools/`:

### Meta Tools

- `POST /mcp/tools/set_working_directory`
  - Sets the working directory for subsequent `cursor-tools` commands.
  - **Request:**
    ```json
    {
      "directoryPath": "/path/to/your/project"
    }
    ```
  - **Response:**
    ```json
    {
      "success": true,
      "message": "Working directory set to: /path/to/your/project"
    }
    ```

### cursor-tools Command Wrappers

- `POST /mcp/tools/ask`
- `POST /mcp/tools/plan`
- `POST /mcp/tools/web`
- `POST /mcp/tools/repo`
- `POST /mcp/tools/doc`
- `POST /mcp/tools/youtube`
- `POST /mcp/tools/github/pr`
- `POST /mcp/tools/github/issue`
- `POST /mcp/tools/clickup/task`
- `POST /mcp/tools/mcp/search`
- `POST /mcp/tools/mcp/run`
- `POST /mcp/tools/browser/act`
- `POST /mcp/tools/browser/observe`
- `POST /mcp/tools/browser/extract`
- `POST /mcp/tools/xcode/build`
- `POST /mcp/tools/xcode/run`
- `POST /mcp/tools/xcode/lint`

**Note:** Paths like `save_to`, `screenshot`, `video`, etc., are relative to the current working directory set via `set_working_directory`.

---

## Example Usage

Assuming the server runs at `http://localhost:3000`:

1. **Set the working directory**

```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"directoryPath": "/path/to/my/project"}' \
     http://localhost:3000/mcp/tools/set_working_directory
```

2. **Run a `repo` command**

```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"query": "Explain the main function in main.py"}' \
     http://localhost:3000/mcp/tools/repo
```

3. **Run a `plan` command**

```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"query": "Refactor the login component"}' \
     http://localhost:3000/mcp/tools/plan
```

---

## Context Injection and Async Tools

- The server supports **async MCP tools**.
- The `Context` object is **automatically injected** into tool functions **only during real MCP HTTP requests**.
- Example tool:

```python
@mcp.tool()
async def test(message: str, ctx: Context = None) -> str:
    if ctx:
        await ctx.info(f"Echo test: {message}")
    return f"Echo: {message}"
```

- **Important:** If you invoke tools **outside** of a real MCP request (e.g., direct function call, test harness), `ctx` will be `None` or invalid.
- To test context-dependent features, **always invoke via real HTTP requests** (e.g., curl).

---

## Development

- Tests can be added using `pytest` or similar.
- Consider adding linting with `flake8` or `black`.

---

## Contributing

Contributions welcome! Please open issues or pull requests.

---

## License

MIT License.