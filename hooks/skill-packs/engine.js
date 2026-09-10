#!/usr/bin/env node
// Shipwright — skill-pack acquisition engine.
//
// Fetches Agent Skills with the vercel-labs/skills CLI into an out-of-repo cache, only when a project
// needs them — official publishers' packs (packs.js) matched by repo signals or requested for a task, and
// skill-library listings (library.js) the user approved — and renders the index the hook injects.
// Nothing is vendored: skill bodies are written by the upstream CLI from the publisher's repo and
// refreshed from it; Shipwright keeps pointers (name -> description -> path).
//
// The CLI installs project-scoped skills relative to its cwd, so it runs inside the cache
// (<cache>/<pack>/.claude/skills/*) — never in the project and never in ~/.claude/skills.
// Packs are shared across projects; which skills a project sees is decided at index time.
'use strict';

const fs = require('fs');
const path = require('path');
const common = require('../lib/common.js');
const PACKS = require('./packs.js');
const { scanFacts, detectPacks, isIndexed } = require('./detect.js');
const { parseListingId } = require('./library.js');

const CONFIG_DEFAULTS = {
  enabled: true,        // master switch (env SHIPWRIGHT_SKILL_PACKS=off also disables)
  include: [],          // pack ids to load even without repo signals
  exclude: [],          // pack ids or skill names never to load or index
  library: true,        // offer skill-library listings; nothing installs without the user's approval
  refreshDays: 7,       // acquire re-fetches packs and library skills older than this
  cliVersion: 'latest', // vercel-labs/skills version run via npx (pin for reproducibility)
};

const HOOKS_DIR = path.dirname(__dirname);
const cacheDir = () => process.env.SHIPWRIGHT_SKILL_PACKS_CACHE || common.cacheRoot('skill-packs');
const packDir = (id) => path.join(cacheDir(), id);
const libraryDir = (id) => path.join(cacheDir(), 'library', id.replace(/[^\w.-]+/g, '_'));
const projectFile = (projectRoot) => path.join(cacheDir(), 'projects', `${common.projectHash(projectRoot)}.json`);

function config(projectRoot) {
  const cfg = common.readConfig(projectRoot, 'skillPacks', CONFIG_DEFAULTS);
  return { ...cfg, enabled: cfg.enabled && process.env.SHIPWRIGHT_SKILL_PACKS !== 'off' };
}

// What a project asked for beyond its repo signals: packs added via --pack and library skills the user approved.
function readProject(projectRoot) {
  try {
    const project = common.readJson(projectFile(projectRoot));
    return { packs: project.packs || [], library: project.library || [] };
  } catch {
    return { packs: [], library: [] };
  }
}

function recordProject(projectRoot, key, ids) {
  const project = readProject(projectRoot);
  project[key] = [...new Set([...project[key], ...ids])];
  const file = projectFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ projectRoot, ...project }, null, 2));
}

function readMeta(dir) {
  try {
    return common.readJson(path.join(dir, 'shipwright-meta.json'));
  } catch {
    return null;
  }
}

function isFresh(meta, refreshDays) {
  const age = meta ? Date.now() - Date.parse(meta.updatedAt) : NaN;
  return Number.isFinite(age) && age < refreshDays * 86400000;
}

// Packs this project needs: repo signals, `skillPacks.include`, and packs a task requested via --pack.
function neededPacks(projectRoot, cfg, facts) {
  const detected = new Map(detectPacks(facts).map((d) => [d.pack.id, d.reasons]));
  const requested = new Set([...cfg.include, ...readProject(projectRoot).packs]);
  return PACKS
    .filter((p) => (detected.has(p.id) || requested.has(p.id)) && !cfg.exclude.includes(p.id))
    .map((pack) => ({ pack, reasons: detected.get(pack.id) || ['requested'], requested: !detected.has(pack.id) }));
}

