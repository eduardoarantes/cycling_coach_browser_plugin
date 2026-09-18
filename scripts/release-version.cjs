const fs = require('node:fs');
const path = require('node:path');

function normalizeVersion(value) {
  const version = value.trim().replace(/^v/, '');
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    version.split('.').some((part) => Number(part) > 65535) ||
    version === '0.0.0'
  ) {
    throw new Error(
      'Use X.Y.Z (optional v prefix), with components from 0 to 65535, excluding 0.0.0.'
    );
  }
  return version;
}

function resolveVersion(current, requested = '', expected = '') {
  current = normalizeVersion(current);
  let version = current;
  if (requested.trim()) {
    const bump = ['major', 'minor', 'patch'].indexOf(requested.trim());
    if (bump >= 0) {
      const parts = current.split('.').map(Number);
      parts[bump]++;
      parts.fill(0, bump + 1);
      version = normalizeVersion(parts.join('.'));
    } else {
      version = normalizeVersion(requested);
    }
    const next = version.split('.').map(Number);
    const previous = current.split('.').map(Number);
    const firstDifference = next.findIndex((part, i) => part !== previous[i]);
    if (
      firstDifference < 0 ||
      next[firstDifference] < previous[firstDifference]
    ) {
      throw new Error(
        `New version ${version} must be greater than ${current}. Leave new_version blank to release the current version.`
      );
    }
  }
  if (expected.trim() && normalizeVersion(expected) !== version) {
    throw new Error(
      `Requested release is ${version}, but expected_version is ${expected}. Use new_version to bump the version.`
    );
  }
  return version;
}

function readVersions(root) {
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const pkg = read('package.json');
  const manifest = read('public/manifest.json');
  if (pkg.version !== manifest.version) {
    throw new Error('package.json and public/manifest.json versions disagree.');
  }
  return { pkg, manifest, lock: read('package-lock.json') };
}

function writeVersion(root, requested) {
  const { pkg, lock } = readVersions(root);
  const version = resolveVersion(pkg.version, requested);
  // Preserve formatting and touch only the root metadata, never dependency versions.
  for (const name of ['package.json', 'public/manifest.json']) {
    const file = path.join(root, name);
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace(/("version"\s*:\s*")[^"]+("\s*[,}])/, `$1${version}$2`)
    );
  }
  lock.version = version;
  lock.packages[''].version = version;
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify(lock, null, 2) + '\n'
  );
  return version;
}

module.exports = {
  normalizeVersion,
  resolveVersion,
  readVersions,
  writeVersion,
};

if (require.main === module) {
  try {
    const [, , command, requested = '', expected = ''] = process.argv;
    if (command === 'resolve') {
      console.log(
        resolveVersion(
          readVersions(process.cwd()).pkg.version,
          requested,
          expected
        )
      );
    } else if (command === 'write') {
      console.log(writeVersion(process.cwd(), requested));
    } else {
      throw new Error(
        'Usage: node scripts/release-version.cjs resolve|write [version|major|minor|patch] [expected_version]'
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
