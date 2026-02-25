#!/usr/bin/env node

/**
 * Increment patch version in package.json and manifest.json
 * Run before build to ensure version updates on each build
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Read manifest.json
const manifestPath = path.join(__dirname, '../public/manifest.json');
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Parse current version
const versionParts = packageJson.version.split('.');
const previousVersion = packageJson.version;
const major = parseInt(versionParts[0]);
const minor = parseInt(versionParts[1]);
const patch = parseInt(versionParts[2]);
// Increment patch only
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update both files
packageJson.version = newVersion;
manifestJson.version = newVersion;

// Write back
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n');

console.log(
  `✅ Version incremented (patch): ${previousVersion} → ${newVersion}`
);
