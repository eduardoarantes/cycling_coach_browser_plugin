#!/usr/bin/env node

/**
 * Set the extension version in package.json and public/manifest.json.
 *
 * Run deliberately, never from a build. This used to run on every `prebuild`,
 * which meant any local build silently rewrote two tracked files: it bumped
 * from whatever was on disk rather than from a decided version, so an
 * uncommitted bump compounded into a skipped version on the next run, and a
 * version chosen on purpose could be moved out from under it by someone simply
 * building. The release workflow refuses to publish unless the tag matches
 * these files, so the version has to be a decision - and a decision is not
 * something a build should make.
 *
 * Usage:
 *   node scripts/increment-version.cjs patch|minor|major
 *   node scripts/increment-version.cjs 1.14.0
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = path.join(__dirname, '../package.json');
const MANIFEST_PATH = path.join(__dirname, '../public/manifest.json');

const RELEASE_TYPES = ['major', 'minor', 'patch'];
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Matches the top-level `"version": "..."` line only.
 *
 * Anchored to the start of a line so it cannot match `"manifest_version"`, and
 * used as a text replacement rather than re-serialising the file: rewriting the
 * JSON reformatted it in a way Prettier disagreed with, so every build left
 * unrelated churn in the diff.
 */
const VERSION_LINE = /^(\s*"version":\s*")(\d+\.\d+\.\d+)(")/m;

function readVersion(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = VERSION_LINE.exec(source);

  if (!match) {
    console.error(`No top-level "version" found in ${filePath}`);
    process.exit(1);
  }

  return { source, version: match[2] };
}

function writeVersion(filePath, source, nextVersion) {
  fs.writeFileSync(
    filePath,
    source.replace(VERSION_LINE, `$1${nextVersion}$3`)
  );
}

function bump(version, releaseType) {
  const [major, minor, patch] = version.split('.').map(Number);

  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const argument = process.argv[2];

  if (!argument) {
    console.error(
      'Usage: node scripts/increment-version.cjs <patch|minor|major|X.Y.Z>'
    );
    process.exit(1);
  }

  const pkg = readVersion(PACKAGE_PATH);
  const manifest = readVersion(MANIFEST_PATH);

  // The two must already agree. If they do not, something moved one without
  // the other and bumping would bury that rather than surface it.
  if (pkg.version !== manifest.version) {
    console.error(
      `package.json (${pkg.version}) and public/manifest.json (${manifest.version}) disagree. Reconcile them before bumping.`
    );
    process.exit(1);
  }

  let nextVersion;
  if (RELEASE_TYPES.includes(argument)) {
    nextVersion = bump(pkg.version, argument);
  } else if (VERSION_PATTERN.test(argument)) {
    nextVersion = argument;
  } else {
    console.error(
      `"${argument}" is neither a release type (${RELEASE_TYPES.join('|')}) nor an X.Y.Z version.`
    );
    process.exit(1);
  }

  if (nextVersion === pkg.version) {
    console.error(`Already at ${nextVersion}; nothing to do.`);
    process.exit(1);
  }

  writeVersion(PACKAGE_PATH, pkg.source, nextVersion);
  writeVersion(MANIFEST_PATH, manifest.source, nextVersion);

  console.log(`Version set: ${pkg.version} -> ${nextVersion}`);
}

main();
