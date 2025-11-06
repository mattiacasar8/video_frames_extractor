/**
 * Video Frame Extractor - Canvas API Version
 * Pure browser implementation, no FFmpeg needed
 */

// ==========================================
// Utility Functions
// ==========================================

const Utils = {
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    parseTime(timeString) {
        const parts = timeString.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    },

    generateFilename(pattern, frameNumber, timestamp, customName = '') {
        let filename = pattern;
        
        filename = filename.replace(/{frame}/g, frameNumber);
        
        const paddingMatch = filename.match(/{frame:0(\d+)d}/);
        if (paddingMatch) {
            const padding = parseInt(paddingMatch[1]);
            filename = filename.replace(/{frame:0\d+d}/, frameNumber.toString().padStart(padding, '0'));
        }
        
        filename = filename.replace(/{timestamp}/g, timestamp.replace(/:/g, '-').replace(/\./g, '_'));
        filename = filename.replace(/{name}/g, customName || 'video');
        
        return filename;
    }
};

// ==========================================
// Timeline Controller
// ==========================================

class TimelineController {
    constructor(videoElement, trackElement, selectionElement, startHandle, endHandle) {
        this.video = videoElement;
        this.track = trackElement;
        this.selection = selectionElement;
        this.startHandle = startHandle;
        this.endHandle = endHandle;
        
        this.startPercent = 0;
        this.endPercent = 100;
        this.isDragging = false;
        this.activeHandle = null;
        
        this.onChangeCallback = null;
        
        this.init();
    }

    init() {
        this.startHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'start'));
        this.endHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'end'));
        
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        
        this.track.addEventListener('click', (e) => this.handleTrackClick(e));
    }

    startDrag(e, handle) {
        e.preventDefault();
        this.isDragging = true;
        this.activeHandle = handle;
    }

    drag(e) {
        if (!this.isDragging) return;

        const rect = this.track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

        if (this.activeHandle === 'start') {
            this.startPercent = Math.min(percent, this.endPercent - 1);
        } else if (this.activeHandle === 'end') {
            this.endPercent = Math.max(percent, this.startPercent + 1);
        }

        this.updateUI();
        this.triggerChange();
    }

    stopDrag() {
        this.isDragging = false;
        this.activeHandle = null;
    }

    handleTrackClick(e) {
        if (this.isDragging) return;

        const rect = this.track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = (x / rect.width) * 100;

        const distToStart = Math.abs(percent - this.startPercent);
        const distToEnd = Math.abs(percent - this.endPercent);

        if (distToStart < distToEnd) {
            this.startPercent = Math.min(percent, this.endPercent - 1);
        } else {
            this.endPercent = Math.max(percent, this.startPercent + 1);
        }

        this.updateUI();
        this.triggerChange();
    }

    updateUI() {
        this.startHandle.style.left = `${this.startPercent}%`;
        this.endHandle.style.left = `${this.endPercent}%`;
        
        this.selection.style.left = `${this.startPercent}%`;
        this.selection.style.width = `${this.endPercent - this.startPercent}%`;
    }

    getStartTime() {
        return (this.startPercent / 100) * this.video.duration;
    }

    getEndTime() {
        return (this.endPercent / 100) * this.video.duration;
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }

    triggerChange() {
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getStartTime(), this.getEndTime());
        }
    }

    reset() {
        this.startPercent = 0;
        this.endPercent = 100;
        this.updateUI();
        this.triggerChange();
    }
}

// ==========================================
// Frame Extractor (Canvas API)
// ==========================================

class FrameExtractor {
    constructor() {
        this.videoElement = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.videoMetadata = {
            duration: 0,
            width: 0,
            height: 0
        };
    }

