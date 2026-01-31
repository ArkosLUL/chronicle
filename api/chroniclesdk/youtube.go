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
	// ServerTime is the time shown on the in-game clock, like "17:56:08"
	ServerTime string `json:"server_time"`
	// UTCTime is ServerTime adjusted by the user-specified offset to match UTC.
	// This is used to sync with encounter timestamps which are stored in UTC.
	UTCTime    string `json:"utc_time,omitempty"`
	Confidence int    `json:"confidence"`
}
