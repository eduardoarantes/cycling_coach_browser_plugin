# TrainingPeaks Browser Plugin

A Chrome extension that provides direct access to your TrainingPeaks workout libraries and enables seamless export to popular training platforms like Intervals.icu and PlanMyPeak.

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

## Features

### Workout Library Access

- View all your TrainingPeaks workout libraries
- Browse workouts with detailed information
- Search and filter training plans
- Access coach comments and structured workout details

### Export to Intervals.icu

Export your TrainingPeaks workouts directly to your Intervals.icu calendar with full metadata preservation.

#### Setup

1. **Generate Intervals.icu API Key**
   - Visit [Intervals.icu Settings](https://intervals.icu/settings)
   - Navigate to "Developer Settings"
   - Generate a new API key
   - Copy the key

2. **Configure the Extension**
   - Open the extension popup
   - Click the "Intervals.icu Integration" banner
   - Paste your API key
   - Click "Save API Key"
   - The banner will show "✓ Connected" status

#### Exporting Workouts

1. **Select Workouts**
   - Browse to a workout library
   - Click "Export" button

2. **Choose Destination**
   - Select "Intervals.icu" as the export destination
   - Choose the start date for your workouts
   - Workouts will be scheduled daily starting from this date

3. **Confirm Export**
   - Acknowledge the authorization checkbox
   - Click "Export"
   - Workouts upload directly to your Intervals.icu calendar

#### What Gets Exported

All workouts are uploaded to Intervals.icu with complete metadata:

- ✅ Workout name and description
- ✅ Coach comments and notes
- ✅ Training load (TSS)
- ✅ Duration
- ✅ Sport type (Bike, Run, Swim, Strength/Weights)
- ✅ Additional metrics (IF, distance, elevation, pace, calories)

#### Supported Sport Types

- **Cycling** - Mapped to "Ride"
- **Running** - Mapped to "Run"
- **Swimming** - Mapped to "Swim"
- **Strength Training** - Mapped to "WeightTraining" (includes RxBuilder structured workouts)

#### Notes

- Workouts are scheduled one per day starting from your selected date
- Past dates are supported for retroactive logging
- The extension uses your API key to upload directly (no file downloads)
- API key is stored securely in browser storage and never shared

### Export to PlanMyPeak

Export workouts to PlanMyPeak JSON format with automatic workout classification:

1. Browse to a workout library
2. Click "Export" button
3. Select "PlanMyPeak" as destination
4. Enter a file name
5. Click "Export"

Workouts are automatically classified based on Intensity Factor (IF) and TSS values.

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
