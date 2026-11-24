(() => {
  const canvas = document.getElementById('scroll-frame-canvas');
  const fallback = document.querySelector('.scroll-frame-fallback');
  if (!canvas || !fallback || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!context) return;

  const frameCount = 576;
  const maxCachedFrames = 9;
  const maxConcurrentLoads = 3;
  const maxCanvasPixelRatio = 1.25;
  const frames = new Map();
  const pendingImages = new Map();
  const queuedFrames = new Set();
  let currentIndex = -1;
  let previousIndex = 0;
  let travelDirection = 1;
  let drawnIndex = -1;
  let animationFrame = 0;
  let scrollableDistance = 0;

  function framePath(index) {
    return `scroll_frames_120fps_webp/frame_${String(index + 1).padStart(5, '0')}.webp`;
  }

  function updateScrollMetrics() {
    scrollableDistance = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      maxCanvasPixelRatio,
      1280 / bounds.width,
      720 / bounds.height
    );
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));

    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    canvas.removeAttribute('data-ready');
    fallback.hidden = false;
    drawnIndex = -1;
  }

  function retainFrame(index, image) {
    frames.delete(index);
    frames.set(index, image);

    while (frames.size > maxCachedFrames) {
      const oldestIndex = frames.keys().next().value;
      if (oldestIndex === currentIndex) {
        const currentImage = frames.get(oldestIndex);
        frames.delete(oldestIndex);
        frames.set(oldestIndex, currentImage);
      } else {
        frames.delete(oldestIndex);
      }
    }
  }

  function pumpQueue() {
    while (pendingImages.size < maxConcurrentLoads && queuedFrames.size) {
      const nextIndex = [...queuedFrames].sort((a, b) => {
        const distance = Math.abs(a - currentIndex) - Math.abs(b - currentIndex);
        return distance || (a - b) * travelDirection;
      })[0];
      queuedFrames.delete(nextIndex);
      if (frames.has(nextIndex) || pendingImages.has(nextIndex)) continue;

      const image = new Image();
      pendingImages.set(nextIndex, image);
      image.decoding = 'async';
      image.onload = () => {
        if (pendingImages.get(nextIndex) !== image) return;
        pendingImages.delete(nextIndex);
        retainFrame(nextIndex, image);
        if (nextIndex === currentIndex) scheduleRender();
        pumpQueue();
      };
      image.onerror = () => {
        if (pendingImages.get(nextIndex) !== image) return;
        pendingImages.delete(nextIndex);
        console.error(`Unable to load scroll background frame: ${framePath(nextIndex)}`);
        pumpQueue();
      };
      image.src = framePath(nextIndex);
    }
  }

  function requestFrames(index, direction) {
    travelDirection = direction;
    queuedFrames.clear();
    [index, index + direction, index - direction].forEach(candidate => {
      if (candidate >= 0 && candidate < frameCount &&
          !frames.has(candidate) && !pendingImages.has(candidate)) {
        queuedFrames.add(candidate);
      }
    });
    pumpQueue();
  }

  function drawFrame(index) {
    const image = frames.get(index);
    if (!image) return false;

    frames.delete(index);
    frames.set(index, image);
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = canvas.width / canvas.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (sourceRatio > canvasRatio) {
      sourceWidth = image.naturalHeight * canvasRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    }

    if (sourceRatio < canvasRatio) {
      const scale = Math.min(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight
      );
      const destinationWidth = image.naturalWidth * scale;
      const destinationHeight = image.naturalHeight * scale;
      context.fillStyle = '#08080b';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        0, 0, image.naturalWidth, image.naturalHeight,
        (canvas.width - destinationWidth) / 2,
        (canvas.height - destinationHeight) / 2,
        destinationWidth, destinationHeight
      );
    } else {
      context.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      );
    }
    if (!fallback.hidden) fallback.hidden = true;
    if (canvas.dataset.ready !== 'true') canvas.dataset.ready = 'true';
    drawnIndex = index;
    return true;
  }

  function drawClosestFrame(index) {
    let closestIndex = -1;
    let closestDistance = Infinity;

    frames.forEach((image, candidate) => {
      const distance = Math.abs(candidate - index);
      if (distance < closestDistance) {
        closestIndex = candidate;
        closestDistance = distance;
      }
    });

    if (closestIndex >= 0 && closestIndex !== drawnIndex) drawFrame(closestIndex);
  }

  function render() {
    animationFrame = 0;
    resizeCanvas();
    const scrollY = window.scrollY;
    const progress = scrollableDistance > 0
      ? Math.min(1, Math.max(0, scrollY / scrollableDistance))
      : 0;
    const index = Math.round(progress * (frameCount - 1));
    const direction = index >= previousIndex ? 1 : -1;
    const frameChanged = index !== currentIndex;

    previousIndex = index;
    currentIndex = index;
    if (drawnIndex !== index && !drawFrame(index)) drawClosestFrame(index);
    if (frameChanged) requestFrames(index, direction);
  }

  function scheduleRender() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
  }

  function refreshScrollMetrics() {
    updateScrollMetrics();
    resizeCanvas();
    scheduleRender();
  }

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(refreshScrollMetrics);
    resizeObserver.observe(canvas.parentElement);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
  }

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', refreshScrollMetrics, { passive: true });
  window.visualViewport?.addEventListener('resize', refreshScrollMetrics, { passive: true });

  updateScrollMetrics();
  scheduleRender();
})();
