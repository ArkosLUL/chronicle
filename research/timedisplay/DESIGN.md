Here’s a compact summary plus a set of “agent instructions” you can hand to another AI to finish, integrate, and debug the implementation.

## Summary

Goal: reliably embed and recover `HH:MM:SS` from video frames (even after YouTube re-encode) without OCR, using a low-frequency, compression-friendly overlay.

Encoding format:

* Represent time as 6 decimal digits: `H tens, H ones, M tens, M ones, S tens, S ones`.
* Encode each digit in **BCD** (4 bits).
* Render as a **6×4 grid** where each column is a digit and each row is a bit (top→bottom bits `8,4,2,1`).
* Draw white cells for `1`, black for `0`, on a black background with padding (2 cells) and optional border.
* Typical robust size at 1080p: cell size 14–20 px → overlay ~140×112 to ~200×160 px.

Decoding:

* Crop ROI containing the overlay.
* Divide ROI into the grid (optionally remove padding).
* For each cell, compute mean luminance (ignore small border inside cell to avoid ringing).
* Use median luminance of all cells as a robust threshold to classify `0/1`.
* Reconstruct digits from bits, validate digits in range 0–9 and time ranges (mm/ss 0–59, hh 0–23 or 1–12 based on your convention).
* Add temporal smoothing (reject impossible jumps) when decoding a sequence.

Implementation delivered:

* Pure Go encoder that outputs PNG overlay.
* Pure Go decoder that reads PNG/JPEG and returns time from ROI.

Limits:

* Video decode in “pure Go” is not practical; plan to extract frames via `ffmpeg` or accept cgo-based video libs. The overlay encode/decode remains pure Go and easy to port to Lua.

---

## Instructions for an AI agent to finish + debug the implementation

### 1) Create a small repo layout

* `/encode/main.go` — overlay PNG generator
* `/decode/main.go` — decoder from image + ROI
* `/lib/timecode/` — shared library package (optional): encode/decode helpers
* `/testdata/` — a few sample overlays + sample frames (before/after YouTube if possible)

Add a `go.work` or single `go.mod`.

### 2) Make the overlay spec explicit (write it down in code comments)

Define constants:

* `Cols=6, Rows=4`
* Bit mapping: row 0 → bit 8, row 1 → bit 4, row 2 → bit 2, row 3 → bit 1
* Digit order: `H10,H1,M10,M1,S10,S1`

Add a docstring that describes the grid and expected ROI options:

* ROI may include padding; decoder should support both padded and tight-grid ROIs via a flag.

### 3) Improve the decoder robustness (required)

Implement these enhancements:

**A. Cell size inference**

* Current logic uses integer division to infer cell size from ROI dimensions. Make it more robust:

  * Compute `cellW = roi.Dx() / (Cols + 2*PadCells)`
  * Compute `cellH = roi.Dy() / (Rows + 2*PadCells)`
  * Use `cell = min(cellW, cellH)`, but also:

    * Recompute grid bounds using that `cell`
    * Ensure grid bounds stay within ROI; if not, adjust.

**B. Thresholding**

* Median threshold is good; keep it.
* Add a fallback:

  * If decoded digit > 9 or time invalid, try:

    * `thr = (minLuma+maxLuma)/2`
    * or Otsu-like simple search over candidate thresholds (only 24 cells, cheap).
  * Pick threshold that yields all digits <= 9 and valid time.

**C. Border/edge artifacts**

* Keep inset sampling inside each cell.
* Make inset relative to cell size (e.g. `inset = max(1, cell/10)`), not fixed `2px`.

**D. Validation & retry**

* If invalid decode:

  * Retry with alternate threshold(s)
  * If still invalid, return an explicit error containing:

    * ROI, inferred cell size, threshold used, decoded raw digits.

### 4) Add unit tests (do this before video integration)

Write tests that:

* Generate overlay for fixed times (e.g., `00:00:00`, `06:34:58`, `23:59:59`).
* Decode the same image with:

  * full ROI (includes padding)
  * tight ROI (just grid)
* Add tests where the image is resized down/up and slightly blurred (simulate compression).

  * In pure Go: downscale by nearest neighbor (or basic box filter), then upscale; or apply a small blur approximation.
* Assert decoder returns the correct time.

### 5) Integrate with frames (ffmpeg pipeline)

Even if you want “pure Go”, use ffmpeg for frames extraction because it’s the most reliable.
Agent should provide:

* Example command to extract 1 fps and crop ROI:

  * `ffmpeg -i input.mp4 -vf "fps=1,crop=W:H:X:Y" frames/out_%05d.png`
* Then run Go decoder on each frame.

Optional: if you want to locate the overlay automatically:

* Search for the distinctive white border (if enabled) or find the largest high-contrast block in a corner.
* But start with manual ROI to ship faster.

### 6) Add temporal smoothing for video sequences

Implement a small state machine:

* Maintain last decoded time `t_last`.
* When reading next frame `t`:

  * If `t` is invalid or differs by more than expected (e.g., >2 seconds at 1 fps), mark as suspect.
  * Optionally attempt decode with alternate thresholds.
  * If still suspect, drop it and keep last.
* Provide metrics: % frames decoded, % dropped.

### 7) Extend encoding (optional)

If you need 12-hour with AM/PM:

* Add one extra “AM/PM bit” cell row or an extra column.
  Simplest: add a 7th column with a fixed pattern:
* `AM` = `0001`
* `PM` = `0010`
  Decoder reads it and validates.
  Keep everything blocky.

### 8) Prepare for Lua/WoW addon port

Deliver a Lua-friendly spec + pseudo-implementation:

* Given a texture or pixel source:

  * `meanLuma(x0,y0,w,h)`
  * iterate cells, threshold, reconstruct digits
* If WoW can’t sample arbitrary pixels easily, plan:

  * server-side decode, or
  * preprocessed numeric data, or
  * use an on-screen font and WoW’s limited APIs (agent should verify feasibility).

### 9) Debug playbook (what to do when it fails)

When decode fails on real frames:

1. Save the cropped ROI image to disk for inspection.
2. Print diagnostics:

  * roi dims, inferred cell, pad, threshold
  * per-cell luma matrix (6×4)
  * decoded bit matrix
3. Verify:

  * ROI alignment (grid isn’t shifted)
  * cell size matches the rendered overlay
  * threshold separates white and black clearly
4. Adjust:

  * increase cell size in encoder (14→18 or 20)
  * increase padding
  * avoid anti-aliased edges (no glow/shadow)
  * ensure overlay is not scaled by the player/editor in a non-integer way

### 10) Deliverables checklist

Agent should deliver:

* Working `encode` and `decode` binaries.
* Tests passing.
* Example ffmpeg commands.
* A short markdown spec of the encoding.
* Optional: a small demo that encodes time, composites onto an image, then decodes it back.

---

If you want, I can also format this as a single “AGENT.md” you can drop into the repo verbatim.
