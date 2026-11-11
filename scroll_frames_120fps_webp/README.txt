120 FPS SCROLL FRAME SEQUENCE
Source: 1280x720 MP4, original 24 fps
Output: motion-interpolated WebP frames at 120 fps
Frame count: 576
Naming: frame_00001.webp, frame_00002.webp, ...
Use: map scroll progress (0..1) to frame index (0..575).
Recommended: preload a small window around the current frame; decode asynchronously.