    async loadVideo(file, videoElement) {
        this.videoElement = videoElement;
        
        return new Promise((resolve, reject) => {
            const video = videoElement;
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                this.videoMetadata = {
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight
                };
                
                resolve(this.videoMetadata);
            };
            
            video.onerror = () => {
                reject(new Error('Failed to load video metadata'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    async extractFrames(startTime, endTime, fps, scale, format, quality, onProgress) {
        const duration = endTime - startTime;
        const interval = 1 / fps;
        const frameCount = Math.ceil(duration * fps);
        
        const frames = [];
        
        // Setup canvas dimensions
        this.canvas.width = Math.floor(this.videoMetadata.width * scale);
        this.canvas.height = Math.floor(this.videoMetadata.height * scale);
        
        console.log(`Extracting ${frameCount} frames from ${startTime}s to ${endTime}s at ${fps} fps`);
        console.log(`Canvas size: ${this.canvas.width}x${this.canvas.height}`);
        
        // Extract frames
        for (let i = 0; i < frameCount; i++) {
            const timestamp = startTime + (i * interval);
            
            // Seek to frame
            await this.seekToTime(timestamp);
            
            // Draw frame to canvas
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to blob
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const blob = await new Promise(resolve => {
                this.canvas.toBlob(resolve, mimeType, quality);
            });
            
            const data = new Uint8Array(await blob.arrayBuffer());
            
            frames.push({
                data: data,
                timestamp: timestamp,
                frameNumber: i + 1
            });
            
            // Update progress
            const progress = (i + 1) / frameCount;
            onProgress(progress, `Extracting frame ${i + 1}/${frameCount}`);
        }
        
        return frames;
    }

    seekToTime(time) {
        return new Promise((resolve) => {
            const video = this.videoElement;
            
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                // Small delay to ensure frame is rendered
                setTimeout(resolve, 50);
            };
            
            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;
        });
    }

    async createZip(frames, namingPattern, customName, format, onProgress) {
        const zip = new JSZip();
        const extension = format === 'png' ? 'png' : 'jpg';

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const timestamp = Utils.formatTime(frame.timestamp);
            const filename = Utils.generateFilename(
                namingPattern,
                frame.frameNumber,
                timestamp,
                customName
            ) + '.' + extension;
            
            zip.file(filename, frame.data);
            onProgress((i + 1) / frames.length);
        }

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return blob;
    }

    estimateFrameCount(startTime, endTime, fps) {
        const duration = endTime - startTime;
        return Math.ceil(duration * fps);
    }

    estimateSize(frameCount, width, height, format, scale, quality) {
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const pixels = scaledWidth * scaledHeight;
        
        // Rough estimates based on format
        let bytesPerPixel;
        if (format === 'png') {
            bytesPerPixel = 3; // PNG is larger
        } else {
            // JPEG quality factor
            bytesPerPixel = 0.2 + (quality * 0.8); // Varies with quality
        }
        
        const estimatedBytesPerFrame = pixels * bytesPerPixel;
        const totalBytes = frameCount * estimatedBytesPerFrame;
        
        return Utils.formatBytes(totalBytes);
    }
}

// ==========================================
// UI Controller
// ==========================================

class UIController {
    constructor() {
        this.extractor = new FrameExtractor();
        this.timeline = null;
        this.currentVideoFile = null;
        
        this.elements = this.getElements();
        this.state = {
            videoLoaded: false,
            processing: false,
            extractedZip: null
        };
        
        this.init();
    }

    getElements() {
        return {
            uploadSection: document.getElementById('uploadSection'),
            videoSection: document.getElementById('videoSection'),
            settingsSection: document.getElementById('settingsSection'),
            actionsSection: document.getElementById('actionsSection'),
            progressSection: document.getElementById('progressSection'),
            resultSection: document.getElementById('resultSection'),
            
            uploadArea: document.getElementById('uploadArea'),
            videoInput: document.getElementById('videoInput'),
            
            videoPlayer: document.getElementById('videoPlayer'),
            videoDuration: document.getElementById('videoDuration'),
            
            timelineTrack: document.getElementById('timelineTrack'),
            timelineSelection: document.getElementById('timelineSelection'),
            handleStart: document.getElementById('handleStart'),
            handleEnd: document.getElementById('handleEnd'),
            startTime: document.getElementById('startTime'),
            endTime: document.getElementById('endTime'),
            selectionDuration: document.getElementById('selectionDuration'),
            
            frameRate: document.getElementById('frameRate'),
            scaleResolution: document.getElementById('scaleResolution'),
            imageFormat: document.getElementById('imageFormat'),
            jpegQuality: document.getElementById('jpegQuality'),
            qualityDisplay: document.getElementById('qualityDisplay'),
            namingPattern: document.getElementById('namingPattern'),
            customName: document.getElementById('customName'),
            originalResolution: document.getElementById('originalResolution'),
            estimatedFrames: document.getElementById('estimatedFrames'),
            estimatedSize: document.getElementById('estimatedSize'),
            
            extractBtn: document.getElementById('extractBtn'),
            resetBtn: document.getElementById('resetBtn'),
            
            progressText: document.getElementById('progressText'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),
            progressDetails: document.getElementById('progressDetails'),
            
            resultSummary: document.getElementById('resultSummary'),
            downloadBtn: document.getElementById('downloadBtn')
        };
    }

    init() {
        this.setupUpload();
        this.setupActions();
        this.setupSettings();
        console.log('Video Frame Extractor initialized (Canvas API version)');
    }

    setupUpload() {
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.videoInput.click();
        });

        this.elements.videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleVideoFile(file);
            }
        });

        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('drag-over');
        });

        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('drag-over');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                this.handleVideoFile(file);
            }
        });
    }

    setupActions() {
        this.elements.extractBtn.addEventListener('click', () => {
            this.extractFrames();
        });

        this.elements.resetBtn.addEventListener('click', () => {
            this.reset();
        });

        this.elements.downloadBtn.addEventListener('click', () => {
            this.downloadZip();
        });
    }

    setupSettings() {
        ['frameRate', 'scaleResolution', 'imageFormat', 'jpegQuality'].forEach(id => {
            this.elements[id].addEventListener('change', () => {
                this.updateEstimates();
            });
            this.elements[id].addEventListener('input', () => {
                if (id === 'jpegQuality') {
                    const quality = Math.round(parseFloat(this.elements.jpegQuality.value) * 100);
                    this.elements.qualityDisplay.textContent = quality;
                }
                this.updateEstimates();
            });
        });
    }

    async handleVideoFile(file) {
        try {
            console.log('Loading video:', file.name);
            this.currentVideoFile = file;
            
            const metadata = await this.extractor.loadVideo(file, this.elements.videoPlayer);
            console.log('Video metadata:', metadata);

            this.elements.videoDuration.textContent = Utils.formatTime(metadata.duration);
            this.elements.originalResolution.textContent = `${metadata.width}x${metadata.height}`;

            this.timeline = new TimelineController(
                this.elements.videoPlayer,
                this.elements.timelineTrack,
                this.elements.timelineSelection,
                this.elements.handleStart,
                this.elements.handleEnd
            );

            this.timeline.onChange((start, end) => {
                this.updateTimeLabels(start, end);
                this.updateEstimates();
            });

            this.timeline.reset();
            this.updateTimeLabels(0, metadata.duration);
            this.updateEstimates();

            this.elements.uploadSection.classList.add('hidden');
            this.elements.videoSection.classList.remove('hidden');
            this.elements.settingsSection.classList.remove('hidden');
            this.elements.actionsSection.classList.remove('hidden');

            this.state.videoLoaded = true;

        } catch (error) {
            console.error('Error loading video:', error);
            alert('Failed to load video file. Please try another file.');
        }
    }

    updateTimeLabels(start, end) {
        this.elements.startTime.value = Utils.formatTime(start);
        this.elements.endTime.value = Utils.formatTime(end);
        this.elements.selectionDuration.value = Utils.formatTime(end - start);
    }

    updateEstimates() {
        if (!this.state.videoLoaded || !this.timeline) return;

        const startTime = this.timeline.getStartTime();
        const endTime = this.timeline.getEndTime();
        const fps = parseInt(this.elements.frameRate.value);
        const scale = parseFloat(this.elements.scaleResolution.value);
        const format = this.elements.imageFormat.value;
        const quality = parseFloat(this.elements.jpegQuality.value);

        const frameCount = this.extractor.estimateFrameCount(startTime, endTime, fps);
        const size = this.extractor.estimateSize(
            frameCount,
            this.extractor.videoMetadata.width,
            this.extractor.videoMetadata.height,
            format,
            scale,
            quality
        );

        this.elements.estimatedFrames.textContent = frameCount;
        this.elements.estimatedSize.textContent = size;
    }

    async extractFrames() {
        if (this.state.processing) return;

        try {
            this.state.processing = true;
            
            this.elements.actionsSection.classList.add('hidden');
            this.elements.progressSection.classList.remove('hidden');

            const settings = {
                startTime: this.timeline.getStartTime(),
                endTime: this.timeline.getEndTime(),
                fps: parseInt(this.elements.frameRate.value),
                scale: parseFloat(this.elements.scaleResolution.value),
                format: this.elements.imageFormat.value,
                quality: parseFloat(this.elements.jpegQuality.value),
                namingPattern: this.elements.namingPattern.value,
                customName: this.elements.customName.value
            };

            console.log('Extraction settings:', settings);

            // Extract frames
            this.updateProgress('Extracting frames...', 0);
            
            const frames = await this.extractor.extractFrames(
                settings.startTime,
                settings.endTime,
                settings.fps,
                settings.scale,
                settings.format,
                settings.quality,
                (progress, status) => {
                    this.updateProgress(status, progress * 0.8);
                }
            );

            console.log(`Extracted ${frames.length} frames`);

            // Create ZIP
            this.updateProgress('Creating ZIP archive...', 0.8);
            
            const zipBlob = await this.extractor.createZip(
                frames,
                settings.namingPattern,
                settings.customName,
                settings.format,
                (progress) => {
                    this.updateProgress('Creating ZIP archive...', 0.8 + (progress * 0.2));
                }
            );

            this.state.extractedZip = zipBlob;

            // Show result
            this.elements.progressSection.classList.add('hidden');
            this.elements.resultSection.classList.remove('hidden');
            this.elements.resultSummary.textContent = `${frames.length} frames extracted successfully (${Utils.formatBytes(zipBlob.size)})`;

        } catch (error) {
            console.error('Extraction error:', error);
            alert('Failed to extract frames: ' + error.message);
            
            this.elements.progressSection.classList.add('hidden');
            this.elements.actionsSection.classList.remove('hidden');
        } finally {
            this.state.processing = false;
        }
    }

    updateProgress(text, percent) {
        this.elements.progressText.textContent = text;
        this.elements.progressPercent.textContent = `${Math.round(percent * 100)}%`;
        this.elements.progressFill.style.width = `${percent * 100}%`;
    }

    downloadZip() {
        if (!this.state.extractedZip) return;

        const url = URL.createObjectURL(this.state.extractedZip);
        const a = document.createElement('a');
        const customName = this.elements.customName.value || 'video';
        a.href = url;
        a.download = `${customName}_frames.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    reset() {
        this.state.videoLoaded = false;
        this.state.processing = false;
        this.state.extractedZip = null;

        if (this.elements.videoPlayer.src) {
            URL.revokeObjectURL(this.elements.videoPlayer.src);
            this.elements.videoPlayer.src = '';
        }

        this.elements.videoInput.value = '';

        this.elements.uploadSection.classList.remove('hidden');
        this.elements.videoSection.classList.add('hidden');
        this.elements.settingsSection.classList.add('hidden');
        this.elements.actionsSection.classList.add('hidden');
        this.elements.progressSection.classList.add('hidden');
        this.elements.resultSection.classList.add('hidden');

        if (this.timeline) {
            this.timeline.reset();
            this.timeline = null;
        }

        console.log('App reset');
    }
}

// ==========================================
// Initialize App
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new UIController();
});