# Feature Requests & Implementation Ideas

This document contains potential improvements, features, and enhancements for the Video Frame Extractor application.

---

## 🎯 High Priority Features

### 1. Advanced Frame Selection Options

**Current State:** When in queue mode, all videos are extracted in full (start to end).

**Proposed Enhancement:**
- Add per-video timeline configuration in single video mode
- In queue mode, allow setting a default time range (e.g., "extract first 10 seconds from each video")
- Advanced: Individual timeline controls for each video in queue

**Implementation:**
```javascript
// Add to video queue item structure
{
  id: ...,
  file: ...,
  metadata: ...,
  status: ...,
  timeRange: { start: 0, end: duration } // Allow custom range per video
}

// UI: Add "Configure" button next to each queue item
// Opens modal/expandable section with mini timeline
```

**Benefits:**
- More granular control over extraction
- Useful for extracting specific segments from multiple videos
- Reduces processing time and output size

---

### 2. Smart Frame Selection Mode

**Proposed Mode:**

#### BLUR DETECTION
https://github.com/Utkarsh-Deshmukh/Blurry-Image-Detector
Let's introduce a selection for our extraction, if we are extraction at a certian FPS, then select double the frames and compare between them to select the best ones based on blur score. (the "double" figure could be adjusted in a setting, with a question like "how many frames to compare" the comparison should be only on 1 second of video for each batch, not the whole frames, the frames should stay at roughly the desired distance)

---

### 3. Progress Improvements

**Current State:** Basic progress bar

**Enhancements:**
- **ETA calculation** - Show estimated time remaining
- **Speed indicator** - Frames per second being processed
- **Detailed logs** - Expandable processing log
- **Pause/Resume** - Ability to pause and continue later
- **Background processing** - Use Web Workers for better performance

**Implementation:**
```javascript
class ProgressTracker {
  constructor(totalFrames) {
    this.totalFrames = totalFrames;
    this.processedFrames = 0;
    this.startTime = Date.now();
  }

  update(framesProcessed) {
    this.processedFrames = framesProcessed;
  }

  getETA() {
    const elapsed = Date.now() - this.startTime;
    const rate = this.processedFrames / (elapsed / 1000); // frames per second
    const remaining = this.totalFrames - this.processedFrames;
    return remaining / rate; // seconds
  }

  getSpeed() {
    const elapsed = Date.now() - this.startTime;
    return this.processedFrames / (elapsed / 1000);
  }
}
```

---

### 4. Frame Analysis Tools


#### Quality Metrics
- Blur detection (reject out-of-focus frames)
once the whole video is processed (or videos) we should have the scores of all the blur estimations, we should use this with a treshold to allow the user to remove any frames that are over a treshold. there should be a preview when we change the treshold that shows the best frame for that treshold.


---