function buildCatalog(installedDir, finalDir) {
  let names = [];
  try {
    names = fs.readdirSync(installedDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { /* nothing installed */ }
  return names.flatMap((name) => {
    try {
      const fm = common.parseFrontmatter(fs.readFileSync(path.join(installedDir, name, 'SKILL.md'), 'utf8'));
      return [{ name: fm.name || name, description: fm.description || '', path: path.join(finalDir, name, 'SKILL.md') }];
    } catch {
      return [];
    }
  });
}

// Fetch into a staging dir and swap it in, so a failed or partial fetch never replaces a working cache.
function fetchInto(dir, source, cfg, meta) {
  const staging = `${dir}.staging-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const r = common.runNpx(['--yes', `skills@${cfg.cliVersion}`, 'add', ...source, '--agent', 'claude-code', '--yes', '--copy'], {
    cwd: staging,
    env: { DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' },
  });
  const catalog = buildCatalog(path.join(staging, '.claude', 'skills'), path.join(dir, '.claude', 'skills'));
  if (!r.ok || !catalog.length) {
    fs.rmSync(staging, { recursive: true, force: true });
    const detail = common.stripAnsi(r.stderr || r.stdout).trim().slice(-300);
    return { status: 'failed', reason: r.ok ? 'nothing-installed' : 'fetch-failed', detail };
  }
  fs.writeFileSync(path.join(staging, 'catalog.json'), JSON.stringify(catalog, null, 2));
  const written = { ...meta, source, updatedAt: new Date().toISOString(), cliVersion: cfg.cliVersion, count: catalog.length };
  fs.writeFileSync(path.join(staging, 'shipwright-meta.json'), JSON.stringify(written, null, 2));
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(staging, dir);
  } catch (e) {
    fs.rmSync(staging, { recursive: true, force: true });
    return { status: 'failed', reason: 'swap-failed', detail: e.message };
  }
  return { status: 'fetched', count: catalog.length };
}

function refreshInto(dir, source, cfg, meta, refresh) {
  const current = readMeta(dir);
  return !refresh && isFresh(current, cfg.refreshDays) ? { status: 'cached', count: current.count } : fetchInto(dir, source, cfg, meta);
}

function acquire({ projectRoot, add = [], refresh = false } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = config(projectRoot);
  if (!cfg.enabled) return { ok: false, reason: 'disabled', packs: [], library: [] };

  const unknown = add.filter((id) => !PACKS.some((p) => p.id === id));
  const known = add.filter((id) => !unknown.includes(id));
  if (known.length) recordProject(projectRoot, 'packs', known);

  const packs = neededPacks(projectRoot, cfg, scanFacts(projectRoot))
    .map(({ pack }) => ({ id: pack.id, ...refreshInto(packDir(pack.id), pack.source, cfg, { repo: pack.repo }, refresh) }));
  const library = !cfg.library ? [] : readProject(projectRoot).library.map((id) => {
    const listing = parseListingId(id);
    const source = readMeta(libraryDir(id))?.source || [`https://github.com/${listing.repo}`, '--skill', listing.skill];
    return { id, ...refreshInto(libraryDir(id), source, cfg, { listing: id }, refresh) };
  });
  return { ok: !unknown.length && [...packs, ...library].every((r) => r.status !== 'failed'), unknown, packs, library };
}

// Install one skill-library listing the user approved and match it to this project.
function addLibrarySkill({ projectRoot, id, skill } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = config(projectRoot);
  if (!cfg.enabled || !cfg.library) return { ok: false, reason: 'disabled' };
  const listing = parseListingId(id);
  if (!listing) return { ok: false, reason: 'expected a GitHub-hosted listing id: skill:<owner>/<repo>#<skill>' };
  const source = [`https://github.com/${listing.repo}`, '--skill', skill || listing.skill];
  const result = fetchInto(libraryDir(id), source, cfg, { listing: id });
  if (result.status === 'fetched') recordProject(projectRoot, 'library', [id]);
  const hint = result.reason === 'nothing-installed' && !skill ? 'the SKILL.md name can differ from the listing slug — retry with --skill "<name>"' : undefined;
  return { ok: result.status === 'fetched', id, ...result, ...(hint && { hint }) };
}

function readCatalog(dir) {
  try {
    return common.readJson(path.join(dir, 'catalog.json'));
  } catch {
    return null;
  }
}

