package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"
)

type Data struct {
	URL        string `json:"url"`
	ExportedAt string `json:"exported_at"`
	Results    []struct {
		VideoTimeSeconds int     `json:"video_time_seconds"`
		RawOCR           string  `json:"raw_ocr"`
		ServerTime       string  `json:"server_time"`
		Confidence       float64 `json:"confidence"`
	} `json:"results"`
}

func main() {
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		panic(err)
	}

	var data Data
	if err := json.Unmarshal(input, &data); err != nil {
		panic(err)
	}

	for i := range data.Results {
		// --- server_time: HH:MM:SS (24h)
		st, err := time.Parse("15:04:05", data.Results[i].ServerTime)
		if err != nil {
			panic(fmt.Errorf("parse server_time %q: %w", data.Results[i].ServerTime, err))
		}
		st = st.Add(-6 * time.Hour)
		data.Results[i].ServerTime = st.Format("15:04:05")

		// --- raw_ocr: HH:MM:SS AM/PM (12h)
		ocr, err := time.Parse("03:04:05 PM", data.Results[i].RawOCR)
		if err != nil {
			panic(fmt.Errorf("parse raw_ocr %q: %w", data.Results[i].RawOCR, err))
		}
		ocr = ocr.Add(-6 * time.Hour)
		data.Results[i].RawOCR = ocr.Format("03:04:05 PM")
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		panic(err)
	}
}
