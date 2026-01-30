package main

import (
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"strconv"
	"strings"
	"time"
)

type EncodeConfig struct {
	CellSize   int // size of each square cell in pixels
	PadCells   int // padding in cells around grid
	GridCols   int // fixed 6
	GridRows   int // fixed 4
	Background color.Color
	OneColor   color.Color
	ZeroColor  color.Color
}

func main() {
	var (
		outPath  = flag.String("out", "timecode.png", "output png path")
		timeStr  = flag.String("time", "", "time as HH:MM:SS or HH:MM:SS AM/PM; if empty uses local time")
		cellSize = flag.Int("cell", 14, "cell size in px")
		padCells = flag.Int("pad", 2, "padding in cells")
	)
	flag.Parse()

	cfg := EncodeConfig{
		CellSize:   *cellSize,
		PadCells:   *padCells,
		GridCols:   6,
		GridRows:   4,
		Background: color.RGBA{0, 0, 0, 255},
		OneColor:   color.RGBA{255, 255, 255, 255},
		ZeroColor:  color.RGBA{0, 0, 0, 255},
	}

	digits, err := parseDigits(*timeStr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse error: %v\n", err)
		os.Exit(1)
	}

	img := RenderDigitsGrid(digits, cfg)

	f, err := os.Create(*outPath)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		panic(err)
	}

	fmt.Println("wrote", *outPath)
}

// parseDigits returns 6 digits [H tens, H ones, M tens, M ones, S tens, S ones].
// Accepts:
//   - "" (use current time)
//   - "06:34:58"
//   - "06:34:58 PM" (AM/PM ignored for encoding; 12h stays as displayed)
func parseDigits(s string) ([6]int, error) {
	var out [6]int

	s = strings.TrimSpace(s)
	if s == "" {
		now := time.Now()
		h, m, sec := now.Hour(), now.Minute(), now.Second()
		// If you want 12h display encoding by default, convert here.
		// For now we encode 24h (00-23) as digits, which is also fine.
		return [6]int{h / 10, h % 10, m / 10, m % 10, sec / 10, sec % 10}, nil
	}

	// Take first token as HH:MM:SS
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return out, fmt.Errorf("empty time")
	}
	hms := parts[0]

	toks := strings.Split(hms, ":")
	if len(toks) != 3 {
		return out, fmt.Errorf("expected HH:MM:SS, got %q", hms)
	}
	h, err := strconv.Atoi(toks[0])
	if err != nil {
		return out, fmt.Errorf("bad hour: %w", err)
	}
	m, err := strconv.Atoi(toks[1])
	if err != nil {
		return out, fmt.Errorf("bad minute: %w", err)
	}
	sec, err := strconv.Atoi(toks[2])
	if err != nil {
		return out, fmt.Errorf("bad second: %w", err)
	}
	if h < 0 || h > 99 || m < 0 || m > 59 || sec < 0 || sec > 59 {
		return out, fmt.Errorf("out of range: %02d:%02d:%02d", h, m, sec)
	}

	out = [6]int{h / 10, h % 10, m / 10, m % 10, sec / 10, sec % 10}
	return out, nil
}

func RenderDigitsGrid(d [6]int, cfg EncodeConfig) *image.RGBA {
	gridW := cfg.GridCols * cfg.CellSize
	gridH := cfg.GridRows * cfg.CellSize
	pad := cfg.PadCells * cfg.CellSize

	w := gridW + pad*2
	h := gridH + pad*2

	img := image.NewRGBA(image.Rect(0, 0, w, h))
	fillRect(img, img.Bounds(), cfg.Background)

	// For each digit column, draw 4 bits (8,4,2,1) top->bottom
	for col := 0; col < cfg.GridCols; col++ {
		val := d[col]
		if val < 0 {
			val = 0
		}
		if val > 15 {
			val = 15
		}
		for row := 0; row < cfg.GridRows; row++ {
			bit := 1 << (cfg.GridRows - 1 - row) // row 0 => 8, row 3 => 1
			on := (val & bit) != 0

			x0 := pad + col*cfg.CellSize
			y0 := pad + row*cfg.CellSize
			r := image.Rect(x0, y0, x0+cfg.CellSize, y0+cfg.CellSize)
			if on {
				fillRect(img, r, cfg.OneColor)
			} else {
				fillRect(img, r, cfg.ZeroColor)
			}
		}
	}

	// Optional: add a 1px white border around entire overlay (helps find ROI sometimes)
	drawBorder(img, img.Bounds(), color.RGBA{255, 255, 255, 255}, 1)

	return img
}

func fillRect(img *image.RGBA, r image.Rectangle, c color.Color) {
	cr, cg, cb, ca := c.RGBA()
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			i := img.PixOffset(x, y)
			img.Pix[i+0] = uint8(cr >> 8)
			img.Pix[i+1] = uint8(cg >> 8)
			img.Pix[i+2] = uint8(cb >> 8)
			img.Pix[i+3] = uint8(ca >> 8)
		}
	}
}

func drawBorder(img *image.RGBA, r image.Rectangle, c color.Color, thickness int) {
	if thickness <= 0 {
		return
	}
	// top
	fillRect(img, image.Rect(r.Min.X, r.Min.Y, r.Max.X, r.Min.Y+thickness), c)
	// bottom
	fillRect(img, image.Rect(r.Min.X, r.Max.Y-thickness, r.Max.X, r.Max.Y), c)
	// left
	fillRect(img, image.Rect(r.Min.X, r.Min.Y, r.Min.X+thickness, r.Max.Y), c)
	// right
	fillRect(img, image.Rect(r.Max.X-thickness, r.Min.Y, r.Max.X, r.Max.Y), c)
}
