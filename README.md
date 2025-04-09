# MCP Vibe Tools: Python FastMCP Server for vibe-tools

This project provides an **MCP (Model Context Protocol) server** built with **FastMCP (Python)** that wraps the `vibe-tools` CLI (formerly `cursor-tools`), allowing AI agents or other services (like Claude Desktop) to interact with `vibe-tools` commands via HTTP requests.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [Environment Variables](#environment-variables)
- [Available MCP Tools (Endpoints)](#available-mcp-tools-endpoints)
- [Example Usage](#example-usage)
- [Context Injection and Async Tools](#context-injection-and-async-tools)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This server exposes endpoints corresponding to various `vibe-tools` commands (like `repo`, `plan`, `web`, `browser`, `xcode`, etc.). It translates JSON request bodies into CLI arguments, executes the command in the correct working directory, and returns the output.

It is implemented in **Python** using **FastMCP** (https://github.com/jlowin/fastmcp), providing an SSE-capable MCP server.

A key feature is the ability to dynamically set the working directory for context-dependent commands, enabling interaction with multiple projects without restarting the server.

---

## Features

- Wraps most major `vibe-tools` commands.
- Manages execution context (working directory) dynamically.
- Allows changing the target project directory via an MCP tool.
- Handles parameter mapping from JSON to CLI flags.
- Provides async tool support with proper context injection.
- Includes unit tests for core functionality.

---

## Prerequisites

1. **Python 3.8+**

2. **vibe-tools CLI**

   - Must be installed globally (`npm install -g vibe-tools` or `pnpm install -g vibe-tools`)
   - Properly configured with API keys, `.repomixignore`, etc.
   - See [vibe-tools repo](https://github.com/getcursor/cursor-tools)

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

3. **Ensure `vibe-tools` CLI is installed globally**

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

## Environment Variables

- **`VIBE_TOOLS_PATH`** (preferred): Absolute path or command name for the `vibe-tools` CLI executable.
- **`CURSOR_TOOLS_PATH`** (legacy, still supported): Same as above.
- If **both** are set, `VIBE_TOOLS_PATH` takes precedence.
- If neither is set, defaults to `'cursor-tools'` (or `'vibe-tools'` if aliased).

---

## Available MCP Tools (Endpoints)

The server exposes tools under `/mcp/tools/`:

### Meta Tools

- **`POST /mcp/tools/set_working_directory`**  
  Set the working directory for subsequent commands.

### vibe-tools Command Wrappers

- **`POST /mcp/tools/ask`**  
  Ask a question to an AI model via `vibe-tools ask`.

- **`POST /mcp/tools/plan`**  
  Generate an implementation plan using AI.

- **`POST /mcp/tools/web`**  
  Perform a web search or autonomous web agent query.

- **`POST /mcp/tools/repo`**  
  Ask questions about the current repository context.

- **`POST /mcp/tools/doc`**  
  Generate documentation for the repository.

- **`POST /mcp/tools/youtube`**  
  Analyze YouTube videos (summarize, transcript, plan, etc.).

- **`POST /mcp/tools/github/pr`**  
  Get information about GitHub pull requests.

- **`POST /mcp/tools/github/issue`**  
  Get information about GitHub issues.

- **`POST /mcp/tools/clickup/task`**  
  Get information about ClickUp tasks.

- **`POST /mcp/tools/mcp/search`**  
  Search the MCP marketplace for servers.

- **`POST /mcp/tools/mcp/run`**  
  Run a tool on a connected MCP server.

- **`POST /mcp/tools/browser/act`**  
  Automate browser actions (click, type, etc.).

- **`POST /mcp/tools/browser/observe`**  
  Observe interactive elements on a webpage.

- **`POST /mcp/tools/browser/extract`**  
  Extract data from a webpage.

- **`POST /mcp/tools/xcode/build`**  
  Build an Xcode project.

- **`POST /mcp/tools/xcode/run`**  
  Build and run an Xcode project.

- **`POST /mcp/tools/xcode/lint`**  
  Run static analysis on an Xcode project.

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