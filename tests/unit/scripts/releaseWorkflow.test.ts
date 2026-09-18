// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  resolveVersion,
  writeVersion,
} = require('../../../scripts/release-version.cjs');
const roots: string[] = [];
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'release-workflow-'));
  roots.push(root);
  mkdirSync(join(root, 'public'));
  writeFileSync(
    join(root, 'package.json'),
    '{\n  "version": "1.20.0",\n  "name": "fixture"\n}\n'
  );
  writeFileSync(
    join(root, 'public/manifest.json'),
    '{\n  "version": "1.20.0",\n  "permissions": ["storage", "tabs"]\n}\n'
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({
      version: '1.19.0',
      packages: {
        '': { version: '1.19.0' },
        'node_modules/example': { version: '1.2.3' },
      },
    })
  );
  return root;
}
afterEach(() => {
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('release version requests', () => {
  it.each([
    ['patch', '1.20.1'],
    ['minor', '1.21.0'],
    ['major', '2.0.0'],
    ['v1.21.2', '1.21.2'],
    [' 1.20.10 ', '1.20.10'],
    ['', '1.20.0'],
  ])('resolves %s to %s', (input, expected) => {
    expect(resolveVersion('1.20.0', input)).toBe(expected);
  });
  it.each([
    '1.20.0',
    '1.19.9',
    '01.21.0',
    '1.21',
    '1.21.0-beta',
    '65536.0.0',
    '0.0.0',
    '$(touch bad)',
    '1.21.0\nvalue=bad',
  ])('rejects %s', (input) => {
    expect(() => resolveVersion('1.20.0', input)).toThrow();
  });
  it('compares numerically and rejects overflow', () => {
    expect(resolveVersion('1.9.9', '1.10.0')).toBe('1.10.0');
    expect(() => resolveVersion('1.20.65535', 'patch')).toThrow();
  });
  it('validates the legacy expected-version guard against the resolved version', () => {
    expect(resolveVersion('1.20.0', 'minor', 'v1.21.0')).toBe('1.21.0');
    expect(() => resolveVersion('1.20.0', '', '1.21.0')).toThrow(/new_version/);
  });
  it('updates all root version metadata while preserving dependency versions and manifest formatting', () => {
    const root = fixture();
    const manifest = readFileSync(join(root, 'public/manifest.json'), 'utf8');
    writeVersion(root, '1.21.0');
    expect(
      JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
    ).toBe('1.21.0');
    expect(readFileSync(join(root, 'public/manifest.json'), 'utf8')).toBe(
      manifest.replace('1.20.0', '1.21.0')
    );
    const lock = JSON.parse(
      readFileSync(join(root, 'package-lock.json'), 'utf8')
    );
    expect(lock.version).toBe('1.21.0');
    expect(lock.packages[''].version).toBe('1.21.0');
    expect(lock.packages['node_modules/example'].version).toBe('1.2.3');
  });
  it('rejects inconsistent source versions without editing files', () => {
    const root = fixture();
    writeFileSync(join(root, 'public/manifest.json'), '{"version":"1.19.0"}');
    const before = readFileSync(join(root, 'package.json'), 'utf8');
    expect(() => writeVersion(root, '1.21.0')).toThrow(/disagree/);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before);
  });
});

// Execute the real orchestration shell script with fake git/GitHub commands.
// Exercise its stop conditions without creating remote branches or releases.
function runPreparation(scenario = 'success'): {
  status: number | null;
  log: string;
  stderr: string;
} {
  const root = fixture();
  const bin = join(root, 'bin');
  mkdirSync(bin);
  mkdirSync(join(root, 'scripts'));
  writeFileSync(
    join(root, 'scripts/release-version.cjs'),
    readFileSync(resolve('scripts/release-version.cjs'))
  );
  const fakeTool = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const command = args.join(' ');
fs.appendFileSync('commands.log', tool + ' ' + command + '\\n');
const scenario = process.env.SCENARIO;
const base = 'a'.repeat(40), bump = 'b'.repeat(40), merged = 'c'.repeat(40);
if (tool === 'git') {
  if (command === 'rev-parse HEAD') {
    const count = fs.existsSync('head-read') ? 1 : 0;
    fs.writeFileSync('head-read', '1');
    console.log(count ? bump : base);
  } else if (command.includes('^{tree}')) {
    console.log(scenario === 'changed-tree' && command.includes(bump) ? 'different' : 'same-tree');
  }
} else if (tool === 'gh') {
  if (command.startsWith('pr create')) console.log('https://github.com/example/repo/pull/1');
  else if (command.includes('/dispatches')) console.log('123');
  else if (command.includes('/actions/runs/123')) console.log(scenario === 'wrong-ci-sha' ? base : bump);
  else if (command.includes('/git/ref/heads/main')) console.log(scenario === 'changed-main' ? bump : base);
  else if (command.startsWith('pr merge') && scenario === 'changed-pr') process.exit(1);
  else if (command.startsWith('pr view')) console.log(merged);
} else if (tool === 'timeout' && scenario === 'failed-ci') process.exit(1);
`;
  for (const tool of ['git', 'gh', 'timeout'])
    writeFileSync(join(bin, tool), fakeTool, { mode: 0o755 });
  const result = spawnSync('bash', [resolve('scripts/prepare-release-pr.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SCENARIO: scenario,
      RELEASE_VERSION: '1.21.0',
      GITHUB_REPOSITORY: 'example/repo',
      GITHUB_RUN_ID: '10',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_STEP_SUMMARY: join(root, 'summary'),
    },
  });
  return {
    status: result.status,
    log: readFileSync(join(root, 'commands.log'), 'utf8'),
    stderr: result.stderr,
  };
}

describe('release PR orchestration', () => {
  it('dispatches CI, merges the exact checked commit, and checks out the merge', () => {
    const result = runPreparation();
    expect(result.status, result.stderr).toBe(0);
    expect(result.log).toContain('ci.yml/dispatches');
    expect(result.log).toContain(
      'timeout 20m gh run watch 123 --interval 10 --exit-status'
    );
    expect(result.log).toContain(`--match-head-commit ${'b'.repeat(40)}`);
    expect(result.log).toContain(`checkout --detach ${'c'.repeat(40)}`);
  });
  it.each(['failed-ci', 'wrong-ci-sha', 'changed-main'])(
    'does not merge when %s',
    (scenario) => {
      const result = runPreparation(scenario);
      expect(result.status).not.toBe(0);
      expect(result.log).not.toContain('gh pr merge');
    }
  );
  it('stops if the PR changes before the merge', () => {
    const result = runPreparation('changed-pr');
    expect(result.status).not.toBe(0);
    expect(result.log).not.toContain('checkout --detach');
  });
  it('stops if the merged tree differs from the validated tree', () => {
    const result = runPreparation('changed-tree');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Merged tree differs');
  });
});
