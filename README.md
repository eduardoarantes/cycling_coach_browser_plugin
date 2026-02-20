# TrainingPeaks Browser Plugin

A Chrome extension that provides direct access to your TrainingPeaks workout libraries from your browser.

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome/Chromium browser

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Loading the Extension

1. Run `npm run build`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

```
src/
├── background/     # Service worker
├── content/        # Content scripts
├── popup/          # Extension popup UI
├── services/       # Business logic
├── store/          # State management
├── hooks/          # React hooks
├── schemas/        # Zod validation schemas
├── types/          # TypeScript types
├── utils/          # Utilities
└── styles/         # Global styles
```

## Tech Stack

- Vite 7.3.1
- TypeScript 5.9.3
- React 19.0.0
- Zustand 5.0.11
- TanStack Query 5.90.21
- Zod 3.24.1
- Tailwind CSS 4.2.0
- Vitest 4.0.18
- Playwright 1.58.2

## License

MIT
