'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const worksDirectory = path.join(root, 'website works ');
const outputFile = path.join(root, 'portfolio-manifest.js');
const featuredFile = path.join(root, 'featured.json');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']);
const carouselImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.apng', '.avif', '.bmp', '.svg', '.ico']);
const selectedWorksDirectoryNames = new Set(['selectedworks', 'frontpage', 'forntpage']);

function sortNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function getMediaEntry(filePath, fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return {
    path: toPosixPath(path.relative(root, filePath)),
    type: ['.mp4', '.webm'].includes(extension) ? 'video' : 'image',
    name: fileName
  };
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
    if (a.type !== b.type) return a.type === 'image' ? -1 : 1;
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

function discoverCarousel() {
  return ['Carousel', 'crousel'].flatMap(directoryName => {
    const carouselDirectory = path.join(root, directoryName);
    if (!fs.existsSync(carouselDirectory)) return [];

    return getMediaFiles(carouselDirectory, true, carouselImageExtensions)
      .filter(media => media.type === 'image')
      .map(media => {
        const parentDirectory = path.dirname(path.join(root, media.path));
        const relativeCategory = path.relative(carouselDirectory, parentDirectory);
        const category = relativeCategory ? relativeCategory.split(path.sep).join(' / ') : directoryName;

        return {
          id: `carousel/${media.path}`,
          title: getProjectTitle(media.name),
          category,
          media: [media],
          cover: media
        };
      });
  });
}

function discoverCategories(featuredSelections) {
  if (!fs.existsSync(worksDirectory)) {
    throw new Error(`Portfolio directory not found: ${worksDirectory}`);
  }

  const categoryDirectories = fs.readdirSync(worksDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => sortNames(a.name, b.name));
  const wallSignatureMedia = [
    ...getMediaFiles(path.join(root, 'wall signature')),
    ...getMediaFiles(path.join(root, 'wall signautre reveal'))
  ];
  const wallSignatureMediaByPath = new Map(wallSignatureMedia.map(media => [media.path, media]));

  let wallSignatureProject = null;
  const categories = categoryDirectories.map((categoryEntry) => {
    const categoryPath = path.join(worksDirectory, categoryEntry.name);
    const projectDirectories = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .sort((a, b) => sortNames(a.name, b.name));

    const projects = [];
    const addProject = (projectId, folder, title, media, pageUrl = null) => {
      if (media.length === 0 && !pageUrl) return null;
      projects.push({
        id: projectId,
        folder: toPosixPath(folder),
        title,
        media,
        cover: getCover(media),
        ...(pageUrl ? { pageUrl } : {})
      });
      return projects[projects.length - 1];
    };

    const directEntries = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(entry => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
      .sort((a, b) => sortNames(a.name, b.name));

    for (const mediaEntry of directEntries) {
      const filePath = path.join(categoryPath, mediaEntry.name);
      const media = [{
        path: toPosixPath(path.relative(root, filePath)),
        type: ['.mp4', '.webm'].includes(path.extname(mediaEntry.name).toLowerCase()) ? 'video' : 'image',
        name: mediaEntry.name
      }];
      addProject(
        `${categoryEntry.name}/${mediaEntry.name}`,
        mediaEntry.name,
        getProjectTitle(mediaEntry.name),
        media
      );
    }

    for (const projectEntry of projectDirectories) {
      const projectPath = path.join(categoryPath, projectEntry.name);
      if (projectEntry.name.trim().toLowerCase() === 'wall signature') {
        wallSignatureProject = {
          id: 'WALL SIGNATURE',
          folder: projectEntry.name,
          title: 'WALL SIGNATURE',
          media: [...new Map([
            ...getMediaFiles(projectPath),
            ...wallSignatureMedia
          ].map(media => [media.path, media])).values()],
          ...(fs.existsSync(path.join(root, 'wall-signature.html')) ? { pageUrl: 'wall-signature.html' } : {})
        };
        wallSignatureProject.cover = getCover(wallSignatureProject.media);
        if (wallSignatureProject.media.length > 0) delete wallSignatureProject.pageUrl;
        continue;
      }

      const media = getMediaFiles(projectPath);
      addProject(
        `${categoryEntry.name}/${toPosixPath(projectEntry.name)}`,
        projectEntry.name,
        projectEntry.name,
        media
      );
    }

    projects.sort((a, b) => sortNames(a.title, b.title));

    const requestedFolder = featuredSelections[categoryEntry.name];
    const requestedProject = requestedFolder === undefined
      ? null
      : projects.find(project =>
          project.folder === requestedFolder ||
          project.id === requestedFolder ||
          project.media.some(media => media.name === requestedFolder || media.path === requestedFolder)
        );

    if (requestedFolder !== undefined && !requestedProject) {
      console.warn(`Featured project "${requestedFolder}" was not found in "${categoryEntry.name}"; using the first valid project.`);
    }

    const category = {
      id: categoryEntry.name,
      name: categoryEntry.name,
      projects,
      featuredProjectId: (requestedProject || projects[0] || {}).id || null
    };

    return category;
  });

  if (!wallSignatureProject && (wallSignatureMediaByPath.size > 0 || fs.existsSync(path.join(root, 'wall-signature.html')))) {
    wallSignatureProject = {
      id: 'WALL SIGNATURE',
      folder: 'wall signature',
      title: 'WALL SIGNATURE',
      media: [...wallSignatureMediaByPath.values()],
      cover: getCover([...wallSignatureMediaByPath.values()]),
      ...(wallSignatureMediaByPath.size === 0 ? { pageUrl: 'wall-signature.html' } : {})
    };
  }

  if (wallSignatureProject) {
    wallSignatureProject.cover = getCover(wallSignatureProject.media);
    if (wallSignatureProject.media.length > 0) delete wallSignatureProject.pageUrl;
    categories.push({
      id: 'WALL SIGNATURE',
      name: 'WALL SIGNATURE',
      projects: [wallSignatureProject],
      featuredProjectId: wallSignatureProject.id
    });
  }

  return categories;
}

const manifest = {
  categories: discoverCategories(readFeaturedSelections()),
  selectedWorks: discoverSelectedWorks(),
  carousel: discoverCarousel()
};

fs.writeFileSync(outputFile, `window.PORTFOLIO_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);

const projectCount = manifest.categories.reduce((total, category) => total + category.projects.length, 0);
const mediaCount = manifest.categories.reduce(
  (total, category) => total + category.projects.reduce((projectTotal, project) => projectTotal + project.media.length, 0),
  0
);
console.log(`Generated ${path.basename(outputFile)}: ${manifest.categories.length} categories, ${projectCount} projects, ${mediaCount} media files.`);
