/**
 * Worker pool for panel processing.
 * 
 * Reuses workers across panel reprocesses to avoid spawn overhead.
 * Workers are lightweight (just run processStreams) so a small pool works well.
 */

import type { WorkerRequest, WorkerResponse } from "./processorTypes";

// Singleton pool
let pooledWorker: Worker | null = null;
let pooledWorkerInUse = false;
let requestQueue: Array<{
  request: WorkerRequest;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Get a worker from the pool (creates one if needed).
 * Returns the worker and a release function to return it to the pool.
 */
export function getPooledWorker(): { 
  worker: Worker;
  release: () => void;
} {
  if (pooledWorker && !pooledWorkerInUse) {
    pooledWorkerInUse = true;
    return {
      worker: pooledWorker,
      release: () => {
        pooledWorkerInUse = false;
        processQueue();
      },
    };
  }
  
  // Create new worker if pool is empty
  const worker = new Worker(
    new URL('./panelWorker.ts', import.meta.url),
    { type: 'module' }
  );
  
  // If this is our first worker, pool it
  if (!pooledWorker) {
    pooledWorker = worker;
    pooledWorkerInUse = true;
    return {
      worker,
      release: () => {
        pooledWorkerInUse = false;
        processQueue();
      },
    };
  }
  
  // Extra worker (shouldn't happen often) - just let it be terminated
  return {
    worker,
    release: () => worker.terminate(),
  };
}

/**
 * Process queued requests when worker becomes available.
 */
function processQueue(): void {
  if (requestQueue.length === 0 || pooledWorkerInUse) return;
  
  const next = requestQueue.shift()!;
  executeRequest(next.request).then(next.resolve).catch(next.reject);
}

/**
 * Execute a request using the pooled worker.
 * Queues if worker is busy.
 */
export function executeRequest(request: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const { worker, release } = getPooledWorker();
    
    const handleMessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.requestId !== request.requestId) return;
      
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      release();
      resolve(e.data);
    };
    
    const handleError = (e: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      release();
      reject(new Error(e.message || 'Worker error'));
    };
    
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage(request);
  });
}

/**
 * Terminate all workers in the pool.
 * Call on page unload or when cleaning up.
 */
export function terminatePool(): void {
  if (pooledWorker) {
    pooledWorker.terminate();
    pooledWorker = null;
    pooledWorkerInUse = false;
  }
  requestQueue = [];
}
