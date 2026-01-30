package main

import (
	"errors"
	"flag"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"sort"
)

type DecodeConfig struct {
	GridCols int // 6
	GridRows int // 4
	PadCells int // must match encoder if ROI includes padding; set to 0 if ROI is tight to grid
}

func main() {
	var (
		inPath = flag.String("in", "", "input image (png/jpg)")
		x      = flag.Int("x", 0, "roi x")
		y      = flag.Int("y", 0, "roi y")
		w      = flag.Int("w", 0, "roi width")
		h      = flag.Int("h", 0, "roi height")
		pad    = flag.Int("padcells", 2, "padding cells used in encoder (0 if ROI is tight to grid)")
	)
	flag.Parse()

	if *inPath == "" {
		fmt.Println("Usage: go run ./decode -in frame.png -x 0 -y 0 -w 140 -h 112")
		os.Exit(2)
	}
	img, err := loadImage(*inPath)
	if err != nil {
		panic(err)
	}

	roi := image.Rect(*x, *y, *x+*w, *y+*h)
	roi = roi.Intersect(img.Bounds())
	if roi.Empty() {
		panic("ROI is empty or out of bounds")
	}

	cfg := DecodeConfig{
		GridCols: 6,
		GridRows: 4,
		PadCells: *pad,
	}

	digits, err := DecodeDigitsFromROI(img, roi, cfg)
	if err != nil {
		panic(err)
	}

	// Convert digits -> HH:MM:SS
	hh := digits[0]*10 + digits[1]
	mm := digits[2]*10 + digits[3]
	ss := digits[4]*10 + digits[5]

	fmt.Printf("digits=%v time=%02d:%02d:%02d\n", digits, hh, mm, ss)
}

func loadImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	return img, err
}

func DecodeDigitsFromROI(img image.Image, roi image.Rectangle, cfg DecodeConfig) ([6]int, error) {
	var out [6]int

	// If roi includes padding, compute effective grid bounds by removing pad cells.
	// We assume padding is symmetrical.
	grid := roi
	if cfg.PadCells > 0 {
		// Estimate cell size from ROI dimensions:
		// ROI width = (cols + 2*padCells) * cellSize
		// ROI height = (rows + 2*padCells) * cellSize
		denW := cfg.GridCols + 2*cfg.PadCells
		denH := cfg.GridRows + 2*cfg.PadCells
		if denW <= 0 || denH <= 0 {
			return out, errors.New("bad grid/pad config")
		}
		cellW := roi.Dx() / denW
		cellH := roi.Dy() / denH
		cell := min(cellW, cellH)
		if cell <= 0 {
			return out, errors.New("ROI too small")
		}
		padPx := cfg.PadCells * cell
		grid = image.Rect(roi.Min.X+padPx, roi.Min.Y+padPx, roi.Max.X-padPx, roi.Max.Y-padPx)
	}

	// Now decode using the grid area only.
	cols, rows := cfg.GridCols, cfg.GridRows
	if cols != 6 || rows != 4 {
		return out, errors.New("this decoder expects 6x4 grid")
	}

	cellW := grid.Dx() / cols
	cellH := grid.Dy() / rows
	cell := min(cellW, cellH)
	if cell <= 0 {
		return out, errors.New("grid too small for cells")
	}

	// Sample each cell's mean luma
	type cellSample struct {
		col, row int
		luma     float64
	}
	samples := make([]cellSample, 0, cols*rows)
	lumas := make([]float64, 0, cols*rows)

	for col := 0; col < cols; col++ {
		for row := 0; row < rows; row++ {
			x0 := grid.Min.X + col*cell
			y0 := grid.Min.Y + row*cell
			r := image.Rect(x0, y0, x0+cell, y0+cell).Intersect(img.Bounds())
			m := meanLuma(img, r)
			samples = append(samples, cellSample{col: col, row: row, luma: m})
			lumas = append(lumas, m)
		}
	}

	// Robust threshold: median luma splits 0/1 pretty well in practice
	sort.Float64s(lumas)
	thr := lumas[len(lumas)/2]

	// Reconstruct digits from bits
	for _, s := range samples {
		on := s.luma >= thr
		if on {
			bit := 1 << (rows - 1 - s.row) // row 0 => 8
			out[s.col] |= bit
		}
	}

	// Validate as time digits (BCD digits must be 0..9)
	for i := 0; i < 6; i++ {
		if out[i] > 9 {
			return out, fmt.Errorf("decoded digit out of range at pos %d: %d (bad ROI/threshold?)", i, out[i])
		}
	}

	hh := out[0]*10 + out[1]
	mm := out[2]*10 + out[3]
	ss := out[4]*10 + out[5]

	// Loose validation: you can tighten based on 12h/24h choice
	if hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59 {
		return out, fmt.Errorf("decoded time invalid: %02d:%02d:%02d", hh, mm, ss)
	}

	return out, nil
}

func meanLuma(img image.Image, r image.Rectangle) float64 {
	if r.Empty() {
		return 0
	}
	var sum float64
	var n float64

	// Ignore a small border to reduce edge artifacts/ringing
	// (helps when YouTube introduces halos)
	inset := 2
	rr := r.Inset(inset)
	if rr.Empty() {
		rr = r
	}

	for y := rr.Min.Y; y < rr.Max.Y; y++ {
		for x := rr.Min.X; x < rr.Max.X; x++ {
			c := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
			sum += float64(c.Y)
			n++
		}
	}
	if n == 0 {
		return 0
	}
	return sum / n
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
