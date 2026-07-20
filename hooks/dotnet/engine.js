#!/usr/bin/env node
// Shipwright — dotnet-skills acquisition engine.
//
// Gated behind detect.js (.NET repos only). Drives the official `dotnet-skills` CLI
// (github.com/managedcode/dotnet-skills) to install PROJECT-MATCHED skills into an
// out-of-repo cache, then builds a compact index for injection into sessions/subagents.
//
// It copies NO content: skill bodies live in the cache, written by the upstream tool and
// refreshed from upstream. Shipwright keeps only pointers (name -> description -> path).
//
// Repo hygiene (so `run` Phase 0's clean-tree gate + checkpoints stay intact):
//   - the CLI binary lives in the user's global tool store (~/.dotnet/tools), not the repo;
//   - skills are written to `--target <cache>` under ~/.claude/.shipwright, not the repo;
//   - `install --auto` scans the project (cwd) for *.csproj but writes only to the target.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const IS_WIN = process.platform === 'win32';
const TOOL_SHIM = path.join(os.homedir(), '.dotnet', 'tools', IS_WIN ? 'dotnet-skills.exe' : 'dotnet-skills');
const STATE_FILE = '.dotnet-skills-auto-state.json'; // written by the upstream tool: { Skills:[...], UpdatedAt }
const META_FILE = 'shipwright-meta.json';            // our bookkeeping (freshness, project signature)
const INDEX_FILE = 'shipwright-index.md';             // the rendered injection block

// ---------------------------------------------------------------------------
// Cache location (out-of-repo, keyed per project so multiple repos never collide)
// ---------------------------------------------------------------------------
function cacheRoot() {
  return path.join(os.homedir(), '.claude', '.shipwright', 'dotnet-skills');
}
function cacheDirFor(projectRoot) {
  const norm = path.resolve(projectRoot).replace(/\\/g, '/').toLowerCase();
  const hash = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
  return path.join(cacheRoot(), hash);
}

