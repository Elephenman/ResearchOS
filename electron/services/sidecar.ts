/**
 * ResearchOS - Python Sidecar Process Manager
 *
 * Manages the lifecycle of the Python FastAPI sidecar process.
 * The sidecar handles RAG operations (embedding, vector search, FTS5).
 */
import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';

const SIDECAR_PORT = 9527;
const SIDECAR_HOST = '127.0.0.1';
const SIDECAR_STARTUP_TIMEOUT = 30000; // 30 seconds

let sidecarProcess: ChildProcess | null = null;
let sidecarReady = false;

/**
 * Get the path to the Python sidecar entry point.
 */
function getSidecarPath(): string {
  // In development: sidecar/ directory next to electron/
  const devPath = path.join(__dirname, '..', 'sidecar', 'app', 'main.py');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // In production: sidecar bundled in resources/
  const prodPath = path.join(process.resourcesPath, 'sidecar', 'app', 'main.py');
  if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  return '';
}

/**
 * Get the Python executable path.
 */
function getPythonPath(): string {
  // 1. Bundled Python (future: embedded Python)
  const bundledPython = path.join(process.resourcesPath || '', 'python', 'python.exe');
  if (fs.existsSync(bundledPython)) {
    return bundledPython;
  }

  // 2. System Python
  return 'python';
}

/**
 * Check if the sidecar is already running by hitting the status endpoint.
 */
function checkSidecarHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${SIDECAR_HOST}:${SIDECAR_PORT}/`,
      { timeout: 3000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.status === 'running');
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Wait for the sidecar to become ready.
 */
async function waitForSidecar(maxWaitMs: number = SIDECAR_STARTUP_TIMEOUT): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (await checkSidecarHealth()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Start the Python sidecar process.
 */
export async function startSidecar(): Promise<boolean> {
  // Check if already running
  if (await checkSidecarHealth()) {
    console.log('[Sidecar] Already running on port', SIDECAR_PORT);
    sidecarReady = true;
    return true;
  }

  const sidecarPath = getSidecarPath();
  if (!sidecarPath) {
    console.warn('[Sidecar] No sidecar found. RAG features will be unavailable.');
    console.warn('[Sidecar] Install the sidecar: cd sidecar && pip install -r requirements.txt');
    return false;
  }

  const pythonPath = getPythonPath();
  const sidecarDir = path.dirname(path.dirname(sidecarPath)); // sidecar/

  console.log('[Sidecar] Starting...', pythonPath, sidecarPath);

  sidecarProcess = spawn(pythonPath, ['-m', 'app.main'], {
    cwd: sidecarDir,
    env: {
      ...process.env,
      SIDECAR_PORT: String(SIDECAR_PORT),
      SIDECAR_HOST: SIDECAR_HOST,
      SIDECAR_DB_PATH: path.join(app.getPath('userData'), 'rag.db'),
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  sidecarProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[Sidecar:out]', data.toString().trim());
  });

  sidecarProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Sidecar:err]', data.toString().trim());
  });

  sidecarProcess.on('exit', (code) => {
    console.log('[Sidecar] Process exited with code', code);
    sidecarProcess = null;
    sidecarReady = false;
  });

  sidecarProcess.on('error', (err) => {
    console.error('[Sidecar] Process error:', err.message);
    sidecarProcess = null;
    sidecarReady = false;
  });

  // Wait for startup
  const ready = await waitForSidecar();
  sidecarReady = ready;

  if (ready) {
    console.log('[Sidecar] Ready on port', SIDECAR_PORT);
  } else {
    console.warn('[Sidecar] Failed to start within timeout');
  }

  return ready;
}

/**
 * Stop the Python sidecar process.
 */
export async function stopSidecar(): Promise<void> {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM');
    // Wait briefly for clean exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        sidecarProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      sidecarProcess?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    sidecarProcess = null;
    sidecarReady = false;
  }
}

/**
 * Check if the sidecar is currently available.
 */
export function isSidecarReady(): boolean {
  return sidecarReady;
}

/**
 * Make an HTTP request to the sidecar.
 */
export function sidecarFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!sidecarReady) {
      reject(new Error('Sidecar is not running'));
      return;
    }

    const data = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: SIDECAR_HOST,
      port: SIDECAR_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json.detail || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Invalid JSON response: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Sidecar request timeout')); });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}
