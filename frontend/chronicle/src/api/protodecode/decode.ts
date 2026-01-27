import { type MessageShape, type DescMessage, fromBinary } from "@bufbuild/protobuf";

/**
 * Decodes a length-delimited stream of protobuf messages.
 * 
 * This matches the Go encoding from proto.Buffer.EncodeMessage(),
 * which writes each message as: varint(length) + message_bytes
 * 
 * @param schema - The protobuf message schema (e.g., DamageSchema)
 * @param data - The raw bytes containing concatenated length-delimited messages
 * @returns Array of decoded messages
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
 * Reads a varint from the buffer at the given offset.
 * Varints are base-128 encoded integers where the MSB indicates continuation.
 */
function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    bytesRead++;

    // Add the lower 7 bits to the value
    value |= (byte & 0x7f) << shift;
    shift += 7;

    // If MSB is 0, we're done
    if ((byte & 0x80) === 0) {
      return { value, bytesRead };
    }

    // Protect against overflow (varints shouldn't exceed 10 bytes for 64-bit)
    if (bytesRead > 10) {
      throw new Error("Varint too long");
    }
  }

  throw new Error("Unexpected end of data while reading varint");
}
