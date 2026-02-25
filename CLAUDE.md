# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pixel GIF Workshop (像素GIF工坊) - A Next.js web application that converts user-uploaded images into pixel-style animated GIFs using AI. Designed for creating WeChat emoji stickers.

## Commands

```bash
cd Gif_Pix_Studio

npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **GIF Encoding**: gif.js.optimized
- **Storage**: localStorage + IndexedDB
- **AI API**: GrsAI (Nano Banana model)

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages |
| `src/components/` | React components |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Core utilities |
| `src/lib/pet/` | Desktop pet module |

### Pages

| Route | Description |
|-------|-------------|
| `/` | Home page with feature showcase |
| `/create` | Image upload and GIF generation |
| `/result/[id]` | Edit and export generated GIF |
| `/history` | Local history of generated GIFs |
| `/settings` | API key configuration |

### Core Modules

**Desktop Pet (小灵)** - Located in `src/lib/pet/`
- `pet-events.tsx` - Main context and hook (`usePetEvent`)
- `pet-controller.ts` - Mood state machine
- `pet-llm.ts` - LLM integration for chat
- `pet-scripts.ts` - Dialogue scripts

**Image Processing** - `src/lib/image-processing.ts`
- Sprite sheet splitting
- GIF frame extraction and encoding
- Background removal

**Storage** - `src/lib/storage.ts` + `src/lib/gif-cache.ts`
- localStorage for history and settings
- IndexedDB for GIF blob cache

## Styling

Custom arcade/pixel aesthetic using CSS variables in `src/app/globals.css`:
- Button variants: `.arcade-button.primary`, `.arcade-button.secondary`, `.arcade-button.mint`, `.arcade-button.warm`, `.arcade-button.danger`
- Color variables: `--primary`, `--secondary`, `--mint`, `--warm`, `--danger`
