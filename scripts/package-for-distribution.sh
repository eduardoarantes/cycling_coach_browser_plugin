#!/bin/bash

# Package extension for manual distribution
# Creates a ZIP file that can be sent to others for manual installation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 PlanMyPeak Importer - Distribution Packager${NC}"
echo ""

# Get version from manifest
VERSION=$(node -p "require('./dist/manifest.json').version")
echo -e "${BLUE}Version:${NC} $VERSION"

# Create distribution folder
DIST_FOLDER="planmypeak-importer-v${VERSION}"
ZIP_NAME="${DIST_FOLDER}.zip"

echo -e "${BLUE}Creating distribution package...${NC}"
echo ""

# Remove old distribution files if they exist
rm -rf "$DIST_FOLDER" 2>/dev/null || true
rm -f "$ZIP_NAME" 2>/dev/null || true

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: dist/ folder not found${NC}"
  echo -e "${RED}   Please run 'npm run build' first${NC}"
  exit 1
fi

# Create temporary distribution folder
mkdir -p "$DIST_FOLDER"

# Copy built extension files
echo -e "${GREEN}✓${NC} Copying extension files..."
cp -r dist/* "$DIST_FOLDER/"

# Copy installation instructions
echo -e "${GREEN}✓${NC} Copying installation guide..."
cp INSTALL.md "$DIST_FOLDER/"

# Copy README
echo -e "${GREEN}✓${NC} Copying README..."
cp README.md "$DIST_FOLDER/"

# Create ZIP file
echo -e "${GREEN}✓${NC} Creating ZIP archive..."
zip -r -q "$ZIP_NAME" "$DIST_FOLDER"

# Clean up temporary folder
rm -rf "$DIST_FOLDER"

# Get file size
SIZE=$(du -h "$ZIP_NAME" | cut -f1)

echo ""
echo -e "${GREEN}✅ Distribution package created successfully!${NC}"
echo ""
echo -e "${BLUE}Package:${NC} $ZIP_NAME"
echo -e "${BLUE}Size:${NC} $SIZE"
echo ""
echo -e "${BLUE}📤 To share with a friend:${NC}"
echo "   1. Send them the file: $ZIP_NAME"
echo "   2. They should extract it and follow INSTALL.md"
echo "   3. Load as unpacked extension in Chrome"
echo ""
echo -e "${GREEN}Done!${NC}"
