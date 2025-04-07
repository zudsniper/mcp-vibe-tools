const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // Import fs module
const app = express();
const port = process.env.PORT || 3000; // Allow port configuration via environment variable

app.use(express.json());

// Define the default workspace root - can be changed by set_working_directory
const DEFAULT_WORKSPACE_ROOT = '/Users/jason/mcp/mcp-vibe-tools';
let currentWorkingDirectory = DEFAULT_WORKSPACE_ROOT; // Mutable working directory

// Helper function to run cursor-tools command
// Removed default value for workingDir, it must be specified explicitly or default to process.cwd()
function runCursorTools(commandArgs, workingDir) {
    const cwd = workingDir || process.cwd(); // Default to server's CWD if not specified
    return new Promise((resolve, reject) => {
        console.log(`Executing: cursor-tools ${commandArgs.join(' ')} in ${cwd}`);
        const proc = spawn('cursor-tools', commandArgs, {
            cwd: cwd, // Use the determined working directory
            shell: true, // Use shell to handle paths and environment correctly
            env: { ...process.env } // Pass environment variables
        });

        let stdoutData = '';
        let stderrData = '';

        proc.stdout.on('data', (data) => {
            stdoutData += data.toString();
            console.log(`stdout: ${data}`);
        });

        proc.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error(`stderr: ${data}`);
        });

        proc.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            if (code === 0) {
                resolve({ success: true, output: stdoutData });
            } else {
                // Include stderr in the rejection for better debugging
                reject({ success: false, error: `Command failed with code ${code}`, stdout: stdoutData, stderr: stderrData });
            }
        });

        proc.on('error', (err) => {
            console.error('Failed to start subprocess.', err);
            reject({ success: false, error: 'Failed to start subprocess', details: err });
        });
    });
}

// --- MCP Tool Definitions ---

