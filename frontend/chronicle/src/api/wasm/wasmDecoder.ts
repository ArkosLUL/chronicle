/**
 * WASM-based protobuf decoder for benchmark comparison
 */

// Declare the global functions that WASM registers
declare global {
  interface Window {
    Go: new () => GoInstance;
    wasmDecodeDamage: (data: Uint8Array) => WasmDecodeResult;
    wasmDecodeDamageBenchmark: (data: Uint8Array) => WasmBenchmarkResult;
    wasmDecodeMinimal: (data: Uint8Array) => WasmMinimalResult;
  }
}

interface GoInstance {
  argv: string[];
  env: Record<string, string>;
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  run: (instance: WebAssembly.Instance) => Promise<void>;
}

export interface WasmDecodeResult {
  error?: string;
  events?: Array<{
    encounterID: string;
    index: number;
    offsetMilli: number;
    caster?: string;
    sourceName: string;
    target: string;
    hitType: number;
    amount: number;
    school: number;
  }>;
  count?: number;
}

export interface WasmBenchmarkResult {
  error?: string;
  events?: number;
  encounters?: number;
  decompressMs?: number;
  parseMs?: number;
  totalMs?: number;
  bytesProcessed?: number;
}

export interface WasmMinimalResult {
  error?: string;
  events?: number;
  encounters?: number;
  copyMs?: number;
  decompressMs?: number;
  iterateMs?: number;
  totalMs?: number;
  bytesProcessed?: number;
}

let wasmReady = false;
let wasmLoadingPromise: Promise<void> | null = null;

/**
 * Load the WASM module and initialize it
 */
export async function loadWasm(): Promise<void> {
  if (wasmReady) return;
  if (wasmLoadingPromise) return wasmLoadingPromise;

  wasmLoadingPromise = (async () => {
    // Load wasm_exec.js if not already loaded
    if (!window.Go) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/wasm_exec.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load wasm_exec.js"));
        document.head.appendChild(script);
      });
    }

    // Instantiate Go
    const go = new window.Go();

    // Fetch and instantiate the WASM module
    const result = await WebAssembly.instantiateStreaming(
      fetch("/chronicle.wasm"),
      go.importObject
    );

    // Run the Go program (this registers the global functions)
    go.run(result.instance);

    // Wait a tick for the functions to be registered
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (!window.wasmDecodeDamageBenchmark) {
      throw new Error("WASM module did not register expected functions");
    }

    wasmReady = true;
  })();

  return wasmLoadingPromise;
}

/**
 * Check if WASM is ready
 */
export function isWasmReady(): boolean {
  return wasmReady;
}

/**
 * Decode damage events using WASM (returns all events as JS objects)
 */
export async function wasmDecodeDamage(data: Uint8Array): Promise<WasmDecodeResult> {
  await loadWasm();
  return window.wasmDecodeDamage(data);
}

/**
 * Benchmark-only decode using WASM (no events returned, just timing)
 */
export async function wasmDecodeDamageBenchmark(data: Uint8Array): Promise<WasmBenchmarkResult> {
  await loadWasm();
  return window.wasmDecodeDamageBenchmark(data);
}

/**
 * Minimal decode - just iterate bytes without protobuf parsing (for overhead measurement)
 */
export async function wasmDecodeMinimal(data: Uint8Array): Promise<WasmMinimalResult> {
  await loadWasm();
  return window.wasmDecodeMinimal(data);
}
