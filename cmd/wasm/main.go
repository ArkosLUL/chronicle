//go:build js && wasm

package main

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"syscall/js"
	"time"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"google.golang.org/protobuf/proto"
)

func main() {
	// Register functions
	js.Global().Set("wasmDecodeDamage", js.FuncOf(decodeDamage))
	js.Global().Set("wasmDecodeDamageBenchmark", js.FuncOf(decodeDamageBenchmark))
	js.Global().Set("wasmDecodeMinimal", js.FuncOf(decodeMinimal))

	// Keep the program running
	select {}
}

// readVarint reads a varint from data at offset, returns value and bytes read
func readVarint(data []byte, offset int) (uint64, int) {
	var result uint64
	var shift uint
	bytesRead := 0

	for i := offset; i < len(data); i++ {
		b := data[i]
		bytesRead++
		result |= uint64(b&0x7F) << shift

		if b < 0x80 {
			break
		}
		shift += 7
	}

	return result, bytesRead
}

// EncounterHeader represents parsed header info
type EncounterHeader struct {
	EncounterID    string
	TimestampMilli int64
	Count          int
	DataLength     int
}

// parseHeader parses one encounter header from the stream
func parseHeader(data []byte, offset int) (EncounterHeader, int, error) {
	start := offset

	// Read encounterID length (varint)
	strLen, n := readVarint(data, offset)
	offset += n

	// Read encounterID string
	if offset+int(strLen) > len(data) {
		return EncounterHeader{}, 0, fmt.Errorf("encounterID out of bounds")
	}
	encounterID := string(data[offset : offset+int(strLen)])
	offset += int(strLen)

	// Read timestamp (varint, milliseconds)
	timestampMs, n := readVarint(data, offset)
	offset += n

	// Read count (varint)
	count, n := readVarint(data, offset)
	offset += n

	// Read dataLength (varint)
	dataLength, n := readVarint(data, offset)
	offset += n

	return EncounterHeader{
		EncounterID:    encounterID,
		TimestampMilli: int64(timestampMs),
		Count:          int(count),
		DataLength:     int(dataLength),
	}, offset - start, nil
}

// decodeDamageBenchmark decodes all damage events and returns timing + count
// This is for pure benchmarking - no data returned to JS
func decodeDamageBenchmark(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "missing data argument"}
	}

	// Get the Uint8Array from JS
	jsData := args[0]
	length := jsData.Get("length").Int()
	data := make([]byte, length)
	js.CopyBytesToGo(data, jsData)

	start := time.Now()

	// Decompress if gzipped
	if len(data) >= 2 && data[0] == 0x1f && data[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip error: %v", err)}
		}
		data, err = io.ReadAll(gr)
		gr.Close()
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip read error: %v", err)}
		}
	}

	decompressTime := time.Since(start)

	// Parse all encounters
	offset := 0
	totalEvents := 0
	encounters := 0

	parseStart := time.Now()

	for offset < len(data) {
		header, headerBytes, err := parseHeader(data, offset)
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("header parse error at %d: %v", offset, err)}
		}
		offset += headerBytes
		encounters++

		// Decode all messages in this encounter
		msgEnd := offset + header.DataLength
		for offset < msgEnd {
			// Read message length (varint)
			msgLen, n := readVarint(data, offset)
			offset += n

			if offset+int(msgLen) > msgEnd {
				return map[string]any{"error": "message extends past encounter boundary"}
			}

			// Decode the protobuf message
			msg := &chronicleproto.Damage{}
			if err := proto.Unmarshal(data[offset:offset+int(msgLen)], msg); err != nil {
				return map[string]any{"error": fmt.Sprintf("proto unmarshal error: %v", err)}
			}
			offset += int(msgLen)
			totalEvents++
		}
	}

	parseTime := time.Since(parseStart)
	totalTime := time.Since(start)

	return map[string]any{
		"events":         totalEvents,
		"encounters":     encounters,
		"decompressMs":   decompressTime.Seconds() * 1000,
		"parseMs":        parseTime.Seconds() * 1000,
		"totalMs":        totalTime.Seconds() * 1000,
		"bytesProcessed": len(data),
	}
}

