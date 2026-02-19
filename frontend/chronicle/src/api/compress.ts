/**
 * Gzip compression utilities for file uploads.
 * Uses native browser CompressionStream API for efficient compression.
 */

/**
 * Compress a Uint8Array using gzip compression.
 */
export async function compressGzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Compress a File object and return a gzipped Blob.
 * The returned Blob has type "application/gzip".
 */
export async function compressFile(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const compressed = await compressGzip(new Uint8Array(arrayBuffer));
  return new Blob([compressed], { type: "application/gzip" });
}
