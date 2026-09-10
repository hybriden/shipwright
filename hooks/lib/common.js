'use strict';
// Shipwright — helpers shared by the hook scripts.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// Windows editors and PowerShell prepend a UTF-8 BOM, which JSON.parse rejects.
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

// One block of `.shipwright.json` merged over its defaults; a missing or unreadable file yields the defaults.
function readConfig(projectRoot, key, defaults) {
  try {
    const block = readJson(path.join(path.resolve(projectRoot), '.shipwright.json'))[key];
    return { ...defaults, ...(block && typeof block === 'object' ? block : {}) };
  } catch {
    return { ...defaults };
  }
}

// SessionStart accepts raw stdout; SubagentStart drops context unless it is wrapped in hookSpecificOutput.
function emit(event, context) {
  process.stdout.write(event === 'SubagentStart'
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } })
    : context);
}

// npx is a .cmd shim on Windows that spawnSync can't launch with shell:false, so the command goes through
// the shell (cmd.exe / sh). Args are controlled flags and identifiers; ones with shell-special characters are quoted.
function runNpx(args, opts = {}) {
  const cmdline = ['npx', ...args.map((a) => (/[\s*?&|<>()^]/.test(a) ? `"${a}"` : a))].join(' ');
  const started = Date.now();
  const r = spawnSync(cmdline, {
    encoding: 'utf8',
    timeout: opts.timeout || 300000,
    cwd: opts.cwd,
    windowsHide: true,
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', ...(opts.env || {}) },
  });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error, ms: Date.now() - started };
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

// Every Shipwright cache lives outside any repo, under ~/.claude/.shipwright.
function cacheRoot(...parts) {
  return path.join(os.homedir(), '.claude', '.shipwright', ...parts);
}

function projectHash(projectRoot) {
  const norm = path.resolve(projectRoot).replace(/\\/g, '/').toLowerCase();
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
}

// SKILL.md frontmatter name + description: plain or quoted scalars, and folded/literal blocks (`>`, `|`).
function parseFrontmatter(text) {
  const m = String(text).match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const grab = (key) => {
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i < 0) return undefined;
    let v = lines[i].slice(key.length + 1).trim();
    if (v === '' || /^[>|][-+]?$/.test(v)) {
      const block = [];
      for (let j = i + 1; j < lines.length && (lines[j] === '' || /^\s/.test(lines[j])); j++) block.push(lines[j].trim());
      v = block.join(' ').replace(/\s+/g, ' ').trim();
    }
    return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
  };
  return { name: grab('name'), description: grab('description') };
}

// First sentence of a long description, trimmed to fit one index line.
function shortDesc(desc, max = 140) {
  if (!desc) return '';
  let s = desc.split(/(?<=\.)\s/)[0].trim();
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

module.exports = { readJson, readConfig, emit, runNpx, stripAnsi, cacheRoot, projectHash, parseFrontmatter, shortDesc };