// ---------------------------------------------------------------------------
// Config — `.shipwright.json` "dotnetSkills" block (all fields optional)
// ---------------------------------------------------------------------------
const CONFIG_DEFAULTS = {
  enabled: true,      // master switch (env SHIPWRIGHT_DOTNET_SKILLS=off also disables)
  installTool: true,  // may `dotnet tool install --global dotnet-skills` when missing
  bundled: true,      // use the tool's offline catalog (false = fetch latest, needs network)
  refreshDays: 7,     // index older than this is flagged stale
  only: [],           // if non-empty, restrict the injected index to these skill ids/names
  exclude: [],        // drop these skill ids/names from the injected index
};
function readConfig(projectRoot) {
  try {
    // Strip a leading UTF-8 BOM — Windows editors/PowerShell add one and it breaks JSON.parse.
    const text = fs.readFileSync(path.join(path.resolve(projectRoot), '.shipwright.json'), 'utf8').replace(/^﻿/, '');
    const raw = JSON.parse(text);
    const ds = raw && typeof raw === 'object' ? raw.dotnetSkills : null;
    return { ...CONFIG_DEFAULTS, ...(ds && typeof ds === 'object' ? ds : {}) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts.timeout || 120000,
    cwd: opts.cwd,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      DOTNET_SKILLS_SKIP_UPDATE_CHECK: '1', // no interactive update notices
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      DOTNET_NOLOGO: '1',
      ...(opts.env || {}),
    },
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error,
  };
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

// Resolve how to invoke the CLI, probed once. Order:
//   1. absolute global shim  (~/.dotnet/tools/dotnet-skills[.exe]) — global install, cwd-independent
//   2. `dotnet-skills` on PATH                                     — global install, PATH updated
//   3. `dotnet dotnet-skills`                                      — local/ambient tool manifest
// The probe uses cwd=projectRoot so a manifest-based install resolves correctly.
let _invoker; // undefined = not probed, null = unavailable
function resolveInvoker(cwd) {
  if (_invoker !== undefined) return _invoker;
  const candidates = [
    { cmd: TOOL_SHIM, pre: [] },
    { cmd: 'dotnet-skills', pre: [] },
    { cmd: 'dotnet', pre: ['dotnet-skills'] },
  ];
  for (const c of candidates) {
    const r = run(c.cmd, [...c.pre, 'version'], { cwd, timeout: 30000 });
    if (r.ok || /v?\d+\.\d+\.\d+/.test(r.stdout + r.stderr)) {
      _invoker = c;
      return _invoker;
    }
  }
  _invoker = null;
  return _invoker;
}
function skills(args, opts = {}) {
  const inv = resolveInvoker(opts.cwd);
  if (!inv) return { ok: false, status: 127, stdout: '', stderr: 'dotnet-skills not available' };
  return run(inv.cmd, [...inv.pre, ...args], opts);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
function dotnetVersion() {
  const r = run('dotnet', ['--version'], { timeout: 30000 });
  return r.ok ? r.stdout.trim() : null;
}
function toolAvailable(cwd) {
  return resolveInvoker(cwd) !== null;
}
function ensureTool({ install = true, cwd } = {}) {
  if (toolAvailable(cwd)) return { present: true, installed: false };
  if (!install) return { present: false, installed: false, reason: 'installTool disabled' };
  const r = run('dotnet', ['tool', 'install', '--global', 'dotnet-skills'], { timeout: 300000 });
  _invoker = undefined; // force re-probe after install
  const present = toolAvailable(cwd);
  return { present, installed: present, reason: present ? undefined : stripAnsi(r.stderr || r.stdout).trim() };
}

// ---------------------------------------------------------------------------
// Index building (deterministic, from files the upstream tool wrote)
// ---------------------------------------------------------------------------
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const body = m[1];
  const grab = (key) => {
    const mm = body.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
    if (!mm) return undefined;
    let v = mm[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  };
  return { name: grab('name'), description: grab('description') };
}

function safeDirs(cacheDir) {
  try {
    return fs.readdirSync(cacheDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function buildIndex(cacheDir, opts = {}) {
  const only = Array.isArray(opts.only) ? opts.only : [];
  const exclude = Array.isArray(opts.exclude) ? opts.exclude : [];
  let ids = null;
  let updatedAt = null;
  try {
    const st = JSON.parse(fs.readFileSync(path.join(cacheDir, STATE_FILE), 'utf8'));
    ids = Array.isArray(st.Skills) ? st.Skills : null;
    updatedAt = st.UpdatedAt || null;
  } catch { /* no state file yet */ }
  if (!ids) ids = safeDirs(cacheDir);

  const skills = [];
  for (const id of ids) {
    const skillDir = path.join(cacheDir, id);
    const mdPath = path.join(skillDir, 'SKILL.md');
    let fm;
    try {
      fm = parseFrontmatter(fs.readFileSync(mdPath, 'utf8'));
    } catch {
      continue; // listed but not on disk — skip
    }
    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(skillDir, 'manifest.json'), 'utf8'));
    } catch { /* optional */ }
    skills.push({
      id,
      name: fm.name || id,
      description: fm.description || '',
      category: manifest.category || '',
      packages: Array.isArray(manifest.packages) ? manifest.packages : [],
      path: mdPath,
    });
  }

  let filtered = skills;
  if (only.length) filtered = filtered.filter((s) => only.includes(s.id) || only.includes(s.name));
  if (exclude.length) filtered = filtered.filter((s) => !(exclude.includes(s.id) || exclude.includes(s.name)));
  return { skills: filtered, updatedAt, cacheDir };
}

// First sentence (or a trimmed slice) of a long USE-FOR-style description.
function shortDesc(desc, max = 140) {
  if (!desc) return '';
  let s = desc.split(/(?<=\.)\s/)[0].trim();
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

function renderIndex(index, cacheDir) {
  const { skills } = index;
  if (!skills.length) return '';
  const lines = [];
  lines.push(`[dotnet-skills] ${skills.length} project-matched skill${skills.length === 1 ? '' : 's'} available` +
    ` — managedcode/dotnet-skills, read the relevant one on demand (do NOT copy its content):`);
  for (const s of skills) {
    const cat = s.category ? ` [${s.category}]` : '';
    lines.push(`- ${s.name}${cat} — ${shortDesc(s.description)} → ${s.path}`);
  }
  lines.push(`When your task touches one of these areas, Read that SKILL.md and apply its guidance.`);
  lines.push(`Cache: ${cacheDir} (regenerated from upstream; safe to delete).`);
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Freshness bookkeeping
// ---------------------------------------------------------------------------
function readMeta(cacheDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cacheDir, META_FILE), 'utf8'));
  } catch {
    return null;
  }
}
function writeMeta(cacheDir, extra) {
  const meta = { updatedAt: new Date().toISOString(), ...extra };
  try {
    fs.writeFileSync(path.join(cacheDir, META_FILE), JSON.stringify(meta, null, 2));
  } catch { /* best-effort */ }
  return meta;
}
function isFresh(cacheDir, refreshDays = 7) {
  const meta = readMeta(cacheDir);
  if (!meta || !meta.updatedAt) return false;
  const ageMs = Date.now() - Date.parse(meta.updatedAt);
  return Number.isFinite(ageMs) && ageMs < refreshDays * 86400000;
}

