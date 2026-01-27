import { type MessageShape, type DescMessage, fromBinary } from "@bufbuild/protobuf";

/**
 * Header information from a Builder-encoded payload
 */
export interface PayloadHeader {
  encounterID: string;
  firstTimestamp: Date;
  count: number;
  dataLength: number;
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
export async function decompressGzip(data: Uint8Array<ArrayBufferLike>): Promise<Uint8Array<ArrayBuffer>> {
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

  // Read dataLength (varint) - expected bytes of message data
  const { value: dataLength, bytesRead: dataLenBytes } = readVarint(data, offset);
  console.log(`dataLength=${dataLength}, dataLenBytes=${dataLenBytes}, offset=${offset}`);
  offset += dataLenBytes;

  console.log(`Header done. Messages start at offset ${offset}`);
  console.log("First message bytes:", Array.from(data.slice(offset, offset + 64)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  // Decode the messages, respecting the count from the header
  const messages = decodeDelimitedMessages(schema, data.subarray(offset), count);

  return {
    header: {
      encounterID,
      firstTimestamp,
      count,
      dataLength,
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

// ============================================================================
// Stream Cursor - Lazy decoding with encounter-aware iteration
// ============================================================================

/**
 * A cursor for lazily iterating through a stream of encounters and messages.
 * Supports peeking at the next message and advancing through the stream.
 */
export class StreamCursor<T extends DescMessage> {
  private readonly schema: T;
  private readonly data: Uint8Array;
  private offset: number = 0;
  
  // Current encounter state
  private _currentHeader: PayloadHeader | null = null;
  private _messagesReadInEncounter: number = 0;
  private _peekedMessage: { message: MessageShape<T>; index: number; bytesConsumed: number } | null = null;
  
  // Progress tracking
  private _bytesProcessed: number = 0;
  
  constructor(schema: T, data: Uint8Array) {
    this.schema = schema;
    this.data = data;
    
    // Load first encounter header
    this._loadNextEncounterHeader();
  }
  
  /** Current encounter header, or null if no more encounters */
  get currentHeader(): PayloadHeader | null {
    return this._currentHeader;
  }
  
  /** Number of messages processed in current encounter */
  get messagesReadInEncounter(): number {
    return this._messagesReadInEncounter;
  }
  
  /** Total bytes processed so far */
  get bytesProcessed(): number {
    return this._bytesProcessed;
  }
  
  /** Total bytes in the stream */
  get bytesTotal(): number {
    return this.data.length;
  }
  
  /** Whether there are more messages in the current encounter */
  get hasMoreInEncounter(): boolean {
    if (!this._currentHeader) return false;
    return this._messagesReadInEncounter < this._currentHeader.count;
  }
  
  /** Whether there are more encounters after the current one */
  get hasMoreEncounters(): boolean {
    if (!this._currentHeader) return false;
    // Check if there's data beyond the current encounter
    const encounterEndOffset = this.offset + (this._currentHeader.dataLength - this._bytesInCurrentEncounter());
    return encounterEndOffset < this.data.length;
  }
  
  /**
   * Peek at the next message without consuming it.
   * Returns null if no more messages in current encounter.
   */
  peek(): { message: MessageShape<T>; index: number } | null {
    if (!this.hasMoreInEncounter) return null;
    
    if (!this._peekedMessage) {
      this._peekedMessage = this._decodeNextMessage();
    }
    
    if (!this._peekedMessage) return null;
    
    return {
      message: this._peekedMessage.message,
      index: this._peekedMessage.index,
    };
  }
  
  /**
   * Advance to the next message, consuming the current one.
   */
  advance(): void {
    if (!this._peekedMessage) {
      // Need to decode to know how many bytes to skip
      this._peekedMessage = this._decodeNextMessage();
    }
    
    if (this._peekedMessage) {
      this.offset += this._peekedMessage.bytesConsumed;
      this._bytesProcessed += this._peekedMessage.bytesConsumed;
      this._messagesReadInEncounter++;
      this._peekedMessage = null;
    }
  }
  
  /**
   * Move to the next encounter.
   * Returns true if there is another encounter, false if done.
   */
  nextEncounter(): boolean {
    if (!this._currentHeader) return false;
    
    // Skip remaining messages in current encounter if any
    while (this.hasMoreInEncounter) {
      this.advance();
    }
    
    // Try to load next header
    return this._loadNextEncounterHeader();
  }
  
  private _bytesInCurrentEncounter(): number {
    // Bytes read so far in current encounter's message data
    // This is tracked separately from offset since offset includes header
    return 0; // This is accounted for in _bytesProcessed
  }
  
  private _loadNextEncounterHeader(): boolean {
    if (this.offset >= this.data.length) {
      this._currentHeader = null;
      return false;
    }
    
    const startOffset = this.offset;
    
    // Read encounterID (length-prefixed string)
    const { value: strLen, bytesRead: strLenBytes } = readVarint(this.data, this.offset);
    this.offset += strLenBytes;
    const encounterID = new TextDecoder().decode(this.data.subarray(this.offset, this.offset + strLen));
    this.offset += strLen;
    
    // Read firstTimestamp (varint, milliseconds since epoch)
    const { value: timestampMs, bytesRead: tsBytes } = readVarint64(this.data, this.offset);
    this.offset += tsBytes;
    const firstTimestamp = new Date(Number(timestampMs));
    
    // Read count (varint)
    const { value: count, bytesRead: countBytes } = readVarint(this.data, this.offset);
    this.offset += countBytes;
    
    // Read dataLength (varint)
    const { value: dataLength, bytesRead: dataLenBytes } = readVarint(this.data, this.offset);
    this.offset += dataLenBytes;
    
    this._currentHeader = {
      encounterID,
      firstTimestamp,
      count,
      dataLength,
    };
    
    this._messagesReadInEncounter = 0;
    this._bytesProcessed += (this.offset - startOffset);
    
    return true;
  }
  
  private _decodeNextMessage(): { message: MessageShape<T>; index: number; bytesConsumed: number } | null {
    if (!this.hasMoreInEncounter) return null;
    
    // Read varint length prefix
    const { value: length, bytesRead } = readVarint(this.data, this.offset);
    const msgStart = this.offset + bytesRead;
    
    if (msgStart + length > this.data.length) {
      throw new Error(
        `Invalid length-delimited message: expected ${length} bytes at offset ${msgStart}, but only ${this.data.length - msgStart} remaining`
      );
    }
    
    const messageBytes = this.data.subarray(msgStart, msgStart + length);
    const message = fromBinary(this.schema, messageBytes);
    
    // Extract index from the message's meta field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (message as any).meta;
    const index = meta?.index ?? 0;
    
    return {
      message,
      index,
      bytesConsumed: bytesRead + length,
    };
  }
}

/**
 * Create a stream cursor for lazy iteration through encounters and messages.
 */
export function createStreamCursor<T extends DescMessage>(
  schema: T,
  data: Uint8Array
): StreamCursor<T> {
  return new StreamCursor(schema, data);
}

// ============================================================================
// Varint helpers (exported for use by cursor)
// ============================================================================

/**
 * Reads a varint (up to 32-bit) from the buffer at the given offset.
 */
export function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
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
export function readVarint64(data: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
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
