import { type MessageShape, type DescMessage, fromBinary } from "@bufbuild/protobuf";

/**
 * Header information from a Builder-encoded payload
 */
export interface PayloadHeader {
  encounterID: string;
  firstTimestamp: Date;
  count: number;
}

/**
 * Result from decoding a full payload with header
 */
export interface DecodedPayload<T> {
  header: PayloadHeader;
  messages: T[];
}

/**
 * Decompresses gzip data using the native DecompressionStream API.
 */
export async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Checks if data appears to be gzip compressed (magic bytes 0x1f 0x8b).
 */
export function isGzipped(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Decodes a full payload with header + length-delimited messages.
 * 
 * Header format (from Go Builder.Finalize):
 *   - EncodeStringBytes(encounterID) - varint length + string bytes
 *   - EncodeVarint(firstTimestamp.UnixMilli())
 *   - EncodeVarint(count)
 * 
 * Then concatenated length-delimited messages from AddToBuilder.
 */
export function decodePayload<T extends DescMessage>(
  schema: T,
  data: Uint8Array
): DecodedPayload<MessageShape<T>> {
  let offset = 0;

  // Read encounterID (length-prefixed string)
  const { value: strLen, bytesRead: strLenBytes } = readVarint(data, offset);
  offset += strLenBytes;
  const encounterID = new TextDecoder().decode(data.subarray(offset, offset + strLen));
  offset += strLen;

  // Read firstTimestamp (varint, milliseconds since epoch)
  const { value: timestampMs, bytesRead: tsBytes } = readVarint64(data, offset);
  offset += tsBytes;
  const firstTimestamp = new Date(Number(timestampMs));

  // Read count (varint)
  const { value: count, bytesRead: countBytes } = readVarint(data, offset);
  offset += countBytes;

  // Decode the messages
  const messages = decodeDelimitedMessages(schema, data.subarray(offset));

  return {
    header: {
      encounterID,
      firstTimestamp,
      count,
    },
    messages,
  };
}

/**
 * Decodes a length-delimited stream of protobuf messages (no header).
 * 
 * This matches the Go encoding from proto.Buffer.EncodeMessage(),
 * which writes each message as: varint(length) + message_bytes
 */
export function decodeDelimitedMessages<T extends DescMessage>(
  schema: T,
  data: Uint8Array
): MessageShape<T>[] {
  const messages: MessageShape<T>[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Read varint length prefix
    const { value: length, bytesRead } = readVarint(data, offset);
    offset += bytesRead;

    if (offset + length > data.length) {
      throw new Error(
        `Invalid length-delimited message: expected ${length} bytes at offset ${offset}, but only ${data.length - offset} remaining`
      );
    }

    // Extract message bytes and decode
    const messageBytes = data.subarray(offset, offset + length);
    const message = fromBinary(schema, messageBytes);
    messages.push(message);

    offset += length;
  }

  return messages;
}

/**
 * Reads a varint (up to 32-bit) from the buffer at the given offset.
 */
function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    bytesRead++;

    value |= (byte & 0x7f) << shift;
    shift += 7;

    if ((byte & 0x80) === 0) {
      return { value, bytesRead };
    }

    if (bytesRead > 5) {
      throw new Error("Varint too long for 32-bit value");
    }
  }

  throw new Error("Unexpected end of data while reading varint");
}

/**
 * Reads a varint (up to 64-bit) from the buffer, returns as bigint.
 */
function readVarint64(data: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  let value = 0n;
  let shift = 0n;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    bytesRead++;

    value |= BigInt(byte & 0x7f) << shift;
    shift += 7n;

    if ((byte & 0x80) === 0) {
      return { value, bytesRead };
    }

    if (bytesRead > 10) {
      throw new Error("Varint too long for 64-bit value");
    }
  }

  throw new Error("Unexpected end of data while reading varint");
}
