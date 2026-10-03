# Cube Coach

A private, static, browser-local 3×3 cube coach. Published with Sites.

## Features
- Live webcam or phone camera with a 3×3 alignment guide, about 1.7 seconds of stable readings, six-face progression, center-color checking, and manual capture.
- Color samples stay in browser memory. No camera frames are sent to a server. No saved-session storage.
- Photo import with drag, zoom, and rotation; manual color painting; editable six-face review.
- Center-sample color calibration after all six camera/photo faces are entered.
- Physical cubie validation, a Web Worker solver, verified solutions, 3D turn animations, manual and automatic playback, and beginner lessons.
- Local WebMCP tools use the visible app's validation and state.

## Run locally

From this directory, run `python3 -m http.server 5173 --bind 127.0.0.1 --directory dist`, then visit http://127.0.0.1:5173/.

The static files need no build. Camera access requires HTTPS or localhost and user permission. If an embedded browser blocks the camera, open the published app directly in Safari or Chrome.

## Supported cube and scanning

Standard 3×3 color arrangement: white top, green front, red right, yellow bottom, orange left, blue back. Capture F/R/B/L with white above; U with green along the bottom; D with green along the top. Rotate the entire cube between captures without moving any layer.

The scanner samples a precisely aligned guide; it does not detect a freely moving cube, correct arbitrary perspective, or track subsequent physical turns. Use even lighting, face the camera squarely, and review uncertain colors. Initial HSV thresholds and center calibration are deterministic computer vision, not a trained recognition model. Real camera accuracy needs testing with the user's cube and lighting. The computed solution is not a layer-by-layer teaching algorithm.

## Verification

`node tests/verify.mjs`: twelve random/demo complete solves, all 18 visual turn transforms against solver facelets, impossible states, six-color sampling, center calibration, rotation.

`node tests/camera.mjs`: synthetic steady-frame capture, duplicate-face blocking, manual capture, and frozen-frame prevention.

Browser checks cover demo-to-solution flow, one animated turn, solution completion, lesson navigation, mobile overflow, and WebMCP valid/invalid state operations. Hardware camera capture is not part of the automated tests.

## Libraries

Vendored cubejs 1.3.2 and Three.js 0.160.1 are MIT licensed; their licenses are in `dist/vendor/`. Fonts use the Google Fonts stylesheet. The app works with system fonts if that service is unavailable.
