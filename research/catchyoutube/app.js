// YouTube Time Sync - Browser-based frame capture and OCR

// ============================================================================
// State
// ============================================================================

let player = null;
let playerReady = false;
let captureStream = null;
let captureVideo = null;
let captureCanvas = null;
let captureCtx = null;
let syncRunning = false;
let syncAborted = false;
let results = [];

// Crop region (in screen capture coordinates)
let cropRegion = {
  x: 0,
  y: 0,
  width: 200,
  height: 50
};

// ============================================================================
// YouTube Player
// ============================================================================

// Called by YouTube IFrame API when ready
function onYouTubeIframeAPIReady() {
  console.log('YouTube IFrame API ready');
}

function parseYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function loadVideo(videoId) {
  const urlSection = document.getElementById('url-section');
  const viewport = document.getElementById('video-viewport');
  const controlsBar = document.getElementById('controls-bar');
  
  // Hide URL input, show video and controls
  urlSection.classList.add('hidden');
  viewport.classList.remove('hidden');
  controlsBar.classList.remove('hidden');
  
  // Apply initial size
  applyVideoSize();
  
  if (player) {
    player.loadVideoById(videoId);
    return;
  }
  
  player = new YT.Player('player', {
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'controls': 1,
      'rel': 0,
      'modestbranding': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function applyVideoSize() {
  const width = parseInt(document.getElementById('video-width').value) || 1280;
  const height = parseInt(document.getElementById('video-height').value) || 720;
  const container = document.getElementById('video-container');
  const playerEl = document.getElementById('player');
  
  container.style.width = width + 'px';
  container.style.height = height + 'px';
  
  if (playerEl.tagName === 'IFRAME') {
    playerEl.style.width = width + 'px';
    playerEl.style.height = height + 'px';
  }
}

// Video panning
let videoDragging = false;
let videoDragStart = { x: 0, y: 0 };
let videoPosition = { x: 0, y: 0 };
let panModeEnabled = false;

function togglePanMode() {
  panModeEnabled = !panModeEnabled;
  const btn = document.getElementById('pan-mode-btn');
  const container = document.getElementById('video-container');
  
  if (panModeEnabled) {
    btn.classList.add('active');
    container.classList.add('pan-mode');
  } else {
    btn.classList.remove('active');
    container.classList.remove('pan-mode');
  }
}

function startVideoDrag(e) {
  if (!panModeEnabled) return;
  
  const container = document.getElementById('video-container');
  videoDragging = true;
  container.classList.add('dragging');
  videoDragStart = {
    x: e.clientX - videoPosition.x,
    y: e.clientY - videoPosition.y
  };
}

function doVideoDrag(e) {
  if (!videoDragging) return;
  
  const container = document.getElementById('video-container');
  const viewport = document.getElementById('video-viewport');
  
  const viewportRect = viewport.getBoundingClientRect();
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;
  
  // Calculate new position
  let newX = e.clientX - videoDragStart.x;
  let newY = e.clientY - videoDragStart.y;
  
  // Constrain so video doesn't leave viewport entirely
  const maxX = 0;
  const minX = viewportRect.width - containerWidth;
  const maxY = 0;
  const minY = viewportRect.height - containerHeight;
  
  newX = Math.min(maxX, Math.max(minX, newX));
  newY = Math.min(maxY, Math.max(minY, newY));
  
  videoPosition = { x: newX, y: newY };
  container.style.left = newX + 'px';
  container.style.top = newY + 'px';
}

function stopVideoDrag() {
  if (videoDragging) {
    videoDragging = false;
    document.getElementById('video-container').classList.remove('dragging');
  }
}

function onPlayerReady(event) {
  playerReady = true;
  updateTimeDisplay();
  setInterval(updateTimeDisplay, 250);
  console.log('Player ready, duration:', player.getDuration());
}

function onPlayerStateChange(event) {
  const btn = document.getElementById('play-pause-btn');
  if (event.data === YT.PlayerState.PLAYING) {
    btn.textContent = 'Pause';
  } else {
    btn.textContent = 'Play';
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimeDisplay() {
  if (!player || !playerReady) return;
  
  const current = player.getCurrentTime();
  const duration = player.getDuration();
  
  document.getElementById('current-time').textContent = formatTime(current);
  document.getElementById('duration').textContent = formatTime(duration);
}

function seekRelative(delta) {
  if (!player || !playerReady) return;
  const newTime = Math.max(0, player.getCurrentTime() + delta);
  player.seekTo(newTime, true);
}

function seekTo(time) {
  if (!player || !playerReady) return;
  player.seekTo(time, true);
}

function togglePlayPause() {
  if (!player || !playerReady) return;
  
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

// ============================================================================
// Screen Capture
// ============================================================================

async function startScreenCapture() {
  try {
    // Check if API is available (requires secure context: HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error(
        'Screen capture API not available. This page must be served over HTTPS or localhost.\n\n' +
        'Run: python3 -m http.server 8080\n' +
        'Then open: http://localhost:8080'
      );
    }
    
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'never'
      },
      audio: false,
      preferCurrentTab: true  // Default to sharing this tab (includes the YouTube iframe)
    });
    
    captureVideo = document.getElementById('capture-video');
    captureCanvas = document.getElementById('capture-canvas');
    captureCtx = captureCanvas.getContext('2d');
    
    captureVideo.srcObject = captureStream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      captureVideo.onloadedmetadata = resolve;
    });
    
    // Update UI
    document.getElementById('start-capture-btn').disabled = true;
    document.getElementById('stop-capture-btn').disabled = false;
    document.getElementById('select-region-btn').disabled = false;
    document.getElementById('test-capture-btn').disabled = false;
    document.getElementById('start-sync-btn').disabled = false;
    
    // Show capture section
    document.getElementById('capture-section').classList.remove('hidden');
    
    // Handle stream end (user clicks "Stop sharing")
    captureStream.getVideoTracks()[0].onended = () => {
      stopScreenCapture();
    };
    
    console.log('Screen capture started:', captureVideo.videoWidth, 'x', captureVideo.videoHeight);
    
    // Take initial capture to show preview
    await updateCapturePreview();
    
  } catch (err) {
    console.error('Failed to start screen capture:', err);
    alert('Failed to start screen capture: ' + err.message);
  }
}