// decodeDamage decodes all damage events and returns them as JS objects
// This is slower due to JS object creation overhead
func decodeDamage(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "missing data argument"}
	}

	// Get the Uint8Array from JS
	jsData := args[0]
	length := jsData.Get("length").Int()
	data := make([]byte, length)
	js.CopyBytesToGo(data, jsData)

	// Decompress if gzipped
	if len(data) >= 2 && data[0] == 0x1f && data[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip error: %v", err)}
		}
		var buf bytes.Buffer
		if _, err := io.Copy(&buf, gr); err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip read error: %v", err)}
		}
		gr.Close()
		data = buf.Bytes()
	}

	// Parse all encounters
	offset := 0
	var allEvents []any

	for offset < len(data) {
		header, headerBytes, err := parseHeader(data, offset)
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("header parse error: %v", err)}
		}
		offset += headerBytes

		// Decode all messages in this encounter
		msgEnd := offset + header.DataLength
		for offset < msgEnd {
			// Read message length (varint)
			msgLen, n := readVarint(data, offset)
			offset += n

			// Decode the protobuf message
			msg := &chronicleproto.Damage{}
			if err := proto.Unmarshal(data[offset:offset+int(msgLen)], msg); err != nil {
				return map[string]any{"error": fmt.Sprintf("proto unmarshal error: %v", err)}
			}
			offset += int(msgLen)

			// Convert to JS-friendly map
			event := map[string]any{
				"encounterID": header.EncounterID,
				"index":       msg.Meta.Index,
				"offsetMilli": msg.Meta.OffsetMilli,
				"sourceName":  msg.SourceName,
				"target":      msg.Target,
				"hitType":     msg.HitType,
				"amount":      msg.Amount,
				"school":      int(msg.School),
			}
			if msg.Caster != nil {
				event["caster"] = *msg.Caster
			}
			allEvents = append(allEvents, event)
		}
	}

	return map[string]any{
		"events": allEvents,
		"count":  len(allEvents),
	}
}
// decodeMinimal does minimal processing - just iterates through bytes without protobuf parsing
// This isolates the overhead of: JS→WASM copy, gzip decompression, and byte iteration
func decodeMinimal(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{"error": "missing data argument"}
	}

	// Get the Uint8Array from JS
	jsData := args[0]
	length := jsData.Get("length").Int()
	data := make([]byte, length)

	copyStart := time.Now()
	js.CopyBytesToGo(data, jsData)
	copyTime := time.Since(copyStart)

	start := time.Now()

	// Decompress if gzipped
	if len(data) >= 2 && data[0] == 0x1f && data[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip error: %v", err)}
		}
		data, err = io.ReadAll(gr)
		gr.Close()
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("gzip read error: %v", err)}
		}
	}

	decompressTime := time.Since(start)

	// Parse all encounters - just skip through, no protobuf parsing
	offset := 0
	totalEvents := 0
	encounters := 0

	iterateStart := time.Now()

	for offset < len(data) {
		header, headerBytes, err := parseHeader(data, offset)
		if err != nil {
			return map[string]any{"error": fmt.Sprintf("header parse error at %d: %v", offset, err)}
		}
		offset += headerBytes
		encounters++

		// Just iterate through message lengths without parsing protobuf
		msgEnd := offset + header.DataLength
		for offset < msgEnd {
			// Read message length (varint)
			msgLen, n := readVarint(data, offset)
			offset += n

			if offset+int(msgLen) > msgEnd {
				return map[string]any{"error": "message extends past encounter boundary"}
			}

			// Skip the message data entirely - no protobuf parsing
			offset += int(msgLen)
			totalEvents++
		}
	}

	iterateTime := time.Since(iterateStart)
	totalTime := time.Since(start)

	return map[string]any{
		"events":         totalEvents,
		"encounters":     encounters,
		"copyMs":         copyTime.Seconds() * 1000,
		"decompressMs":   decompressTime.Seconds() * 1000,
		"iterateMs":      iterateTime.Seconds() * 1000,
		"totalMs":        totalTime.Seconds() * 1000,
		"bytesProcessed": len(data),
	}
}


