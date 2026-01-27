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
// Zero-allocation Damage decoder
// ============================================================================

/**
 * Reusable Damage message structure - mutated in place during decoding.
 * If the callback needs to keep data, it must copy what it needs.
 */
export interface ReusableDamage {
  index: number;
  offsetMilli: number;  // Use number instead of bigint for speed
  caster: string;
  sourceName: string;
  target: string;
  hitType: number;
  amount: number;
  school: number;
}

/**
 * A zero-allocation decoder for Damage messages.
 * Reuses a single object, mutating it for each decode.
 */
export class DamageDecoder {
  private readonly textDecoder = new TextDecoder();
  
  /** Reusable message - mutated on each decode */
  readonly message: ReusableDamage = {
    index: 0,
    offsetMilli: 0,
    caster: "",
    sourceName: "",
    target: "",
    hitType: 0,
    amount: 0,
    school: 0,
  };
  
  /**
   * Decode a Damage message into the reusable object.
   * Returns the same `this.message` reference, mutated.
   */
  decode(data: Uint8Array, offset: number, length: number): ReusableDamage {
    const end = offset + length;
    const msg = this.message;
    
    // Reset fields
    msg.index = 0;
    msg.offsetMilli = 0;
    msg.caster = "";
    msg.sourceName = "";
    msg.target = "";
    msg.hitType = 0;
    msg.amount = 0;
    msg.school = 0;
    
    while (offset < end) {
      const tag = data[offset++];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 0) {
        // Varint
        const { value, bytesRead } = readVarintFast(data, offset);
        offset += bytesRead;
        
        if (fieldNumber === 6) msg.hitType = value;
        else if (fieldNumber === 7) msg.amount = value;
        else if (fieldNumber === 8) msg.school = value;
      } else if (wireType === 2) {
        // Length-delimited
        const { value: len, bytesRead } = readVarintFast(data, offset);
        offset += bytesRead;
        
        if (fieldNumber === 1) {
          // EventMeta - decode nested
          const metaEnd = offset + len;
          while (offset < metaEnd) {
            const metaTag = data[offset++];
            const metaField = metaTag >> 3;
            const metaWire = metaTag & 0x7;
            
            if (metaWire === 0) {
              const { value, bytesRead } = readVarintFast(data, offset);
              offset += bytesRead;
              if (metaField === 1) msg.index = value;
              else if (metaField === 2) msg.offsetMilli = value;
            }
          }
        } else if (fieldNumber === 3) {
          msg.caster = this.textDecoder.decode(data.subarray(offset, offset + len));
          offset += len;
        } else if (fieldNumber === 4) {
          msg.sourceName = this.textDecoder.decode(data.subarray(offset, offset + len));
          offset += len;
        } else if (fieldNumber === 5) {
          msg.target = this.textDecoder.decode(data.subarray(offset, offset + len));
          offset += len;
        } else if (fieldNumber === 9) {
          // Tailers - skip for now (add if needed)
          offset += len;
        } else {
          offset += len;
        }
      }
    }
    
    return msg;
  }
}

/**
 * Fast varint reader - inline for speed, no object allocation for result
 */
function readVarintFast(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  
  // Unroll common cases (1-3 bytes)
  let byte = data[offset];
  if ((byte & 0x80) === 0) {
    return { value: byte, bytesRead: 1 };
  }
  value = byte & 0x7f;
  
  byte = data[offset + 1];
  if ((byte & 0x80) === 0) {
    return { value: value | (byte << 7), bytesRead: 2 };
  }
  value |= (byte & 0x7f) << 7;
  
  byte = data[offset + 2];
  if ((byte & 0x80) === 0) {
    return { value: value | (byte << 14), bytesRead: 3 };
  }
  value |= (byte & 0x7f) << 14;
  
  // Fallback for larger varints
  bytesRead = 3;
  shift = 21;
  while (offset + bytesRead < data.length) {
    byte = data[offset + bytesRead];
    bytesRead++;
    value |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
  }
  
  return { value, bytesRead };
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
// Fast Damage Cursor - Zero-allocation iteration
// ============================================================================

/**
 * A fast, zero-allocation cursor specifically for Damage messages.
 * Uses DamageDecoder internally and reuses memory.
 */
export class FastDamageCursor {
  private readonly data: Uint8Array;
  private readonly decoder = new DamageDecoder();
  private offset: number = 0;
  
  private _currentHeader: PayloadHeader | null = null;
  private _messagesReadInEncounter: number = 0;
  private _bytesProcessed: number = 0;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this._loadNextEncounterHeader();
  }
  
  get currentHeader(): PayloadHeader | null {
    return this._currentHeader;
  }
  
  get hasMoreInEncounter(): boolean {
    if (!this._currentHeader) return false;
    return this._messagesReadInEncounter < this._currentHeader.count;
  }
  
  get bytesProcessed(): number {
    return this._bytesProcessed;
  }
  
  get bytesTotal(): number {
    return this.data.length;
  }
  
  /**
   * Read the next message, returning the reusable message object.
   * Returns null if no more messages in current encounter.
   * WARNING: The returned object is reused - copy data if needed!
   */
  next(): ReusableDamage | null {
    if (!this.hasMoreInEncounter) return null;
    
    // Read length prefix
    const { value: length, bytesRead } = readVarint(this.data, this.offset);
    const msgStart = this.offset + bytesRead;
    
    // Decode into reusable message
    const msg = this.decoder.decode(this.data, msgStart, length);
    
    // Advance
    this.offset = msgStart + length;
    this._bytesProcessed += bytesRead + length;
    this._messagesReadInEncounter++;
    
    return msg;
  }
  
  /**
   * Move to the next encounter.
   */
  nextEncounter(): boolean {
    // Skip remaining messages in current encounter
    while (this.hasMoreInEncounter) {
      this.next();
    }
    return this._loadNextEncounterHeader();
  }
  
  private _loadNextEncounterHeader(): boolean {
    if (this.offset >= this.data.length) {
      this._currentHeader = null;
      return false;
    }
    
    const startOffset = this.offset;
    
    // Read encounterID
    const { value: strLen, bytesRead: strLenBytes } = readVarint(this.data, this.offset);
    this.offset += strLenBytes;
    const encounterID = new TextDecoder().decode(this.data.subarray(this.offset, this.offset + strLen));
    this.offset += strLen;
    
    // Read timestamp
    const { value: timestampMs, bytesRead: tsBytes } = readVarint64(this.data, this.offset);
    this.offset += tsBytes;
    
    // Read count
    const { value: count, bytesRead: countBytes } = readVarint(this.data, this.offset);
    this.offset += countBytes;
    
    // Read dataLength
    const { value: dataLength, bytesRead: dataLenBytes } = readVarint(this.data, this.offset);
    this.offset += dataLenBytes;
    
    this._currentHeader = {
      encounterID,
      firstTimestamp: new Date(Number(timestampMs)),
      count,
      dataLength,
    };
    
    this._messagesReadInEncounter = 0;
    this._bytesProcessed += (this.offset - startOffset);
    
    return true;
  }
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
