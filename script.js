(() => {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 596;
  const FRAME_PREFIX = 'assets/background-frames/frame_';
  const FRAME_EXT = '.jpg';
  const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;
  const MAX_CACHED_FRAMES = IS_MOBILE ? 7 : 10;
  const PREFETCH_RADIUS = IS_MOBILE ? 2 : 4;
  const CONCURRENT_DOWNLOADS = 2;
  const INTRO_STATE_KEY = 'portfolio-walking-intro-complete';

  // --- DOM Elements ---
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
  const navbar = document.querySelector('.navbar');

  // --- State ---
  const frameCache = new Map();
  const frameLoads = new Map();
  const queuedFrames = new Set();
  const failedFrames = new Set();
  let activeFrameIndex = 0;
  let maxScrollY = 1;
  let lastScrollY = -1;
  let lastRenderedIndex = -1;
  let canvasNeedsResize = true;
  let lastFrameTime = performance.now();
  let renderRequestId = null;
  let activeDownloads = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentPointerX = 0;
  let currentPointerY = 0;

  // Format frame URL: frame_000001.jpg -> frame_000596.jpg
  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(6, '0');
    return `${FRAME_PREFIX}${frameNum}${FRAME_EXT}`;
  }

  function releaseFrame(frame) {
    if (typeof frame.close === 'function') frame.close();
  }

  function trimFrameCache() {
    while (frameCache.size > MAX_CACHED_FRAMES) {
      let farthestIndex = -1;
      let farthestDistance = -1;
      frameCache.forEach((frame, index) => {
        const distance = Math.abs(index - activeFrameIndex);
        if (distance > farthestDistance && index !== activeFrameIndex) {
          farthestDistance = distance;
          farthestIndex = index;
        }
      });
      if (farthestIndex < 0) break;
      releaseFrame(frameCache.get(farthestIndex));
      frameCache.delete(farthestIndex);
    }
  }

  async function loadFrame(index) {
    if (frameCache.has(index) || failedFrames.has(index)) return;
    if (frameLoads.has(index)) return frameLoads.get(index);

    const loading = (async () => {
      try {
        const response = await fetch(getFrameUrl(index));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        let frame;

        if ('createImageBitmap' in window) {
          frame = await createImageBitmap(blob);
        } else {
          const objectUrl = URL.createObjectURL(blob);
          try {
            frame = new Image();
            frame.src = objectUrl;
            await frame.decode();
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }

        frameCache.set(index, frame);
        trimFrameCache();
        if (index === activeFrameIndex) lastRenderedIndex = -1;
        scheduleRender();
      } catch (error) {
        failedFrames.add(index);
        console.warn(`Background frame ${index + 1} could not be loaded.`, error);
      } finally {
        frameLoads.delete(index);
      }
    })();

    frameLoads.set(index, loading);
    return loading;
  }

  function requestNearbyFrames() {
    for (const index of queuedFrames) {
      if (Math.abs(index - activeFrameIndex) > PREFETCH_RADIUS + 1) {
        queuedFrames.delete(index);
      }
    }

    for (let offset = -PREFETCH_RADIUS; offset <= PREFETCH_RADIUS; offset++) {
      const index = activeFrameIndex + offset;
      if (
        index >= 0 &&
        index < TOTAL_FRAMES &&
        !frameCache.has(index) &&
        !frameLoads.has(index) &&
        !failedFrames.has(index)
      ) {
        queuedFrames.add(index);
      }
    }

    pumpFrameLoads();
  }

  function pumpFrameLoads() {
    while (activeDownloads < CONCURRENT_DOWNLOADS && queuedFrames.size) {
      let nextIndex = -1;
      let nearestDistance = Infinity;
      queuedFrames.forEach((index) => {
        const distance = Math.abs(index - activeFrameIndex);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nextIndex = index;
        }
      });
      if (nextIndex < 0) break;

      queuedFrames.delete(nextIndex);
      activeDownloads++;
      loadFrame(nextIndex).finally(() => {
        activeDownloads--;
        pumpFrameLoads();
      });
    }
  }

  function startHeroVideo() {
    const video = document.querySelector('.hero-character');
    if (!video) return;

    let isVisible = true;
    const updatePlayback = () => {
      if (isVisible && !document.hidden) {
        video.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.warn('The hero video could not start playback.', error);
          }
        });
      } else {
        video.pause();
      }
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        updatePlayback();
      }, { threshold: 0.1 });
      observer.observe(video);
    } else {
      updatePlayback();
    }

    document.addEventListener('visibilitychange', updatePlayback);
  }

  function startCinematicIntro() {
    const intro = document.getElementById('cinema-intro');
    const navigationType = performance.getEntriesByType('navigation')[0]?.type;
    let shouldPlay = true;

    try {
      if (navigationType === 'reload') sessionStorage.removeItem(INTRO_STATE_KEY);
      shouldPlay = sessionStorage.getItem(INTRO_STATE_KEY) !== 'complete';
      if (shouldPlay) sessionStorage.setItem(INTRO_STATE_KEY, 'complete');
    } catch (error) {
      console.warn('Intro playback state could not be saved for this tab.', error);
    }

    const removeIntro = () => {
      if (intro) intro.remove();
      document.body.classList.remove('cinema-intro-active');
      startHeroVideo();
    };

    if (!intro || !shouldPlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      removeIntro();
      return;
    }

    const video = intro.querySelector('.cinema-intro-video');
    if (!video) {
      removeIntro();
      return;
    }

    const backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== intro)
      .map((element) => ({ element, wasInert: element.inert }));
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
    });

    let isFinishing = false;
    let fallbackTimer = null;
    let fallbackRemaining = 15000;
    let fallbackStartedAt = 0;
    const armFallbackTimer = (delay = fallbackRemaining) => {
      window.clearTimeout(fallbackTimer);
      fallbackRemaining = delay;
      if (!document.hidden) {
        fallbackStartedAt = performance.now();
        fallbackTimer = window.setTimeout(finishIntro, delay);
      }
    };
    function finishIntro() {
      if (isFinishing) return;
      isFinishing = true;
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onIntroVisibilityChange);
      video.pause();
      intro.classList.add('is-leaving');
      window.setTimeout(() => {
        backgroundElements.forEach(({ element, wasInert }) => {
          element.inert = wasInert;
        });
        document.body.classList.remove('cinema-intro-active');
        video.removeAttribute('src');
        video.querySelector('source')?.removeAttribute('src');
        video.load();
        intro.remove();
        startHeroVideo();
      }, 950);
    }

    function onIntroVisibilityChange() {
      if (document.hidden) {
        if (fallbackTimer !== null) {
          fallbackRemaining = Math.max(0, fallbackRemaining - (performance.now() - fallbackStartedAt));
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        video.pause();
      } else {
        const remainingDuration = Number.isFinite(video.duration)
          ? Math.max(1000, (video.duration - video.currentTime) * 1000 + 1500)
          : fallbackRemaining;
        armFallbackTimer(remainingDuration);
        video.play().catch((error) => {
          console.error('The walking-character intro could not resume playback.', error);
          finishIntro();
        });
      }
    }

    video.addEventListener('ended', finishIntro, { once: true });
    video.addEventListener('error', () => {
      console.error('The walking-character intro video could not be loaded.', video.error);
      finishIntro();
    }, { once: true });

    armFallbackTimer();
    video.addEventListener('loadedmetadata', () => {
      armFallbackTimer(Math.max(1000, (video.duration - video.currentTime) * 1000 + 1500));
    }, { once: true });
    video.play().catch((error) => {
      console.error('The walking-character intro could not start playback.', error);
      finishIntro();
    });
    document.addEventListener('visibilitychange', onIntroVisibilityChange);
  }

  // Keep the previous frame visible while an uncached frame is loading.
  function getClosestLoadedImage(requestedIndex) {
    if (frameCache.has(requestedIndex)) return frameCache.get(requestedIndex);

    let closestFrame = null;
    let closestDistance = Infinity;
    frameCache.forEach((frame, index) => {
      const distance = Math.abs(index - requestedIndex);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFrame = frame;
      }
    });
    return closestFrame;
  }

  // Draw each source frame to cover the viewport without distorting its aspect ratio.
  function drawFrame(img) {
    if (!ctx || !img) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.max(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    ctx.fillStyle = '#080809';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
    canvas.classList.add('has-frame');
  }

  // High-DPI Canvas Resizing
  function resizeCanvas() {
    if (!canvas || !ctx) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.25 : 1.5);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const pixelWidth = Math.floor(displayWidth * dpr);
    const pixelHeight = Math.floor(displayHeight * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      return true;
    }
    return false;
  }

  // Compute scroll fraction & update interactive states
  function updateScrollTarget() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    if (scrollY !== lastScrollY) {
      lastScrollY = scrollY;
      const scrollProgress = Math.max(0, Math.min(1, scrollY / maxScrollY));
      const nextFrameIndex = Math.round(scrollProgress * (TOTAL_FRAMES - 1));
      if (nextFrameIndex !== activeFrameIndex) {
        activeFrameIndex = nextFrameIndex;
        requestNearbyFrames();
      }

      if (navbar) navbar.classList.toggle('scrolled', scrollY > 30);
    }
  }

  function onScroll() {
    scheduleRender();
  }

  function onResize() {
    canvasNeedsResize = true;
    updateScrollRange();
    updateScrollTarget();
    scheduleRender();
  }

  function updateScrollRange() {
    const nextMaxScrollY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (nextMaxScrollY !== maxScrollY) {
      maxScrollY = nextMaxScrollY;
      lastScrollY = -1;
    }
  }

  function onPointerMove(event) {
    pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
    scheduleRender();
  }

  function scheduleRender() {
    if (renderRequestId === null) {
      renderRequestId = requestAnimationFrame(renderLoop);
    }
  }

  // Render while the frame, parallax, or canvas size is changing.
  function renderLoop(currentTime) {
    renderRequestId = null;
    if (!canvas) return;
    const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = currentTime;

    // Check resize
    let wasResized = false;
    if (canvasNeedsResize) {
      wasResized = resizeCanvas();
      canvasNeedsResize = false;
    }

    updateScrollTarget();

    const pointerFactor = 1 - Math.exp(-5 * dt);
    currentPointerX += (pointerX - currentPointerX) * pointerFactor;
    currentPointerY += (pointerY - currentPointerY) * pointerFactor;
    canvas.style.transform = `translate3d(${currentPointerX * -6}px, ${currentPointerY * -6}px, 0) scale(1.02)`;

    const targetFrameIndex = activeFrameIndex;

    if (targetFrameIndex !== lastRenderedIndex || wasResized) {
      const frame = getClosestLoadedImage(targetFrameIndex);
      if (frame) {
        drawFrame(frame);
        lastRenderedIndex = targetFrameIndex;
      } else {
        lastRenderedIndex = -1;
      }
    }

    if (
      canvasNeedsResize ||
      Math.abs(pointerX - currentPointerX) > 0.001 ||
      Math.abs(pointerY - currentPointerY) > 0.001
    ) {
      scheduleRender();
    }
  }

  // ==========================================================================
  // CREATIVE PROJECTS DATA & MODAL SYSTEM
  // ==========================================================================
  const projectsData = {
    'cad-designs': {
      title: 'CAD Designs & 3D Concepts',
      tag: 'TECHNICAL DESIGN',
      category: 'CAD Design & Spatial Visualization',
      desc: 'Technical design studies, precise CAD drawings, and 3D concepts developed with a focus on form, proportion, and clear visual communication.',
      tools: 'SketchUp, Illustrator, CorelDraw',
      role: 'CAD & 3D Designer',
      client: 'Independent & Studio Clients',
      image: 'video_frames_24fps/frame_000051.jpg'
    },
    'luxury-packaging': {
      title: 'Large-Format Luxury Packaging Systems',
      tag: 'PACKAGING & PRINT',
      category: 'Rigid Boxes, Foil Stamping & Corporate Collateral',
      desc: 'Engineered premium packaging structures for product collections and client brands, including rigid boxes, magnetic enclosures, metallic foil finishes, and coordinated stationery.',
      tools: 'Adobe Illustrator, Photoshop, CorelDraw',
      role: 'Packaging & Brand Designer',
      client: 'Independent & Corporate Clients',
      image: 'video_frames_24fps/frame_000100.jpg'
    },
    'visual-designs': {
      title: 'Poster & Visual Design',
      tag: 'VISUAL DESIGN',
      category: 'Posters, Editorial Layouts & Campaign Graphics',
      desc: 'Bold graphic compositions, editorial layouts, and promotional visuals designed to communicate ideas clearly across print and digital formats.',
      tools: 'Photoshop, Illustrator, InDesign',
      role: 'Graphic Designer',
      client: 'Independent & Studio Clients',
      image: 'video_frames_24fps/frame_000150.jpg'
    },
    'brand-identity': {
      title: 'Complete Brand Identity & Typography System',
      tag: 'IDENTITY & STRATEGY',
      category: 'Visual Identity, Logos & Brand Books',
      desc: 'Full-spectrum corporate branding: vector logomark creation, geometric typography pairing, color psychology palettes, stationery layouts, and brand asset guidelines designed for digital and print execution.',
      tools: 'Adobe Illustrator, Photoshop, InDesign',
      role: 'Brand Identity Designer',
      client: 'Independent Brands',
      image: 'video_frames_24fps/frame_000180.jpg'
    },
    'social-campaigns': {
      title: 'Cinematic Social Media Promotional Campaigns',
      tag: 'DIGITAL CAMPAIGNS',
      category: 'Advertising Creatives & Social Mockups',
      desc: 'High-converting social media creatives, Instagram feed aesthetics, cinematic video reel thumbnails, and promotional product campaigns created using Photoshop, Firefly, and Canva for luxury brand growth.',
      tools: 'Photoshop, Adobe Firefly, Canva',
      role: 'Digital Art Director',
      client: 'Independent Brands',
      image: 'video_frames_24fps/frame_000200.jpg'
    },
    'sketchup-3d': {
      title: 'Product 3D Concepts & Architectural Spatial Design',
      tag: '3D MODELING',
      category: 'Spatial Visualization & Product Renderings',
      desc: 'Photorealistic 3D spatial staging and interior architecture concepts created in SketchUp, helping clients visualize design ideas for residential, retail, and hospitality spaces.',
      tools: 'SketchUp, Photoshop, CorelDraw',
      role: '3D Spatial Designer',
      client: 'Architects & Private Collectors',
      image: 'video_frames_24fps/frame_000001.jpg'
    }
  };

  const portfolioManifest = window.PORTFOLIO_MANIFEST;
  const discoveredProjects = new Map();
  let projectModalOpener = null;

  if (portfolioManifest && Array.isArray(portfolioManifest.categories)) {
    portfolioManifest.categories.forEach((category) => {
      category.projects.forEach((project) => {
        discoveredProjects.set(project.id, { ...project, category: category.name, categoryId: category.id });
      });
    });
  }
  if (portfolioManifest?.selectedWorks && Array.isArray(portfolioManifest.selectedWorks.projects)) {
    portfolioManifest.selectedWorks.projects.forEach((project) => {
      discoveredProjects.set(project.id, { ...project, categoryId: project.category });
    });
  }

  function toAssetUrl(filePath) {
    return filePath.split('/').map(encodeURIComponent).join('/');
  }

  function renderContinuousShowcase(projects) {
    const container = document.querySelector('.marquee-track-container');
    const track = document.getElementById('marquee-content-track');
    const emptyState = document.getElementById('marquee-empty-state');
    if (!container || !track || !emptyState) return;

    track.replaceChildren();
    if (!projects.length) {
      container.hidden = true;
      emptyState.hidden = false;
      return;
    }

    container.hidden = false;
    emptyState.hidden = true;
    const group = document.createElement('div');
    group.className = 'marquee-content-group';

    projects.forEach((project) => {
      discoveredProjects.set(project.id, { ...project, categoryId: project.category });

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'marquee-card';
      card.dataset.projectId = project.id;

      const thumbnail = document.createElement('span');
      thumbnail.className = 'card-thumb';
      const image = document.createElement('img');
      image.src = toAssetUrl(project.cover.path);
      image.alt = project.title;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 580;
      image.height = 290;
      thumbnail.append(image);

      const badge = document.createElement('span');
      badge.className = 'card-badge-cat';
      badge.textContent = project.category;
      thumbnail.append(badge);

      const meta = document.createElement('span');
      meta.className = 'card-meta';
      const title = document.createElement('span');
      title.className = 'card-title';
      title.textContent = project.title;
      meta.append(title);

      card.append(thumbnail, meta);
      group.append(card);
    });

    track.append(group);
    let renderedCopies = 1;

    const updateTrack = () => {
      const groupWidth = group.getBoundingClientRect().width;
      if (!groupWidth) return;

      const trackGap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const cycleWidth = groupWidth + trackGap;
      const requiredCopies = Math.max(2, Math.ceil((container.clientWidth + cycleWidth + trackGap) / cycleWidth));
      if (requiredCopies !== renderedCopies) {
        while (track.children.length < requiredCopies) {
          const clone = group.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.querySelectorAll('button').forEach(button => button.tabIndex = -1);
          track.append(clone);
        }
        while (track.children.length > requiredCopies) track.lastElementChild.remove();
        renderedCopies = requiredCopies;
      }

      track.style.setProperty('--marquee-distance', `${cycleWidth}px`);
      track.style.setProperty('--marquee-offset', `-${cycleWidth}px`);
      track.style.setProperty('--marquee-duration', `${cycleWidth / (1850 / 32)}s`);
    };

    updateTrack();
    if ('ResizeObserver' in window) {
      new ResizeObserver(updateTrack).observe(container);
    } else {
      window.addEventListener('resize', updateTrack, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        track.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
      });
      visibilityObserver.observe(container);
    }

    let pointerStartX = 0;
    let pointerStartOffset = 0;
    let activePointerId = null;
    let isDragging = false;
    let suppressClick = false;

    const getTrackOffset = () => {
      const transform = getComputedStyle(track).transform;
      if (!transform || transform === 'none') return 0;
      const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
      return values.length === 16 ? values[12] : values[4];
    };

    container.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      track.getAnimations()[0]?.pause();
      pointerStartOffset = getTrackOffset();
      isDragging = false;
      track.style.animationPlayState = 'paused';
      container.setPointerCapture(event.pointerId);
    });

    container.addEventListener('pointermove', (event) => {
      if (event.pointerId !== activePointerId) return;
      const dragDistance = event.clientX - pointerStartX;
      if (Math.abs(dragDistance) > 4) isDragging = true;
      if (isDragging) {
        const distance = Number.parseFloat(track.style.getPropertyValue('--marquee-distance'));
        const animation = track.getAnimations()[0];
        const duration = animation?.effect?.getComputedTiming().duration;
        if (distance && Number.isFinite(duration)) {
          let offset = (pointerStartOffset + dragDistance) % distance;
          if (offset > 0) offset -= distance;
          animation.currentTime = (-offset / distance) * duration;
        }
      }
    });

    const finishTouchDrag = (event) => {
      if (event.pointerId !== activePointerId) return;
      if (isDragging) {
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 0);
      }

      track.getAnimations()[0]?.play();
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      activePointerId = null;
    };

    container.addEventListener('pointerup', finishTouchDrag);
    container.addEventListener('pointercancel', finishTouchDrag);
    track.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
        return;
      }
      const card = event.target.closest('.marquee-card');
      if (card) window.openProjectModal(card.dataset.projectId);
    });
  }

  function createMediaElement(media, className, controls = false) {
    const url = toAssetUrl(media.path);
    let element;

    if (media.type === 'video') {
      element = document.createElement('video');
      element.src = url;
      element.controls = controls;
      element.muted = true;
      element.playsInline = true;
      element.preload = controls ? 'metadata' : 'none';
      if (!controls) element.setAttribute('aria-hidden', 'true');
    } else {
      element = document.createElement('img');
      element.src = url;
      element.alt = media.name || 'Project artwork';
      element.loading = 'lazy';
      element.decoding = 'async';
    }

    element.className = className;
    return element;
  }

  function createProjectCard(project, category, featured = false) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.dataset.category = category.id;
    card.dataset.projectId = project.id;
    card.setAttribute('aria-label', `Open ${project.title}, ${category.name}`);
    card.setAttribute('aria-haspopup', project.pageUrl ? 'false' : 'dialog');

    const mediaFrame = document.createElement('div');
    mediaFrame.className = 'gallery-card-img';
    if (project.cover) {
      const cover = createMediaElement(project.cover, 'portfolio-card-media');
      if (project.cover.type === 'video') {
        const videoLabel = document.createElement('span');
        videoLabel.className = 'portfolio-video-label';
        videoLabel.textContent = 'VIDEO';
        mediaFrame.append(cover, videoLabel);
      } else {
        mediaFrame.append(cover);
      }

      cover.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'portfolio-media-fallback';
        fallback.textContent = 'Preview unavailable';
        cover.replaceWith(fallback);
      }, { once: true });
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'portfolio-media-fallback';
      fallback.textContent = project.pageUrl ? 'Explore collection' : 'Preview unavailable';
      mediaFrame.append(fallback);
    }

    const categoryPill = document.createElement('span');
    categoryPill.className = 'gallery-category-pill';
    categoryPill.textContent = category.name;
    mediaFrame.append(categoryPill);

    const info = document.createElement('span');
    info.className = 'gallery-card-info';

    const tag = document.createElement('span');
    tag.className = 'gallery-card-tag';
    tag.textContent = featured ? 'FEATURED' : category.name;

    const title = document.createElement('span');
    title.className = 'gallery-card-title';
    title.textContent = project.title;

    const summary = document.createElement('span');
    summary.className = 'gallery-card-summary';
    const imageCount = project.media.filter(media => media.type === 'image').length;
    const videoCount = project.media.length - imageCount;
    summary.textContent = [
      imageCount ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '',
      videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : ''
    ].filter(Boolean).join(' · ') || (project.pageUrl ? 'Open the project collection' : 'Open project');

    info.append(tag, title, summary);
    card.append(mediaFrame, info);
    card.addEventListener('click', () => {
      if (project.pageUrl) {
        window.location.href = project.pageUrl;
      } else {
        window.openProjectModal(project.id);
      }
    });
    return card;
  }

  function createSelectedWorkCard(project, index) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'selected-work-card';
    card.dataset.projectId = project.id;
    card.setAttribute('aria-label', `Open ${project.title}, ${project.category}`);
    card.setAttribute('aria-haspopup', 'dialog');

    const mediaFrame = document.createElement('span');
    mediaFrame.className = 'selected-work-media';

    const number = document.createElement('span');
    number.className = 'selected-work-number';
    number.textContent = String(index + 1).padStart(2, '0');
    mediaFrame.append(number);

    if (project.cover) {
      const cover = createMediaElement(project.cover, 'selected-work-preview');
      if (project.cover.type === 'video') {
        cover.controls = false;
        const videoLabel = document.createElement('span');
        videoLabel.className = 'portfolio-video-label';
        videoLabel.textContent = 'VIDEO';
        mediaFrame.append(cover, videoLabel);
      } else {
        mediaFrame.append(cover);
      }
      cover.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'portfolio-media-fallback';
        fallback.textContent = 'Preview unavailable';
        cover.replaceWith(fallback);
      }, { once: true });
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'portfolio-media-fallback';
      fallback.textContent = 'Preview unavailable';
      mediaFrame.append(fallback);
    }

    const body = document.createElement('span');
    body.className = 'selected-work-body';

    const category = document.createElement('span');
    category.className = 'selected-work-category';
    category.textContent = project.category;

    const title = document.createElement('span');
    title.className = 'selected-work-title';
    title.textContent = project.title;

    const imageCount = project.media.filter(media => media.type === 'image').length;
    const videoCount = project.media.length - imageCount;
    const mediaDescription = [
      imageCount ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '',
      videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : ''
    ].filter(Boolean).join(' · ');
    const detail = document.createElement('span');
    detail.className = 'selected-work-detail';
    detail.textContent = mediaDescription || 'Project preview';

    const action = document.createElement('span');
    action.className = 'selected-work-action';
    action.append(document.createTextNode('View Project'));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    action.append(arrow);

    body.append(category, title, detail, action);
    card.append(mediaFrame, body);
    card.addEventListener('click', () => window.openProjectModal(project.id));
    return card;
  }

  function renderSelectedWorks(projects) {
    const grid = document.getElementById('selected-works-grid');
    const stats = document.getElementById('selected-works-stats');
    if (!grid) return;

    grid.replaceChildren();
    if (!Array.isArray(projects) || projects.length === 0) {
      grid.append(createPortfolioStatus('Add named project folders and media to the Selected Works folder to feature them here.'));
      if (stats) stats.replaceChildren();
      return;
    }

    projects.forEach((project, index) => {
      grid.append(createSelectedWorkCard(project, index));
    });

    if (stats) {
      const categories = new Set(projects.map(project => project.category));
      const mediaCount = projects.reduce((total, project) => total + project.media.length, 0);
      const metrics = [
        { value: String(projects.length), label: 'Selected Projects', icon: '✦' },
        { value: String(categories.size), label: 'Creative Categories', icon: '◈' },
        { value: String(mediaCount), label: 'Visual Assets', icon: '▧' },
        { value: 'AUTO', label: 'Folder Discovery', icon: '↻' }
      ];

      stats.replaceChildren(...metrics.map((metric) => {
        const item = document.createElement('div');
        item.className = 'selected-work-stat';
        const icon = document.createElement('span');
        icon.className = 'selected-work-stat-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = metric.icon;
        const copy = document.createElement('span');
        copy.className = 'selected-work-stat-copy';
        const value = document.createElement('strong');
        value.textContent = metric.value;
        const label = document.createElement('span');
        label.textContent = metric.label;
        copy.append(value, label);
        item.append(icon, copy);
        return item;
      }));
    }
  }

  function createCarouselNavigation(track, itemCount, categoryName, showPosition = false) {
    const navigation = document.createElement('div');
    navigation.className = 'portfolio-carousel-controls';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'portfolio-carousel-arrow';
    previous.setAttribute('aria-label', showPosition ? 'Previous image' : `Scroll ${categoryName} backward`);
    previous.textContent = '←';

    const count = document.createElement('span');
    count.className = 'portfolio-carousel-count';
    count.setAttribute('aria-live', 'polite');
    count.textContent = showPosition ? `1 / ${itemCount}` : `${itemCount} PROJECT${itemCount === 1 ? '' : 'S'}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'portfolio-carousel-arrow';
    next.setAttribute('aria-label', showPosition ? 'Next image' : `Scroll ${categoryName} forward`);
    next.textContent = '→';

    const getSlideStep = () => {
      const slideWidth = track.firstElementChild?.getBoundingClientRect().width || track.clientWidth || 1;
      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
      return slideWidth + gap;
    };
    const getIndex = () => Math.max(0, Math.min(itemCount - 1, Math.round(track.scrollLeft / getSlideStep())));

    const update = () => {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      if (showPosition) {
        const index = getIndex();
        previous.disabled = index === 0;
        next.disabled = index >= itemCount - 1;
        count.textContent = `${index + 1} / ${itemCount}`;
        return;
      }

      previous.disabled = maxScroll <= 1 || track.scrollLeft <= 1;
      next.disabled = maxScroll <= 1 || track.scrollLeft >= maxScroll - 1;
    };

    const navigate = direction => {
      if (showPosition) {
        const nextIndex = Math.max(0, Math.min(itemCount - 1, getIndex() + direction));
        track.scrollTo({ left: nextIndex * getSlideStep(), behavior: 'smooth' });
        return;
      }

      track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.82, 240), behavior: 'smooth' });
    };
    previous.addEventListener('click', () => navigate(-1));
    next.addEventListener('click', () => navigate(1));
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    navigation.append(previous, count, next);
    update();
    requestAnimationFrame(update);

    return navigation;
  }

  function enableMouseDrag(track) {
    let pointerId = null;
    let startX = 0;
    let initialScroll = 0;
    let dragged = false;
    let suppressClick = false;

    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('video')) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      initialScroll = track.scrollLeft;
      dragged = false;
    });

    track.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 5 && !dragged) {
        dragged = true;
        track.setPointerCapture(pointerId);
        track.classList.add('is-dragging');
      }
      if (dragged) {
        event.preventDefault();
        track.scrollLeft = initialScroll - delta;
      }
    }, { passive: false });

    const finishDrag = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      track.classList.remove('is-dragging');
      if (dragged) {
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 0);
      }
    };

    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    track.addEventListener('click', (event) => {
      if (!suppressClick || !event.target.closest('.gallery-card')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
  }

  function createCategorySection(category, categoryIndex, featuredOnly = false) {
    const featuredProject = category.projects.find((project) => project.id === category.featuredProjectId) || category.projects[0];
    const projects = featuredOnly
      ? (featuredProject ? [featuredProject] : [])
      : category.projects;
    const section = document.createElement('section');
    section.className = 'section-block portfolio-category-section';
    section.dataset.category = category.id;

    const header = document.createElement('div');
    header.className = 'section-block-header portfolio-category-header';
    const headingGroup = document.createElement('div');
    headingGroup.className = 'block-header-left';

    const categoryLabel = document.createElement('span');
    categoryLabel.className = 'block-num-tag';
    categoryLabel.textContent = `${String(categoryIndex + 1).padStart(2, '0')} · ${projects.length} PROJECT${projects.length === 1 ? '' : 'S'}`;

    const heading = document.createElement('h2');
    heading.className = 'block-title';
    heading.textContent = category.name;

    headingGroup.append(categoryLabel, heading);
    header.append(headingGroup);

    const track = document.createElement('div');
    track.className = 'portfolio-carousel-track';
    track.id = `portfolio-carousel-${categoryIndex}`;
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', `${category.name} projects`);

    projects.forEach((project) => {
      track.append(createProjectCard(project, category, project.id === category.featuredProjectId));
    });

    if (projects.length === 0) {
      track.append(createPortfolioStatus('Projects added to this category will appear here.'));
    }

    header.append(createCarouselNavigation(track, projects.length, category.name));
    enableMouseDrag(track);
    section.append(header, track);
    return section;
  }

  function createPortfolioStatus(message) {
    const status = document.createElement('p');
    status.className = 'portfolio-status';
    status.textContent = message;
    return status;
  }

  function renderPortfolioFilters(categories) {
    const filterContainer = document.getElementById('portfolio-category-filters');
    if (!filterContainer) return;

    filterContainer.replaceChildren();
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'filter-btn active';
    allButton.dataset.filter = 'all';
    allButton.textContent = 'All Categories';
    allButton.addEventListener('click', () => window.filterProjects('all', allButton));
    filterContainer.append(allButton);

    categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-btn';
      button.dataset.filter = category.id;
      button.textContent = category.name;
      button.addEventListener('click', () => window.filterProjects(category.id, button));
      filterContainer.append(button);
    });

    if (!document.getElementById('portfolio-categories')) {
      const galleryLink = document.createElement('a');
      galleryLink.href = 'creativity.html';
      galleryLink.className = 'filter-btn portfolio-gallery-link';
      galleryLink.textContent = 'Open Full Detailed Gallery →';
      filterContainer.append(galleryLink);
    }
  }

  function renderPortfolio() {
    const selectedWorksGrid = document.getElementById('selected-works-grid');
    const categoriesContainer = document.getElementById('portfolio-categories');
    const hasManifest = portfolioManifest && Array.isArray(portfolioManifest.categories);

    if (!hasManifest) {
      console.error('Portfolio manifest is missing or invalid. Run node generate-portfolio-manifest.js before publishing.');
      if (selectedWorksGrid) selectedWorksGrid.replaceChildren(createPortfolioStatus('The portfolio index is unavailable. Please regenerate the site portfolio manifest.'));
      if (categoriesContainer) categoriesContainer.replaceChildren(createPortfolioStatus('The portfolio index is unavailable. Please regenerate the site portfolio manifest.'));
      document.querySelectorAll('.section-block').forEach(section => section.remove());
      return;
    }

    const categories = portfolioManifest.categories;
    renderContinuousShowcase(portfolioManifest.carousel || []);
    renderSelectedWorks(portfolioManifest.selectedWorks?.projects || []);
    if (categoriesContainer) {
      renderPortfolioFilters(categories);
      document.querySelectorAll('.section-block:not(.portfolio-category-section)').forEach(section => section.remove());
      categoriesContainer.replaceChildren();
      categories.forEach((category, index) => {
        categoriesContainer.append(createCategorySection(category, index));
      });
    }
  }

  // Open Project Modal
  window.openProjectModal = function (projectId) {
    const project = discoveredProjects.get(projectId);
    if (project && project.pageUrl) {
      window.location.href = project.pageUrl;
      return;
    }
    const imageCount = project ? project.media.filter(media => media.type === 'image').length : 0;
    const videoCount = project ? project.media.filter(media => media.type === 'video').length : 0;
    const mediaSummary = [
      imageCount ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '',
      videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : ''
    ].filter(Boolean).join(' and ') || 'project media';
    const data = project
      ? {
          title: project.title,
          tag: 'PORTFOLIO PROJECT',
          category: project.category,
          desc: `Explore ${mediaSummary} from ${project.title}.`,
          tools: 'Portfolio media',
          role: 'Designer',
          client: project.category,
          image: project.cover && project.cover.type === 'image' ? toAssetUrl(project.cover.path) : ''
        }
      : projectsData[projectId];
    if (!data) return;

    const modal = document.getElementById('project-modal');
    const modalImg = document.getElementById('modal-img');
    const modalTag = document.getElementById('modal-tag');
    const modalTitle = document.getElementById('modal-title');
    const modalCat = document.getElementById('modal-cat');
    const modalDesc = document.getElementById('modal-desc');
    const modalTools = document.getElementById('modal-tools');
    const modalRole = document.getElementById('modal-role');
    const modalClient = document.getElementById('modal-client');
    const modalGallery = document.getElementById('modal-media-gallery');
    const modalBackButton = document.getElementById('modal-back-btn');

    if (project) projectModalOpener = document.activeElement;
    if (modalBackButton) {
      modalBackButton.hidden = !project;
      modalBackButton.textContent = project ? `← Back to ${project.category}` : '';
    }
    if (modalImg) {
      modalImg.hidden = Boolean(project);
      modalImg.style.backgroundImage = data.image ? `url("${data.image}")` : 'none';
    }
    if (modalTag) modalTag.textContent = data.tag;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalCat) modalCat.textContent = data.category;
    if (modalDesc) modalDesc.textContent = data.desc;
    if (modalTools) modalTools.textContent = data.tools;
    if (modalRole) modalRole.textContent = data.role;
    if (modalClient) modalClient.textContent = data.client;

    if (modalGallery) {
      modalGallery.replaceChildren();
      modalGallery.hidden = !project;
      if (project) {
        const track = document.createElement('div');
        track.className = 'portfolio-carousel-track portfolio-modal-track';
        track.tabIndex = 0;
        track.setAttribute('role', 'region');
        track.setAttribute('aria-label', `${project.title} project gallery`);

        project.media.forEach((media) => {
          const slide = document.createElement('div');
          slide.className = 'portfolio-modal-slide';
          const item = createMediaElement(media, 'portfolio-modal-media', true);
          if (media.type === 'video') {
            item.muted = false;
            item.setAttribute('aria-label', media.name || 'Project video');
          }
          slide.append(item);
          track.append(slide);
        });

        modalGallery.append(track);
        if (project.media.length > 1) {
          modalGallery.append(createCarouselNavigation(track, project.media.length, project.title, true));
        }
        enableMouseDrag(track);
      }
    }

    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  // Close Project Modal
  window.closeProjectModal = function (event) {
    if (event && event.target && event.target.closest('.project-modal-dialog') && !event.target.classList.contains('modal-close-btn')) {
      return;
    }
    const modal = document.getElementById('project-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (projectModalOpener instanceof HTMLElement && projectModalOpener.isConnected) {
      projectModalOpener.focus({ preventScroll: true });
    }
    projectModalOpener = null;
  };

  // Open Project Suggestion Modal
  window.openSuggestionModal = function () {
    const modal = document.getElementById('suggestion-modal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      const successBox = document.getElementById('suggestion-success-alert');
      if (successBox) successBox.style.display = 'none';
    }
  };

  // Close Project Suggestion Modal
  window.closeSuggestionModal = function (event) {
    if (event && event.target && event.target.closest('.suggestion-dialog') && !event.target.classList.contains('modal-close-btn')) {
      return;
    }
    const modal = document.getElementById('suggestion-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  // Handle Suggestion Form Submission
  window.handleSuggestionSubmit = function (event) {
    event.preventDefault();
    const successBox = document.getElementById('suggestion-success-alert');
    if (successBox) successBox.style.display = 'block';

    const name = document.getElementById('sugg-name')?.value || 'A Creative Viewer';
    const contact = document.getElementById('sugg-contact')?.value || 'Not provided';
    const category = document.getElementById('sugg-category')?.value || 'Creative Concept';
    const comment = document.getElementById('sugg-comment')?.value || '';

    const subject = encodeURIComponent(`Creative Project Suggestion from ${name} (${category})`);
    const body = encodeURIComponent(`Hi Tanishq,\n\nI have a project suggestion for you:\n\nName: ${name}\nContact: ${contact}\nCategory: ${category}\n\nProject Suggestion / Comment:\n${comment}\n`);

    document.getElementById('suggestion-form')?.reset();

    setTimeout(() => {
      window.location.href = `mailto:tanishq.sharma.vds@gmail.com?subject=${subject}&body=${body}`;
    }, 1200);
  };

  // Filter Projects in Gallery
  window.filterProjects = function (category, btnElement) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    document.querySelectorAll('.portfolio-category-section').forEach((section) => {
      section.style.display = category === 'all' || section.dataset.category === category ? '' : 'none';
    });
  };

  // Keyboard escape listener for modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeProjectModal();
      window.closeSuggestionModal();
      return;
    }

    const modal = document.getElementById('project-modal');
    if (!modal?.classList.contains('open') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    const gallery = modal.querySelector('.portfolio-modal-track');
    if (!gallery || gallery.children.length < 2) return;

    const arrow = modal.querySelector(e.key === 'ArrowLeft'
      ? '.portfolio-carousel-arrow:first-child'
      : '.portfolio-carousel-arrow:last-child');
    if (arrow && !arrow.disabled) {
      e.preventDefault();
      arrow.click();
    }
  });

  // Initialize
  function init() {
    renderPortfolio();
    startCinematicIntro();

    if (canvas) {
      updateScrollRange();
      updateScrollTarget();
      requestNearbyFrames();
      resizeCanvas();

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      if (window.matchMedia('(pointer: fine) and (hover: hover)').matches) {
        window.addEventListener('pointermove', onPointerMove, { passive: true });
      }
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
          updateScrollRange();
          scheduleRender();
        }).observe(document.body);
      }

      lastFrameTime = performance.now();
      scheduleRender();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================
   LANDING ENTRY ANIMATION CONTROLLER
   ========================================== */

(() => {
  let entryStarted = false;

  const introIsActive = () =>
    document.body.classList.contains("cinema-intro-active") ||
    document.documentElement.classList.contains("cinema-intro-active");

  function startLandingEntryAnimation() {
    if (entryStarted) return;
    entryStarted = true;

    const flare = document.createElement("div");
    flare.id = "landing-entry-flare";
    document.body.appendChild(flare);

    document.body.classList.add("landing-entry-active");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add("landing-entry-done");
      });
    });

    window.setTimeout(() => {
      flare.remove();
      document.body.classList.remove("landing-entry-active");
    }, 3800);
  }

  window.startLandingEntryAnimation = startLandingEntryAnimation;

  /*
   * Connect to existing intro completion function.
   */
  if (typeof window.finishIntro === "function") {
    const originalFinishIntro = window.finishIntro;

    window.finishIntro = function (...args) {
      const result = originalFinishIntro.apply(this, args);

      window.setTimeout(startLandingEntryAnimation, 150);

      return result;
    };
  }

  /*
   * Fallback: detect the existing intro class disappearing.
   */
  let introWasActive = introIsActive();

  const introObserver = new MutationObserver(() => {
    if (introIsActive()) {
      introWasActive = true;
      return;
    }

    if (introWasActive) {
      introObserver.disconnect();
      window.setTimeout(startLandingEntryAnimation, 150);
    }
  });

  introObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  introObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });

})();


/* ==========================================
   FUTURE UPGRADE — AUTO MOTION CONTROLLER
   ========================================== */

(() => {
  if (window.__futureMotionInstalled) return;
  window.__futureMotionInstalled = true;

  const excluded = 'script,style,link,meta,svg,path,defs,filter';

  function prepareElements() {
    const selectors = [
      'header', 'nav', 'main', 'main > *',
      'section', 'footer', 'article',
      '.hero', '.container', '.content',
      '.project-card', '.portfolio-card',
      '.work-card', '.portfolio-grid',
      '.gallery', '.featured-work',
      'h1', 'h2', 'h3', 'h4',
      'p', '.subtitle', '.description',
      'img', 'video', 'canvas',
      'button', '.btn', '.cta',
      'a', '.nav-link'
    ].join(',');

    const elements = [...document.querySelectorAll(selectors)]
      .filter(el => !el.closest(excluded));

    let index = 0;

    elements.forEach(el => {
      if (el.closest('#fx-atmosphere, #fx-light-sweep')) return;

      let type = 'block';

      if (el.matches('img,video,canvas')) type = 'media';
      else if (el.matches('h1,h2,h3,h4')) type = 'title';
      else if (el.matches('p,.subtitle,.description')) type = 'text';
      else if (el.matches('button,.btn,.cta,a,.nav-link')) type = 'control';
      else if (el.matches('.project-card,.portfolio-card,.work-card,.portfolio-grid,.gallery,article')) type = 'card';

      el.dataset.fx = type;

      const delay = type === 'title' ? 1.0 + index * .07 :
                    type === 'media' ? 1.3 + index * .035 :
                    type === 'control' ? 1.8 + index * .035 :
                    1.25 + index * .045;

      el.style.setProperty('--fx-delay', `${Math.min(delay, 3.2)}s`);
      el.style.setProperty('--fx-duration', type === 'media' ? '1.5s' : '1.05s');

      index++;
    });
  }

  function activate() {
    if (document.body.classList.contains('fx-entry-ready')) return;

    prepareElements();

    const atmosphere = document.createElement('div');
    atmosphere.id = 'fx-atmosphere';

    const sweep = document.createElement('div');
    sweep.id = 'fx-light-sweep';

    document.body.prepend(atmosphere, sweep);
    document.body.classList.add('fx-entry-ready');
  }

  function checkIntro() {
    if (
      document.body.classList.contains('landing-entry-active') ||
      document.body.classList.contains('landing-entry-done') ||
      document.body.classList.contains('cinema-intro-done')
    ) {
      activate();
    }
  }

  const observer = new MutationObserver(checkIntro);

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  checkIntro();

})();

/* FIRST PAINT RELEASE + PERFORMANCE PATCH */
(() => {
  function releaseLanding() {
    if (!document.body.classList.contains("fx-entry-ready")) return false;
    document.documentElement.classList.remove("fx-boot");
    return true;
  }

  if (releaseLanding()) return;

  const observer = new MutationObserver(() => {
    if (releaseLanding()) observer.disconnect();
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // Safety fallback
  setTimeout(() => {
    document.documentElement.classList.remove("fx-boot");
    observer.disconnect();
  }, 10000);
})();

/* ===== SIGNATURE HEAVY DROP TYPOGRAPHY ===== */

(() => {
  const targets = [
    { text: "Visual Storytelling", cls: "fx-drop-one" },
    { text: "Branding & Identity", cls: "fx-drop-two" },
    { text: "Tanishq Sharma", cls: "fx-drop-three" }
  ];

  function applySignatureAnimation() {
    if (!document.body.classList.contains("fx-entry-ready")) return;

    const elements = document.querySelectorAll(
      "h1,h2,h3,h4,p,span,div"
    );

    targets.forEach(target => {
      elements.forEach(el => {
        if (
          el.closest("#fx-atmosphere, #fx-light-sweep") ||
          el.classList.contains("fx-heavy-drop")
        ) return;

        const content = (el.innerText || "").replace(/\s+/g, " ").trim();

        if (!content.includes(target.text)) return;

        const hasMatchingChild = [...el.children].some(child =>
          (child.innerText || "").replace(/\s+/g, " ").includes(target.text)
        );

        if (hasMatchingChild) return;

        el.classList.add("fx-heavy-drop", target.cls);
      });
    });
  }

  const observer = new MutationObserver(applySignatureAnimation);

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  if (document.body.classList.contains("fx-entry-ready")) {
    applySignatureAnimation();
  }

  window.addEventListener("load", applySignatureAnimation, { once: true });
})();




