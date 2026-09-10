'use strict';
// Offline tests for Shipwright's hook scripts: `node --test "hooks/test/*.test.js"`. No network, no npx.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const common = require('../lib/common.js');
const PACKS = require('../skill-packs/packs.js');
const { scanFacts, detectPacks, isIndexed } = require('../skill-packs/detect.js');
const { parseListingId } = require('../skill-packs/library.js');
const { parseSkipped } = require('../js/oxc-compat.js');

const HOOKS = path.join(__dirname, '..');
const made = [];
after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function fixture(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipwright-test-'));
  made.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function runHook(script, event, cwd, env = {}) {
  return execFileSync(process.execPath, [path.join(HOOKS, script), event], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
}

const packageJson = (dependencies) => JSON.stringify({ dependencies });
const ids = (dir) => detectPacks(scanFacts(dir)).map((d) => d.pack.id);

test('parseFrontmatter reads plain, quoted, and folded descriptions', () => {
  assert.deepEqual(common.parseFrontmatter('---\nname: a\ndescription: plain text\n---'), { name: 'a', description: 'plain text' });
  assert.deepEqual(
    common.parseFrontmatter('\uFEFF---\nname: "b"\ndescription: >\n  folded one\n  and two\nmetadata:\n  name: nested\n---'),
    { name: 'b', description: 'folded one and two' },
  );
  assert.deepEqual(common.parseFrontmatter('no frontmatter'), {});
});

test('readConfig merges one .shipwright.json block over its defaults', () => {
  const dir = fixture({ '.shipwright.json': '\uFEFF{"skillPacks":{"exclude":["aws"]}}' });
  assert.deepEqual(common.readConfig(dir, 'skillPacks', { enabled: true, exclude: [] }), { enabled: true, exclude: ['aws'] });
  assert.deepEqual(common.readConfig(fixture(), 'skillPacks', { enabled: true }), { enabled: true });
});

test('packs match repo signals and gate their skills by them', () => {
  const dir = fixture({ 'package.json': packageJson({ next: '16', react: '19', '@clerk/nextjs': '6' }), 'infra/main.bicep': 'param location string' });
  for (const id of ['vercel', 'nextjs', 'clerk', 'azure']) assert.ok(ids(dir).includes(id), `expected ${id} in ${ids(dir)}`);
  const facts = scanFacts(dir);
  const clerk = PACKS.find((p) => p.id === 'clerk');
  assert.equal(isIndexed(clerk, 'clerk-nextjs-patterns', facts, false), true);
  assert.equal(isIndexed(clerk, 'clerk-vue-patterns', facts, false), false);
  assert.equal(isIndexed(clerk, 'clerk-orgs', facts, false), false);
  assert.equal(isIndexed(clerk, 'clerk-vue-patterns', facts, true), true, 'a requested pack shows its signal-gated skills');
});

test('JS stacks without platform signals match no pack', () => {
  assert.deepEqual(ids(fixture({ 'package.json': packageJson({ axios: '1' }) })), []);
});

test('manifest text markers detect Azure and Aspire in .NET projects', () => {
  const dir = fixture({
    'Api/Api.csproj': '<PackageReference Include="Azure.Storage.Blobs" Version="12.0.0" />',
    'AppHost/AppHost.csproj': '<PackageReference Include="Aspire.Hosting.AppHost" Version="13.0.0" />',
  });
  assert.deepEqual(ids(dir), ['azure', 'aspire']);
});

test('library listing ids resolve only for GitHub-hosted skills', () => {
  assert.deepEqual(parseListingId('skill:stripe/ai#stripe-best-practices'), { repo: 'stripe/ai', skill: 'stripe-best-practices' });
  assert.equal(parseListingId('skill:docs.stripe.com#stripe-directory'), null);
});

test('oxlint-migrate output parses into skipped-rule groups', () => {
  const output = [
    '✨ .oxlintrc.json created with 65 rules.',
    '',
    '   Skipped 3 rules:',
    '     - 2 Nursery',
    '       - no-undef',
    '       - no-useless-assignment',
    '     - 1 Unsupported',
    '       - no-octal: Superseded by strict mode.',
    '',
    '👉 Re-run with flags to include more:',
  ].join('\n');
  assert.deepEqual(parseSkipped(output), {
    Nursery: ['no-undef', 'no-useless-assignment'],
    Unsupported: ['no-octal: Superseded by strict mode.'],
  });
});

test('hooks wrap SubagentStart context in hookSpecificOutput', () => {
  const out = JSON.parse(runHook('inject-code-laws.js', 'SubagentStart', HOOKS));
  assert.equal(out.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(out.hookSpecificOutput.additionalContext, /Code Laws/);
});

test('skill-packs hook: silent for subagents in unmatched repos, a pointer for sessions, nothing when off', () => {
  const dir = fixture({ 'README.md': '# empty' });
  const env = { SHIPWRIGHT_SKILL_PACKS_CACHE: fixture() };
  assert.equal(JSON.parse(runHook('skill-packs/inject-skill-packs.js', 'SubagentStart', dir, env)).hookSpecificOutput.additionalContext, '');
  assert.match(runHook('skill-packs/inject-skill-packs.js', 'SessionStart', dir, env), /no pack matches this repo/);
  assert.equal(runHook('skill-packs/inject-skill-packs.js', 'SessionStart', dir, { ...env, SHIPWRIGHT_SKILL_PACKS: 'off' }), '');
});

test('skill-packs hook surfaces the fetch command for a matched pack not cached yet', () => {
  const dir = fixture({ 'package.json': packageJson({ hono: '4' }) });
  assert.match(runHook('skill-packs/inject-skill-packs.js', 'SessionStart', dir, { SHIPWRIGHT_SKILL_PACKS_CACHE: fixture() }), /needed but not fetched yet: hono/);
});

test('dotnet hook injects nothing outside .NET repos', () => {
  const out = JSON.parse(runHook('dotnet/inject-dotnet-skills.js', 'SubagentStart', fixture({ 'README.md': '# empty' })));
  assert.equal(out.hookSpecificOutput.additionalContext, '');
});
