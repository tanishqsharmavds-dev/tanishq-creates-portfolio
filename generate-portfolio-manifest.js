'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = __dirname;
const worksDirectory = path.join(root, 'website works ');
const outputFile = path.join(root, 'portfolio-manifest.js');
const featuredFile = path.join(root, 'featured.json');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg', '.ico', '.heic', '.mp4', '.webm', '.pdf']);
const carouselImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.apng', '.avif', '.bmp', '.svg', '.ico', '.heic']);
const selectedWorksDirectoryNames = new Set(['selectedworks', 'frontpage', 'forntpage']);
const categoryAliases = new Map([
  ['3d mmodels', '3D Models and Renders'],
  ['branding', 'Brand Identity : Logo'],
  ['packaging', 'Packaging Design'],
  ['posters', 'Posters : Visual Designs'],
  ['social issue', 'Social Issues']
]);
const previewDirectory = path.join(root, 'portfolio-previews');

function sortNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function getMediaEntry(filePath, fileName) {
  const extension = path.extname(fileName).toLowerCase();
  const media = {
    path: toPosixPath(path.relative(root, filePath)),
    type: ['.mp4', '.webm'].includes(extension) ? 'video' : extension === '.pdf' ? 'document' : 'image',
    name: fileName
  };

  if (extension === '.heic') {
    const digest = hashFile(filePath);
    const previewPath = path.join(previewDirectory, `${digest}.jpg`);
    if (!fs.existsSync(previewPath)) {
      fs.mkdirSync(previewDirectory, { recursive: true });
      try {
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', filePath, '--out', previewPath], { stdio: 'ignore' });
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn(`HEIC preview could not be generated because sips is unavailable: ${filePath}`);
        } else {
          throw error;
        }
      }
    }
    if (fs.existsSync(previewPath)) {
      media.previewPath = toPosixPath(path.relative(root, previewPath));
    }
  }

  return media;
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function uniqueMedia(mediaFiles, seenHashes = new Set()) {
  return mediaFiles.filter(media => {
    const absolutePath = path.join(root, media.path);
    const digest = hashFile(absolutePath);
    if (seenHashes.has(digest)) return false;
    seenHashes.add(digest);
    return true;
  });
}

function getMediaFiles(directory, recursive = true, acceptedExtensions = supportedExtensions) {
  const mediaFiles = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => sortNames(a.name, b.name));

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (recursive) mediaFiles.push(...getMediaFiles(entryPath, recursive, acceptedExtensions));
      continue;
    }

    if (!entry.isFile() || !acceptedExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    mediaFiles.push(getMediaEntry(entryPath, entry.name));
  }

  return mediaFiles;
}

function getCover(media) {
  return [...media].sort((a, b) => {
    const coverPattern = /^(cover|thumbnail|thumb|featured)(?:[-_.\s]|$)/i;
    const aIsNamedCover = coverPattern.test(a.name);
    const bIsNamedCover = coverPattern.test(b.name);
    if (aIsNamedCover !== bIsNamedCover) return aIsNamedCover ? -1 : 1;
    const typeOrder = { image: 0, video: 1, document: 2 };
    if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
    return sortNames(a.name, b.name);
  })[0] || null;
}

function getProjectTitle(fileName) {
  const withoutExtension = path.basename(fileName, path.extname(fileName));
  const normalized = withoutExtension
    .replace(/^ChatGPT Image\s+/i, '')
    .replace(/-Picsart-AiImageEnhancer$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function readFeaturedSelections() {
  if (!fs.existsSync(featuredFile)) return {};

  const selections = JSON.parse(fs.readFileSync(featuredFile, 'utf8'));
  if (!selections || typeof selections !== 'object' || Array.isArray(selections)) {
    throw new TypeError('featured.json must contain an object mapping category names to project folder names.');
  }

  for (const [category, projectFolder] of Object.entries(selections)) {
    if (typeof projectFolder !== 'string') {
      throw new TypeError(`The featured project for "${category}" must be a project folder name or media filename.`);
    }
  }

  return selections;
}

function findSelectedWorksDirectory() {
  const directories = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));
  const normalize = name => name.toLowerCase().replace(/[^a-z]/g, '');

  return directories.find(entry => normalize(entry.name) === 'selectedworks') ||
    directories.find(entry => selectedWorksDirectoryNames.has(normalize(entry.name))) ||
    null;
}