// ---------------------------------------------------------------------------
// Acquire: env check -> ensure tool -> install --auto to cache -> build + render index
// ---------------------------------------------------------------------------
function acquire({ projectRoot, cacheDir, bundled, prune = true, install, force = false } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = readConfig(projectRoot);
  cacheDir = cacheDir || cacheDirFor(projectRoot);
  if (!cfg.enabled && !force) return { ok: false, reason: 'disabled', cacheDir };
  if (install === undefined) install = cfg.installTool;
  if (bundled === undefined) bundled = cfg.bundled;

  const dotnet = dotnetVersion();
  if (!dotnet) return { ok: false, reason: 'no-dotnet', cacheDir };

  const tool = ensureTool({ install, cwd: projectRoot });
  if (!tool.present) return { ok: false, reason: 'no-tool', detail: tool.reason, cacheDir };

  fs.mkdirSync(cacheDir, { recursive: true });
  const args = ['install', '--auto', '--target', cacheDir];
  if (bundled) args.push('--bundled');
  if (prune) args.push('--prune');
  const r = skills(args, { cwd: projectRoot, timeout: 300000 });

  const index = buildIndex(cacheDir, { only: cfg.only, exclude: cfg.exclude });
  writeMeta(cacheDir, {
    projectRoot,
    dotnet,
    toolInstalled: tool.installed,
    skills: index.skills.map((s) => s.id),
    installOk: r.ok,
  });
  try {
    fs.writeFileSync(path.join(cacheDir, INDEX_FILE), renderIndex(index, cacheDir));
  } catch { /* best-effort */ }

  return { ok: r.ok, reason: r.ok ? undefined : 'install-failed', cacheDir, index, raw: stripAnsi(r.stdout) };
}

module.exports = {
  cacheRoot,
  cacheDirFor,
  readConfig,
  dotnetVersion,
  toolAvailable,
  ensureTool,
  buildIndex,
  renderIndex,
  readMeta,
  writeMeta,
  isFresh,
  acquire,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name) => argv.includes(name);
  const projectRoot = path.resolve(flag('--project') || process.cwd());
  const cacheDir = flag('--cache') || cacheDirFor(projectRoot);

  if (cmd === 'env') {
    const inv = resolveInvoker(projectRoot);
    process.stdout.write(JSON.stringify({
      dotnet: dotnetVersion(),
      tool: inv !== null,
      invoker: inv ? [inv.cmd, ...inv.pre].join(' ') : null,
    }, null, 2) + '\n');
  } else if (cmd === 'cache-dir') {
    process.stdout.write(cacheDir + '\n');
  } else if (cmd === 'index') {
    const cfg = readConfig(projectRoot);
    const idx = buildIndex(cacheDir, { only: cfg.only, exclude: cfg.exclude });
    process.stdout.write(has('--md') ? renderIndex(idx, cacheDir) : JSON.stringify(idx, null, 2) + '\n');
  } else if (cmd === 'fresh') {
    process.stdout.write(String(isFresh(cacheDir, Number(flag('--days')) || readConfig(projectRoot).refreshDays)) + '\n');
  } else if (cmd === 'acquire') {
    const res = acquire({
      projectRoot,
      cacheDir,
      bundled: has('--no-bundled') ? false : undefined,
      prune: !has('--no-prune'),
      install: has('--no-install') ? false : undefined,
      force: has('--force'),
    });
    process.stdout.write(JSON.stringify({
      ok: res.ok,
      reason: res.reason,
      detail: res.detail,
      cacheDir: res.cacheDir,
      count: res.index ? res.index.skills.length : 0,
    }, null, 2) + '\n');
  } else {
    process.stderr.write(
      'usage: engine.js <env|acquire|index|fresh|cache-dir> ' +
      '[--project <dir>] [--cache <dir>] [--md] [--days N] [--no-bundled] [--no-prune] [--no-install] [--force]\n');
    process.exit(2);
  }
}
