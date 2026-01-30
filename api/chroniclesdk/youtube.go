package chroniclesdk

import "time"

type Video struct {
	URL        string           `json:"url"`
	ExportedAt time.Time        `json:"exported_at"`
	Results    []VideoTimestamp `json:"results"`
}

type VideoTimestamp struct {
	VideoTimeSeconds int    `json:"video_time_seconds"`
	RawOCR           string `json:"raw_ocr"`
	// Need to convert to timezone, is like "17:56:08"
	ServerTime string `json:"server_time"`
	Confidence int    `json:"confidence"`
}
