# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-22 | Built Task Roulette app — slot machine task selector with yellow theme, localStorage persistence, manage/remove modal |
| 2026-02-22 | Redesigned slot machine display: stacked scrolling reel with OSRS Blank_chatbox.png background; prev/next tasks shown darker, center task bright |
| 2026-02-22 | Redesigned display to OSRS chathead dialogue box: Nesty chathead on left, "Task Roulette" speaker name in dark red, task text in black, "Click here to continue" in blue on win |
| 2026-02-22 | Redesigned display to stacked reel: 3 chatbox.png slots (prev/center/next), no chathead, no continue prompt; center slot full opacity, prev/next at 35% opacity |
| 2026-02-22 | Added true slot machine scrolling animation: chatboxes physically scroll up/down with CSS translateY transition; 200-slot reel column, viewport clips to 3 slots, fade masks at top/bottom |
| 2026-02-22 | Redesigned spin: looped fixed reel (SPIN_CYCLES * tasks.length slots), winner pre-picked, single CSS cubic-bezier transition lands exactly on selected task; reelKey resets reel between spins |
| 2026-02-22 | Added white glow highlight on center selection slot (inset box-shadow + outer glow overlay); added Web Audio API metronome tick sound that fires each time a new slot scrolls into center position during spin |
| 2026-02-22 | Added task completion system: green checkmark button after roll, completed tasks list (localStorage), Completed Tasks modal; skip credit system: 1 credit per 5 completions, +1 bonus at 10-streak, skip button costs 1 credit and re-spins; credits HUD with glowing dots, streak counter, progress bar |
| 2026-02-22 | Spin now costs 1 credit per use; users start with 3 initial credits; Spin button disabled (shows "No Credits!") when credits = 0 |
| 2026-02-22 | Reduced TASKS_PER_CREDIT from 5 to 2 so users can earn credits faster after completing tasks and spin again sooner |
| 2026-02-22 | Fixed credit system: spins are now FREE, credits are only used for skipping (rerolling) a task |
| 2026-02-22 | Added active task persistence: current task is saved to localStorage and restored on page refresh, preventing users from spinning away from an active task |
| 2026-02-22 | Configured for GitHub Pages deployment: added static export to next.config.ts with basePath /Task-Roulette-OSRS, created GitHub Actions workflow for automatic deployment on push to main |
| 2026-02-22 | Fixed GitHub Actions workflow: updated to setup-bun@v2 with explicit bun-version and frozen lockfile for reliable builds |
| 2026-02-22 | Fixed missing task backgrounds on GitHub Pages: updated image path to include basePath /Task-Roulette-OSRS/ |
