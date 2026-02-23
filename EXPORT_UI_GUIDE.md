# Export UI Guide

Complete guide to using the PlanMyPeak export functionality in the browser extension.

## Overview

The export UI allows users to export their TrainingPeaks workout libraries to PlanMyPeak JSON format directly from the extension popup.

### Features

✅ **One-click export** from library details view
✅ **Multi-library export** - select and export multiple libraries at once
✅ **Configurable export** with workout type, intensity, and phase settings
✅ **Smart defaults** - automatically infers workout characteristics from TP data
✅ **Validation feedback** - shows warnings and errors before export
✅ **Download management** - automatic file download with configurable naming
✅ **Flexible export strategies** - separate files per library or combined file

---

## User Flow

### 1. Navigate to Library Details

1. Open the extension popup (click extension icon)
2. Authenticate with TrainingPeaks (if not already authenticated)
3. Browse libraries and click on a library to view workouts

### 2. Export Workouts

1. Click the **"Export to PlanMyPeak"** button at the top of the workout list
2. The export dialog opens

### 3. Configure Export

The export dialog is simple and focused:

**File Name**

- Enter a custom file name (default: `planmypeak_export`)
- File will be saved as `{name}.json`

**Automatic Classification**

- Each workout is automatically classified individually based on its own data
- Workout type inferred from Intensity Factor (IF)
- Intensity level inferred from IF
- Suitable training phases suggested based on workout type
- No manual configuration needed - the system does it all!

**Authorization Acknowledgment** (Required)

- You must check the authorization checkbox before exporting
- Confirms you are the owner or have authorization to export the content
- This acknowledgment must be made each time you export

### 4. Export & Download

1. Ensure the authorization checkbox is checked
2. Click **"Export"** button
3. Progress indicator shows while processing
4. On success:
   - Result modal shows summary
   - Warnings displayed (if any)
   - Click **"Download File"** to save the JSON
5. File downloads to your default downloads folder

---

## Multi-Library Export

### How to Export Multiple Libraries

1. **Enter Selection Mode**
   - From the library list view, click "Export Multiple Libraries" button
   - Libraries will show checkboxes for selection

2. **Select Libraries**
   - Click on libraries to select them (checkbox appears)
   - Selected libraries show with blue border and background
   - Use "Select All" to select all visible libraries
   - Use "Clear" to deselect all

3. **Export Selected**
   - Click "Export Selected" button
   - Export dialog opens with selected libraries

4. **Choose Export Strategy**
   - **Separate Files**: One JSON file per library (recommended)
     - Each file named after its library
     - Easy to organize and import individually
   - **Combined File**: All workouts in one JSON file
     - Single file with all workouts merged
     - Useful for bulk imports

5. **Configure & Export**
   - Enter file name or prefix
   - Check authorization acknowledgment
   - Click "Export"
   - Progress indicator shows export status

6. **Download Results**
   - Separate files: Multiple downloads (one per library)
   - Combined file: Single download
   - Review any warnings or errors
   - Click "Download File" for each result

### Selection Mode Tips

- Search works in selection mode - filter then select all
- Cancel selection mode to return to normal browse
- Selection persists while searching
- Can't open library details while in selection mode

---

## UI Components

### Export Button

**Location**: Top of library details view, below library header

**Appearance**:

- White button with blue border and text
- Download icon with workout count
- Disabled while exporting

**States**:

- **Normal**: Ready to export
- **Disabled**: During export or when no workouts available

### Export Dialog

**Layout**: Modal overlay with centered dialog

**Sections**:

1. **Header**
   - Title: "Export to PlanMyPeak"
   - Workout count subtitle
   - Close button (X)

2. **Configuration Form**
   - File name input field
   - Automatic classification info box
   - Export summary (what will be included)
   - Authorization acknowledgment checkbox (required)

3. **Footer**
   - Cancel button
   - Export button (primary action)

**Behavior**:

- Click outside dialog to close
- ESC key to close
- Export button disabled if:
  - File name is empty
  - Authorization checkbox is not checked
- Acknowledgment checkbox resets when dialog reopens
- Shows spinner during export

### Export Result Modal

**Success State**:

- Green checkmark icon
- File information card
- Warning list (if applicable)
- Download button
- Close button

**Error State**:

- Red X icon
- Error message list
- Close button

### Multi-Library Export Dialog

