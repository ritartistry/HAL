# HAL Documentation Site

This directory contains the Astro-based documentation website for HAL (HTTP API Layer).

## Development

To run the documentation site locally:

```bash
cd docs
npm install
npm run dev
```

The site will be available at `http://localhost:4321`.

## Building

To build the site for production:

```bash
npm run build
```

The built site will be in the `dist/` directory.

## Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions whenever changes are pushed to the main branch. The workflow is defined in `.github/workflows/deploy-docs.yml`.

The live site will be available at: https://deanward.github.io/HAL/

## Project Structure

```
docs/
├── src/
│   ├── layouts/
│   │   └── Layout.astro       # Main layout component
│   └── pages/
│       ├── index.astro        # Homepage
│       └── documentation.astro # Documentation page
├── astro.config.mjs           # Astro configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Adding Pages

To add a new page:

1. Create a new `.astro` file in `src/pages/`
2. Use the Layout component for consistent styling
3. Add navigation links in the Layout component if needed

Example:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Your Page Title">
  <h1>Your Content</h1>
</Layout>
``` 