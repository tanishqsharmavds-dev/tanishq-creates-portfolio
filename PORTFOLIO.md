# Folder-based portfolio

The full gallery uses the immediate folders inside the existing `website works ` directory (which currently has a trailing space in its name) as categories. Every supported media file placed directly in a category is its own project card. Each immediate subfolder is one project, and its supported media is discovered recursively, allowing a project folder to contain multiple images and videos.

The homepage Selected Works grid is built from a separate `Selected Works` folder. Each immediate project subfolder becomes one homepage card, with all supported media inside that folder available in its detail gallery. If `Selected Works` does not exist, the existing `fornt page` folder is used as a compatibility source: its category folders are preserved, direct media files become individual cards, and each subfolder is a project. The homepage data is stored separately from the full gallery categories in the generated manifest.

Supported gallery media: JPG, JPEG, PNG, WebP, GIF, AVIF, BMP, SVG, ICO, MP4, and WebM. Hidden files and unsupported formats are ignored. Images named `cover`, `thumbnail`, `thumb`, or `featured` are preferred as covers; otherwise the first image (then the first video) in sorted filename order is used.

The homepage Continuous Creative Project Showcase is generated from every supported image found recursively under `Carousel`. Each image becomes a showcase card, with its containing folder shown as the category. Add or remove images there and regenerate the manifest to update the moving showcase; this folder is separate from Selected Works and the full gallery.

## Add or update work

1. Add files to an existing gallery category, or create a category folder under `website works `.
2. To make a distinct gallery project, put its media in a new folder under the category. A cover image is optional.
3. Add selected projects as individually named folders under `Selected Works`; put that project's images and videos inside its folder. A cover image is optional. If using the compatibility `fornt page` layout, add categories, loose project files, and project folders there.
4. Add showcase images to `Carousel` (nested folders are supported), then run `node generate-portfolio-manifest.js` from any working directory. Upload the updated `portfolio-manifest.js` along with the site and the media directories.

The site is static, so the browser cannot scan folders on the hosting server. The generation command discovers folder and media additions at build/deploy time; it requires no React/Vite setup or per-project component edits.
