# mcp-vibe-tools
> _mcp server wrapper for `cursor-tools` (now `vibe-tools`)._  

This project provides an **MCP (Model Context Protocol) server** built with **MCP Python SDK** that wraps the `vibe-tools` CLI (formerly `cursor-tools`), allowing AI agents or other services (like Claude Desktop) to interact with `vibe-tools` without using the command line directly..

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [Environment Variables](#environment-variables)
- [Available MCP Tools](#available-mcp-tools-endpoints)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This server exposes endpoints corresponding to various `vibe-tools` commands (like `repo`, `plan`, `web`, `browser`, `xcode`, etc.). It translates JSON request bodies into CLI arguments, executes the command in the correct working directory, and returns the output.

It is implemented in **Python** using **Python MCP SDK** (https://github.com/modelcontextprotocol/python-sdk).

A key feature is the ability to dynamically set the working directory for context-dependent commands, enabling interaction with multiple projects without restarting the server.

---

## Features

- Wraps ALL `vibe-tools` commands.
- Manages execution context (working directory) dynamically.
- Allows changing the target project directory via an MCP tool.
- Handles parameter mapping from JSON to CLI flags.
- Provides async tool support with proper context injection.
- Includes unit tests for core functionality.

---

## Prerequisites

1. **Python 3.11+**

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

The recommended way to install **mcp-vibe-tools** is using [uv](https://github.com/astral-sh/uv):

```bash
uv tool install mcp-vibe-tools
```

This will install the CLI entry point `mcp-vibe-tools` into your uv tool environment.

You can then run the server with:

```bash
uv run mcp-vibe-tools
```

Make sure you have the `vibe-tools` CLI installed globally via npm or pnpm:

```bash
npm install -g vibe-tools
```

**Important:** Set the environment variable `VIBE_TOOLS_PATH` to the absolute path of your `vibe-tools` binary (usually something like `/usr/local/bin/vibe-tools`):

```bash
export VIBE_TOOLS_PATH=/absolute/path/to/vibe-tools
```

### Example `mcp.json` configuration

Add this block to your MCP client's configuration to connect:

```json
{
  "mcpServers": {
    "vibe-tools": {
      "name": "uv",
      "args": [
        "run",
        "mcp-vibe-tools"
      ],
      "env": {
        "VIBE_TOOLS_PATH": "/absolute/path/to/vibe-tools"
      }
    }
  }
}
```

---

## Running the Server

Start the FastMCP server:

```bash
uv run mcp-vibe-tools
```

## Environment Variables

- **`VIBE_TOOLS_PATH`** (preferred): Absolute path or command name for the `vibe-tools` CLI executable.
- **`CURSOR_TOOLS_PATH`** (legacy, still supported): Same as above.
- If **both** are set, `VIBE_TOOLS_PATH` takes precedence.
- If neither is set, defaults to `'cursor-tools'` (or `'vibe-tools'` if aliased).

---

## Available MCP Tools

### ask
Ask any AI model a direct question.
**Parameters:**
- `query` (string): The question to ask.
- `--provider` (string): AI provider (openai, anthropic, perplexity, gemini, modelbox, openrouter).
- `--model` (string, required): Model to use.
- `--reasoning-effort` (low|medium|high): Depth of reasoning.

### plan
Generate a focused implementation plan using AI.
**Parameters:**
- `query` (string): The task or feature to plan.
- `--fileProvider` (string): Provider for file identification.
- `--thinkingProvider` (string): Provider for plan generation.
- `--fileModel` (string): Model for file identification.
- `--thinkingModel` (string): Model for plan generation.

### repo
Ask questions about the current repository context.
**Parameters:**
- `query` (string): The question about the repo.
- `--subdir` (string): Subdirectory to analyze.
- `--from-github` (string): Remote GitHub repo to analyze.
- `--provider` (string): AI provider.
- `--model` (string): Model to use.

### web
Perform web search or autonomous web agent queries.
**Parameters:**
- `query` (string): The question or search task.
- `--provider` (string): AI provider.

### doc
Generate comprehensive documentation for the repository.
**Parameters:**
- `--from-github` (string): Remote GitHub repo.
- `--provider` (string): AI provider.
- `--model` (string): Model to use.

### youtube
Analyze YouTube videos (summarize, transcript, plan, review).
**Parameters:**
- `url` (string): YouTube video URL.
- `question` (string, optional): Specific question.
- `--type` (summary|transcript|plan|review|custom): Type of analysis.

### github pr
Get information about GitHub pull requests.
**Parameters:**
- `number` (int, optional): PR number. If omitted, fetches recent PRs.
- `--from-github` (string): Remote GitHub repo.

### github issue
Get information about GitHub issues.
**Parameters:**
- `number` (int, optional): Issue number. If omitted, fetches recent issues.
- `--from-github` (string): Remote GitHub repo.

### clickup task
Get detailed information about a ClickUp task.
**Parameters:**
- `task_id` (string): ClickUp task ID.

### mcp search
Search the MCP marketplace for available servers.
**Parameters:**
- `query` (string): Search query.

### mcp run
Run a tool on a connected MCP server.
**Parameters:**
- `query` (string): Natural language command specifying the tool and arguments.
- `--provider` (string): AI provider.

### browser act
Automate browser actions (click, type, etc.).
**Parameters:**
- `instruction` (string): Natural language instructions.
- `--url` (string): URL or 'current'/'reload-current'.
- `--video` (string): Directory to save video recording.
- `--screenshot` (string): Path to save screenshot.

### browser observe
Observe interactive elements on a webpage.
**Parameters:**
- `instruction` (string): What to observe.
- `--url` (string): URL or 'current'/'reload-current'.

### browser extract
Extract data from a webpage.
**Parameters:**
- `instruction` (string): What to extract.
- `--url` (string): URL or 'current'/'reload-current'.

### xcode build
Build an Xcode project.
**Parameters:**
- `--buildPath` (string): Custom build directory.
- `--destination` (string): Simulator destination.

### xcode run
Build and run an Xcode project on a simulator.
**Parameters:**
- `--destination` (string): Simulator destination.

### xcode lint
Run static analysis on an Xcode project.
_No parameters._

### set_working_directory
Change the working directory for subsequent commands.
**Parameters:**
- `directoryPath` (string): Absolute path to the new working directory.

---

## Contributing

Contributions welcome! Please open issues or pull requests.

---

## License

MIT License.