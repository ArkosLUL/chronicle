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

  console.log("=== DECODE PAYLOAD ===");
  console.log("First 64 bytes:", Array.from(data.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  // Read encounterID (length-prefixed string)
  const { value: strLen, bytesRead: strLenBytes } = readVarint(data, offset);
  console.log(`strLen=${strLen}, strLenBytes=${strLenBytes}, offset=${offset}`);
  offset += strLenBytes;
  const encounterID = new TextDecoder().decode(data.subarray(offset, offset + strLen));
  console.log(`encounterID="${encounterID}"`);
  offset += strLen;

  // Read firstTimestamp (varint, milliseconds since epoch)
  const { value: timestampMs, bytesRead: tsBytes } = readVarint64(data, offset);
  console.log(`timestampMs=${timestampMs}, tsBytes=${tsBytes}, offset=${offset}`);
  offset += tsBytes;
  const firstTimestamp = new Date(Number(timestampMs));

  // Read count (varint)
  const { value: count, bytesRead: countBytes } = readVarint(data, offset);
  console.log(`count=${count}, countBytes=${countBytes}, offset=${offset}`);
  offset += countBytes;

  console.log(`Header done. Messages start at offset ${offset}`);
  console.log("First message bytes:", Array.from(data.slice(offset, offset + 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  // Decode the messages, respecting the count from the header
  const messages = decodeDelimitedMessages(schema, data.subarray(offset), count);

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
  data: Uint8Array,
  maxCount?: number
): MessageShape<T>[] {
  const messages: MessageShape<T>[] = [];
  let offset = 0;
  let msgIndex = 0;

  while (offset < data.length && (maxCount === undefined || msgIndex < maxCount)) {
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
    
    try {
      const message = fromBinary(schema, messageBytes);
      messages.push(message);
    } catch (e) {
      console.error(`Failed at message ${msgIndex}, offset ${offset - bytesRead}, length ${length}`);
      console.error("Message bytes:", Array.from(messageBytes.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      throw e;
    }

    offset += length;
    msgIndex++;
  }

  console.log(`Decoded ${messages.length} messages`);
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
