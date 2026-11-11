(() => {
  'use strict';

  const manifest = window.PORTFOLIO_MANIFEST;
  const projectsById = new Map();
  const categoriesById = new Map();
  const isGalleryPage = document.body.classList.contains('creativity-page-body');
  let savedScrollPosition = 0;
  let savedRootOverflow = '';
  let savedRootOverflowPriority = '';
  let savedBodyPaddingRight = '';
  let savedBodyPaddingRightPriority = '';
  let lastModalTrigger = null;
  const legacyProjectCopy = new Map([
    ['cafe render.png', { title: 'Café Interior 3D Render', description: 'Full interior space render with accurate lighting and material simulation.' }],
    ['cafe render 2.png', { title: 'Café Interior Render Study' }],
    ['display stand iso.png', { title: 'Display Stand Design', description: 'Isometric product display stand designed in SketchUp with clean geometry.' }],
    ['mobile stand.jpg', { title: 'Mobile Phone Stand', description: 'Ergonomic mobile stand concept modeled in 3D with real-world dimensions.' }],
    ['apple watch poster-01.jpg', { title: 'Apple Watch Poster', description: 'Bold product advertisement poster for Apple Watch featuring cinematic composition.' }],
    ['cocktail party -01.png', { title: 'Cocktail Party Poster' }],
    ['cola strike.jpg', { title: 'Cola Strike Packaging' }],
    ['cola predator .jpg', { title: 'Cola Predator Label', description: 'Bold, high-energy beverage label design for Cola Predator with aggressive visual identity.' }],
    ['flora. .jpg', { title: 'Flora Botanical Photography', description: 'Macro nature photography with shallow depth of field and natural light.' }],
    ['flora.jpg', { title: 'Flora Botanical Photography', description: 'Macro nature photography with shallow depth of field and natural light.' }],
    ['lemon splash.heic', { title: 'Citrus Product Study' }],
    ['lemon.jpg', { title: 'Lemon Beverage Label' }],
    ['lemon predator.jpg', { title: 'Lemon Predator Packaging', description: 'Citrus-themed variant with vivid colour gradients and punchy label typography.' }],
    ['nike.png', { title: 'Nike Sneaker Poster' }],
    ['puma sneaker poster_.jpg', { title: 'Puma Sneaker Poster' }],
    ['puma billboard.jpg', { title: 'Puma Billboard Campaign', description: 'Large-format billboard design for Puma footwear with strong visual hierarchy.' }],
    ['puma womens wear.jpg', { title: "Puma Women's Wear Campaign", description: "Fashion-forward brand campaign for Puma Women's Wear featuring bold typography and lifestyle photography." }],
    ['puma.png', { title: 'Puma Brand Study' }],
    ['raspberry predator .jpg', { title: 'Raspberry Predator Packaging' }],
    ['raspberry.jpg', { title: 'Raspberry Beverage Label' }],
    ['render redtape.png', { title: 'Red Tape Product Render' }],
    ['render havells .png', { title: 'Havells Product Render', description: '3D brand visualization and product render for Havells — integrating product photography with motion-inspired design.' }],
    ['rim light .jpg', { title: 'Rim-Light Portrait', description: 'Studio photography experiment with dramatic rim lighting and subject contrast.' }],
    ['side light.jpg', { title: 'Side-Light Study' }],
    ['symettery.jpg', { title: 'Symmetry Study', description: 'Abstract architectural and geometric photography exploring visual balance.' }],
    ['symettry.jpg', { title: 'Symmetry Study', description: 'Abstract architectural and geometric photography exploring visual balance.' }],
    ['tiger badge orange poster_.jpg', { title: 'Onitsuka Tiger Campaign Poster' }],
    ['tiger sneaker_.jpg', { title: 'Onitsuka Tiger Sneaker Campaign' }],
    ['tiger sneaker poster.jpg', { title: 'Onitsuka Tiger Sneaker Campaign' }],
    ['terettory.jpg', { title: '' }],
    ['vegas_sp_new.jpg', { title: 'Vegas Mall Social Campaign', description: 'Complete social media brand identity design for Vegas Mall including promotional posts, story templates and event banners.' }],
    ['vegas_social_media_post.jpg', { title: 'Vegas Mall Social Campaign' }],
    ['vegas_social_media_post_2.jpg', { title: 'Vegas Mall Social Campaign' }],
    ['water splash glass .heic', { title: 'Glass and Water Product Study' }],
    ['onitsuka tiger sp.jpg', { title: 'Onitsuka Tiger Sneaker Campaign' }],
    ['social issue.png', { title: 'Domestic Violence Awareness', description: 'Visual campaign raising awareness about domestic violence through powerful imagery.' }],
    ['social issue 3.png', { title: 'Stop The Silence', description: 'Editorial illustration campaign on the importance of speaking out against violence.' }],
    ['social issue 4.png', { title: 'She Deserves Better', description: 'Advocacy poster series designed to spark conversation and social change.' }],
    ['img_6620.jpg', { title: 'Rim Light Portrait', description: 'Studio photography experiment with dramatic rim lighting and subject contrast.' }],
    ['img_6764.jpg', { title: 'Symmetry Study', description: 'Abstract architectural and geometric photography exploring visual balance.' }],
    ['3 flavours label design.jpg', { title: 'Three-Flavour Label System', description: 'Complete product label design system across 3 flavour variants with consistent brand language.' }],
    ['sunglasses girls 2.png', { title: 'Sunglasses Visual Campaign', description: 'Editorial sunglasses photography and visual storytelling for lifestyle branding.' }],
    ['sunglasses visulas.png', { title: 'Sunglasses Visual Campaign', description: 'Editorial sunglasses photography and visual storytelling for lifestyle branding.' }],
    ['sunglasses.png', { title: 'Sunglasses Visual Campaign', description: 'Editorial sunglasses photography and visual storytelling for lifestyle branding.' }]
  ]);
  const projectTitleOverrides = new Map([
    ['3d models and renders|cafe', 'Café Interior Rendering'],
    ['3d models and renders|display stand', 'Product Display Stand'],
    ['3d models and renders|mobile stand', 'Mobile Stand Concept'],
    ['3d models and renders|podium', 'Podium Concept'],
    ['brand identity : logo|havells', 'Havells Brand Identity'],
    ['brand identity : logo|onitstuka tiger', 'Onitsuka Tiger'],
    ['brand identity : logo|puma speedcat', 'Puma Speedcat'],
    ['brand identity : logo|red tape', 'Red Tape'],
    ['brand identity : logo|thumbs up', 'Thums Up'],
    ['brand identity : logo|tim hortins', 'Tim Hortons'],
    ['brand identity : logo|vegas mall', 'Vegas Mall'],
    ['posters : visual designs|apple watch', 'Apple Watch Poster'],
    ['posters : visual designs|message', 'Event and Promotional Posters'],
    ['posters : visual designs|sneakers', 'Sneaker Campaign'],
    ['posters : visual designs|sunglasses', 'Sunglasses Visual Campaign'],
    ['photography|flora', 'Flora Botanical Photography'],
    ['photography|img 0004', ''],
    ['photography|img 0005 2', ''],
    ['photography|img 0272', ''],
    ['photography|img 0277', ''],
    ['photography|img 6620', 'Rim-Light Portrait'],
    ['photography|img 6623 (1)', ''],
    ['photography|img 6680', ''],
    ['photography|img 6685 (1)', ''],
    ['photography|img 6735', ''],
    ['photography|img 6746', ''],
    ['photography|img 6764', 'Symmetry Study']
  ]);
  const legacyCategoryCopy = new Map();

  if (isGalleryPage) {
    const categoryAliases = {
      '3D Models and Renders': ['CAD Designs', '3D Models & Renders'],
      'Brand Identity : Logo': ['Brand Identity / Logo'],
      'Packaging Design': ['Packaging Design'],
      Photography: ['Photography'],
      'Posters : Visual Designs': ['Posters / Visual Designs'],
      'Social Issues': ['Social Issues']
    };

    document.querySelectorAll('.section-block').forEach(section => {
      const heading = section.querySelector('.block-title')?.textContent.trim();
      const description = section.querySelector('.block-sub')?.textContent.trim();
      if (!heading || !description) return;
      Object.entries(categoryAliases).forEach(([category, aliases]) => {
        if (aliases.includes(heading)) {
          const descriptions = legacyCategoryCopy.get(category) || [];
          descriptions.push(description);
          legacyCategoryCopy.set(category, descriptions);
        }
      });

    });
  }

  if (!manifest || !Array.isArray(manifest.categories)) {
    console.error('Portfolio content could not be loaded. Check portfolio-manifest.js.');
    return;
  }

  const categories = manifest.categories.filter(category => category.id !== 'WALL SIGNATURE');
  categories.forEach(category => {
    categoriesById.set(category.id, category);
    category.projects.forEach(project => projectsById.set(project.id, { ...project, category: category.name }));
  });

  function localUrl(filePath) {
    return filePath.split('/').map(encodeURIComponent).join('/');
  }

  function lockPageScroll() {
    if (document.body.classList.contains('modal-open')) return;
    savedScrollPosition = window.scrollY;
    const root = document.documentElement;
    savedRootOverflow = root.style.getPropertyValue('overflow');
    savedRootOverflowPriority = root.style.getPropertyPriority('overflow');
    savedBodyPaddingRight = document.body.style.getPropertyValue('padding-right');
    savedBodyPaddingRightPriority = document.body.style.getPropertyPriority('padding-right');
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.setProperty('padding-right', `${currentPadding + scrollbarWidth}px`);
    }
    root.style.setProperty('overflow', 'hidden');
    document.body.classList.add('modal-open');
  }

  function unlockPageScroll() {
    if (document.querySelector('.project-modal-backdrop.open')) return;
    document.body.classList.remove('modal-open');
    const root = document.documentElement;
    if (savedRootOverflow) {
      root.style.setProperty('overflow', savedRootOverflow, savedRootOverflowPriority);
    } else {
      root.style.removeProperty('overflow');
    }
    if (savedBodyPaddingRight) {
      document.body.style.setProperty('padding-right', savedBodyPaddingRight, savedBodyPaddingRightPriority);
    } else {
      document.body.style.removeProperty('padding-right');
    }
    window.scrollTo({ top: savedScrollPosition, left: 0, behavior: 'instant' });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function getImageMedia(project) {
    return project.cover?.type === 'image'
      ? project.cover
      : project.media.find(media => media.type === 'image') || project.cover || null;
  }

  function getProjectCopy(project) {
    return project.media.map(media => legacyProjectCopy.get(media.name.toLowerCase())).find(Boolean);
  }

  function getDisplayTitle(project) {
    const copy = getProjectCopy(project);
    if (copy) return copy.title;

    const title = project.title?.trim() || '';
    const override = projectTitleOverrides.get(`${project.category?.toLowerCase()}|${title.toLowerCase()}`);
    if (override !== undefined) return override;
    if (/\.(?:jpe?g|png|webp|gif|apng|avif|bmp|svg|ico|heic|pdf|mp4|webm)$/i.test(project.folder || '')) return '';
    if (/^(?:img|dsc|screenshot)(?:[\s_-]|$)|^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(title)) return '';

    return title.replace(/\s+/g, ' ');
  }

  function createCover(project, className) {
    const cover = createElement('div', className);
    const media = getImageMedia(project);
    if (media) {
      const image = createElement('img');
      image.src = localUrl(media.previewPath || media.path);
      image.alt = getDisplayTitle(project);
      image.loading = 'lazy';
      image.decoding = 'async';
      cover.append(image);
    } else if (project.cover?.type === 'video') {
      const video = createElement('video');
      video.src = localUrl(project.cover.path);
      video.muted = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-label', `${getDisplayTitle(project) || project.category} project video`);
      cover.append(video);
    } else {
      cover.append(createElement('span', 'project-document-cover', 'PDF'));
    }

    return cover;
  }

  function createHomeCard(project) {
    const card = createElement('a', 'gallery-card portfolio-home-card');
    const category = categoriesById.get(project.category);
    const matchingProject = category?.projects.find(candidate =>
      candidate.title.toLowerCase() === project.title.toLowerCase() ||
      candidate.media.some(media => project.media.some(selectedMedia => media.name.toLowerCase() === selectedMedia.name.toLowerCase()))
    );
    const displayProject = matchingProject || project;
    const displayTitle = getDisplayTitle(displayProject);
    const copy = getProjectCopy(displayProject);
    card.href = 'creativity.html';
    card.setAttribute('aria-label', displayTitle ? `${displayTitle}, ${project.category}` : `Portfolio work in ${project.category}`);
    card.append(createCover(displayProject, 'gallery-card-img'));

    const body = createElement('div', 'gallery-card-info');
    body.append(
      createElement('span', 'gallery-card-tag', project.category),
      ...(displayTitle ? [createElement('h3', 'gallery-card-title', displayTitle)] : []),
      ...(copy?.description ? [createElement('p', 'gallery-card-summary', copy.description)] : [])
    );
    card.append(body);
    return card;
  }

  function renderHomeProjects() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    const selected = manifest.selectedWorks?.projects || [];
    if (selected.length === 0) {
      grid.replaceChildren(createElement('p', 'portfolio-empty-state', 'No selected work is available yet.'));
      return;
    }

    const categoryIds = new Set(selected.map(project => project.category));
    const filters = document.querySelector('.section-creativity .gallery-filter-tabs');
    if (filters) {
      filters.replaceChildren();
      const allButton = createFilterButton('All Selected Work', 'all', true);
      filters.append(allButton);
      categories.forEach(category => {
        if (categoryIds.has(category.name)) {
          filters.append(createFilterButton(category.name, category.name));
        }
      });
      const fullGalleryLink = createElement('a', 'filter-btn', 'Open Full Gallery');
      fullGalleryLink.href = 'creativity.html';
      filters.append(fullGalleryLink);
    }

    const fragment = document.createDocumentFragment();
    selected.forEach(project => {
      fragment.append(createHomeCard(project));
    });
    grid.replaceChildren(fragment);

    if (filters) {
      filters.addEventListener('click', event => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        filters.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        grid.querySelectorAll('.gallery-card').forEach(card => {
          const visible = button.dataset.filter === 'all' || card.querySelector('.gallery-card-tag')?.textContent === button.dataset.filter;
          card.hidden = !visible;
        });
      });
    }
  }

  function renderCarousel() {
    const track = document.getElementById('carousel-track');
    if (!track) return;

    const projects = manifest.carousel || [];
    const group = createElement('div', 'carousel-group');
    projects.forEach(project => {
      const displayTitle = getDisplayTitle(project);
      const copy = getProjectCopy(project);
      const card = createElement('button', 'marquee-card');
      card.type = 'button';
      card.dataset.projectId = project.id;
      card.setAttribute('aria-label', displayTitle
        ? `Open ${displayTitle} project gallery`
        : `Open project gallery in ${project.category}`);

      const thumbnail = createElement('span', 'card-thumb');
      const media = getImageMedia(project);
      if (media) {
        const image = createElement('img');
        image.src = localUrl(media.previewPath || media.path);
        image.alt = displayTitle;
        image.loading = 'lazy';
        image.decoding = 'async';
        thumbnail.append(image);
      }
      thumbnail.append(createElement('span', 'card-badge-cat', project.category));
      card.append(thumbnail);

      const metadata = createElement('span', 'card-meta');
      if (displayTitle) metadata.append(createElement('span', 'card-title', displayTitle));
      if (copy?.description) metadata.append(createElement('span', 'card-desc', copy.description));
      card.append(metadata);
      group.append(card);
    });
    const duplicateGroup = group.cloneNode(true);
    duplicateGroup.setAttribute('aria-hidden', 'true');
    duplicateGroup.querySelectorAll('button').forEach(button => {
      button.tabIndex = -1;
    });
    track.replaceChildren(group, duplicateGroup);
    track.hidden = false;

    const scroller = track.closest('.marquee-track-container');
    const previous = document.getElementById('carousel-previous');
    const next = document.getElementById('carousel-next');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const groupWidth = () => group.getBoundingClientRect().width;
    let activeAnimation = 0;
    let previousTime = 0;
    let previousScrollLeft = scroller?.scrollLeft || 0;
    let resumeTimer = 0;
    let isVisible = false;
    let isHovered = false;
    let isDragging = false;

    function normalizeScroll() {
      const loopWidth = groupWidth();
      if (!loopWidth) return;
      if (scroller.scrollLeft >= loopWidth) {
        scroller.scrollLeft -= loopWidth;
      } else if (scroller.scrollLeft < 0 && previousScrollLeft > 0) {
        scroller.scrollLeft += loopWidth;
      }
      previousScrollLeft = scroller.scrollLeft;
    }

    function stopAnimation() {
      if (!activeAnimation) return;
      cancelAnimationFrame(activeAnimation);
      activeAnimation = 0;
      previousTime = 0;
    }

    function animate(time) {
      activeAnimation = 0;
      if (!scroller || !isVisible || isHovered || isDragging || document.hidden ||
          reducedMotion.matches ||
          document.getElementById('project-modal')?.classList.contains('open')) return;

      if (previousTime) {
        scroller.scrollLeft += Math.min(time - previousTime, 50) * 0.022;
        normalizeScroll();
      }
      previousTime = time;
      activeAnimation = requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (!activeAnimation && isVisible && !isHovered && !isDragging && !document.hidden &&
          !reducedMotion.matches) {
        activeAnimation = requestAnimationFrame(animate);
      }
    }

    function pauseAfterInteraction() {
      stopAnimation();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(startAnimation, 1400);
    }

    track.addEventListener('click', event => {
      const card = event.target.closest('.marquee-card');
      if (!card || card.closest('[aria-hidden="true"]')) return;
      window.openProjectModal(card.dataset.projectId);
    });
    scroller?.addEventListener('scroll', normalizeScroll, { passive: true });
    scroller?.addEventListener('pointerenter', () => {
      isHovered = true;
      stopAnimation();
    });
    scroller?.addEventListener('pointerleave', () => {
      isHovered = false;
      startAnimation();
    });
    scroller?.addEventListener('pointerdown', () => {
      isDragging = true;
      stopAnimation();
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!isDragging) return;
      isDragging = false;
      pauseAfterInteraction();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAnimation();
      else startAnimation();
    });
    window.addEventListener('portfolio-modal-closed', startAnimation);
    reducedMotion.addEventListener('change', event => {
      if (event.matches) stopAnimation();
      else startAnimation();
    });

    if (scroller && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) startAnimation();
        else stopAnimation();
      });
      observer.observe(scroller);
    } else {
      isVisible = true;
      startAnimation();
    }

    previous?.addEventListener('click', () => {
      if (!scroller) return;
      scroller.scrollBy({ left: -Math.max(180, scroller.clientWidth * 0.75), behavior: 'smooth' });
      pauseAfterInteraction();
    });
    next?.addEventListener('click', () => {
      if (!scroller) return;
      scroller.scrollBy({ left: Math.max(180, scroller.clientWidth * 0.75), behavior: 'smooth' });
      pauseAfterInteraction();
    });
  }

  function createFilterButton(label, filter, active = false) {
    const button = createElement('button', `filter-btn${active ? ' active' : ''}`, label);
    button.type = 'button';
    button.dataset.filter = filter;
    return button;
  }

  function createProjectCard(project, index) {
    const article = createElement('article', 'detail-card portfolio-project-card');
    const copy = getProjectCopy(project);
    const displayTitle = getDisplayTitle(project);
    article.id = `project-${index + 1}`;
    const button = createElement('button', 'portfolio-project-open');
    button.type = 'button';
    button.setAttribute('aria-label', displayTitle ? `View ${displayTitle}` : `View project in ${project.category}`);
    button.addEventListener('click', () => window.openProjectModal(project.id));
    button.append(createCover(project, 'detail-card-media'));

    const body = createElement('div', 'detail-card-body');
    body.append(createElement('span', 'card-corner-badge', project.category));
    if (displayTitle) body.append(createElement('h3', 'detail-item-title', displayTitle));
    if (copy?.description) body.append(createElement('p', 'detail-item-desc', copy.description));
    button.append(body);
    article.append(button);
    return article;
  }

  function renderFullGallery() {
    const container = document.getElementById('portfolio-categories');
    const filters = document.getElementById('portfolio-category-filters');
    if (!container || !filters) return;

    const fragment = document.createDocumentFragment();
    let projectIndex = 0;
    categories.forEach((category, categoryIndex) => {
      if (category.projects.length === 0) return;
      const section = createElement('section', 'section-block portfolio-category');
      section.id = `category-${categoryIndex + 1}`;
      section.dataset.category = category.id;
      const header = createElement('div', 'section-block-header');
      const left = createElement('div', 'block-header-left');
      left.append(
        createElement('span', 'block-num-tag', String(categoryIndex + 1).padStart(2, '0')),
        createElement('h2', 'block-title', category.name)
      );
      header.append(left);
      (legacyCategoryCopy.get(category.name) || []).forEach(description => {
        left.append(createElement('p', 'block-sub', description));
      });
      section.append(header);

      const grid = createElement('div', 'block-grid portfolio-project-grid');
      category.projects.forEach(project => {
        projectIndex += 1;
        grid.append(createProjectCard(project, projectIndex - 1));
      });
      section.append(grid);
      fragment.append(section);
    });

    container.replaceChildren(fragment);
    filters.replaceChildren(
      createFilterButton('All Categories', 'all', true),
      ...categories.filter(category => category.projects.length > 0).map(category => createFilterButton(category.name, category.id))
    );
    filters.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      filters.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      container.querySelectorAll('.portfolio-category').forEach(section => {
        section.hidden = button.dataset.filter !== 'all' && section.dataset.category !== button.dataset.filter;
      });
    });
  }

  function createMediaItem(media, project) {
    const item = createElement('figure', 'modal-media-item');
    const copy = legacyProjectCopy.get(media.name.toLowerCase());
    if (media.type === 'image') {
      const image = createElement('img');
      image.src = localUrl(media.previewPath || media.path);
      image.alt = copy?.title || getDisplayTitle(project);
      image.loading = 'lazy';
      image.decoding = 'async';
      item.append(image);
    } else if (media.type === 'video') {
      const video = createElement('video');
      video.src = localUrl(media.path);
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-label', `${getDisplayTitle(project) || project.category} project video`);
      item.append(video);
    } else {
      const link = createElement('a', 'modal-document-link', 'Open project document');
      link.href = localUrl(media.path);
      link.target = '_blank';
      link.rel = 'noopener';
      item.append(link);
    }
    const caption = copy?.title || getDisplayTitle(project);
    if (caption) item.append(createElement('figcaption', 'modal-media-caption', caption));
    if (copy?.description) {
      item.append(createElement('p', 'modal-media-description', copy.description));
    }
    return item;
  }

  window.openProjectModal = function (projectId) {
    const project = projectsById.get(projectId);
    const modal = document.getElementById('project-modal');
    if (!project || !modal) return;

    document.getElementById('modal-title').textContent = getDisplayTitle(project);
    document.getElementById('modal-cat').textContent = project.category;
    document.getElementById('modal-tag').textContent = `${project.media.length} PROJECT ${project.media.length === 1 ? 'FILE' : 'FILES'}`;
    document.getElementById('modal-desc').textContent = '';
    document.getElementById('modal-desc').hidden = true;
    const modalImage = document.getElementById('modal-img');
    modalImage.style.backgroundImage = '';
    modalImage.hidden = true;
    document.getElementById('modal-media-gallery').replaceChildren(
      ...project.media.map(media => createMediaItem(media, project))
    );
    document.querySelector('#project-modal .modal-details-grid')?.setAttribute('hidden', '');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    lastModalTrigger = document.activeElement;
    lockPageScroll();
    document.querySelector('#project-modal .modal-close-btn')?.focus({ preventScroll: true });
  };

  window.closeProjectModal = function (event) {
    if (event && event.target.closest('.project-modal-dialog') && !event.target.closest('.modal-close-btn')) return;
    const modal = document.getElementById('project-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    unlockPageScroll();
    if (lastModalTrigger instanceof HTMLElement) lastModalTrigger.focus({ preventScroll: true });
    window.dispatchEvent(new Event('portfolio-modal-closed'));
  };

  window.openSuggestionModal = function () {
    const modal = document.getElementById('suggestion-modal');
    if (!modal) return;
    modal.classList.add('open');
    lockPageScroll();
    const successBox = document.getElementById('suggestion-success-alert');
    if (successBox) successBox.style.display = 'none';
  };

  window.closeSuggestionModal = function (event) {
    if (event && event.target.closest('.project-modal-dialog') && !event.target.closest('.modal-close-btn')) return;
    document.getElementById('suggestion-modal')?.classList.remove('open');
    unlockPageScroll();
  };

  window.handleSuggestionSubmit = function (event) {
    event.preventDefault();
    const name = document.getElementById('sugg-name')?.value.trim() || '';
    const contact = document.getElementById('sugg-contact')?.value.trim() || '';
    const category = document.getElementById('sugg-category')?.value || '';
    const message = document.getElementById('sugg-comment')?.value.trim() || '';
    const subject = encodeURIComponent(`Portfolio project suggestion: ${category}`);
    const body = encodeURIComponent(`Name: ${name}\nContact: ${contact}\nCategory: ${category}\n\n${message}`);
    const successBox = document.getElementById('suggestion-success-alert');
    if (successBox) successBox.hidden = false;
    window.location.href = `mailto:tanishq.sharma.vds@gmail.com?subject=${subject}&body=${body}`;
  };

  window.filterProjects = function (category, button) {
    const filters = button?.closest('.gallery-filter-tabs');
    filters?.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
    button?.classList.add('active');
    document.querySelectorAll('.gallery-card[data-category]').forEach(card => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
  };

  document.querySelectorAll('.section-block').forEach(element => element.remove());
  if (isGalleryPage) renderFullGallery();
  else renderHomeProjects();
  renderCarousel();

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      window.closeProjectModal();
      window.closeSuggestionModal();
    }
  });
})();
