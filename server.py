from fastmcp import FastMCP, Context
import subprocess
import os
import pathlib
import sys
import tomli
import time
from typing import Optional, List, Dict, Any, Literal, Union

# Read version from pyproject.toml
with open(pathlib.Path(__file__).parent / "pyproject.toml", "rb") as f:
    pyproject = tomli.load(f)
    VERSION = pyproject["project"]["version"]

# Get cursor-tools path from environment or use default
cursor_tools_exec = os.environ.get('CURSOR_TOOLS_PATH', 'cursor-tools')

# Initialize FastMCP
mcp = FastMCP("cursor-tools-mcp", version=VERSION)

# Global working directory
current_working_directory = "/Users/jason/mcp/mcp-vibe-tools"

def build_command_args(
    command: List[str],
    params: Dict[str, Any],
    path_params: List[str] = [],
    boolean_params: List[str] = [],
    no_prefix_params: List[str] = []
) -> List[str]:
    """Build command arguments from parameters."""
    command_args = command.copy()
    
    for key, value in params.items():
        if value is None:
            continue
        
        # Convert snake_case to kebab-case
        kebab_key = key.replace("_", "-")
        
        # Handle boolean flags
        if key in boolean_params:
            if value:
                command_args.append(f"--{kebab_key}")
            continue
        
        # Handle boolean flags with --no- prefix for False values
        if key in no_prefix_params:
            if value is False:
                command_args.append(f"--no-{kebab_key}")
            elif value is True:
                command_args.append(f"--{kebab_key}")
            continue
        
        # Handle path parameters
        if key in path_params and value:
            resolved_path = pathlib.Path(current_working_directory).resolve() / value
            command_args.append(f"--{kebab_key}={resolved_path}")
            continue
        
        # Handle regular parameters with spaces
        if isinstance(value, str) and " " in value:
            command_args.append(f'--{kebab_key}="{value}"')
        else:
            command_args.append(f"--{kebab_key}={value}")
    
    return command_args

def run_cursor_tools(
    command_args: List[str],
    ctx: Context,
    from_github: bool = False
) -> str:
    """Run the cursor-tools command and format the response."""
    # Determine the execution directory
    execution_dir = current_working_directory
    if from_github:
        execution_dir = os.getcwd()
    
    # Log command execution
    ctx.info(f"Executing command: {' '.join(command_args)}")
    ctx.info(f"Working directory: {execution_dir}")
    
    # Debug info
    print(f"DEBUG: Running command: {' '.join(command_args)}", file=sys.stderr)
    print(f"DEBUG: Working directory: {execution_dir}", file=sys.stderr)
    
    start_time = time.time()
    line_count = 0
    
    # Report starting progress
    ctx.report_progress(0, 100)
    
    # Run the command with realtime output processing
    process = subprocess.Popen(
        command_args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=execution_dir
    )
    
    stdout_lines = []
    stderr_lines = []
    
    # Process output in real-time with progress updates
    last_progress_time = time.time()
    
    try:
        while True:
            # Read with timeout to ensure progress updates even without output
            current_time = time.time()
            elapsed = current_time - start_time
            
            # Send heartbeat progress updates every 3 seconds
            if current_time - last_progress_time >= 3:
                progress_pct = min(int(elapsed / 3), 95)  # Cap at 95% until complete
                ctx.report_progress(progress_pct, 100)
                print(f"DEBUG: Progress heartbeat {progress_pct}%", file=sys.stderr)
                last_progress_time = current_time
            
            # Check if process has terminated
            if process.poll() is not None:
                # Process remaining output
                remaining_stdout, remaining_stderr = process.communicate()
                if remaining_stdout:
                    for line in remaining_stdout.splitlines():
                        stdout_lines.append(line)
                        ctx.info(f"OUT: {line}")
                        line_count += 1
                if remaining_stderr:
                    for line in remaining_stderr.splitlines():
                        stderr_lines.append(line)
                        ctx.info(f"ERR: {line}")
                        print(f"DEBUG: STDERR: {line}", file=sys.stderr)
                        line_count += 1
                break
                
            # Read stdout with timeout
            stdout_line = process.stdout.readline() if process.stdout else ""
            stderr_line = process.stderr.readline() if process.stderr else ""
            
            if not stdout_line and not stderr_line:
                # No data, sleep briefly and continue
                time.sleep(0.1)
                continue
                
            if stdout_line:
                line = stdout_line.rstrip()
                stdout_lines.append(line)
                ctx.info(f"OUT: {line}")
                line_count += 1
                
                # Update progress on each line
                elapsed = time.time() - start_time
                progress_pct = min(int(elapsed / 3), 95)
                ctx.report_progress(progress_pct, 100)
                last_progress_time = time.time()
                
            if stderr_line:
                line = stderr_line.rstrip()
                stderr_lines.append(line)
                ctx.info(f"ERR: {line}")
                print(f"DEBUG: STDERR: {line}", file=sys.stderr)
                line_count += 1
    except Exception as e:
        print(f"DEBUG: Exception in subprocess handling: {str(e)}", file=sys.stderr)
        ctx.error(f"Exception during command execution: {str(e)}")
        # Try to terminate the process if still running
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    
    # Get return code
    returncode = process.poll()
    
    # Calculate execution time
    execution_time = time.time() - start_time
    
    # Report completion
    ctx.report_progress(100, 100)
    
    # Debug info
    print(f"DEBUG: Command finished with code {returncode}", file=sys.stderr)
    print(f"DEBUG: Execution time: {execution_time:.2f} seconds", file=sys.stderr)
    print(f"DEBUG: Processed {line_count} lines of output", file=sys.stderr)
    
    # Format the response
    stdout = "\n".join(stdout_lines)
    stderr = "\n".join(stderr_lines)
    
    if returncode == 0:
        return f"Command successful:\n{stdout}"
    else:
        return f"Command failed with code {returncode}:\nStdout:\n{stdout}\nStderr:\n{stderr}"

