const request = require('supertest');
const app = require('./server'); // Import the exported app
const { spawn } = require('child_process');
const path = require('path');

// Define the expected workspace root for path assertions
const WORKSPACE_ROOT = '/Users/jason/mcp/mcp-vibe-tools';

// Mock the child_process.spawn function
jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

// Helper to simulate spawn success
function mockSpawnSuccess(stdout = 'Success') {
    const mockProcess = {
        stdout: {
            on: jest.fn((event, cb) => {
                if (event === 'data') process.nextTick(() => cb(stdout));
            }),
        },
        stderr: {
            on: jest.fn(),
        },
        on: jest.fn((event, cb) => {
            if (event === 'close') process.nextTick(() => cb(0)); // Simulate successful exit code 0
        }),
    };
    spawn.mockReturnValue(mockProcess);
    return mockProcess;
}

// Helper to simulate spawn failure
function mockSpawnFailure(code = 1, stderr = 'Error', stdout = '') {
    const mockProcess = {
        stdout: {
            on: jest.fn((event, cb) => {
                if (event === 'data') process.nextTick(() => cb(stdout));
            }),
        },
        stderr: {
            on: jest.fn((event, cb) => {
                if (event === 'data') process.nextTick(() => cb(stderr));
            }),
        },
        on: jest.fn((event, cb) => {
            if (event === 'close') process.nextTick(() => cb(code)); // Simulate error exit code
            if (event === 'error') process.nextTick(() => cb(new Error(stderr))); // Simulate spawn error
        }),
    };
    spawn.mockReturnValue(mockProcess);
    return mockProcess;
}

describe('MCP Server API', () => {
    beforeEach(() => {
        // Reset mocks before each test
        spawn.mockClear();
    });

    // --- Tests for /mcp/tools/ask ---
    describe('POST /mcp/tools/ask', () => {
        it('should call cursor-tools ask with query and model', async () => {
            mockSpawnSuccess();
            const response = await request(app)
                .post('/mcp/tools/ask')
                .send({ query: 'test query', model: 'test-model', provider: 'test-provider' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true, output: 'Success' });
            expect(spawn).toHaveBeenCalledTimes(1);
            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'ask',
                '"test query"',
                '--provider=test-provider',
                '--model=test-model'
            ], expect.anything()); // Ignore options for simplicity here
        });

        it('should handle missing query parameter', async () => {
            const response = await request(app)
                .post('/mcp/tools/ask')
                .send({ model: 'test-model' }); // Missing query

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ success: false, error: 'Missing required parameter: query' });
            expect(spawn).not.toHaveBeenCalled();
        });

        it('should handle spawn failure', async () => {
            mockSpawnFailure(1, 'Ask failed');
            const response = await request(app)
                .post('/mcp/tools/ask')
                .send({ query: 'test query', model: 'test-model' });

            expect(response.status).toBe(500);
            expect(response.body).toMatchObject({ success: false, error: 'Command failed with code 1', stderr: 'Ask failed' });
        });

        it('should resolve save_to path correctly', async () => {
            mockSpawnSuccess();
            const savePath = 'output/ask_result.txt';
            await request(app)
                .post('/mcp/tools/ask')
                .send({ query: 'save test', model: 'test-save', save_to: savePath });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'ask',
                '"save test"',
                '--model=test-save',
                `--save-to=${path.resolve(WORKSPACE_ROOT, savePath)}`
            ], expect.anything());
        });
    });

    // --- Tests for /mcp/tools/plan ---
    describe('POST /mcp/tools/plan', () => {
        it('should call cursor-tools plan with query and execute in WORKSPACE_ROOT', async () => {
            mockSpawnSuccess();
            const response = await request(app)
                .post('/mcp/tools/plan')
                .send({ query: 'plan query' });

            expect(response.status).toBe(200);
            expect(spawn).toHaveBeenCalledTimes(1);
            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'plan',
                '"plan query"'
            ], {
                cwd: WORKSPACE_ROOT, // Check execution directory
                shell: true,
                env: expect.anything()
            });
        });

        it('should handle missing query parameter', async () => {
            const response = await request(app)
                .post('/mcp/tools/plan')
                .send({});
            expect(response.status).toBe(400);
            expect(spawn).not.toHaveBeenCalled();
        });
    });

    // --- Tests for /mcp/tools/repo ---
    describe('POST /mcp/tools/repo', () => {
        it('should execute in WORKSPACE_ROOT by default', async () => {
            mockSpawnSuccess();
            await request(app)
                .post('/mcp/tools/repo')
                .send({ query: 'repo query' });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'repo',
                '"repo query"'
            ], expect.objectContaining({ cwd: WORKSPACE_ROOT }));
        });

        it('should execute in process.cwd() when from_github is provided', async () => {
            mockSpawnSuccess();
            await request(app)
                .post('/mcp/tools/repo')
                .send({ query: 'repo query', from_github: 'user/repo' });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'repo',
                '"repo query"',
                '--from-github=user/repo'
            ], expect.objectContaining({ cwd: process.cwd() })); // Check execution directory
        });
    });

    // --- Tests for /mcp/tools/doc ---
    describe('POST /mcp/tools/doc', () => {
        it('should require save_to parameter', async () => {
            const response = await request(app)
                .post('/mcp/tools/doc')
                .send({}); // Missing save_to
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing required parameter: save_to');
            expect(spawn).not.toHaveBeenCalled();
        });

        it('should execute in WORKSPACE_ROOT by default and quote hint', async () => {
            mockSpawnSuccess();
            const savePath = 'docs/doc.md';
            await request(app)
                .post('/mcp/tools/doc')
                .send({ save_to: savePath, hint: 'test hint' });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'doc',
                '--hint="test hint"',
                `--save-to=${path.resolve(WORKSPACE_ROOT, savePath)}`
            ], expect.objectContaining({ cwd: WORKSPACE_ROOT }));
        });
    });

    // --- Tests for /mcp/tools/browser/act ---
    describe('POST /mcp/tools/browser/act', () => {
        it('should call browser act with instruction and url', async () => {
            mockSpawnSuccess();
            const instruction = "Click Login";
            const url = "https://example.com";
            await request(app)
                .post('/mcp/tools/browser/act')
                .send({ instruction, url, headless: false, screenshot: 'login.png' });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'browser',
                'act',
                `"${instruction}"`,
                `--url="${url}"`,
                `--screenshot=${path.resolve(WORKSPACE_ROOT, 'login.png')}`,
                '--no-headless'
            ], expect.anything());
        });

        it('should handle missing instruction or url', async () => {
            let response = await request(app).post('/mcp/tools/browser/act').send({ url: 'test' });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Missing required parameter: instruction');

            response = await request(app).post('/mcp/tools/browser/act').send({ instruction: 'test' });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Missing required parameter: url');
        });
    });

     // --- Tests for /mcp/tools/xcode/build ---
     describe('POST /mcp/tools/xcode/build', () => {
        it('should call xcode build and quote destination', async () => {
            mockSpawnSuccess();
            const destination = 'platform=iOS Simulator,name=iPhone 15';
            await request(app)
                .post('/mcp/tools/xcode/build')
                .send({ destination, buildPath: 'custom_build' });

            expect(spawn).toHaveBeenCalledWith('cursor-tools', [
                'xcode',
                'build',
                'buildPath=custom_build',
                `destination="${destination}"`
            ], expect.objectContaining({ cwd: WORKSPACE_ROOT }));
        });
    });

    // --- Test root endpoint ---
    describe('GET /', () => {
        it('should return running status', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.text).toBe('MCP Server for cursor-tools is running.');
        });
    });
}); 