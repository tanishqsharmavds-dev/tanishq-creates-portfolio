(() => {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 239;
  const FRAME_PREFIX = 'video_frames_24fps/frame_';
  const FRAME_EXT = '.jpg';
  const DECAY_SPEED = 7.5; // Frame-rate independent exponential damping constant
  const CONCURRENT_DOWNLOADS = 10;

  // --- DOM Elements ---
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
  const loader = document.getElementById('loader');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderBar = document.getElementById('loader-progress-bar');
  const navbar = document.querySelector('.navbar');

  // --- State ---
  const images = new Array(TOTAL_FRAMES);
  const loaded = new Array(TOTAL_FRAMES).fill(false);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let canvasNeedsResize = true;
  let isLoaderDismissed = false;
  let lastFrameTime = performance.now();

  // Format frame URL: frame_000001.jpg -> frame_000239.jpg
  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(6, '0');
    return `${FRAME_PREFIX}${frameNum}${FRAME_EXT}`;
  }

  // Pre-load and decode an individual frame
  function loadFrame(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameUrl(index);

      const onImageReady = () => {
        images[index] = img;
        loaded[index] = true;
        loadedCount++;
        updateProgress();

        // GPU texture pre-decode to eliminate stutter during scrubbing
        if ('decode' in img) {
          img.decode().catch(() => { }).then(() => resolve(img));
        } else {
          resolve(img);
        }
      };

      img.onload = onImageReady;
      img.onerror = () => {
        loaded[index] = true;
        loadedCount++;
        updateProgress();
        resolve(null);
      };
    });
  }

  // Update loading progress UI
  function updateProgress() {
    const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
    if (loaderPercent) loaderPercent.textContent = `${percent}%`;
    if (loaderBar) loaderBar.style.width = `${percent}%`;

    if (loadedCount >= TOTAL_FRAMES && !isLoaderDismissed) {
      dismissLoader();
    }
  }

  // Dismiss loader with sleek transition
  function dismissLoader(immediate = false) {
    if (immediate) {
      isLoaderDismissed = true;
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
      return;
    }

    if (isLoaderDismissed) return;
    isLoaderDismissed = true;
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        if (loader && loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 850);
    }
  }

  function startCinematicIntro() {
    const intro = document.getElementById('cinema-intro');
    if (!intro) return;

    const backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== intro)
      .map((element) => ({ element, wasInert: element.inert }));
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
    });

    let isFinished = false;
    let fallbackTimer;
    const finishIntro = () => {
      if (isFinished) return;
      isFinished = true;
      window.clearTimeout(fallbackTimer);
      backgroundElements.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      document.body.classList.remove('cinema-intro-active');
      intro.remove();
      dismissLoader(true);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishIntro();
      return;
    }

    intro.addEventListener('animationend', (event) => {
      if (event.target === intro && event.animationName === 'cinema-fade-out') {
        finishIntro();
      }
    });
    fallbackTimer = window.setTimeout(finishIntro, 4500);
  }

  // Preload pipeline with concurrency pool
  async function preloadAllFrames() {
    if (!canvas) return;
    // 1. Immediately load Frame 0 (or current scroll frame) for instantaneous first render
    const initialIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(targetProgress * (TOTAL_FRAMES - 1)))
    );

    const initialImg = await loadFrame(initialIndex);
    if (initialImg) {
      resizeCanvas();
      drawFrame(initialImg);
      lastRenderedIndex = initialIndex;
    }

    // 2. Queue remaining frames in order
    const indicesToLoad = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (i !== initialIndex) {
        indicesToLoad.push(i);
      }
    }

    let currentIndex = 0;
    async function worker() {
      while (currentIndex < indicesToLoad.length) {
        const nextIdx = indicesToLoad[currentIndex++];
        await loadFrame(nextIdx);
      }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENT_DOWNLOADS; w++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    dismissLoader();
  }

  // Find nearest loaded frame to guarantee flicker-free rendering
  function getClosestLoadedImage(requestedIndex) {
    if (loaded[requestedIndex] && images[requestedIndex]) {
      return images[requestedIndex];
    }

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = requestedIndex - offset;
      if (prev >= 0 && loaded[prev] && images[prev]) {
        return images[prev];
      }
      const next = requestedIndex + offset;
      if (next < TOTAL_FRAMES && loaded[next] && images[next]) {
        return images[next];
      }
    }

    return images[0] || null;
  }

  // Canvas drawing with watermark elimination and crisp sub-pixel alignment
  function drawFrame(img) {
    if (!ctx || !img || !img.complete) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgWidth = img.naturalWidth || img.width || 1920;
    const imgHeight = img.naturalHeight || img.height || 1080;

    // Mathematically clean crop parameters: completely exclude the watermark zone (X > 1690, Y > 850)
    // 1560x880 box offset by 60px X and 40px Y maintains true 16:9 ratio and centers the 3D character
    const cropX = imgWidth * 0.03125;
    const cropY = imgHeight * 0.037;
    const cropW = imgWidth * 0.8125;
    const cropH = imgHeight * 0.8148;

    const imgRatio = cropW / cropH;
    const canvasRatio = w / h;

    let drawW, drawH;
    if (canvasRatio > imgRatio) {
      drawW = w;
      drawH = w / imgRatio;
    } else {
      drawH = h;
      drawW = h * imgRatio;
    }

    const drawX = (w - drawW) * 0.5;
    const drawY = (h - drawH) * 0.5;

    ctx.drawImage(img, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);
  }

  // High-DPI Canvas Resizing
  function resizeCanvas() {
    if (!canvas || !ctx) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Navbar elevation on scroll
    if (navbar) {
      if (scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  }

  function onScroll() {
    updateScrollTarget();
  }

  function onResize() {
    canvasNeedsResize = true;
    updateScrollTarget();
  }

  // Animation Loop (Frame-rate independent damped scrubber)
  function renderLoop(currentTime) {
    if (!canvas) return;
    const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = currentTime;

    // Check resize
    let wasResized = false;
    if (canvasNeedsResize) {
      wasResized = resizeCanvas();
      canvasNeedsResize = false;
    }

    // Frame-rate independent exponential decay interpolation
    const factor = 1 - Math.exp(-DECAY_SPEED * dt);
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.00005) {
      currentProgress += diff * factor;
    } else {
      currentProgress = targetProgress;
    }

    // Map to frame index
    const targetFrameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
    );

    // Render only when frame index changes or canvas resized
    if (targetFrameIndex !== lastRenderedIndex || wasResized) {
      const imgToDraw = getClosestLoadedImage(targetFrameIndex);
      if (imgToDraw) {
        drawFrame(imgToDraw);
        lastRenderedIndex = targetFrameIndex;
      }
    }

    requestAnimationFrame(renderLoop);
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

  // Open Project Modal
  window.openProjectModal = function (projectId) {
    const data = projectsData[projectId];
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

    if (modalImg) modalImg.style.backgroundImage = `url('${data.image}')`;
    if (modalTag) modalTag.textContent = data.tag;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalCat) modalCat.textContent = data.category;
    if (modalDesc) modalDesc.textContent = data.desc;
    if (modalTools) modalTools.textContent = data.tools;
    if (modalRole) modalRole.textContent = data.role;
    if (modalClient) modalClient.textContent = data.client;

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

    const cards = document.querySelectorAll('.gallery-card');
    cards.forEach(card => {
      const cardCat = card.getAttribute('data-category');
      if (category === 'all' || cardCat === category) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // Keyboard escape listener for modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeProjectModal();
      window.closeSuggestionModal();
    }
  });

  // Initialize
  function init() {
    startCinematicIntro();

    if (canvas) {
      updateScrollTarget();
      currentProgress = targetProgress;
      resizeCanvas();

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });

      lastFrameTime = performance.now();
      requestAnimationFrame(renderLoop);
      preloadAllFrames();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
