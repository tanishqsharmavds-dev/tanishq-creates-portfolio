# Folder-based portfolio

The full gallery uses the immediate folders inside the existing `website works ` directory (which currently has a trailing space in its name) as categories. Every supported media file placed directly in a category is its own project card. Each immediate subfolder is one project, and its supported media is discovered recursively, allowing a project folder to contain multiple images and videos.

The homepage Selected Works grid is built from a separate `Selected Works` folder. Each immediate project subfolder becomes one homepage card, with all supported media inside that folder available in its detail gallery. If `Selected Works` does not exist, the existing `fornt page` folder is used as a compatibility source: its category folders are preserved, direct media files become individual cards, and each subfolder is a project. The homepage data is stored separately from the full gallery categories in the generated manifest.

Supported gallery media: JPG, JPEG, PNG, WebP, GIF, AVIF, BMP, SVG, ICO, HEIC, PDF, MP4, and WebM. HEIC files receive JPEG previews in `portfolio-previews/` on systems with `sips`; the originals remain unchanged. PDFs are linked from their project galleries. Hidden files and unsupported formats are ignored. Identical media files are de-duplicated by content when the full gallery manifest is generated. Images named `cover`, `thumbnail`, `thumb`, or `featured` are preferred as covers; otherwise the first image (then the first video or document) in sorted filename order is used.

Category aliases `3d mmodels`, `branding`, `packaging`, `posters`, and `social issue` are merged into their matching primary categories so reorganized copies do not create duplicate cards. The `crousel` folder populates the restored horizontal project carousel; duplicate assets are grouped with their matching gallery projects. The 576 numbered WebP frames in `scroll_frames_120fps_webp` drive the lightweight scroll-linked canvas background on the homepage. The original process clips in `wall signautre continiuty` remain untouched; `WALL_SIGNATURE_Making_Process.mp4` is their combined, muted, looping film displayed above the WALL SIGNATURE galleries.

Portfolio pages use the curated Selected Works grid, the `crousel` carousel, and the complete `website works ` gallery.

## Add or update work

1. Add files to an existing gallery category, or create a category folder under `website works `.
2. To make a distinct gallery project, put its media in a new folder under the category. A cover image is optional.
3. Add selected projects as individually named folders under `Selected Works`; put that project's images and videos inside its folder. A cover image is optional. If using the compatibility `fornt page` layout, add categories, loose project files, and project folders there.
4. Run `node generate-portfolio-manifest.js` from any working directory after changing assets. Upload the updated `portfolio-manifest.js`, the site, and the media directories.

The site is static, so the browser cannot scan folders on the hosting server. The generation command discovers folder and media additions at build/deploy time; it requires no React/Vite setup or per-project component edits.