@mcp.tool()
def set_working_directory(directory_path: str) -> str:
    """Set the working directory for cursor-tools commands."""
    global current_working_directory
    
    # Resolve the input path relative to the current working directory
    resolved_path = pathlib.Path(current_working_directory) / directory_path
    resolved_absolute_path = resolved_path.resolve()
    
    # Check if the resolved path exists and is a directory
    if resolved_absolute_path.exists() and resolved_absolute_path.is_dir():
        current_working_directory = str(resolved_absolute_path)
        return f"Working directory set to: {current_working_directory}"
    else:
        return f"Error: {directory_path} is not a valid directory"

@mcp.tool()
def test(message: str, ctx: Context = None) -> str:
    """Simple echo test function."""
    if ctx:
        ctx.info(f"Echo test: {message}")
    return f"Echo: {message}"

@mcp.tool()
def ask(
    query: str,
    max_tokens: Optional[int] = None,
    provider: Optional[Literal["openai", "anthropic", "ollama", "llama2", "llama3", "mixtral", "phi3", "claude", "gpt4", "gpt35", "mistral", "perplexity", "gemini", "modelbox", "openrouter"]] = None,
    model: Optional[str] = None,
    reasoning_effort: Optional[Literal["low", "medium", "high"]] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Ask a direct question to an LLM without context.
    
    Note: Generally less useful than repo or plan as it doesn't include codebase context.
    """
    command = [cursor_tools_exec, "ask", query]
    params = {
        "max_tokens": max_tokens,
        "provider": provider,
        "model": model,
        "reasoning_effort": reasoning_effort,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def plan(
    query: str,
    max_tokens: Optional[int] = None,
    file_provider: Optional[Literal["gemini", "openai", "anthropic", "perplexity", "modelbox", "openrouter"]] = None,
    thinking_provider: Optional[Literal["gemini", "openai", "anthropic", "perplexity", "modelbox", "openrouter"]] = None,
    file_model: Optional[str] = None,
    thinking_model: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Generate a focused implementation plan using AI.
    
    Uses multiple AI models to identify relevant files and generate a detailed plan.
    """
    command = [cursor_tools_exec, "plan", query]
    params = {
        "max_tokens": max_tokens,
        "file_provider": file_provider,
        "thinking_provider": thinking_provider,
        "file_model": file_model,
        "thinking_model": thinking_model,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def web(
    query: str,
    max_tokens: Optional[int] = None,
    provider: Optional[Literal["perplexity", "gemini", "modelbox", "openrouter"]] = None,
    model: Optional[str] = None,
    max_search_results: Optional[int] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Get answers from the web using an AI model with search capabilities.
    
    Web is a smart autonomous agent with internet access - not just a search engine.
    """
    command = [cursor_tools_exec, "web", query]
    params = {
        "max_tokens": max_tokens,
        "provider": provider,
        "model": model,
        "max_search_results": max_search_results,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def repo(
    query: str,
    max_tokens: Optional[int] = None,
    provider: Optional[Literal["gemini", "openai", "openrouter", "perplexity", "modelbox"]] = None,
    model: Optional[str] = None,
    from_github: Optional[bool] = None,
    repo_url: Optional[str] = None,
    subdir: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Get context-aware answers about a repository using AI.
    
    Provides intelligent insights based on repository content. Can analyze specific 
    subdirectories or remote GitHub repositories.
    """
    command = [cursor_tools_exec, "repo", query]
    params = {
        "max_tokens": max_tokens,
        "provider": provider,
        "model": model,
        "repo_url": repo_url,
        "subdir": subdir,
        "save_to": save_to,
        "from_github": from_github
    }
    path_params = ["save_to", "subdir"]
    boolean_params = ["from_github"]
    
    command_args = build_command_args(command, params, path_params, boolean_params)
    return run_cursor_tools(command_args, ctx, from_github or False)

@mcp.tool()
def doc(
    query: Optional[str] = None,
    max_tokens: Optional[int] = None,
    provider: Optional[Literal["gemini", "openai", "openrouter", "perplexity", "modelbox"]] = None,
    model: Optional[str] = None,
    from_github: Optional[bool] = None,
    repo_url: Optional[str] = None,
    output: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Generate comprehensive documentation for a repository.
    
    Can document local or remote GitHub repositories.
    """
    command = [cursor_tools_exec, "doc"]
    if query:
        command.append(query)
        
    params = {
        "max_tokens": max_tokens,
        "provider": provider,
        "model": model,
        "repo_url": repo_url,
        "from_github": from_github
    }
    
    # Handle output or save_to parameter
    if output is not None:
        params["output"] = output
    elif save_to is not None:
        params["output"] = save_to
    
    path_params = ["output"]
    boolean_params = ["from_github"]
    
    command_args = build_command_args(command, params, path_params, boolean_params)
    return run_cursor_tools(command_args, ctx, from_github or False)

@mcp.tool()
def youtube(
    url: str,
    query: Optional[str] = None,
    type: Optional[Literal["summary", "transcript", "plan", "review", "custom"]] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Analyze YouTube videos and generate detailed reports.
    
    Requires GEMINI_API_KEY in environment or .cursor-tools.env file.
    """
    command = [cursor_tools_exec, "youtube", url]
    if query:
        command.append(query)
        
    params = {
        "type": type,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def github_pr(
    number: Optional[int] = None,
    from_github: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Get information about GitHub pull requests.
    
    Returns the last 10 PRs or a specific PR by number.
    """
    command = [cursor_tools_exec, "github", "pr"]
    if number is not None:
        command.append(str(number))
        
    params = {
        "from_github": from_github,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def github_issue(
    number: Optional[int] = None,
    from_github: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Get information about GitHub issues.
    
    Returns the last 10 issues or a specific issue by number.
    """
    command = [cursor_tools_exec, "github", "issue"]
    if number is not None:
        command.append(str(number))
        
    params = {
        "from_github": from_github,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def clickup_task(
    task_id: str,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Get detailed information about a ClickUp task.
    
    Requires CLICKUP_API_TOKEN in .cursor-tools.env file.
    """
    command = [cursor_tools_exec, "clickup", "task", task_id]
    params = {
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def mcp_search(
    query: str,
    provider: Optional[Literal["anthropic", "openrouter"]] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Search the MCP Marketplace for available servers.
    
    Requires ANTHROPIC_API_KEY or OPENROUTER_API_KEY in environment.
    """
    command = [cursor_tools_exec, "mcp", "search", query]
    params = {
        "provider": provider,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def mcp_run(
    query: str,
    provider: Optional[Literal["anthropic", "openrouter"]] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Execute MCP server tools using natural language queries.
    
    Requires ANTHROPIC_API_KEY or OPENROUTER_API_KEY in environment.
    """
    command = [cursor_tools_exec, "mcp", "run", query]
    params = {
        "provider": provider,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def browser_open(
    url: str,
    console: Optional[bool] = None,
    html: Optional[bool] = None,
    network: Optional[bool] = None,
    screenshot: Optional[str] = None,
    timeout: Optional[int] = None,
    viewport: Optional[str] = None,
    headless: Optional[bool] = None,
    connect_to: Optional[Union[str, int]] = None,
    wait: Optional[str] = None,
    video: Optional[str] = None,
    evaluate: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Open a URL and capture page content, console logs, and network activity.
    
    Part of Stagehand browser automation suite.
    """
    command = [cursor_tools_exec, "browser", "open", url]
    params = {
        "console": console,
        "html": html,
        "network": network,
        "screenshot": screenshot,
        "timeout": timeout,
        "viewport": viewport,
        "headless": headless,
        "connect_to": connect_to,
        "wait": wait,
        "video": video,
        "evaluate": evaluate,
        "save_to": save_to
    }
    path_params = ["screenshot", "video", "save_to"]
    boolean_params = ["html"]
    no_prefix_params = ["console", "network", "headless"]
    
    command_args = build_command_args(command, params, path_params, boolean_params, no_prefix_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def browser_act(
    instruction: str,
    url: Optional[str] = None,
    console: Optional[bool] = None,
    html: Optional[bool] = None,
    network: Optional[bool] = None,
    screenshot: Optional[str] = None,
    timeout: Optional[int] = None,
    viewport: Optional[str] = None,
    headless: Optional[bool] = None,
    connect_to: Optional[Union[str, int]] = None,
    wait: Optional[str] = None,
    video: Optional[str] = None,
    evaluate: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Execute actions on a webpage using natural language instructions.
    
    Supports multi-step workflows using pipe (|) separator.
    """
    command = [cursor_tools_exec, "browser", "act", instruction]
    params = {
        "url": url,
        "console": console,
        "html": html,
        "network": network,
        "screenshot": screenshot,
        "timeout": timeout,
        "viewport": viewport,
        "headless": headless,
        "connect_to": connect_to,
        "wait": wait,
        "video": video,
        "evaluate": evaluate,
        "save_to": save_to
    }
    path_params = ["screenshot", "video", "save_to"]
    boolean_params = ["html"]
    no_prefix_params = ["console", "network", "headless"]
    
    command_args = build_command_args(command, params, path_params, boolean_params, no_prefix_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def browser_observe(
    instruction: str,
    url: Optional[str] = None,
    console: Optional[bool] = None,
    html: Optional[bool] = None,
    network: Optional[bool] = None,
    screenshot: Optional[str] = None,
    timeout: Optional[int] = None,
    viewport: Optional[str] = None,
    headless: Optional[bool] = None,
    connect_to: Optional[Union[str, int]] = None,
    wait: Optional[str] = None,
    video: Optional[str] = None,
    evaluate: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Observe interactive elements on a webpage and suggest possible actions.
    
    Helps identify actionable elements for browser_act commands.
    """
    command = [cursor_tools_exec, "browser", "observe", instruction]
    params = {
        "url": url,
        "console": console,
        "html": html,
        "network": network,
        "screenshot": screenshot,
        "timeout": timeout,
        "viewport": viewport,
        "headless": headless,
        "connect_to": connect_to,
        "wait": wait,
        "video": video,
        "evaluate": evaluate,
        "save_to": save_to
    }
    path_params = ["screenshot", "video", "save_to"]
    boolean_params = ["html"]
    no_prefix_params = ["console", "network", "headless"]
    
    command_args = build_command_args(command, params, path_params, boolean_params, no_prefix_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def browser_extract(
    instruction: str,
    url: Optional[str] = None,
    console: Optional[bool] = None,
    html: Optional[bool] = None,
    network: Optional[bool] = None,
    screenshot: Optional[str] = None,
    timeout: Optional[int] = None,
    viewport: Optional[str] = None,
    headless: Optional[bool] = None,
    connect_to: Optional[Union[str, int]] = None,
    wait: Optional[str] = None,
    video: Optional[str] = None,
    evaluate: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Extract data from a webpage based on natural language instructions.
    
    Great for scraping structured information from websites.
    """
    command = [cursor_tools_exec, "browser", "extract", instruction]
    params = {
        "url": url,
        "console": console,
        "html": html,
        "network": network,
        "screenshot": screenshot,
        "timeout": timeout,
        "viewport": viewport,
        "headless": headless,
        "connect_to": connect_to,
        "wait": wait,
        "video": video,
        "evaluate": evaluate,
        "save_to": save_to
    }
    path_params = ["screenshot", "video", "save_to"]
    boolean_params = ["html"]
    no_prefix_params = ["console", "network", "headless"]
    
    command_args = build_command_args(command, params, path_params, boolean_params, no_prefix_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def xcode_build(
    build_path: Optional[str] = None,
    destination: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Build Xcode project and report errors.
    
    Defaults to iOS Simulator destination if not specified.
    """
    command = [cursor_tools_exec, "xcode", "build"]
    params = {
        "build_path": build_path,
        "destination": destination,
        "save_to": save_to
    }
    path_params = ["build_path", "save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def xcode_run(
    destination: Optional[str] = None,
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Build and run the Xcode project on a simulator.
    
    Defaults to iOS Simulator destination if not specified.
    """
    command = [cursor_tools_exec, "xcode", "run"]
    params = {
        "destination": destination,
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

@mcp.tool()
def xcode_lint(
    save_to: Optional[str] = None,
    ctx: Context = None
) -> str:
    """Run static analysis on the Xcode project to find and fix issues."""
    command = [cursor_tools_exec, "xcode", "lint"]
    params = {
        "save_to": save_to
    }
    path_params = ["save_to"]
    
    command_args = build_command_args(command, params, path_params)
    return run_cursor_tools(command_args, ctx)

def main():
    """Entry point for the package."""
    mcp.run()

if __name__ == "__main__":
    main()
