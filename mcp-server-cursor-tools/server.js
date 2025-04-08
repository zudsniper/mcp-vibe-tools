// Import necessary modules
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';

// For __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const SERVER_NAME = "cursor-tools-mcp";
const SERVER_VERSION = "1.1.0"; // Updated version
const DEFAULT_WORKSPACE_ROOT = '/Users/jason/mcp/mcp-vibe-tools';
let currentWorkingDirectory = DEFAULT_WORKSPACE_ROOT; // Mutable working directory
const DEBUG = process.env.DEBUG === 'true'; // Enable debug logging with env var

// Helper for debug logging that doesn't interfere with MCP protocol
function debugLog(message) {
    if (DEBUG) {
        process.stderr.write(`DEBUG: ${message}\n`);
    }
}

// --- Helper: Run cursor-tools command ---
// Adjusted to return MCP-compatible success/error structure
async function runCursorTools(commandArgs, workingDir) {
    const cwd = workingDir || process.cwd(); // Default to server's CWD if not specified

    return new Promise((resolve) => { // Changed to always resolve
        debugLog(`Executing: cursor-tools ${commandArgs.join(' ')} in ${cwd}`);
        const proc = spawn('cursor-tools', commandArgs, {
            cwd: cwd,
            shell: true, // Use shell to handle paths and environment correctly
            env: { ...process.env } // Pass environment variables
        });

        let stdoutData = '';
        let stderrData = '';

        proc.stdout.on('data', (data) => {
            stdoutData += data.toString();
            debugLog(`stdout: ${data}`);
        });

        proc.stderr.on('data', (data) => {
            stderrData += data.toString();
            debugLog(`stderr: ${data}`);
        });

        proc.on('close', (code) => {
            debugLog(`child process exited with code ${code}`);
            if (code === 0) {
                // Resolve with success and text content
                resolve({
                    content: [{ type: 'text', text: `Command successful:\n${stdoutData}` }]
                });
            } else {
                // Resolve with error indication and text content including stderr
                resolve({
                    content: [{ type: 'text', text: `Command failed with code ${code}:\nStdout:\n${stdoutData}\nStderr:\n${stderrData}` }],
                    isError: true
                });
            }
        });

        proc.on('error', (err) => {
            debugLog(`Failed to start subprocess: ${err}`);
            // Resolve with error indication
            resolve({
                content: [{ type: 'text', text: `Failed to start subprocess: ${err.message}` }],
                isError: true
            });
        });
    });
}

// --- Initialize MCP Server ---
const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
});

// Helper function to build command args, resolving paths
function buildCommandArgs(baseArgs, params) {
    const commandArgs = [...baseArgs];
    const { save_to, buildPath, video, screenshot, ...rest } = params; // Handle path params separately

    for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined && value !== null) {
            // Convert camelCase to kebab-case for command line flags
            const flagName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

            // Handle boolean flags (presence indicates true)
            if (typeof value === 'boolean' && value === true) {
                commandArgs.push(`--${flagName}`);
            } else if (typeof value === 'boolean' && value === false) {
                 commandArgs.push(`--no-${flagName}`); // Handle --no-<flag> convention
            }
            // Handle string/number flags
            else if (typeof value !== 'boolean') {
                 // Quote values containing spaces, unless it's a known flag that shouldn't be (like number)
                 const shouldQuote = typeof value === 'string' && value.includes(' ') && !['number', 'max_tokens', 'timeout'].includes(flagName);
                 const formattedValue = shouldQuote ? `"${value}"` : value;
                 commandArgs.push(`--${flagName}=${formattedValue}`);
            }
        }
    }

    // Resolve path arguments relative to currentWorkingDirectory
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);
    if (buildPath) commandArgs.push(`buildPath=${path.resolve(currentWorkingDirectory, buildPath)}`); // xcode build specific format
    if (video) commandArgs.push(`--video=${path.resolve(currentWorkingDirectory, video)}`);
    if (screenshot) commandArgs.push(`--screenshot=${path.resolve(currentWorkingDirectory, screenshot)}`);


    // Ensure quoted positional args if they contain spaces
    if (params.query && typeof params.query === 'string' && params.query.includes(' ')) {
        const queryIndex = commandArgs.findIndex(arg => arg === params.query);
        if (queryIndex !== -1) commandArgs[queryIndex] = `"${params.query}"`;
    }
     if (params.instruction && typeof params.instruction === 'string' && params.instruction.includes(' ')) {
        const instructionIndex = commandArgs.findIndex(arg => arg === params.instruction);
        if (instructionIndex !== -1) commandArgs[instructionIndex] = `"${params.instruction}"`;
    }
     if (params.url && typeof params.url === 'string' && params.url.includes(' ')) {
        const urlIndex = commandArgs.findIndex(arg => arg === params.url);
        if (urlIndex !== -1) commandArgs[urlIndex] = `"${params.url}"`;
    }
     if (params.question && typeof params.question === 'string' && params.question.includes(' ')) {
        const questionIndex = commandArgs.findIndex(arg => arg === params.question);
        if (questionIndex !== -1) commandArgs[questionIndex] = `"${params.question}"`;
    }
     if (params.hint && typeof params.hint === 'string' && params.hint.includes(' ')) {
        const hintIndex = commandArgs.findIndex(arg => arg === `--hint=${params.hint}`);
        if (hintIndex !== -1) commandArgs[hintIndex] = `--hint="${params.hint}"`;
    }
     if (params.evaluate && typeof params.evaluate === 'string') { // Evaluate often has complex chars
        const evaluateIndex = commandArgs.findIndex(arg => arg === `--evaluate=${params.evaluate}`);
        if (evaluateIndex !== -1) commandArgs[evaluateIndex] = `--evaluate="${params.evaluate}"`;
     }
     if (params.wait && typeof params.wait === 'string' && params.wait.includes(' ')) {
        const waitIndex = commandArgs.findIndex(arg => arg === `--wait=${params.wait}`);
        if (waitIndex !== -1) commandArgs[waitIndex] = `--wait="${params.wait}"`;
    }
     if (params.destination && typeof params.destination === 'string' && params.destination.includes(' ')) {
        const destIndex = commandArgs.findIndex(arg => arg === `destination=${params.destination}`);
        if (destIndex !== -1) commandArgs[destIndex] = `destination="${params.destination}"`;
     }

    return commandArgs;
}

