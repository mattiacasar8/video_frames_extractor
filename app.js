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
// Progress Tracker
// ==========================================

class ProgressTracker {
    constructor(totalFrames) {
        this.totalFrames = totalFrames;
        this.processedFrames = 0;
        this.startTime = Date.now();
        this.lastUpdateTime = Date.now();
        this.framesSinceLastUpdate = 0;
    }

    update(framesProcessed) {
        const now = Date.now();
        const deltaFrames = framesProcessed - this.processedFrames;

        this.processedFrames = framesProcessed;
        this.framesSinceLastUpdate += deltaFrames;

        // Update speed calculation every 500ms
        if (now - this.lastUpdateTime > 500) {
            this.lastUpdateTime = now;
            this.framesSinceLastUpdate = 0;
        }
    }

    getETA() {
        const elapsed = (Date.now() - this.startTime) / 1000; // seconds
        if (this.processedFrames === 0) return 0;

        const rate = this.processedFrames / elapsed; // frames per second
        const remaining = this.totalFrames - this.processedFrames;
        return remaining / rate; // seconds
    }

    getSpeed() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (elapsed === 0) return 0;
        return this.processedFrames / elapsed; // frames per second
    }

    formatETA() {
        const eta = this.getETA();
        if (!isFinite(eta) || eta < 0) return 'Calculating...';

        const minutes = Math.floor(eta / 60);
        const seconds = Math.floor(eta % 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    getProgress() {
        return this.processedFrames / this.totalFrames;
    }
}

// ==========================================
// Blur Detection
// ==========================================

class BlurDetector {
    // Calculate Laplacian variance for blur detection
    // Optimized version with downsampling and pixel sampling
    static calculateBlurScore(imageData, options = {}) {
        const {
            downsampleSize = 320,  // Downsample to this width for faster processing
            sampleRate = 2         // Process every Nth pixel
        } = options;

        const { width, height, data } = imageData;

        // For small images, don't downsample
        const shouldDownsample = width > downsampleSize;
        const scale = shouldDownsample ? downsampleSize / width : 1;
        const targetWidth = Math.floor(width * scale);
        const targetHeight = Math.floor(height * scale);

        // Convert to grayscale (downsampled)
        const gray = new Float32Array(targetWidth * targetHeight);

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                // Map back to original coordinates
                const srcX = Math.floor(x / scale);
                const srcY = Math.floor(y / scale);
                const srcIdx = (srcY * width + srcX) * 4;

                const idx = y * targetWidth + x;
                gray[idx] = 0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2];
            }
        }

        // Apply Laplacian operator with pixel sampling for speed
        let varianceSum = 0;
        let varianceCount = 0;

        for (let y = 1; y < targetHeight - 1; y += sampleRate) {
            for (let x = 1; x < targetWidth - 1; x += sampleRate) {
                const idx = y * targetWidth + x;
                const laplacianValue =
                    -1 * gray[(y-1) * targetWidth + (x-1)] +
                    -1 * gray[(y-1) * targetWidth + x] +
                    -1 * gray[(y-1) * targetWidth + (x+1)] +
                    -1 * gray[y * targetWidth + (x-1)] +
                    8 * gray[idx] +
                    -1 * gray[y * targetWidth + (x+1)] +
                    -1 * gray[(y+1) * targetWidth + (x-1)] +
                    -1 * gray[(y+1) * targetWidth + x] +
                    -1 * gray[(y+1) * targetWidth + (x+1)];

                varianceSum += laplacianValue * laplacianValue;
                varianceCount++;
            }
        }

        // Return variance as blur score (higher = sharper)
        return varianceSum / varianceCount;
    }

    // Compare multiple frames and select the sharpest
    static selectSharpestFrame(frames) {
        let maxScore = -1;
        let sharpestFrame = null;

        for (const frame of frames) {
            if (frame.blurScore > maxScore) {
                maxScore = frame.blurScore;
                sharpestFrame = frame;
            }
        }

        return sharpestFrame;
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

    async extractFrames(startTime, endTime, fps, scale, format, quality, onProgress, options = {}) {
        const {
            useBlurDetection = false,
            enableQualityMetrics = false,
            blurComparisonCount = 2,
            blurComparisonWindow = 1.0 // seconds
        } = options;

        const duration = endTime - startTime;
        const interval = 1 / fps;
        let frameCount = Math.ceil(duration * fps);

        const frames = [];

        // Setup canvas dimensions
        this.canvas.width = Math.floor(this.videoMetadata.width * scale);
        this.canvas.height = Math.floor(this.videoMetadata.height * scale);

        console.log(`Extracting ${frameCount} frames from ${startTime}s to ${endTime}s`);
        if (useBlurDetection) {
            console.log(`Blur detection enabled: comparing ${blurComparisonCount} frames per position`);
        }

        // Extract frames
        for (let i = 0; i < frameCount; i++) {
            const targetTimestamp = startTime + (i * interval);

            if (useBlurDetection) {
                // Extract multiple frames around this timestamp for comparison
                const comparisonFrames = [];
                const windowPerFrame = blurComparisonWindow / blurComparisonCount;

                for (let j = 0; j < blurComparisonCount; j++) {
                    const offset = (j - (blurComparisonCount - 1) / 2) * windowPerFrame;
                    const timestamp = Math.max(startTime, Math.min(endTime, targetTimestamp + offset));

                    await this.seekToTime(timestamp);
                    this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

                    // Calculate blur score (optimized)
                    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    const blurScore = BlurDetector.calculateBlurScore(imageData, {
                        downsampleSize: 320,
                        sampleRate: 2
                    });

                    // Convert to blob
                    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                    const blob = await new Promise(resolve => {
                        this.canvas.toBlob(resolve, mimeType, quality);
                    });

                    const data = new Uint8Array(await blob.arrayBuffer());

                    comparisonFrames.push({
                        data: data,
                        timestamp: timestamp,
                        blurScore: blurScore,
                        frameNumber: i + 1
                    });
                }

                // Select the sharpest frame
                const sharpestFrame = BlurDetector.selectSharpestFrame(comparisonFrames);
                frames.push(sharpestFrame);

                // Update progress
                const progress = (i + 1) / frameCount;
                onProgress(progress, `Extracting & analyzing frame ${i + 1}/${frameCount}`);

            } else {
                // Standard extraction without blur detection
                await this.seekToTime(targetTimestamp);
                this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

                // Only calculate blur score if quality metrics are enabled
                let blurScore = 0;
                if (enableQualityMetrics) {
                    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    blurScore = BlurDetector.calculateBlurScore(imageData, {
                        downsampleSize: 320,
                        sampleRate: 2
                    });
                }

                // Convert to blob
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                const blob = await new Promise(resolve => {
                    this.canvas.toBlob(resolve, mimeType, quality);
                });

                const data = new Uint8Array(await blob.arrayBuffer());

                frames.push({
                    data: data,
                    timestamp: targetTimestamp,
                    frameNumber: i + 1,
                    blurScore: blurScore
                });

                // Update progress more frequently
                const progress = (i + 1) / frameCount;
                onProgress(progress, `Extracting frame ${i + 1}/${frameCount}`);
            }
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
        this.videoQueue = [];
        this.currentSettings = null;
        this.cancelRequested = false;
        this.extractedFrames = [];
        this.progressTracker = null;

        this.elements = this.getElements();
        this.state = {
            videoLoaded: false,
            processing: false,
            extractedZip: null,
            queueMode: false
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
            videoQueue: document.getElementById('videoQueue'),
            queueList: document.getElementById('queueList'),
            queueCount: document.getElementById('queueCount'),
            clearQueueBtn: document.getElementById('clearQueueBtn'),
            addMoreBtn: document.getElementById('addMoreBtn'),
            processQueueBtn: document.getElementById('processQueueBtn'),

            videoPlayer: document.getElementById('videoPlayer'),
            videoDuration: document.getElementById('videoDuration'),

            timelineTrack: document.getElementById('timelineTrack'),
            timelineSelection: document.getElementById('timelineSelection'),
            handleStart: document.getElementById('handleStart'),
            handleEnd: document.getElementById('handleEnd'),
            startTime: document.getElementById('startTime'),
            endTime: document.getElementById('endTime'),
            selectionDuration: document.getElementById('selectionDuration'),

            settingsInfo: document.getElementById('settingsInfo'),
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

            enableQualityMetrics: document.getElementById('enableQualityMetrics'),
            useBlurDetection: document.getElementById('useBlurDetection'),
            blurSettings: document.getElementById('blurSettings'),
            blurComparisonCount: document.getElementById('blurComparisonCount'),
            blurComparisonWindow: document.getElementById('blurComparisonWindow'),

            extractBtn: document.getElementById('extractBtn'),
            resetBtn: document.getElementById('resetBtn'),

            progressText: document.getElementById('progressText'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),
            progressDetails: document.getElementById('progressDetails'),
            progressVideoInfo: document.getElementById('progressVideoInfo'),
            progressSpeed: document.getElementById('progressSpeed'),
            progressETA: document.getElementById('progressETA'),
            cancelBtn: document.getElementById('cancelBtn'),

            qualitySection: document.getElementById('qualitySection'),
            blurThreshold: document.getElementById('blurThreshold'),
            totalFramesCount: document.getElementById('totalFramesCount'),
            keptFramesCount: document.getElementById('keptFramesCount'),
            removedFramesCount: document.getElementById('removedFramesCount'),
            maxBlurScore: document.getElementById('maxBlurScore'),
            thresholdBlurScore: document.getElementById('thresholdBlurScore'),
            minBlurScore: document.getElementById('minBlurScore'),
            sharpestPreview: document.getElementById('sharpestPreview'),
            thresholdPreview: document.getElementById('thresholdPreview'),
            blurriestPreview: document.getElementById('blurriestPreview'),
            skipQualityBtn: document.getElementById('skipQualityBtn'),
            applyQualityBtn: document.getElementById('applyQualityBtn'),

            resultSummary: document.getElementById('resultSummary'),
            downloadBtn: document.getElementById('downloadBtn'),
            processAnotherBtn: document.getElementById('processAnotherBtn')
        };
    }

    init() {
        this.setupUpload();
        this.setupActions();
        this.setupSettings();
        this.setupBlurDetection();
        this.setupQuality();
        console.log('Video Frame Extractor initialized (Canvas API version)');
    }

    setupBlurDetection() {
        // When blur detection is enabled, also enable quality metrics
        this.elements.useBlurDetection.addEventListener('change', () => {
            const blurSettings = document.querySelectorAll('.blur-settings');
            blurSettings.forEach(elem => {
                if (this.elements.useBlurDetection.checked) {
                    elem.classList.remove('hidden');
                    // Auto-enable quality metrics when blur detection is enabled
                    this.elements.enableQualityMetrics.checked = true;
                } else {
                    elem.classList.add('hidden');
                }
            });
        });

        // Warn if blur detection is enabled but quality metrics is disabled
        this.elements.enableQualityMetrics.addEventListener('change', () => {
            if (!this.elements.enableQualityMetrics.checked && this.elements.useBlurDetection.checked) {
                this.elements.useBlurDetection.checked = false;
                const blurSettings = document.querySelectorAll('.blur-settings');
                blurSettings.forEach(elem => elem.classList.add('hidden'));
                alert('Blur detection requires quality metrics to be enabled. Both features have been disabled.');
            }
        });
    }

    setupQuality() {
        this.elements.blurThreshold.addEventListener('input', () => {
            if (this.extractedFrames.length > 0) {
                this.updateQualityPreview();
            }
        });

        this.elements.skipQualityBtn.addEventListener('click', () => {
            this.proceedToZipCreation(this.extractedFrames);
        });

        this.elements.applyQualityBtn.addEventListener('click', () => {
            const threshold = parseFloat(this.elements.blurThreshold.value);
            const filteredFrames = this.extractedFrames.filter(f => f.blurScore >= threshold);

            if (filteredFrames.length === 0) {
                alert('All frames would be removed with this threshold. Please adjust the threshold.');
                return;
            }

            this.proceedToZipCreation(filteredFrames);
        });
    }

    setupUpload() {
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.videoInput.click();
        });

        this.elements.videoInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.handleVideoFiles(files);
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

            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
            if (files.length > 0) {
                this.handleVideoFiles(files);
            }
        });

        // Queue management
        this.elements.clearQueueBtn.addEventListener('click', () => {
            this.clearQueue();
        });

        this.elements.addMoreBtn.addEventListener('click', () => {
            this.elements.videoInput.click();
        });

        this.elements.processQueueBtn.addEventListener('click', () => {
            this.processQueue();
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

        this.elements.processAnotherBtn.addEventListener('click', () => {
            this.reset();
        });

        this.elements.cancelBtn.addEventListener('click', () => {
            this.cancelProcessing();
        });
    }

    setupSettings() {
        ['frameRate', 'scaleResolution', 'imageFormat', 'jpegQuality'].forEach(id => {
            this.elements[id].addEventListener('change', () => {
                this.updateEstimates();
                // Also update queue estimates if in queue mode
                if (this.state.queueMode && this.videoQueue.length > 0) {
                    this.updateQueueEstimates();
                }
            });
            this.elements[id].addEventListener('input', () => {
                if (id === 'jpegQuality') {
                    const quality = Math.round(parseFloat(this.elements.jpegQuality.value) * 100);
                    this.elements.qualityDisplay.textContent = quality;
                }
                this.updateEstimates();
                // Also update queue estimates if in queue mode
                if (this.state.queueMode && this.videoQueue.length > 0) {
                    this.updateQueueEstimates();
                }
            });
        });
    }

    async handleVideoFiles(files) {
        // Filter valid video files
        const videoFiles = files.filter(f => f.type.startsWith('video/'));

        if (videoFiles.length === 0) {
            alert('No valid video files selected. Please select video files (MP4, MOV, AVI, WebM, etc.)');
            return;
        }

        if (videoFiles.length < files.length) {
            alert(`${files.length - videoFiles.length} non-video file(s) were skipped.`);
        }

        // If only one file and not in queue mode, load directly
        if (videoFiles.length === 1 && this.videoQueue.length === 0) {
            await this.handleVideoFile(videoFiles[0]);
        } else {
            // Multiple files or adding to existing queue - use queue mode
            this.state.queueMode = true;

            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'loadingMsg';
            loadingMsg.style.textAlign = 'center';
            loadingMsg.style.padding = '1rem';
            loadingMsg.style.color = 'var(--text-secondary)';
            loadingMsg.textContent = `Loading ${videoFiles.length} video(s)...`;
            this.elements.uploadSection.appendChild(loadingMsg);

            for (const file of videoFiles) {
                await this.addToQueue(file);
            }

            // Remove loading message
            const msg = document.getElementById('loadingMsg');
            if (msg) msg.remove();

            this.renderQueue();
            this.elements.videoQueue.classList.remove('hidden');

            // Show settings for queue mode
            this.elements.settingsSection.classList.remove('hidden');
            this.elements.settingsInfo.classList.remove('hidden');
        }
        // Reset file input
        this.elements.videoInput.value = '';
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

    async addToQueue(file) {
        try {
            // Create a temporary video element to extract metadata
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';

            const metadata = await new Promise((resolve, reject) => {
                tempVideo.onloadedmetadata = () => {
                    resolve({
                        duration: tempVideo.duration,
                        width: tempVideo.videoWidth,
                        height: tempVideo.videoHeight
                    });
                    URL.revokeObjectURL(tempVideo.src);
                };
                tempVideo.onerror = () => {
                    reject(new Error('Failed to load video metadata'));
                };
                tempVideo.src = URL.createObjectURL(file);
            });

            this.videoQueue.push({
                id: Date.now() + Math.random(),
                file: file,
                metadata: metadata,
                status: 'pending'
            });

        } catch (error) {
            console.error('Error loading video metadata:', error);
            alert(`Failed to load ${file.name}. Skipping.`);
        }
    }

    renderQueue() {
        this.elements.queueList.innerHTML = '';
        this.elements.queueCount.textContent = this.videoQueue.length;

        this.videoQueue.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            if (video.status === 'processing') item.classList.add('processing');
            if (video.status === 'completed') item.classList.add('completed');

            const icon = document.createElement('div');
            icon.className = 'queue-item-icon';
            icon.textContent = video.status === 'completed' ? '✅' :
                              video.status === 'processing' ? '⏳' : '📹';

            const info = document.createElement('div');
            info.className = 'queue-item-info';

            const name = document.createElement('div');
            name.className = 'queue-item-name';
            name.textContent = video.file.name;

            const meta = document.createElement('div');
            meta.className = 'queue-item-meta';
            meta.textContent = `${video.metadata.width}x${video.metadata.height} • ${Utils.formatTime(video.metadata.duration)} • ${Utils.formatBytes(video.file.size)}`;

            info.appendChild(name);
            info.appendChild(meta);

            const status = document.createElement('div');
            status.className = 'queue-item-status';
            if (video.status === 'processing') status.classList.add('processing');
            if (video.status === 'completed') status.classList.add('completed');
            status.textContent = video.status === 'completed' ? 'Done' :
                                video.status === 'processing' ? 'Processing...' : 'Pending';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'queue-item-remove';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => this.removeFromQueue(video.id);
            if (video.status === 'processing') removeBtn.style.display = 'none';

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(status);
            item.appendChild(removeBtn);

            this.elements.queueList.appendChild(item);
        });

        // Update estimates for queue
        this.updateQueueEstimates();
    }

    updateQueueEstimates() {
        if (this.videoQueue.length === 0) return;

        const fps = parseInt(this.elements.frameRate.value) || 10;
        const scale = parseFloat(this.elements.scaleResolution.value) || 0.5;
        const format = this.elements.imageFormat.value || 'jpg';
        const quality = parseFloat(this.elements.jpegQuality.value) || 0.85;

        let totalDuration = 0;
        let totalFrames = 0;
        let totalEstimatedSize = 0;

        // Calculate totals for all videos in queue
        this.videoQueue.forEach(video => {
            totalDuration += video.metadata.duration;
            const videoFrames = Math.ceil(video.metadata.duration * fps);
            totalFrames += videoFrames;

            // Estimate size for this video's frames
            const scaledWidth = video.metadata.width * scale;
            const scaledHeight = video.metadata.height * scale;
            const pixels = scaledWidth * scaledHeight;

            let bytesPerPixel;
            if (format === 'png') {
                bytesPerPixel = 3;
            } else {
                bytesPerPixel = 0.2 + (quality * 0.8);
            }

            const estimatedBytesPerFrame = pixels * bytesPerPixel;
            totalEstimatedSize += videoFrames * estimatedBytesPerFrame;
        });

        // Update the UI with queue totals
        this.elements.estimatedFrames.textContent = `${totalFrames} (across ${this.videoQueue.length} video${this.videoQueue.length > 1 ? 's' : ''})`;
        this.elements.estimatedSize.textContent = Utils.formatBytes(totalEstimatedSize);
    }

    removeFromQueue(videoId) {
        this.videoQueue = this.videoQueue.filter(v => v.id !== videoId);
        this.renderQueue();

        if (this.videoQueue.length === 0) {
            this.elements.videoQueue.classList.add('hidden');
            this.state.queueMode = false;
        }
    }

    clearQueue() {
        if (confirm('Clear all videos from queue?')) {
            this.videoQueue = [];
            this.elements.videoQueue.classList.add('hidden');
            this.state.queueMode = false;
        }
    }

    async processQueue() {
        if (this.videoQueue.length === 0) {
            alert('Queue is empty. Please add videos first.');
            return;
        }

        // Calculate total estimated frames
        let totalFrames = 0;
        const fps = parseInt(this.elements.frameRate.value) || 10;
        this.videoQueue.forEach(video => {
            totalFrames += Math.ceil(video.metadata.duration * fps);
        });

        const confirmed = confirm(
            `Ready to process ${this.videoQueue.length} video(s)?\n\n` +
            `Estimated total frames: ~${totalFrames}\n` +
            `All videos will use the same extraction settings.\n` +
            `Frames will be numbered continuously across all videos.`
        );

        if (!confirmed) return;

        try {
            this.state.processing = true;
            this.cancelRequested = false;

            // Hide upload section, show progress
            this.elements.uploadSection.classList.add('hidden');
            this.elements.progressSection.classList.remove('hidden');
            this.elements.cancelBtn.classList.remove('hidden');

            const allFrames = [];
            let globalFrameNumber = 1;

            // Get settings from first video (we'll apply same settings to all)
            const settings = {
                fps: parseInt(this.elements.frameRate.value),
                scale: parseFloat(this.elements.scaleResolution.value),
                format: this.elements.imageFormat.value,
                quality: parseFloat(this.elements.jpegQuality.value),
                namingPattern: this.elements.namingPattern.value,
                customName: this.elements.customName.value || 'video'
            };

            // Blur detection options
            const blurOptions = {
                useBlurDetection: this.elements.useBlurDetection.checked,
                enableQualityMetrics: this.elements.enableQualityMetrics.checked,
                blurComparisonCount: parseInt(this.elements.blurComparisonCount.value),
                blurComparisonWindow: parseFloat(this.elements.blurComparisonWindow.value)
            };

            this.currentSettings = settings;

            for (let i = 0; i < this.videoQueue.length; i++) {
                if (this.cancelRequested) {
                    console.log('Processing cancelled by user');
                    break;
                }

                const video = this.videoQueue[i];
                video.status = 'processing';
                this.renderQueue();

                this.elements.progressVideoInfo.textContent = `Processing video ${i + 1} of ${this.videoQueue.length}: ${video.file.name}`;

                // Load video
                await this.extractor.loadVideo(video.file, this.elements.videoPlayer);

                // Extract all frames from this video
                const startTime = 0;
                const endTime = video.metadata.duration;

                this.updateProgress(`Extracting frames from video ${i + 1}...`, 0);

                const videoFrames = await this.extractor.extractFrames(
                    startTime,
                    endTime,
                    settings.fps,
                    settings.scale,
                    settings.format,
                    settings.quality,
                    (progress, status) => {
                        const overallProgress = (i / this.videoQueue.length) + (progress / this.videoQueue.length) * 0.8;
                        this.updateProgress(status, overallProgress);
                    },
                    blurOptions
                );

                // Renumber frames to be continuous across videos
                videoFrames.forEach(frame => {
                    frame.frameNumber = globalFrameNumber++;
                    allFrames.push(frame);
                });

                video.status = 'completed';
                this.renderQueue();
            }

            if (this.cancelRequested) {
                this.elements.progressSection.classList.add('hidden');
                this.elements.uploadSection.classList.remove('hidden');
                this.state.processing = false;
                return;
            }

            // Create ZIP with all frames
            this.updateProgress('Creating ZIP archive...', 0.9);

            const zipBlob = await this.extractor.createZip(
                allFrames,
                settings.namingPattern,
                settings.customName,
                settings.format,
                (progress) => {
                    this.updateProgress('Creating ZIP archive...', 0.9 + (progress * 0.1));
                }
            );

            this.state.extractedZip = zipBlob;

            // Show result
            this.elements.progressSection.classList.add('hidden');
            this.elements.resultSection.classList.remove('hidden');
            this.elements.resultSummary.textContent = `${allFrames.length} frames extracted from ${this.videoQueue.length} video(s) (${Utils.formatBytes(zipBlob.size)})`;

        } catch (error) {
            console.error('Queue processing error:', error);
            alert('Failed to process videos: ' + error.message);

            this.elements.progressSection.classList.add('hidden');
            this.elements.uploadSection.classList.remove('hidden');
        } finally {
            this.state.processing = false;
        }
    }

    cancelProcessing() {
        if (confirm('Cancel processing?')) {
            this.cancelRequested = true;
            this.elements.cancelBtn.disabled = true;
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
            this.cancelRequested = false;

            this.elements.actionsSection.classList.add('hidden');
            this.elements.progressSection.classList.remove('hidden');
            this.elements.cancelBtn.classList.remove('hidden');

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

            // Blur detection options
            const blurOptions = {
                useBlurDetection: this.elements.useBlurDetection.checked,
                enableQualityMetrics: this.elements.enableQualityMetrics.checked,
                blurComparisonCount: parseInt(this.elements.blurComparisonCount.value),
                blurComparisonWindow: parseFloat(this.elements.blurComparisonWindow.value)
            };

            console.log('Extraction settings:', settings, blurOptions);

            // Initialize progress tracker
            const estimatedFrames = Math.ceil((settings.endTime - settings.startTime) * settings.fps);
            this.progressTracker = new ProgressTracker(estimatedFrames);

            // Extract frames with progress tracking
            this.updateProgress('Extracting frames...', 0);

            const frames = await this.extractor.extractFrames(
                settings.startTime,
                settings.endTime,
                settings.fps,
                settings.scale,
                settings.format,
                settings.quality,
                (progress, status) => {
                    if (this.cancelRequested) {
                        throw new Error('Cancelled by user');
                    }

                    // Update progress tracker with actual frame count
                    const frameCount = Math.floor(progress * estimatedFrames);
                    this.progressTracker.update(frameCount);

                    // Update UI with ETA and speed (use setTimeout to ensure UI updates)
                    setTimeout(() => {
                        this.updateProgressWithStats(status, progress * 0.99);
                    }, 0);
                },
                blurOptions
            );

            if (this.cancelRequested) {
                throw new Error('Cancelled by user');
            }

            console.log(`Extracted ${frames.length} frames`);

            // Store frames for quality review
            this.extractedFrames = frames;
            this.currentSettings = settings;

            // Hide progress
            this.elements.progressSection.classList.add('hidden');
            this.elements.cancelBtn.classList.add('hidden');

            // Show quality review only if quality metrics were calculated
            if (blurOptions.enableQualityMetrics && frames.length > 0 && frames[0].blurScore > 0) {
                this.showQualityReview(frames);
            } else {
                // Skip quality review and go directly to ZIP creation
                await this.proceedToZipCreation(frames);
            }

        } catch (error) {
            console.error('Extraction error:', error);
            if (error.message !== 'Cancelled by user') {
                alert('Failed to extract frames: ' + error.message);
            }

            this.elements.progressSection.classList.add('hidden');
            this.elements.cancelBtn.classList.add('hidden');
            this.elements.actionsSection.classList.remove('hidden');
        } finally {
            this.state.processing = false;
            this.elements.cancelBtn.disabled = false;
        }
    }

    updateProgress(text, percent) {
        this.elements.progressText.textContent = text;
        this.elements.progressPercent.textContent = `${Math.round(percent * 100)}%`;
        this.elements.progressFill.style.width = `${percent * 100}%`;
    }

    updateProgressWithStats(text, percent) {
        this.updateProgress(text, percent);

        if (this.progressTracker) {
            const speed = this.progressTracker.getSpeed();
            const eta = this.progressTracker.formatETA();

            this.elements.progressSpeed.textContent = `${speed.toFixed(1)} fps`;
            this.elements.progressETA.textContent = eta;
        }
    }

    showQualityReview(frames) {
        if (frames.length === 0) {
            alert('No frames to review');
            return;
        }

        // Calculate blur score statistics
        const blurScores = frames.map(f => f.blurScore).sort((a, b) => a - b);
        const minScore = blurScores[0];
        const maxScore = blurScores[blurScores.length - 1];
        const medianScore = blurScores[Math.floor(blurScores.length / 2)];

        // Set threshold range based on scores
        this.elements.blurThreshold.min = Math.floor(minScore);
        this.elements.blurThreshold.max = Math.ceil(maxScore);
        this.elements.blurThreshold.value = Math.floor(medianScore * 0.5); // Start at half median

        // Update stats
        this.elements.totalFramesCount.textContent = frames.length;
        this.elements.maxBlurScore.textContent = maxScore.toFixed(0);
        this.elements.minBlurScore.textContent = minScore.toFixed(0);

        // Render preview
        this.updateQualityPreview();

        // Show quality section
        this.elements.qualitySection.classList.remove('hidden');
    }

    updateQualityPreview() {
        if (this.extractedFrames.length === 0) return;

        const threshold = parseFloat(this.elements.blurThreshold.value);
        const frames = this.extractedFrames;

        // Find frames at boundaries
        const sharpestFrame = frames.reduce((prev, curr) =>
            curr.blurScore > prev.blurScore ? curr : prev
        );

        const blurriestFrame = frames.reduce((prev, curr) =>
            curr.blurScore < prev.blurScore ? curr : prev
        );

        // Find frame closest to threshold
        const thresholdFrame = frames.reduce((prev, curr) =>
            Math.abs(curr.blurScore - threshold) < Math.abs(prev.blurScore - threshold) ? curr : prev
        );

        // Update counts
        const keptCount = frames.filter(f => f.blurScore >= threshold).length;
        const removedCount = frames.length - keptCount;

        this.elements.keptFramesCount.textContent = keptCount;
        this.elements.removedFramesCount.textContent = removedCount;
        this.elements.thresholdBlurScore.textContent = threshold;

        // Render previews
        this.renderFramePreview(sharpestFrame, this.elements.sharpestPreview);
        this.renderFramePreview(thresholdFrame, this.elements.thresholdPreview);
        this.renderFramePreview(blurriestFrame, this.elements.blurriestPreview);
    }

    renderFramePreview(frame, canvas) {
        if (!frame || !canvas) return;

        // Create image from frame data
        const blob = new Blob([frame.data], { type: `image/${this.currentSettings.format === 'png' ? 'png' : 'jpeg'}` });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
        };

        img.src = url;
    }

    async proceedToZipCreation(frames) {
        try {
            this.state.processing = true;

            // Hide quality section, show progress
            this.elements.qualitySection.classList.add('hidden');
            this.elements.progressSection.classList.remove('hidden');

            // Create ZIP
            this.updateProgress('Creating ZIP archive...', 0);

            const zipBlob = await this.extractor.createZip(
                frames,
                this.currentSettings.namingPattern,
                this.currentSettings.customName,
                this.currentSettings.format,
                (progress) => {
                    this.updateProgress('Creating ZIP archive...', progress);
                }
            );

            this.state.extractedZip = zipBlob;

            // Show result
            this.elements.progressSection.classList.add('hidden');
            this.elements.resultSection.classList.remove('hidden');
            this.elements.resultSummary.textContent = `${frames.length} frames extracted successfully (${Utils.formatBytes(zipBlob.size)})`;

        } catch (error) {
            console.error('ZIP creation error:', error);
            alert('Failed to create ZIP: ' + error.message);
        } finally {
            this.state.processing = false;
        }
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
        this.state.queueMode = false;
        this.cancelRequested = false;

        // Clear video queue
        this.videoQueue = [];

        if (this.elements.videoPlayer.src) {
            URL.revokeObjectURL(this.elements.videoPlayer.src);
            this.elements.videoPlayer.src = '';
        }

        this.elements.videoInput.value = '';

        this.elements.uploadSection.classList.remove('hidden');
        this.elements.videoQueue.classList.add('hidden');
        this.elements.videoSection.classList.add('hidden');
        this.elements.settingsSection.classList.add('hidden');
        this.elements.settingsInfo.classList.add('hidden');
        this.elements.actionsSection.classList.add('hidden');
        this.elements.progressSection.classList.add('hidden');
        this.elements.cancelBtn.classList.add('hidden');
        this.elements.qualitySection.classList.add('hidden');
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