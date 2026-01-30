import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card"
import { cn } from "@/lib/utils"

// Types
interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

interface SyncResult {
  videoTime: number
  videoTimeFormatted: string
  imageDataUrl: string | null
  serverTime: string | null
  rawOCR: string | null
  confidence: number
  status: "success" | "error" | "pending"
  error: string | null
}

// YouTube Player types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string
          playerVars?: Record<string, unknown>
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  loadVideoById: (videoId: string) => void
}

// Helper functions
function parseYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }
  return `${m}:${s.toString().padStart(2, "0")}`
}

function parseServerTime(ocrText: string): { success: boolean; time: string | null } {
  // Clean up OCR text - fix common misreadings
  const text = ocrText
    .replace(/O/g, "0")
    .replace(/l/g, "1")
    .replace(/I/g, "1")
    .replace(/\|/g, "1")

  // Time patterns (ordered by specificity)
  const patterns = [
    // 12-hour with seconds: "2:30:45 PM"
    {
      regex: /(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM|am|pm)/,
      parse: (m: RegExpMatchArray) => {
        let hour = parseInt(m[1])
        const isPM = m[4].toUpperCase() === "PM"
        if (isPM && hour !== 12) hour += 12
        if (!isPM && hour === 12) hour = 0
        return { hour, minute: parseInt(m[2]), second: parseInt(m[3]) }
      },
    },
    // 24-hour with seconds: "14:30:45"
    {
      regex: /(\d{1,2}):(\d{2}):(\d{2})/,
      parse: (m: RegExpMatchArray) => ({
        hour: parseInt(m[1]),
        minute: parseInt(m[2]),
        second: parseInt(m[3]),
      }),
    },
    // 12-hour without seconds: "2:30 PM"
    {
      regex: /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/,
      parse: (m: RegExpMatchArray) => {
        let hour = parseInt(m[1])
        const isPM = m[3].toUpperCase() === "PM"
        if (isPM && hour !== 12) hour += 12
        if (!isPM && hour === 12) hour = 0
        return { hour, minute: parseInt(m[2]), second: 0 }
      },
    },
    // 24-hour without seconds: "14:30"
    {
      regex: /(\d{1,2}):(\d{2})/,
      parse: (m: RegExpMatchArray) => ({
        hour: parseInt(m[1]),
        minute: parseInt(m[2]),
        second: 0,
      }),
    },
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) {
      const parsed = pattern.parse(match)

      if (parsed.hour < 0 || parsed.hour > 23) continue
      if (parsed.minute < 0 || parsed.minute > 59) continue
      if (parsed.second < 0 || parsed.second > 59) continue

      const timeStr = `${parsed.hour.toString().padStart(2, "0")}:${parsed.minute.toString().padStart(2, "0")}:${parsed.second.toString().padStart(2, "0")}`
      return { success: true, time: timeStr }
    }
  }

  return { success: false, time: null }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function YouTubeSyncPage() {
  // State
  const [videoUrl, setVideoUrl] = useState("")
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const [videoWidth, setVideoWidth] = useState(1280)
  const [videoHeight, setVideoHeight] = useState(720)
  const [panMode, setPanMode] = useState(false)
  const [videoPosition, setVideoPosition] = useState({ x: 0, y: 0 })

  const [captureActive, setCaptureActive] = useState(false)
  const [cropRegion, setCropRegion] = useState<CropRegion>({ x: 0, y: 0, width: 200, height: 50 })
  const [capturePreview, setCapturePreview] = useState<string | null>(null)

  const [selectingRegion, setSelectingRegion] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)

  const [ocrUrl, setOcrUrl] = useState("http://localhost:8730")
  const [interval, setIntervalSec] = useState(60)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)

  const [syncRunning, setSyncRunning] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [statusText, setStatusText] = useState("")
  const [results, setResults] = useState<SyncResult[]>([])
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const [chronicleUrl, setChronicleUrl] = useState(window.location.origin)
  const [instanceId, setInstanceId] = useState("")
  const [chronicleExporting, setChronicleExporting] = useState(false)

  // Refs
  const playerRef = useRef<YTPlayer | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const playerReadyRef = useRef(false)
  const captureStreamRef = useRef<MediaStream | null>(null)
  const captureVideoRef = useRef<HTMLVideoElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const regionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const regionImageDataRef = useRef<ImageData | null>(null)
  const syncAbortedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  // Load YouTube IFrame API
  useEffect(() => {
    if (document.getElementById("youtube-iframe-api")) return

    const tag = document.createElement("script")
    tag.id = "youtube-iframe-api"
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
  }, [])

  // Time update interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && playerReadyRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime())
        setDuration(playerRef.current.getDuration())
      }
    }, 250)
    return () => clearInterval(interval)
  }, [])

  // Load video
  const loadVideo = useCallback(() => {
    const videoId = parseYouTubeVideoId(videoUrl)
    if (!videoId) {
      alert("Invalid YouTube URL")
      return
    }

    // If player exists and is ready, load new video
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.loadVideoById(videoId)
      return
    }

    // If player is being initialized, wait for it
    if (playerRef.current && !playerReadyRef.current) {
      return
    }

    // Show the video container first so the div exists
    setVideoLoaded(true)

    // Wait for YT API and DOM to be ready
    const initPlayer = () => {
      // Use setTimeout to ensure the div is rendered
      setTimeout(() => {
        playerRef.current = new window.YT.Player("yt-player", {
          videoId,
          playerVars: {
            playsinline: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              playerReadyRef.current = true
            },
            onStateChange: (event) => {
              setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
            },
          },
        })
      }, 0)
    }

    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
    }
  }, [videoUrl])

  // Playback controls
  const seekRelative = (delta: number) => {
    if (!playerRef.current || !playerReadyRef.current) return
    const newTime = Math.max(0, playerRef.current.getCurrentTime() + delta)
    playerRef.current.seekTo(newTime, true)
  }

  const togglePlayPause = () => {
    if (!playerRef.current || !playerReadyRef.current) return
    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  // Video panning
  const handleVideoDragStart = (e: React.MouseEvent) => {
    if (!panMode) return
    dragStartRef.current = { x: e.clientX - videoPosition.x, y: e.clientY - videoPosition.y }
  }

  const handleVideoDrag = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current || !panMode) return

      const viewportWidth = 800
      const viewportHeight = 450

      let newX = e.clientX - dragStartRef.current.x
      let newY = e.clientY - dragStartRef.current.y

      // Constrain
      newX = Math.min(0, Math.max(viewportWidth - videoWidth, newX))
      newY = Math.min(0, Math.max(viewportHeight - videoHeight, newY))

      setVideoPosition({ x: newX, y: newY })
    },
    [panMode, videoWidth, videoHeight]
  )

  const handleVideoDragEnd = useCallback(() => {
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    document.addEventListener("mousemove", handleVideoDrag)
    document.addEventListener("mouseup", handleVideoDragEnd)
    return () => {
      document.removeEventListener("mousemove", handleVideoDrag)
      document.removeEventListener("mouseup", handleVideoDragEnd)
    }
  }, [handleVideoDrag, handleVideoDragEnd])

  // Screen capture
  const startCapture = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen capture not available. Use HTTPS or localhost.")
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "never" } as MediaTrackConstraints,
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions)

      captureStreamRef.current = stream
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream
        await new Promise<void>((resolve) => {
          captureVideoRef.current!.onloadedmetadata = () => resolve()
        })
      }

      stream.getVideoTracks()[0].onended = () => stopCapture()
      setCaptureActive(true)
    } catch (err) {
      alert("Failed to start screen capture: " + (err as Error).message)
    }
  }

  const stopCapture = () => {
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach((track) => track.stop())
      captureStreamRef.current = null
    }
    setCaptureActive(false)
    setCapturePreview(null)
  }

  // Capture frame
  const captureFrame = useCallback((): string => {
    const video = captureVideoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas || !captureStreamRef.current) {
      throw new Error("Screen capture not active")
    }

    const ctx = canvas.getContext("2d")!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Crop
    const cropCanvas = document.createElement("canvas")
    cropCanvas.width = cropRegion.width
    cropCanvas.height = cropRegion.height
    const cropCtx = cropCanvas.getContext("2d")!

    cropCtx.drawImage(
      canvas,
      cropRegion.x,
      cropRegion.y,
      cropRegion.width,
      cropRegion.height,
      0,
      0,
      cropRegion.width,
      cropRegion.height
    )

    // Convert to B&W
    const imageData = cropCtx.getImageData(0, 0, cropRegion.width, cropRegion.height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const bw = gray > 128 ? 255 : 0
      data[i] = bw
      data[i + 1] = bw
      data[i + 2] = bw
    }
    cropCtx.putImageData(imageData, 0, 0)

    return cropCanvas.toDataURL("image/png")
  }, [cropRegion])

  const testCapture = () => {
    try {
      const dataUrl = captureFrame()
      setCapturePreview(dataUrl)
    } catch (err) {
      alert("Capture failed: " + (err as Error).message)
    }
  }

  // Region selection
  const openRegionSelector = () => {
    if (!captureVideoRef.current || !captureStreamRef.current) return
    setSelectingRegion(true)
  }

  // Draw to region canvas when it becomes visible
  useEffect(() => {
    if (!selectingRegion) return

    const video = captureVideoRef.current
    const canvas = regionCanvasRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      // Store the image data so we can restore it on each mouse move
      regionImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
  }, [selectingRegion])

  const handleRegionMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = regionCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    setSelectionStart({
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    })
  }

  const handleRegionMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectionStart) return

    const canvas = regionCanvasRef.current
    if (!canvas || !regionImageDataRef.current) return

    const ctx = canvas.getContext("2d")!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const currentX = Math.round((e.clientX - rect.left) * scaleX)
    const currentY = Math.round((e.clientY - rect.top) * scaleY)

    // Restore original image
    ctx.putImageData(regionImageDataRef.current, 0, 0)

    // Draw selection
    const x = Math.min(selectionStart.x, currentX)
    const y = Math.min(selectionStart.y, currentY)
    const w = Math.abs(currentX - selectionStart.x)
    const h = Math.abs(currentY - selectionStart.y)

    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = "rgba(34, 197, 94, 0.2)"
    ctx.fillRect(x, y, w, h)
  }

  const handleRegionMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectionStart) return

    const canvas = regionCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const endX = Math.round((e.clientX - rect.left) * scaleX)
    const endY = Math.round((e.clientY - rect.top) * scaleY)

    const x = Math.min(selectionStart.x, endX)
    const y = Math.min(selectionStart.y, endY)
    const w = Math.abs(endX - selectionStart.x)
    const h = Math.abs(endY - selectionStart.y)

    if (w > 10 && h > 10) {
      setCropRegion({ x, y, width: w, height: h })
    }

    setSelectionStart(null)
    setSelectingRegion(false)
    testCapture()
  }

  // OCR
  const sendToOCR = async (imageDataUrl: string): Promise<string> => {
    const base64Data = imageDataUrl.split(",")[1]

    const response = await fetch(`${ocrUrl}/base64`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: base64Data, trim: "\n" }),
    })

    if (!response.ok) {
      throw new Error(`OCR failed: ${response.status}`)
    }

    const data = await response.json()
    return data.result || data.text || ""
  }

  // Sync
  const runSync = async () => {
    if (!playerRef.current || !playerReadyRef.current) {
      alert("Load a video first")
      return
    }
    if (!captureStreamRef.current) {
      alert("Start screen capture first")
      return
    }

    const videoDuration = playerRef.current.getDuration()
    const effectiveEnd = endTime > 0 ? endTime : videoDuration

    setSyncRunning(true)
    syncAbortedRef.current = false
    setResults([])
    setLastResult(null)
    setSyncProgress(0)

    playerRef.current.pauseVideo()

    const totalSteps = Math.ceil((effectiveEnd - startTime) / interval)
    let step = 0

    for (let time = startTime; time < effectiveEnd && !syncAbortedRef.current; time += interval) {
      step++
      setSyncProgress(step / totalSteps)
      setStatusText(`Processing ${formatTime(time)} (${step}/${totalSteps})...`)

      playerRef.current.seekTo(time, true)
      await sleep(1500)

      // Get actual video time from player (has sub-second precision)
      const actualTime = playerRef.current.getCurrentTime()

      const result: SyncResult = {
        videoTime: actualTime,
        videoTimeFormatted: formatTime(actualTime),
        imageDataUrl: null,
        serverTime: null,
        rawOCR: null,
        confidence: 0,
        status: "pending",
        error: null,
      }

      try {
        const imageDataUrl = captureFrame()
        result.imageDataUrl = imageDataUrl

        const ocrText = await sendToOCR(imageDataUrl)
        result.rawOCR = ocrText

        const parsed = parseServerTime(ocrText)
        if (parsed.success) {
          result.serverTime = parsed.time
          result.confidence = 1.0
          result.status = "success"
        } else {
          result.status = "error"
          result.error = "Could not parse time"
        }
      } catch (err) {
        result.status = "error"
        result.error = (err as Error).message
      }

      setResults((prev) => [...prev, result])
      setLastResult(result)
      await sleep(500)
    }

    setSyncRunning(false)
    setStatusText(syncAbortedRef.current ? "Sync aborted" : `Done! ${step} frames processed.`)
  }

  const stopSync = () => {
    syncAbortedRef.current = true
  }

  // Export
  const exportJSON = () => {
    const data = {
      url: videoUrl,
      exported_at: new Date().toISOString(),
      results: results.map((r) => ({
        video_time_seconds: Math.round(r.videoTime),
        raw_ocr: r.rawOCR,
        server_time: r.serverTime,
        confidence: r.confidence,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "youtube-sync.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const lines = ["Video Time,Video Seconds,Server Time,Raw OCR,Status"]
    for (const r of results) {
      lines.push(
        [
          r.videoTimeFormatted,
          r.videoTime,
          r.serverTime || "",
          `"${(r.rawOCR || "").replace(/"/g, '""')}"`,
          r.status,
        ].join(",")
      )
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "youtube-sync.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToChronicle = async () => {
    if (!instanceId.trim()) {
      alert("Please enter an Instance ID")
      return
    }

    if (results.length === 0) {
      alert("No results to export")
      return
    }

    setChronicleExporting(true)
    try {
      // Check if logged in
      const whoamiRes = await fetch(`${chronicleUrl}/api/v1/whoami`, {
        credentials: "include",
      })
      if (!whoamiRes.ok) {
        alert(`Not logged in to ${chronicleUrl}. Please log in first.`)
        setChronicleExporting(false)
        return
      }

      const data = {
        url: videoUrl,
        exported_at: new Date().toISOString(),
        results: results.map((r) => ({
          video_time_seconds: Math.round(r.videoTime),
          raw_ocr: r.rawOCR,
          server_time: r.serverTime,
          confidence: r.confidence,
        })),
      }

      const response = await fetch(
        `${chronicleUrl}/api/v1/raidlogs/instances/${encodeURIComponent(instanceId.trim())}/youtube`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      alert("Successfully exported to Chronicle!")
    } catch (err) {
      alert(`Failed to export: ${(err as Error).message}`)
    } finally {
      setChronicleExporting(false)
    }
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)

        // Set video URL if present
        if (json.url) {
          setVideoUrl(json.url)
        }

        // Convert imported results to SyncResult format
        if (Array.isArray(json.results)) {
          const imported: SyncResult[] = json.results.map(
            (r: {
              video_time_seconds?: number
              raw_ocr?: string | null
              server_time?: string | null
              confidence?: number
              error?: string | null
            }) => ({
              videoTime: r.video_time_seconds ?? 0,
              videoTimeFormatted: formatTime(r.video_time_seconds ?? 0),
              imageDataUrl: null,
              serverTime: r.server_time ?? null,
              rawOCR: r.raw_ocr ?? null,
              confidence: r.confidence ?? 0,
              status: r.error ? "error" : r.server_time ? "success" : "pending",
              error: r.error ?? null,
            })
          )
          setResults(imported)
          setStatusText(`Imported ${imported.length} results from file`)
        }
      } catch (err) {
        alert(`Failed to parse JSON: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Fixed Video Area */}
      <div className="fixed top-0 left-0 right-0 bg-card border-b border-border z-50 p-4">
        {/* URL Input */}
        {!videoLoaded && (
          <div className="flex gap-3 items-center">
            <Input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadVideo()}
              placeholder="Paste YouTube URL and press Enter..."
              className="max-w-lg"
            />
            <Button onClick={loadVideo}>Load</Button>
          </div>
        )}

        {/* Video viewport */}
        {videoLoaded && (
          <>
            <div className="w-[800px] h-[450px] bg-black rounded-md overflow-hidden border border-border relative">
              <div
                className={cn(
                  "absolute",
                  panMode && "cursor-grab active:cursor-grabbing [&_iframe]:pointer-events-none"
                )}
                style={{
                  width: videoWidth,
                  height: videoHeight,
                  left: videoPosition.x,
                  top: videoPosition.y,
                }}
                onMouseDown={handleVideoDragStart}
              >
                <div id="yt-player" className="w-full h-full" />
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex gap-4 items-center mt-3 flex-wrap">
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="sm" onClick={() => seekRelative(-60)}>
                  -60s
                </Button>
                <Button variant="secondary" size="sm" onClick={() => seekRelative(-10)}>
                  -10s
                </Button>
                <Button variant="secondary" size="sm" onClick={togglePlayPause}>
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => seekRelative(10)}>
                  +10s
                </Button>
                <Button variant="secondary" size="sm" onClick={() => seekRelative(60)}>
                  +60s
                </Button>
                <span className="font-mono bg-muted px-3 py-1.5 rounded text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="w-px h-6 bg-border" />

              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={videoWidth}
                  onChange={(e) => setVideoWidth(Number(e.target.value))}
                  className="w-[70px]"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={videoHeight}
                  onChange={(e) => setVideoHeight(Number(e.target.value))}
                  className="w-[70px]"
                />
                <Button
                  variant={panMode ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setPanMode(!panMode)}
                  title="Toggle pan mode"
                >
                  🖐
                </Button>
              </div>

              <div className="w-px h-6 bg-border" />

              <div className="flex gap-2 items-center">
                {!captureActive ? (
                  <Button onClick={startCapture}>Start Capture</Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={stopCapture}>
                      Stop
                    </Button>
                    <Button variant="secondary" onClick={openRegionSelector}>
                      Select Region
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="pt-[540px] px-5 pb-5 max-w-5xl mx-auto space-y-5">
        {/* Capture Section */}
        {captureActive && (
          <Card>
            <CardHeader>
              <CardTitle>📷 Capture Region</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-5">
                <div className="flex-1 min-h-[100px] max-h-[200px] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {capturePreview ? (
                    <img src={capturePreview} alt="Preview" className="max-w-full max-h-[200px]" />
                  ) : (
                    <span className="text-muted-foreground">Select a region to capture</span>
                  )}
                </div>
                {!syncRunning && (
                  <div className="grid grid-cols-2 gap-2 min-w-[180px]">
                    <div>
                      <Label>X</Label>
                      <Input
                        type="number"
                        value={cropRegion.x}
                        onChange={(e) =>
                          setCropRegion({ ...cropRegion, x: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label>Y</Label>
                      <Input
                        type="number"
                        value={cropRegion.y}
                        onChange={(e) =>
                          setCropRegion({ ...cropRegion, y: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label>Width</Label>
                      <Input
                        type="number"
                        value={cropRegion.width}
                        onChange={(e) =>
                          setCropRegion({ ...cropRegion, width: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label>Height</Label>
                      <Input
                        type="number"
                        value={cropRegion.height}
                        onChange={(e) =>
                          setCropRegion({ ...cropRegion, height: Number(e.target.value) })
                        }
                      />
                    </div>
                    <Button variant="secondary" className="col-span-2" onClick={testCapture}>
                      Test Capture
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle>⚡ Sync Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <Label>OCR Service URL</Label>
                <Input
                  type="text"
                  value={ocrUrl}
                  onChange={(e) => setOcrUrl(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div>
                <Label>Interval (sec)</Label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setIntervalSec(Number(e.target.value))}
                  className="w-[80px]"
                />
              </div>
              <div>
                <Label>Start (sec)</Label>
                <Input
                  type="number"
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  className="w-[80px]"
                />
              </div>
              <div>
                <Label>End (sec, 0=end)</Label>
                <Input
                  type="number"
                  value={endTime}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                  className="w-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={runSync} disabled={!captureActive || syncRunning}>
                  Start Sync
                </Button>
                <Button variant="destructive" onClick={stopSync} disabled={!syncRunning}>
                  Stop
                </Button>
              </div>
            </div>

            {syncRunning && (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${syncProgress * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{statusText}</p>
              </div>
            )}

            {lastResult && (
              <div className="bg-muted rounded-lg p-4 mt-4">
                <div className="flex gap-5 items-center">
                  {lastResult.imageDataUrl && (
                    <img
                      src={lastResult.imageDataUrl}
                      alt="Last capture"
                      className="max-h-[60px] rounded"
                    />
                  )}
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground block">Video Time</span>
                    <span className="font-mono text-lg">{lastResult.videoTimeFormatted}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground block">Server Time</span>
                    <span className="font-mono text-lg">{lastResult.serverTime || "-"}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground block">OCR Text</span>
                    <span className="font-mono text-lg">{lastResult.rawOCR || "-"}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-muted-foreground mb-3">No results yet</p>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Import JSON
                </Button>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Video Time
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Server Time
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Raw OCR
                      </th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono">{r.videoTimeFormatted}</td>
                        <td className="py-2 px-3">
                          {r.imageDataUrl && (
                            <img
                              src={r.imageDataUrl}
                              alt={`Frame ${i}`}
                              className="max-h-[30px] rounded hover:scale-200 hover:relative hover:z-10 transition-transform"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">{r.serverTime || "-"}</td>
                        <td className="py-2 px-3 font-mono">{r.rawOCR || "-"}</td>
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-xs",
                              r.status === "success"
                                ? "bg-green-900/50 text-green-300"
                                : "bg-red-900/50 text-red-300"
                            )}
                          >
                            {r.status === "success" ? "OK" : r.error || "Error"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <Button variant="secondary" onClick={exportJSON}>
                    Export JSON
                  </Button>
                  <Button variant="secondary" onClick={exportCSV}>
                    Export CSV
                  </Button>
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    Import JSON
                  </Button>
                  <Button variant="secondary" onClick={() => setResults([])}>
                    Clear
                  </Button>
                </div>

                {/* Chronicle Export */}
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium mb-3">Export to Chronicle</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <Label htmlFor="chronicle-url" className="text-xs">
                        Chronicle URL
                      </Label>
                      <Input
                        id="chronicle-url"
                        value={chronicleUrl}
                        onChange={(e) => setChronicleUrl(e.target.value)}
                        placeholder="https://chronicle.example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="instance-id" className="text-xs">
                        Instance ID
                      </Label>
                      <Input
                        id="instance-id"
                        value={instanceId}
                        onChange={(e) => setInstanceId(e.target.value)}
                        placeholder="abc123..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={exportToChronicle} disabled={chronicleExporting}>
                    {chronicleExporting ? "Exporting..." : "Export to Chronicle"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Region selector overlay */}
      {selectingRegion && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center">
          <div className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg mb-5">
            Click and drag to select the clock region. Press Escape to cancel.
          </div>
          <canvas
            ref={regionCanvasRef}
            className="max-w-[95vw] max-h-[85vh] border-2 border-primary rounded cursor-crosshair"
            onMouseDown={handleRegionMouseDown}
            onMouseMove={handleRegionMouseMove}
            onMouseUp={handleRegionMouseUp}
            onKeyDown={(e) => e.key === "Escape" && setSelectingRegion(false)}
            tabIndex={0}
          />
        </div>
      )}

      {/* Hidden elements */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileImport}
        className="hidden"
      />
      <video ref={captureVideoRef} className="hidden" autoPlay />
      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  )
}