// First, let's add a simple test tool to see if it works
server.tool(
    'test',
    z.object({
        message: z.string().describe("Test message to echo back")
    }).describe("Test tool that simply echoes back the input message"),
    async (params) => {
        return {
            content: [{ type: 'text', text: `Test successful! Your message: ${params.message}` }]
        };
    }
);

// Now add a simple cursor-tools command to test the functionality
server.tool(
    'ask',
    z.object({
        query: z.string().describe("The question to ask"),
        provider: z.enum(['openai', 'anthropic', 'perplexity', 'gemini', 'modelbox', 'openrouter']).optional().describe("AI provider to use"),
        model: z.string().optional().describe("Model to use"),
        maxTokens: z.number().optional().describe("Maximum tokens for response"),
        save_to: z.string().optional().describe("Path to save output"),
    }).describe("Ask any model from any provider a direct question"),
    async (params) => {
        const baseArgs = ['ask', params.query];
        const commandArgs = buildCommandArgs(baseArgs, params);
        return await runCursorTools(commandArgs);
    }
);

// Add web tool
server.tool(
    'web',
    z.object({
        query: z.string().describe("The search query"),
        provider: z.enum(['openai', 'anthropic', 'perplexity', 'gemini', 'modelbox', 'openrouter']).optional().describe("AI provider to use"),
        model: z.string().optional().describe("Model to use"),
        maxTokens: z.number().optional().describe("Maximum tokens for response"),
        save_to: z.string().optional().describe("Path to save output"),
    }).describe("Get answers from the web using providers like Perplexity or Gemini"),
    async (params) => {
        const baseArgs = ['web', params.query];
        const commandArgs = buildCommandArgs(baseArgs, params);
        return await runCursorTools(commandArgs);
    }
);

// Add repo tool
server.tool(
    'repo',
    z.object({
        query: z.string().describe("The repository query"),
        subdir: z.string().optional().describe("Subdirectory to analyze"),
        from_github: z.string().optional().describe("GitHub username/repo[@branch]"),
        provider: z.enum(['openai', 'anthropic', 'perplexity', 'gemini', 'modelbox', 'openrouter']).optional().describe("AI provider to use"),
        model: z.string().optional().describe("Model to use"),
        maxTokens: z.number().optional().describe("Maximum tokens for response"),
        save_to: z.string().optional().describe("Path to save output"),
    }).describe("Get context-aware answers about the repository"),
    async (params) => {
        const baseArgs = ['repo', params.query];
        const commandArgs = buildCommandArgs(baseArgs, params);
        const executionDir = params.from_github ? process.cwd() : currentWorkingDirectory;
        return await runCursorTools(commandArgs, executionDir);
    }
);

