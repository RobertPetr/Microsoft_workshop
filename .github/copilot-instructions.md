# Copilot Instructions for Mona Mayhem

This repository is a workshop template for building **Mona Mayhem** — a GitHub Contribution Battle Arena web application. The following guidance helps Copilot understand the project structure, conventions, and workflows.

## Project Overview

**Mona Mayhem** is an Astro-based web application that compares GitHub contribution graphs of two users in a retro arcade-themed interface. The workshop guides developers through building this app step-by-step using GitHub Copilot.

- **Framework**: Astro v5 (file-based routing)
- **Runtime**: Node.js with `@astrojs/node` adapter (server-side rendering)
- **Styling**: CSS in Astro components with retro arcade theme
- **API Integration**: GitHub's contribution graph API (SVG scraping)
- **Key Feature**: Dynamic API route that fetches contribution data for usernames

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (watches for changes)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run Astro CLI directly
npm run astro <command>
```

**Development URL**: `http://localhost:3000` (default Astro dev server)

## Architecture

### File-Based Routing (Astro)
- Pages live in `src/pages/`
- Routes map directly to file paths: `src/pages/index.astro` → `/`, `src/pages/about.astro` → `/about`
- Dynamic routes use bracket syntax: `src/pages/api/contributions/[username].ts` → `/api/contributions/:username`

### Key Pages & API Routes

| File | Route | Purpose |
|------|-------|---------|
| `src/pages/index.astro` | `/` | Main page (landing/game arena) |
| `src/pages/api/contributions/[username].ts` | `/api/contributions/:username` | Fetch GitHub contribution data |

### Directory Structure

```
src/
├── pages/
│   ├── index.astro              # Main landing page
│   └── api/
│       └── contributions/
│           └── [username].ts    # API endpoint for GitHub data
public/                          # Static assets (favicon, images)
docs/                           # Workshop documentation
workshop/                       # Step-by-step guide (not part of app)
```

### API Route Pattern

API routes in Astro use:
- `prerender = false` to enable dynamic server responses
- Request data via `params` (URL parameters) and `request` (HTTP context)
- Return `Response` objects with JSON or custom headers

Example from `[username].ts`:
```typescript
export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  const { username } = params;
  // Fetch contribution data...
  return new Response(JSON.stringify({ /* data */ }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Styling & Theme

- **Retro Arcade Aesthetic**: Press Start 2P font, pixel-perfect layouts, neon colors
- **Astro Component Styling**: CSS can be scoped within `<style>` tags in `.astro` files
- **No CSS Framework**: Pure CSS (flexbox/grid) to maintain retro simplicity
- Global styles should be minimal; prefer component-level styling

## Key Conventions

### TypeScript Strict Mode
- `tsconfig.json` extends `astro/tsconfigs/strict`
- All files should be properly typed; avoid `any`
- Astro files use `---` frontmatter for scripts and imports

### Astro Component Anatomy
```astro
---
// Server-side code (runs only on server)
import { data } from '../lib/data';
const title = "My Page";
---

<!-- Template (rendered HTML) -->
<h1>{title}</h1>

<style>
  /* Component-scoped CSS */
  h1 { color: neon-green; }
</style>
```

### GitHub API Integration
- Contributions API endpoint: `https://github.com/{username}.contrib` (SVG format)
- Requires scraping SVG to extract contribution data
- Handle missing/invalid usernames gracefully
- Rate limiting: Respect GitHub's unauthenticated request limits (60/hour)

## Workshop Structure

The workshop is divided into 7 parts (in `workshop/` directory):
- **00-overview**: Learning goals and track selection
- **01-setup**: Environment setup and context engineering
- **02-plan-and-scaffold**: API and page architecture planning
- **03-agent-mode**: Agentic implementation and iteration
- **04-design-vibes**: Visual design and theming
- **05-polish**: Parallelism, reviews, and quality
- **06-bonus**: Extensions and extra experiments

**Note**: Workshop files are educational guides, not part of the application itself.

## Testing & Validation

- **No unit test suite** exists yet (may be added in workshop Part 03+)
- **Manual testing**: Start dev server and visit `http://localhost:3000`
- **API testing**: Visit `/api/contributions/{username}` to verify endpoint

## Common Tasks

### Adding a New Page
1. Create `src/pages/pagename.astro`
2. Add frontmatter with imports and logic
3. Write template HTML below `---`
4. Styles go in `<style>` block

### Adding a New API Route
1. Create `src/pages/api/routename.ts` (or with params: `[param].ts`)
2. Set `export const prerender = false;`
3. Export typed handler: `export const GET: APIRoute = async ({ params, request }) => {...}`
4. Return `new Response()` with appropriate headers

### Debugging
- Check browser console for client-side errors
- Check terminal for server-side logs
- Use `console.log()` in Astro frontmatter and API routes
- Dev server auto-restarts on file changes
