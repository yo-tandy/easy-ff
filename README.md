# EasyFF - Video Scene Editor

A browser-based tool for visually planning and generating FFmpeg crop, trim, and pan commands. Designed for reformatting widescreen video into vertical/portrait clips (e.g., for social media).

## Features

- **Video preview** with frame-by-frame navigation and seek bar
- **Visual crop positioning** — drag the crop window directly on the video preview
- **Scene editor** — define scenes with precise start/end times and crop positions
- **Pan effects** — animate the crop window across a scene using linear or ease-in-out interpolation
- **Multi-clip tabs** — organize scenes into separate output clips, each producing its own file
- **Continuity validation** — warns when gaps exist between scenes or clips
- **Drag-and-drop reordering** of scenes within a clip
- **Auto-generated FFmpeg commands** — complete `ffmpeg` commands with trim, crop, scale, and concat filters
- **Copy individual scene commands** or the full clip command
- **Download all commands** as a single bash script
- **Save/load projects** as JSON

## Usage

Open `tool.html` in a browser. No build step or server required.

1. Load a video file using the file picker
2. Set your desired output dimensions (e.g., `720x1280` for vertical video)
3. Scrub through the video to find your scenes
4. Use the scene actions to set start/end times and crop positions
5. Add multiple scenes per clip, and multiple clips via tabs
6. Copy the generated FFmpeg commands or download them as a script
7. Run the commands with FFmpeg to produce your output files

## Project Structure

```
tool.html              Main HTML entry point
styles.css             Stylesheet
js/
  main.js              Module entry point
  app.js               App controller and event delegation
  video-preview.js     Video loading, playback, crop window overlay
  scene-manager.js     Scene creation, editing, drag reorder
  tab-manager.js       Multi-clip tab management
  command-generator.js FFmpeg command generation
  project-manager.js   Save/load project JSON
  input-validator.js   Input validation logic
  validation-setup.js  Validation wiring
  error-handler.js     Error display
  utils.js             Shared utilities
  constants.js         Configuration defaults
```

## Requirements

- A modern browser (Chrome, Firefox, Safari, Edge)
- [FFmpeg](https://ffmpeg.org/) installed to run the generated commands