**Layout**: Modal overlay with centered dialog (wider than single export)

**Sections**:

1. **Header**
   - Title: "Export Multiple Libraries"
   - Library count and estimated workout count
   - Close button (X)

2. **Export Strategy Selection**
   - Radio buttons for "Separate Files" or "Combined File"
   - Description of each option
   - Default: Separate Files

3. **Configuration**
   - File name/prefix input
   - Selected libraries list (scrollable if many)
   - Automatic classification info box
   - Authorization acknowledgment checkbox (required)

4. **Progress Indicator** (during export)
   - Spinner animation
   - Status message (e.g., "Exporting Library 2 of 5...")
   - Progress bar (0-100%)
   - No close button during export

5. **Footer** (before export)
   - Cancel button
   - Export button (primary action)

**Behavior**:

- Click outside to close (before export only)
- Cannot close during export
- Export button disabled if:
  - File name is empty
  - Authorization not acknowledged
- Acknowledgment resets on reopen
- Progress shown for both strategies
- Separate files: Downloads trigger sequentially
- Combined file: Single download at end

---

## Smart Inference

The export system automatically infers workout characteristics:

### Workout Type Inference

Based on Intensity Factor (IF):

```
IF ≥ 1.05 → VO2 Max
IF ≥ 0.95 → Threshold
IF ≥ 0.85 → Tempo
IF ≥ 0.70 → Endurance
IF < 0.70 → Recovery
```

### Intensity Inference

Based on Intensity Factor (IF):

```
IF ≥ 1.05 → Very Hard
IF ≥ 0.95 → Hard
IF ≥ 0.85 → Moderate
IF ≥ 0.70 → Easy
IF < 0.70 → Very Easy
```

### Training Phase Suggestions

Based on inferred workout type:

```
VO2 Max / Anaerobic → Build, Peak
Threshold            → Build, Peak
Tempo                → Base, Build
Endurance            → Base, Build
Recovery             → Recovery
```

**Each workout is classified individually** - there are no global defaults. If a workout is missing data, sensible fallbacks are used automatically.

---

## Examples

### Example 1: Basic Export

```
1. Open library "My Interval Workouts" (15 workouts)
2. Click "Export to PlanMyPeak (15)"
3. Enter file name (or use default):
   - File name: "my_interval_workouts"
4. Check the authorization acknowledgment checkbox
5. Click "Export"
6. Click "Download File"
→ Downloads: my_interval_workouts.json
→ Each workout automatically classified by its IF/TSS values
```

### Example 2: Custom File Name

```
1. Open library "Base Training Plan" (23 workouts)
2. Click "Export to PlanMyPeak (23)"
3. Configure:
   - File name: "base_plan_week1-4"
4. Check the authorization acknowledgment checkbox
5. Click "Export"
6. Review warnings (if any)
7. Click "Download File"
→ Downloads: base_plan_week1-4.json
→ Mix of endurance, tempo, and recovery workouts automatically classified
```

### Example 3: With Warnings

```
1. Export library with some incomplete workouts
2. Check the authorization acknowledgment checkbox
3. Dialog shows warnings:
   - "Workout 3: Duration should be greater than 0"
   - "Workout 7: TSS should not be negative"
4. Review warnings (workouts still exported)
5. Click "Download File"
→ File downloads with all workouts
→ User can manually fix warnings in PlanMyPeak
```

### Example 4: Multi-Library Export (Separate Files)

```
1. Click "Export Multiple Libraries" button
2. Select 3 libraries:
   - "VO2 Max Intervals"
   - "Threshold Sessions"
   - "Recovery Rides"
3. Click "Export Selected"
4. Choose strategy: "Separate Files" (default)
5. Keep default file name prefix
6. Check authorization acknowledgment
7. Click "Export"
8. Watch progress:  "Exporting VO2 Max Intervals (1/3)..."   "Exporting Threshold Sessions (2/3)..."
   "Exporting Recovery Rides (3/3)..."
9. Three files download:
   → vo2_max_intervals.json
   → threshold_sessions.json
   → recovery_rides.json
```

### Example 5: Multi-Library Export (Combined File)

```
1. Enter selection mode
2. Search for "base training"
3. Click "Select All" (selects all matching libraries)
4. Click "Export Selected"
5. Choose strategy: "Combined File"
6. Enter file name: "base_training_all"
7. Check authorization acknowledgment
8. Click "Export"
9. Progress shows fetching from each library
10. Single file downloads:
   → base_training_all.json (contains all workouts from selected libraries)
```