function stopScreenCapture() {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }
  
  document.getElementById('start-capture-btn').disabled = false;
  document.getElementById('stop-capture-btn').disabled = true;
  document.getElementById('select-region-btn').disabled = true;
  document.getElementById('test-capture-btn').disabled = true;
  document.getElementById('start-sync-btn').disabled = true;
  
  document.getElementById('capture-preview-container').innerHTML = 
    '<span>Select a region to capture</span>';
  
  // Hide capture section
  document.getElementById('capture-section').classList.add('hidden');
}

function captureFrame() {
  if (!captureVideo || !captureStream) {
    throw new Error('Screen capture not active');
  }
  
  const width = captureVideo.videoWidth;
  const height = captureVideo.videoHeight;
  
  captureCanvas.width = width;
  captureCanvas.height = height;
  
  // Draw full frame
  captureCtx.drawImage(captureVideo, 0, 0);
  
  // Get cropped region
  const crop = cropRegion;
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = crop.width;
  cropCanvas.height = crop.height;
  const cropCtx = cropCanvas.getContext('2d');
  
  cropCtx.drawImage(
    captureCanvas,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, crop.width, crop.height
  );
  
  // Convert to black and white for better OCR
  const imageData = cropCtx.getImageData(0, 0, crop.width, crop.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate grayscale using luminance formula
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Apply threshold for high contrast B&W (adjust threshold as needed)
    const bw = gray > 128 ? 255 : 0;
    data[i] = bw;     // R
    data[i + 1] = bw; // G
    data[i + 2] = bw; // B
    // Alpha stays the same
  }
  
  cropCtx.putImageData(imageData, 0, 0);
  
  return cropCanvas.toDataURL('image/png');
}