function discoverSelectedWorks() {
  const selectedWorksEntry = findSelectedWorksDirectory();
  if (!selectedWorksEntry) {
    console.warn('Selected Works folder not found; homepage selected projects will be empty.');
    return { sourceFolder: null, projects: [] };
  }

  const selectedWorksPath = path.join(root, selectedWorksEntry.name);
  const isNamedProjectLayout = selectedWorksEntry.name.toLowerCase().replace(/[^a-z]/g, '') === 'selectedworks';
  const entries = fs.readdirSync(selectedWorksPath, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .sort((a, b) => sortNames(a.name, b.name));
  const projects = [];
  const addSelectedProject = (projectPath, projectName, categoryName, media) => {
    if (media.length === 0) return;

    const relativeFolder = toPosixPath(path.relative(root, projectPath));
    projects.push({
      id: `selected-works/${relativeFolder}`,
      folder: relativeFolder,
      title: projectName,
      category: categoryName,
      media,
      cover: getCover(media)
    });
  };

  if (isNamedProjectLayout) {
    for (const entry of entries) {
      const entryPath = path.join(selectedWorksPath, entry.name);
      if (entry.isDirectory()) {
        addSelectedProject(entryPath, entry.name, selectedWorksEntry.name, getMediaFiles(entryPath));
      } else if (entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
        addSelectedProject(entryPath, getProjectTitle(entry.name), selectedWorksEntry.name, [getMediaEntry(entryPath, entry.name)]);
      }
    }
  } else {
    for (const categoryEntry of entries.filter(entry => entry.isDirectory())) {
      const categoryPath = path.join(selectedWorksPath, categoryEntry.name);
      const categoryEntries = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter(entry => !entry.name.startsWith('.'))
        .sort((a, b) => sortNames(a.name, b.name));

      for (const entry of categoryEntries) {
        const entryPath = path.join(categoryPath, entry.name);
        if (entry.isDirectory()) {
          addSelectedProject(entryPath, entry.name.trim(), categoryEntry.name, getMediaFiles(entryPath));
        } else if (entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
          addSelectedProject(entryPath, getProjectTitle(entry.name), categoryEntry.name, [getMediaEntry(entryPath, entry.name)]);
        }
      }
    }
  }

  return {
    sourceFolder: selectedWorksEntry.name,
    projects
  };
}

function discoverCarousel(categories, selectedWorks) {
  const projectByHash = new Map();
  categories.forEach(category => {
    category.projects.forEach(project => {
      project.media.forEach(media => {
        projectByHash.set(hashFile(path.join(root, media.path)), { project, category: category.name });
      });
    });
  });
  selectedWorks.projects.forEach(project => {
    project.media.forEach(media => {
      const digest = hashFile(path.join(root, media.path));
      if (!projectByHash.has(digest)) {
        projectByHash.set(digest, { project, category: project.category });
      }
    });
  });

  const seenAssets = new Set();
  const projects = new Map();
  ['crousel', 'Carousel'].forEach(directoryName => {
    const carouselDirectory = path.join(root, directoryName);
    if (!fs.existsSync(carouselDirectory)) return;

    getMediaFiles(carouselDirectory, true, carouselImageExtensions)
      .filter(media => media.type === 'image')
      .forEach(media => {
        const digest = hashFile(path.join(root, media.path));
        if (seenAssets.has(digest)) return;
        seenAssets.add(digest);

        const match = projectByHash.get(digest);
        const id = match ? match.project.id : `carousel/${media.path}`;
        if (projects.has(id)) return;
        projects.set(id, match
          ? {
              ...match.project,
              id: match.project.id,
              category: match.category,
              cover: media
            }
          : {
              id,
              title: '',
              category: 'Selected Work',
              media: [media],
              cover: media
            });
      });
  });

  return [...projects.values()];
}

function discoverCategories(featuredSelections) {
  if (!fs.existsSync(worksDirectory)) {
    throw new Error(`Portfolio directory not found: ${worksDirectory}`);
  }

  const categoryDirectories = fs.readdirSync(worksDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => {
      const aIsAlias = categoryAliases.has(a.name.toLowerCase());
      const bIsAlias = categoryAliases.has(b.name.toLowerCase());
      return Number(aIsAlias) - Number(bIsAlias) || sortNames(a.name, b.name);
    });
  const wallSignatureMedia = [
    ...getMediaFiles(path.join(root, 'wall signature')),
    ...getMediaFiles(path.join(root, 'wall signautre reveal'))
  ];
  const categoriesByName = new Map();
  const seenHashes = new Set();
  for (const categoryEntry of categoryDirectories) {
    const categoryName = categoryAliases.get(categoryEntry.name.toLowerCase()) || categoryEntry.name;
    if (!categoriesByName.has(categoryName)) categoriesByName.set(categoryName, new Map());
    const projects = categoriesByName.get(categoryName);
    const categoryPath = path.join(worksDirectory, categoryEntry.name);
    const entries = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.'))
      .sort((a, b) => sortNames(a.name, b.name));

    for (const entry of entries) {
      const entryPath = path.join(categoryPath, entry.name);
      if (entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
        const key = `file:${entry.name.trim().toLowerCase()}`;
        if (!projects.has(key)) {
          projects.set(key, {
            id: `${categoryName}/${entry.name}`,
            folder: entry.name,
            title: getProjectTitle(entry.name),
            media: []
          });
        }
        projects.get(key).media.push(...uniqueMedia([getMediaEntry(entryPath, entry.name)], seenHashes));
      } else if (entry.isDirectory()) {
        const media = uniqueMedia(getMediaFiles(entryPath), seenHashes);
        if (media.length === 0) continue;

        const title = entry.name.trim();
        const key = `folder:${title.toLowerCase()}`;
        if (!projects.has(key)) {
          projects.set(key, {
            id: `${categoryName}/${title}`,
            folder: entry.name.trim(),
            title,
            media: []
          });
        }
        projects.get(key).media.push(...media);
      }
    }
  }

  const categories = [...categoriesByName.entries()].map(([name, projectMap]) => {
    const projects = [...projectMap.values()]
      .filter(project => project.media.length > 0)
      .map(project => ({ ...project, cover: getCover(project.media) }))
      .sort((a, b) => sortNames(a.title, b.title));
    const requestedFolder = featuredSelections[name];
    const requestedProject = requestedFolder === undefined
      ? null
      : projects.find(project =>
          project.folder === requestedFolder ||
          project.id === requestedFolder ||
          project.media.some(media => media.name === requestedFolder || media.path === requestedFolder)
        );
    if (requestedFolder !== undefined && !requestedProject) {
      console.warn(`Featured project "${requestedFolder}" was not found in "${name}"; using the first valid project.`);
    }
    return {
      id: name,
      name,
      projects,
      featuredProjectId: (requestedProject || projects[0] || {}).id || null
    };
  });

  const uniqueWallSignatureMedia = uniqueMedia(wallSignatureMedia);
  if (uniqueWallSignatureMedia.length > 0 || fs.existsSync(path.join(root, 'wall-signature.html'))) {
    const wallSignatureProject = {
      id: 'WALL SIGNATURE',
      folder: 'wall signature',
      title: 'WALL SIGNATURE',
      media: uniqueWallSignatureMedia,
      cover: getCover(uniqueWallSignatureMedia),
      ...(uniqueWallSignatureMedia.length === 0 ? { pageUrl: 'wall-signature.html' } : {})
    };
    categories.push({
      id: 'WALL SIGNATURE',
      name: 'WALL SIGNATURE',
      projects: [wallSignatureProject],
      featuredProjectId: wallSignatureProject.id
    });
  }

  return categories;
}

function discoverContinuityVideos() {
  const directory = path.join(root, 'wall signautre continiuty');
  if (!fs.existsSync(directory)) return [];
  return getMediaFiles(directory).filter(media => media.type === 'video');
}

const categories = discoverCategories(readFeaturedSelections());
const selectedWorks = discoverSelectedWorks();
const manifest = {
  categories,
  selectedWorks,
  carousel: discoverCarousel(categories, selectedWorks),
  continuityVideos: discoverContinuityVideos()
};

fs.writeFileSync(outputFile, `window.PORTFOLIO_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);

const projectCount = manifest.categories.reduce((total, category) => total + category.projects.length, 0);
const mediaCount = manifest.categories.reduce(
  (total, category) => total + category.projects.reduce((projectTotal, project) => projectTotal + project.media.length, 0),
  0
);
console.log(`Generated ${path.basename(outputFile)}: ${manifest.categories.length} categories, ${projectCount} projects, ${mediaCount} media files, ${manifest.continuityVideos.length} continuity videos.`);