// 1. ask
app.post('/mcp/tools/ask', async (req, res) => {
    const {
        query, // required
        provider,
        model,
        reasoning_effort,
        max_tokens,
        save_to
        // Add any other relevant params from your detailed plan
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['ask', `"${query}"`]; // Ensure query is quoted

    if (provider) commandArgs.push(`--provider=${provider}`);
    if (model) commandArgs.push(`--model=${model}`); // ask requires model
    if (reasoning_effort) commandArgs.push(`--reasoning-effort=${reasoning_effort}`);
    if (max_tokens) commandArgs.push(`--max-tokens=${max_tokens}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`); // Resolve save_to path relative to *current* working dir

    try {
        // 'ask' doesn't strictly need workspace context, run from server's CWD
        const result = await runCursorTools(commandArgs); // No workingDir specified, defaults to process.cwd()
        res.json(result);
    } catch (error) {
        console.error("Error executing 'ask' command:", error);
        // Send back detailed error info from the catch block
        res.status(500).json({
             success: false,
             error: error.error || 'Internal Server Error',
             stdout: error.stdout,
             stderr: error.stderr,
             details: error.details
         });
    }
});

// 2. plan
app.post('/mcp/tools/plan', async (req, res) => {
    const {
        query, // required
        fileProvider,
        thinkingProvider,
        fileModel,
        thinkingModel,
        fileMaxTokens,
        thinkingMaxTokens,
        save_to
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['plan', `"${query}"`];

    if (fileProvider) commandArgs.push(`--fileProvider=${fileProvider}`);
    if (thinkingProvider) commandArgs.push(`--thinkingProvider=${thinkingProvider}`);
    if (fileModel) commandArgs.push(`--fileModel=${fileModel}`);
    if (thinkingModel) commandArgs.push(`--thinkingModel=${thinkingModel}`);
    if (fileMaxTokens) commandArgs.push(`--fileMaxTokens=${fileMaxTokens}`);
    if (thinkingMaxTokens) commandArgs.push(`--thinkingMaxTokens=${thinkingMaxTokens}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // 'plan' requires workspace context
        const result = await runCursorTools(commandArgs, currentWorkingDirectory); // Use currentWorkingDirectory
        res.json(result);
    } catch (error) {
        console.error("Error executing 'plan' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 3. web
app.post('/mcp/tools/web', async (req, res) => {
    const {
        query, // required
        provider,
        model,
        max_tokens,
        save_to
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['web', `"${query}"`];

    if (provider) commandArgs.push(`--provider=${provider}`);
    if (model) commandArgs.push(`--model=${model}`);
    if (max_tokens) commandArgs.push(`--max-tokens=${max_tokens}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // 'web' doesn't strictly need workspace context
        const result = await runCursorTools(commandArgs); // No workingDir specified
        res.json(result);
    } catch (error) {
        console.error("Error executing 'web' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 4. repo
app.post('/mcp/tools/repo', async (req, res) => {
    const {
        query, // required
        subdir,
        from_github,
        provider,
        model,
        max_tokens,
        save_to
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['repo', `"${query}"`];

    if (subdir) commandArgs.push(`--subdir=${subdir}`); // subdir is relative to WORKSPACE_ROOT if not using from_github
    if (from_github) commandArgs.push(`--from-github=${from_github}`);
    if (provider) commandArgs.push(`--provider=${provider}`);
    if (model) commandArgs.push(`--model=${model}`);
    if (max_tokens) commandArgs.push(`--max-tokens=${max_tokens}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // 'repo' requires workspace context unless --from-github is used
        const executionDir = from_github ? process.cwd() : currentWorkingDirectory; // Use currentWorkingDirectory if local
        const result = await runCursorTools(commandArgs, executionDir);
        res.json(result);
    } catch (error) {
        console.error("Error executing 'repo' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 5. doc
app.post('/mcp/tools/doc', async (req, res) => {
    const {
        from_github,
        provider,
        model,
        max_tokens,
        hint,
        save_to // Required according to docs
    } = req.body;

    // Note: 'doc' command itself might not require a query parameter unlike others,
    // but it does require outputting to a file (implicitly or via save_to).
    // We enforce save_to for clarity in the MCP tool.
    if (!save_to) {
        return res.status(400).json({ success: false, error: "Missing required parameter: save_to" });
    }

    const commandArgs = ['doc'];

    if (from_github) commandArgs.push(`--from-github=${from_github}`);
    if (provider) commandArgs.push(`--provider=${provider}`);
    if (model) commandArgs.push(`--model=${model}`);
    if (max_tokens) commandArgs.push(`--max-tokens=${max_tokens}`);
    if (hint) commandArgs.push(`--hint="${hint}"`); // Quote hint
    commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`); // Always resolve save_to path relative to current dir

    try {
        // 'doc' requires workspace context unless --from-github is used
        const executionDir = from_github ? process.cwd() : currentWorkingDirectory; // Use currentWorkingDirectory if local
        const result = await runCursorTools(commandArgs, executionDir);
        // Since output goes to file, maybe return file path or confirmation?
        // For now, return the process output which might indicate success/failure.
        res.json({ ...result, savedToFile: path.resolve(currentWorkingDirectory, save_to) });
    } catch (error) {
        console.error("Error executing 'doc' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 6. youtube
app.post('/mcp/tools/youtube', async (req, res) => {
    const {
        url, // required
        question,
        type, // enum: summary|transcript|plan|review|custom
        save_to
    } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: "Missing required parameter: url" });
    }

    const commandArgs = ['youtube', `"${url}"`];

    if (question) commandArgs.push(`"${question}"`); // Positional argument, quote it
    if (type) commandArgs.push(`--type=${type}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // 'youtube' doesn't need specific workspace context
        const result = await runCursorTools(commandArgs); // No workingDir specified
        res.json(result);
    } catch (error) {
        console.error("Error executing 'youtube' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 7. github pr
app.post('/mcp/tools/github/pr', async (req, res) => {
    const {
        number,
        from_github,
        save_to
    } = req.body;

    const commandArgs = ['github', 'pr'];

    if (number) commandArgs.push(number.toString()); // Positional argument
    if (from_github) commandArgs.push(`--from-github=${from_github}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // Requires workspace context unless --from-github is used
        const executionDir = from_github ? process.cwd() : currentWorkingDirectory; // Use currentWorkingDirectory if local
        const result = await runCursorTools(commandArgs, executionDir);
        res.json(result);
    } catch (error) {
        console.error("Error executing 'github pr' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 8. github issue
app.post('/mcp/tools/github/issue', async (req, res) => {
    const {
        number,
        from_github,
        save_to
    } = req.body;

    const commandArgs = ['github', 'issue'];

    if (number) commandArgs.push(number.toString()); // Positional argument
    if (from_github) commandArgs.push(`--from-github=${from_github}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // Requires workspace context unless --from-github is used
        const executionDir = from_github ? process.cwd() : currentWorkingDirectory; // Use currentWorkingDirectory if local
        const result = await runCursorTools(commandArgs, executionDir);
        res.json(result);
    } catch (error) {
        console.error("Error executing 'github issue' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 9. clickup task
app.post('/mcp/tools/clickup/task', async (req, res) => {
    const {
        task_id, // required
        save_to
    } = req.body;

    if (!task_id) {
        return res.status(400).json({ success: false, error: "Missing required parameter: task_id" });
    }

    const commandArgs = ['clickup', 'task', task_id]; // task_id is positional

    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // 'clickup' doesn't need specific workspace context
        const result = await runCursorTools(commandArgs); // No workingDir specified
        res.json(result);
    } catch (error) {
        console.error("Error executing 'clickup task' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 10. mcp search
app.post('/mcp/tools/mcp/search', async (req, res) => {
    const {
        query, // required
        provider,
        save_to
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['mcp', 'search', `"${query}"`];

    if (provider) commandArgs.push(`--provider=${provider}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        const result = await runCursorTools(commandArgs); // No workingDir specified
        res.json(result);
    } catch (error) {
        console.error("Error executing 'mcp search' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 11. mcp run
app.post('/mcp/tools/mcp/run', async (req, res) => {
    const {
        query, // required
        provider,
        save_to
    } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: "Missing required parameter: query" });
    }

    const commandArgs = ['mcp', 'run', `"${query}"`];

    if (provider) commandArgs.push(`--provider=${provider}`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        const result = await runCursorTools(commandArgs); // No workingDir specified
        res.json(result);
    } catch (error) {
        console.error("Error executing 'mcp run' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// Helper function for browser act/observe/extract commands
async function handleBrowserAction(commandType, req, res) {
    const {
        instruction, // required
        url, // required
        html, // boolean
        console: captureConsole, // boolean
        network, // boolean
        screenshot,
        timeout,
        viewport,
        headless, // boolean
        connect_to,
        wait,
        video,
        evaluate,
        save_to
    } = req.body;

    if (!instruction) {
        return res.status(400).json({ success: false, error: `Missing required parameter: instruction for ${commandType}` });
    }
    if (!url) {
        return res.status(400).json({ success: false, error: `Missing required parameter: url for ${commandType}` });
    }

    // URL is handled via --url option for these commands, instruction is positional
    const commandArgs = ['browser', commandType, `"${instruction}"`, `--url="${url}"`];

    if (html === true) commandArgs.push('--html');
    if (captureConsole === false) commandArgs.push('--no-console');
    if (network === false) commandArgs.push('--no-network');
    if (screenshot) commandArgs.push(`--screenshot=${path.resolve(currentWorkingDirectory, screenshot)}`);
    if (timeout) commandArgs.push(`--timeout=${timeout}`);
    if (viewport) commandArgs.push(`--viewport=${viewport}`);
    if (headless === false) commandArgs.push('--no-headless');
    if (connect_to) commandArgs.push(`--connect-to=${connect_to}`);
    if (wait) commandArgs.push(`--wait="${wait}"`);
    if (video) commandArgs.push(`--video=${path.resolve(currentWorkingDirectory, video)}`);
    if (evaluate) commandArgs.push(`--evaluate="${evaluate}"`);
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        const result = await runCursorTools(commandArgs); // Browser commands don't typically need specific workspace CWD
        res.json(result);
    } catch (error) {
        console.error(`Error executing 'browser ${commandType}' command:`, error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
}

// 13. browser act
app.post('/mcp/tools/browser/act', async (req, res) => {
    await handleBrowserAction('act', req, res);
});

// 14. browser observe
app.post('/mcp/tools/browser/observe', async (req, res) => {
    await handleBrowserAction('observe', req, res);
});

// 15. browser extract
app.post('/mcp/tools/browser/extract', async (req, res) => {
    await handleBrowserAction('extract', req, res);
});

// 16. xcode build
app.post('/mcp/tools/xcode/build', async (req, res) => {
    const {
        buildPath,
        destination,
        save_to
    } = req.body;

    const commandArgs = ['xcode', 'build'];

    if (buildPath) commandArgs.push(`buildPath=${path.resolve(currentWorkingDirectory, buildPath)}`); // Resolve buildPath relative to current CWD
    if (destination) commandArgs.push(`destination="${destination}"`); // Quote destination
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // Xcode commands require workspace context
        const result = await runCursorTools(commandArgs, currentWorkingDirectory); // Use currentWorkingDirectory
        res.json(result);
    } catch (error) {
        console.error("Error executing 'xcode build' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 17. xcode run
app.post('/mcp/tools/xcode/run', async (req, res) => {
    const {
        destination,
        save_to
    } = req.body;

    const commandArgs = ['xcode', 'run'];

    if (destination) commandArgs.push(`destination="${destination}"`); // Quote destination
    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // Xcode commands require workspace context
        const result = await runCursorTools(commandArgs, currentWorkingDirectory); // Use currentWorkingDirectory
        res.json(result);
    } catch (error) {
        console.error("Error executing 'xcode run' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// 18. xcode lint
app.post('/mcp/tools/xcode/lint', async (req, res) => {
    const {
        save_to
    } = req.body;

    const commandArgs = ['xcode', 'lint'];

    if (save_to) commandArgs.push(`--save-to=${path.resolve(currentWorkingDirectory, save_to)}`);

    try {
        // Xcode commands require workspace context
        const result = await runCursorTools(commandArgs, currentWorkingDirectory); // Use currentWorkingDirectory
        res.json(result);
    } catch (error) {
        console.error("Error executing 'xcode lint' command:", error);
        res.status(500).json({
            success: false,
            error: error.error || 'Internal Server Error',
            stdout: error.stdout,
            stderr: error.stderr,
            details: error.details
        });
    }
});

// --- NEW Meta Tool: Set Working Directory ---
app.post('/mcp/tools/set_working_directory', (req, res) => {
    const { directoryPath } = req.body;

    if (!directoryPath) {
        return res.status(400).json({ success: false, error: "Missing required parameter: directoryPath" });
    }

    try {
        // Check if path exists and is a directory
        const stats = fs.statSync(directoryPath);
        if (stats.isDirectory()) {
            const oldDirectory = currentWorkingDirectory;
            currentWorkingDirectory = path.resolve(directoryPath); // Store the absolute path
            console.log(`Working directory changed from ${oldDirectory} to ${currentWorkingDirectory}`);
            res.json({ success: true, message: `Working directory set to: ${currentWorkingDirectory}` });
        } else {
            res.status(400).json({ success: false, error: `Path is not a directory: ${directoryPath}` });
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, error: `Directory not found: ${directoryPath}` });
        } else {
            console.error("Error setting working directory:", error);
            res.status(500).json({ success: false, error: `Failed to set working directory: ${error.message}` });
        }
    }
});

// --- Server Start ---
// Only start listening if the script is run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`MCP Server for cursor-tools listening on port ${port}`);
        console.log(`Default Workspace Root: ${DEFAULT_WORKSPACE_ROOT}`);
        console.log(`Initial Working Directory: ${currentWorkingDirectory}`); // Log initial CWD
        // Log available environment variables that cursor-tools might need (optional, for debugging)
        console.log("Checking required ENV variables:");
        ['PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_TOKEN', 'CLICKUP_API_TOKEN'].forEach(key => {
            console.log(`  ${key}: ${process.env[key] ? 'Set' : 'Not Set'}`);
        });
    });
}

// Basic root endpoint for health check or info
app.get('/', (req, res) => {
    res.send(`MCP Server for cursor-tools is running.\nCurrent Working Directory: ${currentWorkingDirectory}`); // Show current CWD
});

// Export the app for testing
module.exports = app; 