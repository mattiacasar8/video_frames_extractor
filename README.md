# Video Frame Extractor

A browser-based tool for extracting frames from video files with precise control over time range, frame rate, and output settings.

## Features

- 🎬 **Visual Timeline Selection** - Drag handles to select exact start/end points
- ⚡ **Custom Frame Rate** - Extract at any FPS (1-120)
- 📐 **Resolution Scaling** - Downscale to 75%, 50%, or 25% of original
- 🖼️ **Format Options** - Output as PNG (lossless) or JPG (smaller size)
- 📝 **Custom Naming** - Flexible naming patterns with templates
- 📦 **ZIP Export** - Download all frames as a convenient ZIP file
- 🔒 **Privacy First** - All processing happens locally in your browser

## Quick Start

1. **Open the tool**
   ```bash
   cd /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor
   open index.html
   ```
   
   Or simply double-click `index.html` in Finder

2. **Upload a video**
   - Drag & drop a video file
   - Or click the upload area to browse

3. **Select region**
   - Drag the blue handles on the timeline
   - Or click anywhere on the timeline

4. **Configure settings**
   - Frame rate (fps)
   - Resolution scale
   - Image format
   - Naming pattern

5. **Extract & download**
   - Click "Extract Frames"
   - Wait for processing
   - Download the ZIP file

## File Structure

```
video_frames_extractor/
├── index.html          # Main UI structure
├── style.css           # Styling and layout
├── app.js              # Application logic
└── README.md           # This file
```

## Architecture

The app is organized into modular classes:

### `VideoProcessor`
Handles FFmpeg.wasm integration for video processing
- Loading FFmpeg engine
- Extracting frames from video
- Filesystem management

### `TimelineController`
Manages timeline UI and user interactions
- Handle dragging
- Time range selection
- Visual updates

### `FrameExtractor`
Core extraction logic
- Video metadata parsing
- Frame extraction coordination
- Format conversion
- ZIP creation

### `UIController`
Main application controller
- State management
- Event handling
- UI updates
- User flow coordination

### `Utils`
Helper functions
- Time formatting
- File naming
- Size calculations

## Configuration Options

### Frame Rate
Extract frames at a specific rate (1-120 fps). Lower values = fewer frames.

**Example:**
- Original: 60 fps
- Extract at: 10 fps
- Result: 1 frame every 6 original frames

### Resolution Scale
Downscale output resolution to save space:
- `1.0` - Original size (e.g., 1920x1080)
- `0.75` - 75% (e.g., 1440x810)
- `0.5` - 50% (e.g., 960x540)
- `0.25` - 25% (e.g., 480x270)

### Naming Pattern
Customize output filenames using templates:

| Template | Description | Example |
|----------|-------------|---------|
| `{frame}` | Frame number | `frame_42.png` |
| `{frame:04d}` | Zero-padded frame number | `frame_0042.png` |
| `{timestamp}` | Time in video | `frame_00-02-15.png` |
| `{name}` | Custom name field | `myvideo_0042.png` |

**Default pattern:** `frame_{frame:04d}`

**Examples:**
- `{name}_{frame:04d}` → `project_0001.jpg`, `project_0002.jpg`
- `shot_{timestamp}` → `shot_00-00-01.png`, `shot_00-00-02.png`
- `frame{frame}` → `frame1.jpg`, `frame2.jpg`

## Technical Details

### Dependencies (loaded via CDN)
- **FFmpeg.wasm** - Video processing in browser
- **JSZip** - ZIP file creation
- No npm or build tools required

### Browser Requirements
- Modern browser (Chrome, Firefox, Safari, Edge)
- ~2GB RAM recommended for smooth operation
- JavaScript enabled

### Limitations
- Max video size: ~500MB (browser memory limit)
- Processing speed: 3-5x slower than native FFmpeg
- Large videos may take time to process

### Supported Formats
**Input:** MP4, MOV, AVI, WebM, and most common video formats
**Output:** PNG (lossless) or JPG (compressed)

## Performance Tips

1. **For faster processing:**
   - Use lower frame rates
   - Scale down resolution
   - Select shorter time ranges
   - Use JPG instead of PNG

2. **For best quality:**
   - Keep original resolution (100%)
   - Use PNG format
   - Extract at original FPS

3. **For smallest file size:**
   - Use JPG format
   - Scale to 50% or 25%
   - Extract at lower FPS (5-15)

## Troubleshooting

### Video won't load
- Check file format (must be browser-supported video)
- Verify file isn't corrupted
- Try a different browser
- File might be too large (>500MB)

### Processing is slow
- This is normal - browser processing is slower than native
- For a 10-second clip at 30fps, expect 10-30 seconds processing
- Close other browser tabs to free memory

### Out of memory error
- Video file is too large
- Try scaling down resolution
- Select a shorter time range
- Close other applications

## Future Enhancements

Possible additions:
- Video preview thumbnails on timeline
- Batch processing multiple videos
- Additional output formats (WebP, AVIF)
- Frame analysis tools
- Custom quality settings
- Export individual frames

## License

MIT License - Feel free to modify and use as needed

## Credits

Built with:
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [JSZip](https://stuk.github.io/jszip/)