async function updateCapturePreview() {
  try {
    const dataUrl = captureFrame();
    document.getElementById('capture-preview-container').innerHTML = 
      `<img src="${dataUrl}" alt="Capture preview" />`;
  } catch (err) {
    console.error('Failed to capture preview:', err);
  }
}

// ============================================================================
// Region Selection
// ============================================================================

let selectionActive = false;
let selectionStart = null;  // In canvas pixel coordinates
let selectionCanvas = null;
let selectionCtx = null;
let selectionImageData = null;  // Store the original frame

function openRegionSelector() {
  if (!captureStream) {
    alert('Start screen capture first');
    return;
  }
  
  const overlay = document.getElementById('region-selector-overlay');
  selectionCanvas = document.getElementById('region-selector-canvas');
  selectionCtx = selectionCanvas.getContext('2d');
  
  // Capture current frame to the selector canvas
  const width = captureVideo.videoWidth;
  const height = captureVideo.videoHeight;
  
  selectionCanvas.width = width;
  selectionCanvas.height = height;
  
  selectionCtx.drawImage(captureVideo, 0, 0);
  
  // Store the original image so we can redraw during selection
  selectionImageData = selectionCtx.getImageData(0, 0, width, height);
  
  // Show overlay
  overlay.classList.remove('hidden');
  selectionActive = false;
  selectionStart = null;
}

function closeRegionSelector() {
  const overlay = document.getElementById('region-selector-overlay');
  overlay.classList.add('hidden');
  selectionActive = false;
  selectionStart = null;
  selectionImageData = null;
}

// Convert mouse event to canvas coordinates
function getCanvasCoords(e) {
  const rect = selectionCanvas.getBoundingClientRect();
  const scaleX = selectionCanvas.width / rect.width;
  const scaleY = selectionCanvas.height / rect.height;
  
  return {
    x: Math.round((e.clientX - rect.left) * scaleX),
    y: Math.round((e.clientY - rect.top) * scaleY)
  };
}

function drawSelectionBox(x1, y1, x2, y2) {
  // Restore original image
  selectionCtx.putImageData(selectionImageData, 0, 0);
  
  // Draw selection rectangle
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  
  selectionCtx.strokeStyle = '#22c55e';
  selectionCtx.lineWidth = 3;
  selectionCtx.strokeRect(x, y, w, h);
  
  // Semi-transparent fill
  selectionCtx.fillStyle = 'rgba(34, 197, 94, 0.2)';
  selectionCtx.fillRect(x, y, w, h);
}

function handleSelectionMouseDown(e) {
  if (e.target !== selectionCanvas) return;
  
  selectionActive = true;
  selectionStart = getCanvasCoords(e);
}

function handleSelectionMouseMove(e) {
  if (!selectionActive || !selectionStart) return;
  
  const current = getCanvasCoords(e);
  drawSelectionBox(selectionStart.x, selectionStart.y, current.x, current.y);
}

function handleSelectionMouseUp(e) {
  if (!selectionActive || !selectionStart) return;
  
  selectionActive = false;
  
  const end = getCanvasCoords(e);
  
  // Calculate crop region in canvas coordinates
  const x1 = Math.min(selectionStart.x, end.x);
  const y1 = Math.min(selectionStart.y, end.y);
  const x2 = Math.max(selectionStart.x, end.x);
  const y2 = Math.max(selectionStart.y, end.y);
  
  const cropW = x2 - x1;
  const cropH = y2 - y1;
  
  // Validate selection size
  if (cropW < 10 || cropH < 10) {
    closeRegionSelector();
    return;
  }
  
  // Clamp to canvas bounds
  const finalX = Math.max(0, Math.min(x1, selectionCanvas.width - 10));
  const finalY = Math.max(0, Math.min(y1, selectionCanvas.height - 10));
  const finalW = Math.min(cropW, selectionCanvas.width - finalX);
  const finalH = Math.min(cropH, selectionCanvas.height - finalY);
  
  // Update crop region
  cropRegion = {
    x: finalX,
    y: finalY,
    width: finalW,
    height: finalH
  };
  
  // Update inputs
  document.getElementById('crop-x').value = finalX;
  document.getElementById('crop-y').value = finalY;
  document.getElementById('crop-width').value = finalW;
  document.getElementById('crop-height').value = finalH;
  
  closeRegionSelector();
  updateCapturePreview();
}