function renderIndex(projectRoot, { event = 'SessionStart' } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = config(projectRoot);
  if (!cfg.enabled) return '';
  const facts = scanFacts(projectRoot);
  const needed = neededPacks(projectRoot, cfg, facts);
  const library = cfg.library ? readProject(projectRoot).library : [];
  const cmd = `node "${__filename}" acquire --project "${projectRoot}"`;
  const addLine = `${cmd} --pack <${PACKS.map((p) => p.id).join('|')}>`;
  const isSession = event === 'SessionStart';
  if (!needed.length && !library.length) {
    return isSession ? `[skill-packs] no pack matches this repo. If a task targets ${PACKS.map((p) => p.publisher).join(' / ')}, fetch its skills on demand: ${addLine}\n` : '';
  }

  const groups = [];
  const notes = [];
  const missing = [];
  const stale = [];
  for (const { pack, requested } of needed) {
    if (pack.hint) notes.push(pack.hint.replace('{hooks}', HOOKS_DIR).replace('{project}', projectRoot));
    const dir = path.join(packDir(pack.id), '.claude', 'skills');
    const catalog = readCatalog(packDir(pack.id));
    if (!catalog) {
      missing.push(pack.id);
      continue;
    }
    if (!isFresh(readMeta(packDir(pack.id)), cfg.refreshDays)) stale.push(pack.id);
    const shown = catalog.filter((s) => !cfg.exclude.includes(s.name) && isIndexed(pack, s.name, facts, requested));
    if (shown.length) groups.push({ label: pack.id, dir, shown });
    if (pack.browse && catalog.length > shown.length) {
      notes.push(`[skill-packs] ${pack.id}: ${shown.length} of ${catalog.length} cached skills matched — for another ${pack.publisher} topic, Glob "${dir}/*/SKILL.md" by name.`);
    }
  }
  const approved = library.flatMap((id) => {
    const catalog = readCatalog(libraryDir(id));
    if (!catalog) {
      missing.push(id);
      return [];
    }
    if (!isFresh(readMeta(libraryDir(id)), cfg.refreshDays)) stale.push(id);
    return catalog.filter((s) => !cfg.exclude.includes(s.name));
  });
  if (approved.length) groups.push({ label: 'library (user-approved)', dir: null, shown: approved });

  const lines = [];
  const count = groups.reduce((n, g) => n + g.shown.length, 0);
  if (count) {
    lines.push(`[skill-packs] ${count} project-matched skill${count === 1 ? '' : 's'} — Read the relevant SKILL.md on demand; never copy its content:`);
    for (const { label, dir, shown } of groups) {
      lines.push(dir ? `${label}: ${path.join(dir, '<name>', 'SKILL.md')}` : `${label}:`);
      // The CLI names each folder after its skill; spell out a path only where they differ.
      shown.forEach((s) => lines.push(`- ${s.name} — ${common.shortDesc(s.description)}${dir && path.basename(path.dirname(s.path)) === s.name ? '' : ` → ${s.path}`}`));
    }
  }
  lines.push(...notes);
  if (missing.length) lines.push(`[skill-packs] needed but not fetched yet: ${missing.join(', ')} — fetch (writes only to an out-of-repo cache): ${cmd}`);
  if (stale.length) lines.push(`[skill-packs] may be stale: ${stale.join(', ')} — refresh: ${cmd} --refresh`);
  if (isSession) lines.push(`[skill-packs] a task targets another platform? ${addLine}`);
  return `${lines.join('\n')}\n`;
}

module.exports = { acquire, addLibrarySkill, renderIndex, neededPacks, config };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const projectRoot = path.resolve(flag('--project') || process.cwd());
  const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

  if (argv[0] === 'detect') {
    const needed = neededPacks(projectRoot, config(projectRoot), scanFacts(projectRoot));
    print(needed.map(({ pack, reasons, requested }) => ({ id: pack.id, reasons, requested })));
  } else if (argv[0] === 'acquire') {
    const add = argv.flatMap((a, i) => (a === '--pack' && argv[i + 1] ? [argv[i + 1]] : []));
    print(acquire({ projectRoot, add, refresh: argv.includes('--refresh') }));
  } else if (argv[0] === 'add' && argv[1] && !argv[1].startsWith('--')) {
    print(addLibrarySkill({ projectRoot, id: argv[1], skill: flag('--skill') }));
  } else if (argv[0] === 'index') {
    process.stdout.write(renderIndex(projectRoot));
  } else {
    process.stderr.write('usage: engine.js <detect|acquire|index> [--project <dir>] [--pack <id>]... [--refresh]\n'
      + '       engine.js add "<skill:owner/repo#skill>" [--project <dir>] [--skill <name>]\n');
    process.exit(2);
  }
}
