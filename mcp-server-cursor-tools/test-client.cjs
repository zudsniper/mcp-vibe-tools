// Simple MCP client to test the server (CommonJS version)
const { spawn } = require('child_process');
const { createInterface } = require('readline');

// Simple test - spawn the server and send a manual MCP protocol message
function testServer() {
  console.log('Starting test client...');
  
  // Spawn the server process
  const serverProcess = spawn('node', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'] // pipe stdin/stdout/stderr so we can see all output
  });
  
  // Create interface to read stdout line by line
  const stdoutRl = createInterface({
    input: serverProcess.stdout,
    crlfDelay: Infinity
  });
  
  // Create interface to read stderr line by line
  const stderrRl = createInterface({
    input: serverProcess.stderr,
    crlfDelay: Infinity
  });

  // Track if we've sent a greeting yet
  let greetingSent = false;
  
  // Listen for stderr output (debug logs)
  stderrRl.on('line', (line) => {
    console.log('Server stderr:', line);
    
    // If we see the "CONNECTED" message and haven't sent greeting yet, send our greeting
    if (line.includes('CONNECTED VIA STDIO TRANSPORT AND READY') && !greetingSent) {
      greetingSent = true;
      setTimeout(() => {
        sendRawMessage({
          type: 'client_greeting',
          client_name: 'test-client',
          client_version: '1.0.0'
        });
      }, 500);
    }
  });
  
  // Listen for stdout output (MCP protocol)
  stdoutRl.on('line', (line) => {
    console.log('Server stdout (MCP):', line);
    
    try {
      // Try to parse as JSON
      const response = JSON.parse(line);
      console.log('Parsed MCP response:', JSON.stringify(response, null, 2));
      
      // If this was a greeting message, invoke the test tool
      if (response.type === 'greeting') {
        console.log('Server greeting received, invoking test tool...');
        
        // Send a test message to invoke the test tool
        sendRawMessage({
          type: 'invoke_tool',
          tool_name: 'test',
          params: {
            message: 'Hello from test client'
          },
          invoke_id: '123'
        });
      }
      
      // If we got a tool response, exit after a short delay
      if (response.type === 'tool_call_result' && response.invoke_id === '123') {
        console.log('Test successful! Exiting in 1 second...');
        setTimeout(() => {
          serverProcess.kill();
          process.exit(0);
        }, 1000);
      }
    } catch (err) {
      console.log('Non-JSON output or parse error:', err.message);
    }
  });
  
  // Helper function to send a raw message
  function sendRawMessage(message) {
    const messageStr = JSON.stringify(message);
    console.log('Sending message:', messageStr);
    serverProcess.stdin.write(messageStr + '\n');
  }
  
  // Set a timeout to ensure we don't hang indefinitely
  setTimeout(() => {
    console.log('Test timed out after 15 seconds. Trying direct tool call...');
    
    // Before giving up, try a direct tool call without waiting for greeting
    sendRawMessage({
      type: 'invoke_tool',
      tool_name: 'test',
      params: {
        message: 'Hello from test client - direct call'
      },
      invoke_id: '456'
    });
    
    setTimeout(() => {
      console.log('Final timeout. Exiting.');
      serverProcess.kill();
      process.exit(1);
    }, 5000);
  }, 15000);
  
  // Handle server exit
  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  // Handle errors
  serverProcess.on('error', (err) => {
    console.error('Error spawning server:', err);
  });
}

testServer(); 