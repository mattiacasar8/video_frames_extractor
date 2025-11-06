# 🚀 How to Start Video Frame Extractor

## Quick Start (Recommended)

### Option 1: Double-Click Launcher

**First time only:**
1. Open **Terminal**
2. Paste this command and press Enter:
   ```bash
   chmod +x /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor/start.command
   ```

**Every time you want to use the app:**
- **Double-click** `start.command` in Finder
- The browser will open automatically at http://localhost:8000
- Start using the app!

**To stop:**
- Press `Ctrl+C` in the Terminal window that opened
- Or just close the Terminal window

---

## Option 2: Manual Terminal Command

**Copy and paste this into Terminal:**

```bash
cd /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor && python3 -m http.server 8000
```

Then open your browser to: **http://localhost:8000**

**To stop:** Press `Ctrl+C` in Terminal

---

## Why Do I Need a Server?

The app uses **FFmpeg.wasm** which requires Web Workers. Browsers block Web Workers when opening files directly (`file://` URLs) for security reasons.

Running a local HTTP server (`http://localhost`) solves this issue.

---

## Troubleshooting

### "Port 8000 is already in use"

Someone else is using port 8000. Try a different port:

```bash
cd /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor
python3 -m http.server 8080
```

Then open: http://localhost:8080

### "python3: command not found"

Your Mac should have Python 3 installed. If not:
1. Install Homebrew: https://brew.sh
2. Install Python: `brew install python3`

### Script won't launch when double-clicked

Make the script executable:
```bash
chmod +x /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor/start.command
```

### Still having issues?

Make sure you're in the correct directory:
```bash
cd /Users/mattia.casarotto/Documents/GitHub/video_frames_extractor
ls -la
```

You should see: `index.html`, `app.js`, `style.css`, `start.command`

---

## Alternative: Use VS Code Live Server

If you use **VS Code**:
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start server | `python3 -m http.server 8000` |
| Open app | http://localhost:8000 |
| Stop server | `Ctrl+C` in Terminal |
| Change port | Use `8080` or `3000` instead of `8000` |

---

**Ready to extract some frames? 🎬**