---

## Keyboard Shortcuts

| Key           | Action                    |
| ------------- | ------------------------- |
| ESC           | Close dialog              |
| Enter         | Export (when dialog open) |
| Click outside | Close dialog              |

---

## Error Handling

### Common Errors

**"Failed to Load Workouts"**

- Network issue or authentication expired
- Click "Retry" or refresh authentication

**"Validation failed"**

- Workout data missing required fields
- Check error details in result modal

**"Export failed"**

- Generic error during export process
- Check browser console for details

### Warning Types

**Non-blocking warnings** (export continues):

- Duration ≤ 0
- Negative TSS
- Missing optional fields

**Blocking errors** (export fails):

- Empty workout name
- No structure data
- Invalid data format

---

## Tips & Best Practices

### 1. File Naming

✅ **Good**:

- `my_vo2max_sessions_jan2026`
- `base_training_plan`
- `threshold_workouts`

❌ **Avoid**:

- Special characters: `my/workouts`
- Very long names (>50 chars)

### 2. Trust the System

The automatic classification is intelligent:

- **VO2 Max workouts** (IF ≥ 1.05) → Classified as "vo2max", "very_hard", Build/Peak phases
- **Threshold workouts** (IF ≥ 0.95) → Classified as "threshold", "hard", Build/Peak phases
- **Tempo workouts** (IF ≥ 0.85) → Classified as "tempo", "moderate", Base/Build phases
- **Endurance rides** (IF ≥ 0.70) → Classified as "endurance", "easy", Base/Build phases
- **Recovery rides** (IF < 0.70) → Classified as "recovery", "very_easy", Recovery phase

Each workout gets its own classification - no manual work needed!

### 3. Batch Exports

For large libraries:

1. Export library-by-library instead of individual workouts
2. Use descriptive file names
3. Review warnings before downloading
4. Keep exports organized by type/phase

---

## Technical Details

### File Format

Exported files are JSON format, compatible with PlanMyPeak import:

```json
[
  {
    "id": "c0g94m",
    "name": "30 s x 4m interval repeats",
    "detailed_description": "Interval workout description...",
    "type": "vo2max",
    "intensity": "very_hard",
    "suitable_phases": ["Build", "Peak"],
    "structure": {
      /* ... */
    },
    "base_duration_min": 66.5,
    "base_tss": 51.7,
    "source_file": "workout_12684302.json",
    "source_format": "json",
    "signature": "a1b2c3d4e5f6g7h8"
  }
]
```

### Data Transformations

**Removed from TrainingPeaks**:

- `polyline` (visualization data)
- `begin`/`end` timestamps

**Added for PlanMyPeak**:

- `type` and `unit` fields on targets
- `suitable_phases`, `signature`, `source_file`
- Top-level metadata

See [PLANMYPEAK_INTEGRATION.md](./PLANMYPEAK_INTEGRATION.md) for complete technical details.

---

## Troubleshooting UI Issues

### Export button not visible

**Check**:

- Library has workouts (button only shows when workouts > 0)
- Not in loading or error state
- Scroll down if library header is tall

### Dialog won't open

**Try**:

- Close extension popup and reopen
- Check browser console for errors
- Refresh authentication

### Download not starting

**Check**:

- Browser download permissions
- Popup blocker settings
- Browser console for errors

### File downloaded but empty

**This means**:

- Export succeeded but with validation errors
- Open result modal to see error details
- Check browser console for detailed logs

---

## Future Enhancements

Planned features (not yet implemented):

- [x] Export from library list (batch export multiple libraries) ✅ **Implemented**
- [ ] Export individual workouts
- [ ] Export presets (save configurations)
- [ ] Export history tracking
- [ ] Direct upload to PlanMyPeak API (when available)
- [ ] Pause/resume for very large exports

---

## Support

**Issues?**

- Check browser console for error details
- See [PLANMYPEAK_INTEGRATION.md](./PLANMYPEAK_INTEGRATION.md) for technical documentation
- Report bugs on GitHub issues

**Questions?**

- See [README.md](./README.md) for general extension usage
- See [CLAUDE.md](./CLAUDE.md) for development guide