// Add doc tool
server.tool(
    'doc',
    z.object({
        output: z.string().optional().describe("Path to save documentation"),
        hint: z.string().optional().describe("Optional hint for documentation focus"),
        from_github: z.string().optional().describe("GitHub username/repo[@branch]"),
        provider: z.enum(['openai', 'anthropic', 'perplexity', 'gemini', 'modelbox', 'openrouter']).optional().describe("AI provider to use"),
        model: z.string().optional().describe("Model to use"),
        maxTokens: z.number().optional().describe("Maximum tokens for response"),
        save_to: z.string().optional().describe("Path to save output"),
    }).describe("Generate comprehensive documentation for the repository"),
    async (params) => {
        const saveTo = params.output || params.save_to;
        if (!saveTo) {
            return { 
                content: [{ type: 'text', text: 'Error: Missing required parameter: output or save_to' }],
                isError: true 
            };
        }
        
        const baseArgs = ['doc'];
        const commandArgs = buildCommandArgs(baseArgs, { ...params, save_to: saveTo, output: undefined });
        const executionDir = params.from_github ? process.cwd() : currentWorkingDirectory;
        const result = await runCursorTools(commandArgs, executionDir);
        
        if (!result.isError) {
            result.content.push({ 
                type: 'text', 
                text: `\nDocumentation saved to: ${path.resolve(executionDir, saveTo)}` 
            });
        }
        
        return result;
    }
);

// Add browser open tool
server.tool(
    'browser_open',
    z.object({
        url: z.string().url().describe("URL to open"),
        html: z.boolean().optional().describe("Capture page HTML content"),
        console: z.boolean().optional().describe("Capture browser console logs"),
        network: z.boolean().optional().describe("Capture network activity"),
        screenshot: z.string().optional().describe("Path to save screenshot"),
        timeout: z.number().int().positive().optional().describe("Navigation timeout in ms"),
        viewport: z.string().regex(/^\d+x\d+$/).optional().describe("Viewport size"),
        headless: z.boolean().optional().describe("Run browser in headless mode"),
        connect_to: z.string().optional().describe("Connect to existing Chrome instance"),
        wait: z.string().optional().describe("Wait condition"),
        video: z.string().optional().describe("Directory to save video recording"),
        evaluate: z.string().optional().describe("JavaScript code to execute"),
        save_to: z.string().optional().describe("Path to save output"),
    }).describe("Open a URL and capture page content, logs, and network activity"),
    async (params) => {
        const baseArgs = ['browser', 'open', params.url];
        const adjustedParams = { ...params };
        
        if (params.console === false) adjustedParams.noConsole = true;
        if (params.network === false) adjustedParams.noNetwork = true;
        if (params.headless === false) adjustedParams.noHeadless = true;
        
        delete adjustedParams.console;
        delete adjustedParams.network;
        delete adjustedParams.headless;
        
        const commandArgs = buildCommandArgs(baseArgs, adjustedParams);
        return await runCursorTools(commandArgs);
    }
);

// --- Meta Tool: Set Working Directory ---
server.tool(
    'set_working_directory',
    z.object({
        directoryPath: z.string().describe("The absolute or relative path to set as the new working directory"),
    }).describe("Set the working directory for subsequent context-aware commands"),
    async ({ directoryPath }) => {
        const resolvedPath = path.resolve(currentWorkingDirectory, directoryPath); // Resolve relative to current CWD first
        try {
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
                const oldDirectory = currentWorkingDirectory;
                currentWorkingDirectory = resolvedPath; // Store the resolved absolute path
                debugLog(`Working directory changed from ${oldDirectory} to ${currentWorkingDirectory}`);
                return {
                    content: [{ type: 'text', text: `Working directory successfully set to: ${currentWorkingDirectory}` }]
                };
            } else {
                return {
                    content: [{ type: 'text', text: `Error: Path is not a directory: ${resolvedPath}` }],
                    isError: true
                };
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    content: [{ type: 'text', text: `Error: Directory not found: ${resolvedPath}` }],
                    isError: true
                };
            } else {
                debugLog(`Error setting working directory: ${error}`);
                return {
                    content: [{ type: 'text', text: `Error: Failed to set working directory: ${error.message}` }],
                    isError: true
                };
            }
        }
    }
);

// --- Start the Server with Stdio Transport ---
async function main() {
    process.stderr.write(`\n*** STARTING ${SERVER_NAME} v${SERVER_VERSION} ***\n`);
    process.stderr.write(`Default Workspace Root: ${DEFAULT_WORKSPACE_ROOT}\n`);
    process.stderr.write(`Initial Working Directory: ${currentWorkingDirectory}\n`);
    process.stderr.write(`Node version: ${process.version}\n`);

    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        process.stderr.write(`\n*** ${SERVER_NAME} CONNECTED VIA STDIO TRANSPORT AND READY ***\n`);
    } catch (err) {
        process.stderr.write(`Error during server startup: ${err}\n`);
        process.exit(1);
    }
}

// Execute main function if the script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        process.stderr.write(`Failed to start MCP server: ${err}\n`);
        process.exit(1);
    });
}

// Export server for potential testing
export default server;