function handleSelectionKeyDown(e) {
  if (e.key === 'Escape') {
    closeRegionSelector();
  }
}

// ============================================================================
// OCR
// ============================================================================

async function sendToOCR(imageDataUrl) {
  const ocrUrl = document.getElementById('ocr-url').value.trim();
  
  // Extract base64 data (remove "data:image/png;base64," prefix)
  const base64Data = imageDataUrl.split(',')[1];
  
  const response = await fetch(`${ocrUrl}/base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      base64: base64Data,
      trim: "\n"
    })
  });
  
  if (!response.ok) {
    throw new Error(`OCR request failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  return result;
}

// ============================================================================
// Time Parsing
// ============================================================================

function parseServerTime(ocrText) {
  // Clean up OCR text - fix common misreadings
  let text = ocrText
    .replace(/O/g, '0')  // O -> 0
    .replace(/l/g, '1')  // l -> 1
    .replace(/I/g, '1')  // I -> 1
    .replace(/\|/g, '1'); // | -> 1
  
  // Time patterns (ordered by specificity)
  const patterns = [
    // Month + day + time: "Jan 15 14:30:45"
    {
      regex: /([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
      parse: (m) => ({
        month: m[1],
        day: parseInt(m[2]),
        hour: parseInt(m[3]),
        minute: parseInt(m[4]),
        second: parseInt(m[5])
      })
    },
    // Slash date + time: "1/15 14:30:45"
    {
      regex: /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
      parse: (m) => ({
        month: parseInt(m[1]),
        day: parseInt(m[2]),
        hour: parseInt(m[3]),
        minute: parseInt(m[4]),
        second: parseInt(m[5])
      })
    },
    // 12-hour with seconds: "2:30:45 PM"
    {
      regex: /(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM|am|pm)/,
      parse: (m) => {
        let hour = parseInt(m[1]);
        const isPM = m[4].toUpperCase() === 'PM';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        return {
          hour: hour,
          minute: parseInt(m[2]),
          second: parseInt(m[3])
        };
      }
    },
    // 24-hour with seconds: "14:30:45"
    {
      regex: /(\d{1,2}):(\d{2}):(\d{2})/,
      parse: (m) => ({
        hour: parseInt(m[1]),
        minute: parseInt(m[2]),
        second: parseInt(m[3])
      })
    },
    // 12-hour without seconds: "2:30 PM"
    {
      regex: /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/,
      parse: (m) => {
        let hour = parseInt(m[1]);
        const isPM = m[3].toUpperCase() === 'PM';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        return {
          hour: hour,
          minute: parseInt(m[2]),
          second: 0
        };
      }
    },
    // 24-hour without seconds: "14:30"
    {
      regex: /(\d{1,2}):(\d{2})/,
      parse: (m) => ({
        hour: parseInt(m[1]),
        minute: parseInt(m[2]),
        second: 0
      })
    }
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const parsed = pattern.parse(match);
      
      // Validate parsed values
      if (parsed.hour < 0 || parsed.hour > 23) continue;
      if (parsed.minute < 0 || parsed.minute > 59) continue;
      if (parsed.second < 0 || parsed.second > 59) continue;
      
      // Format as HH:MM:SS
      const timeStr = `${parsed.hour.toString().padStart(2, '0')}:${parsed.minute.toString().padStart(2, '0')}:${parsed.second.toString().padStart(2, '0')}`;
      
      return {
        success: true,
        time: timeStr,
        matched: match[0],
        confidence: 1.0
      };
    }
  }
  
  return {
    success: false,
    time: null,
    matched: null,
    confidence: 0
  };
}

// ============================================================================
// Sync Process
// ============================================================================

async function runSync() {
  if (!player || !playerReady) {
    alert('Please load a video first');
    return;
  }
  
  if (!captureStream) {
    alert('Please start screen capture first');
    return;
  }
  
  const interval = parseInt(document.getElementById('interval').value);
  const startTime = parseInt(document.getElementById('start-time').value);
  let endTime = parseInt(document.getElementById('end-time').value);
  const duration = player.getDuration();
  
  if (endTime <= 0 || endTime > duration) {
    endTime = duration;
  }
  
  syncRunning = true;
  syncAborted = false;
  results = [];
  
  // Update UI
  document.getElementById('start-sync-btn').disabled = true;
  document.getElementById('stop-sync-btn').disabled = false;
  document.getElementById('sync-progress').classList.remove('hidden');
  document.getElementById('no-results').classList.add('hidden');
  document.getElementById('results-table').classList.remove('hidden');
  document.getElementById('export-buttons').classList.remove('hidden');
  document.getElementById('results-body').innerHTML = '';
  document.getElementById('last-result').classList.remove('hidden');
  
  // Hide crop controls during sync
  document.getElementById('crop-controls').classList.add('hidden');
  
  // Pause video for consistent captures
  player.pauseVideo();
  
  const totalSteps = Math.ceil((endTime - startTime) / interval);
  let currentStep = 0;
  
  for (let time = startTime; time < endTime && !syncAborted; time += interval) {
    currentStep++;
    const progress = currentStep / totalSteps;
    
    // Update progress
    document.getElementById('progress-fill').style.width = `${progress * 100}%`;
    document.getElementById('status-text').textContent = 
      `Processing ${formatTime(time)} (${currentStep}/${totalSteps})...`;
    
    // Seek to time
    player.seekTo(time, true);
    
    // Wait for seek to complete (YouTube player needs time to update)
    await sleep(1500);
    
    // Capture frame
    let result = {
      videoTime: time,
      videoTimeFormatted: formatTime(time),
      imageDataUrl: null,
      serverTime: null,
      rawOCR: null,
      confidence: 0,
      status: 'pending',
      error: null
    };
    
    try {
      const imageDataUrl = captureFrame();
      result.imageDataUrl = imageDataUrl;
      const ocrResult = await sendToOCR(imageDataUrl);
      
      result.rawOCR = ocrResult.result || ocrResult.text || '';
      
      const parsed = parseServerTime(result.rawOCR);
      if (parsed.success) {
        result.serverTime = parsed.time;
        result.confidence = parsed.confidence;
        result.status = 'success';
      } else {
        result.status = 'error';
        result.error = 'Could not parse time from OCR text';
      }
    } catch (err) {
      result.status = 'error';
      result.error = err.message;
    }
    
    results.push(result);
    addResultRow(result);
    
    // Small delay between captures
    await sleep(500);
  }
  
  // Finish
  syncRunning = false;
  document.getElementById('start-sync-btn').disabled = false;
  document.getElementById('stop-sync-btn').disabled = true;
  document.getElementById('status-text').textContent = 
    syncAborted ? 'Sync aborted' : `Sync complete! ${results.length} frames processed.`;
  
  // Show crop controls again
  document.getElementById('crop-controls').classList.remove('hidden');
}

function stopSync() {
  syncAborted = true;
}

function addResultRow(result) {
  const tbody = document.getElementById('results-body');
  const row = document.createElement('tr');
  
  const statusClass = result.status === 'success' ? 'success' : 'error';
  const statusText = result.status === 'success' ? 'OK' : result.error || 'Error';
  const imageHtml = result.imageDataUrl 
    ? `<img src="${result.imageDataUrl}" alt="Frame at ${result.videoTimeFormatted}" />` 
    : '-';
  
  row.innerHTML = `
    <td>${result.videoTimeFormatted}</td>
    <td>${imageHtml}</td>
    <td>${result.serverTime || '-'}</td>
    <td>${escapeHtml(result.rawOCR || '-')}</td>
    <td><span class="status ${statusClass}">${statusText}</span></td>
  `;
  
  tbody.appendChild(row);
  
  // Update last result display
  updateLastResult(result);
}

function updateLastResult(result) {
  if (result.imageDataUrl) {
    document.getElementById('last-result-img').src = result.imageDataUrl;
  }
  document.getElementById('last-result-video-time').textContent = result.videoTimeFormatted;
  document.getElementById('last-result-server-time').textContent = result.serverTime || '-';
  document.getElementById('last-result-ocr').textContent = result.rawOCR || '-';
}

// ============================================================================
// Export
// ============================================================================

function exportJSON() {
  const data = {
    videoId: parseYouTubeVideoId(document.getElementById('youtube-url').value),
    exportedAt: new Date().toISOString(),
    results: results
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'youtube-sync.json');
}

function exportCSV() {
  const lines = ['Video Time,Video Seconds,Server Time,Raw OCR,Confidence,Status'];
  
  for (const r of results) {
    lines.push([
      r.videoTimeFormatted,
      r.videoTime,
      r.serverTime || '',
      `"${(r.rawOCR || '').replace(/"/g, '""')}"`,
      r.confidence,
      r.status
    ].join(','));
  }
  
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, 'youtube-sync.csv');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function clearResults() {
  results = [];
  document.getElementById('results-body').innerHTML = '';
  document.getElementById('no-results').classList.remove('hidden');
  document.getElementById('results-table').classList.add('hidden');
  document.getElementById('export-buttons').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('status-text').textContent = '';
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Video loading
  document.getElementById('load-video-btn').addEventListener('click', () => {
    const url = document.getElementById('youtube-url').value.trim();
    const videoId = parseYouTubeVideoId(url);
    
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }
    
    loadVideo(videoId);
  });
  
  // Video controls
  document.getElementById('seek-back-60').addEventListener('click', () => seekRelative(-60));
  document.getElementById('seek-back-10').addEventListener('click', () => seekRelative(-10));
  document.getElementById('seek-fwd-10').addEventListener('click', () => seekRelative(10));
  document.getElementById('seek-fwd-60').addEventListener('click', () => seekRelative(60));
  document.getElementById('play-pause-btn').addEventListener('click', togglePlayPause);
  
  // Video size and panning
  document.getElementById('apply-video-size-btn').addEventListener('click', applyVideoSize);
  document.getElementById('pan-mode-btn').addEventListener('click', togglePanMode);
  
  const videoContainer = document.getElementById('video-container');
  videoContainer.addEventListener('mousedown', startVideoDrag);
  document.addEventListener('mousemove', doVideoDrag);
  document.addEventListener('mouseup', stopVideoDrag);
  
  // Screen capture
  document.getElementById('start-capture-btn').addEventListener('click', startScreenCapture);
  document.getElementById('stop-capture-btn').addEventListener('click', stopScreenCapture);
  document.getElementById('select-region-btn').addEventListener('click', openRegionSelector);
  document.getElementById('test-capture-btn').addEventListener('click', updateCapturePreview);
  
  // Region selector - attach to canvas for accurate coordinates
  const selectorCanvas = document.getElementById('region-selector-canvas');
  selectorCanvas.addEventListener('mousedown', handleSelectionMouseDown);
  selectorCanvas.addEventListener('mousemove', handleSelectionMouseMove);
  selectorCanvas.addEventListener('mouseup', handleSelectionMouseUp);
  document.addEventListener('keydown', handleSelectionKeyDown);
  
  // Crop controls
  document.getElementById('update-crop-btn').addEventListener('click', () => {
    cropRegion.x = parseInt(document.getElementById('crop-x').value) || 0;
    cropRegion.y = parseInt(document.getElementById('crop-y').value) || 0;
    cropRegion.width = parseInt(document.getElementById('crop-width').value) || 200;
    cropRegion.height = parseInt(document.getElementById('crop-height').value) || 50;
    updateCapturePreview();
  });
  
  // Sync controls
  document.getElementById('start-sync-btn').addEventListener('click', runSync);
  document.getElementById('stop-sync-btn').addEventListener('click', stopSync);
  
  // Export
  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('clear-results-btn').addEventListener('click', clearResults);
  
  // Allow Enter key in URL field
  document.getElementById('youtube-url').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('load-video-btn').click();
    }
  });
});
