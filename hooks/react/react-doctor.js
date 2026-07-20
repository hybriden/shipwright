#!/usr/bin/env node
// Shipwright — react-doctor verify-gate runner.
//
// Detects a React project, runs millionco/react-doctor (a DETERMINISTIC static analyzer,
// Modified-MIT) over the diff, parses its JSON, and returns normalized findings for
// auto-review to gate on. This is a verify tool, not injected guidance.
//
// Principles it holds to:
//   - LOCAL-ONLY: always passes --no-score --no-telemetry so it never phones home
//     (react-doctor calls a score/share API by default — unacceptable for private code).
//   - DIFF-SCOPED: default --scope changed --base <ref> so it judges only the change
//     shipwright produced, not the repo's pre-existing debt.
//   - NO VENDORING: react-doctor is fetched transiently via npx; nothing is copied in.
//   - DEGRADE, NEVER BLOCK: no node/npx, offline, or a scan error => report unavailable
//     and let the pipeline continue; the gate is an enhancement, not a hard dependency.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Config — `.shipwright.json` "reactDoctor" block (all optional)
// ---------------------------------------------------------------------------
const CONFIG_DEFAULTS = {
  enabled: true,           // master switch
  scope: 'changed',        // 'changed' (diff vs base) | 'full' (whole project)
  base: null,              // git ref for changed-scope; null = react-doctor auto-detects
  blocking: 'error',       // severity that trips a non-zero exit: 'error' | 'warning' | 'none'
  categories: [],          // limit to these categories (e.g. ["Bugs","Accessibility"]); [] = all
  version: 'latest',       // react-doctor version to run via npx (pin for reproducibility)
  maxWarnings: 40,         // cap warnings in the rendered block (errors are never capped)
};
function readConfig(projectRoot) {
  try {
    // Strip a leading UTF-8 BOM — Windows editors/PowerShell add one and it breaks JSON.parse.
    const text = fs.readFileSync(path.join(path.resolve(projectRoot), '.shipwright.json'), 'utf8').replace(/^﻿/, '');
    const raw = JSON.parse(text);
    const rd = raw && typeof raw === 'object' ? raw.reactDoctor : null;
    return { ...CONFIG_DEFAULTS, ...(rd && typeof rd === 'object' ? rd : {}) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

// ---------------------------------------------------------------------------
// Detection — pure fs, cheap: package.json with a react dependency
// ---------------------------------------------------------------------------
function detectReact(projectRoot) {
  const pkgPath = path.join(path.resolve(projectRoot || process.cwd()), 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^﻿/, ''));
    const buckets = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies];
    for (const b of buckets) {
      if (b && typeof b === 'object' && b.react) return { isReact: true, react: b.react };
    }
    return { isReact: false };
  } catch {
    return { isReact: false };
  }
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
// Invoke npx through a shell: on Windows npx is a `.cmd` shim that spawnSync can't launch
// reliably with shell:false, so we pass a single command string with shell:true (cmd.exe on
// Windows, /bin/sh on POSIX). Args are controlled flags/idents/refs; whitespace ones are quoted.
function runNpx(args, opts = {}) {
  const cmdline = 'npx ' + args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  const r = spawnSync(cmdline, {
    encoding: 'utf8',
    timeout: opts.timeout || 300000,
    cwd: opts.cwd,
    windowsHide: true,
    shell: true,
    maxBuffer: 32 * 1024 * 1024, // JSON reports can be large
    env: { ...process.env, NO_COLOR: '1', ...(opts.env || {}) },
  });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}
function npxAvailable() {
  return runNpx(['--version'], { timeout: 30000 }).ok;
}

// Pull the first well-formed JSON object out of stdout (npx/tool banners can leak a line).
function extractJson(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) return null;
  const slice = stdout.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    // last resort: trim to the final closing brace
    const end = slice.lastIndexOf('}');
    if (end > 0) {
      try { return JSON.parse(slice.slice(0, end + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Normalize + render
// ---------------------------------------------------------------------------
const SEV_ORDER = { error: 0, warning: 1, info: 2 };
function normalize(report) {
  const diags = Array.isArray(report && report.diagnostics) ? report.diagnostics : [];
  return diags.map((d) => ({
    category: d.category || '',
    severity: d.severity || 'warning',
    rule: d.rule || d.id || '',
    file: d.normalizedFilePath || d.filePath || '',
    line: d.line || null,
    message: (d.message || '').replace(/\s+/g, ' ').trim(),
  })).sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
}

function render(result, cfg) {
  if (!result.available) {
    return `[react-doctor] unavailable (${result.reason}) — skipped, pipeline continues.\n`;
  }
  const diags = result.diagnostics;
  const errors = diags.filter((d) => d.severity === 'error');
  const warnings = diags.filter((d) => d.severity !== 'error');
  const scopeNote = `scope: ${result.scope}${result.base ? ` vs ${result.base}` : ''}${result.scopeFallback ? ' (fell back to full — no git base)' : ''}`;
  const lines = [];
  lines.push(`[react-doctor] React health on the diff — ${errors.length} error(s), ${warnings.length} warning(s) (${scopeNote}, local-only).`);
  const fmt = (d) => `- ${d.file}${d.line ? `:${d.line}` : ''} [${d.category}/${d.rule}] ${d.message}`;
  if (errors.length) {
    lines.push(`Errors (fix required):`);
    errors.forEach((d) => lines.push(fmt(d)));
  }
  if (warnings.length) {
    lines.push(`Warnings:`);
    const cap = Math.max(0, cfg.maxWarnings | 0);
    warnings.slice(0, cap).forEach((d) => lines.push(fmt(d)));
    if (warnings.length > cap) lines.push(`(+${warnings.length - cap} more warnings not shown — raise reactDoctor.maxWarnings to see them)`);
  }
  if (!diags.length) lines.push(`No issues in the reviewed scope. Clean.`);
  lines.push(`Fix error-severity findings, then re-scan under the net-positive gate. react-doctor via npx — nothing vendored.`);
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
function scan({ projectRoot, scope, base, blocking, categories, version, force = false } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = readConfig(projectRoot);
  if (!cfg.enabled && !force) return { available: false, reason: 'disabled' };
  if (!detectReact(projectRoot).isReact) return { available: false, reason: 'not-react' };
  if (!npxAvailable()) return { available: false, reason: 'no-npx' };

  scope = scope || cfg.scope;
  base = base !== undefined ? base : cfg.base;
  blocking = blocking || cfg.blocking;
  categories = categories || cfg.categories;
  version = version || cfg.version;

  const build = (useScope) => {
    const a = [`react-doctor@${version}`, '--json', '--no-score', '--no-telemetry', '--yes'];
    if (useScope === 'changed') {
      a.push('--scope', 'changed');
      if (base) a.push('--base', base);
    } else if (useScope === 'full') {
      a.push('--scope', 'full');
    }
    if (blocking) a.push('--blocking', blocking);
    for (const c of (Array.isArray(categories) ? categories : [])) a.push('--category', c);
    return a;
  };

  let usedScope = scope;
  let r = runNpx(['--yes', ...build(scope)], { cwd: projectRoot });
  let report = extractJson(r.stdout);

  // changed-scope needs git; if it errored (bad/missing base ref), fall back to a full scan.
  let scopeFallback = false;
  if (scope === 'changed' && (!report || report.error)) {
    scopeFallback = true;
    usedScope = 'full';
    r = runNpx(['--yes', ...build('full')], { cwd: projectRoot });
    report = extractJson(r.stdout);
  }

  if (!report) {
    return { available: false, reason: 'scan-failed', exitCode: r.status, stderr: (r.stderr || '').slice(0, 400) };
  }
  const diagnostics = normalize(report);
  return {
    available: true,
    ok: r.status === 0,           // react-doctor exits non-zero when blocking findings exist
    exitCode: r.status,
    scope: usedScope,
    base: usedScope === 'changed' ? base : null,
    scopeFallback,
    reactDetected: report.reactDetected,
    summary: report.summary || {},
    diagnostics,
  };
}

module.exports = { readConfig, detectReact, scan, normalize, render };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (n) => argv.includes(n);
  const projectRoot = path.resolve(flag('--project') || process.cwd());

  if (cmd === 'detect') {
    process.stdout.write(JSON.stringify(detectReact(projectRoot)) + '\n');
    process.exit(detectReact(projectRoot).isReact ? 0 : 1);
  } else if (cmd === 'config') {
    process.stdout.write(JSON.stringify(readConfig(projectRoot), null, 2) + '\n');
  } else if (cmd === 'scan' || cmd === 'report') {
    const res = scan({
      projectRoot,
      scope: flag('--scope'),
      base: flag('--base'),
      blocking: flag('--blocking'),
      version: flag('--version'),
      force: has('--force'),
    });
    if (cmd === 'report' || has('--md')) {
      process.stdout.write(render(res, readConfig(projectRoot)));
    } else {
      const { diagnostics, ...meta } = res;
      process.stdout.write(JSON.stringify({ ...meta, count: diagnostics ? diagnostics.length : 0 }, null, 2) + '\n');
    }
  } else {
    process.stderr.write('usage: react-doctor.js <detect|scan|report|config> [--project <dir>] [--scope changed|full] [--base <ref>] [--blocking error|warning|none] [--version <v>] [--md] [--force]\n');
    process.exit(2);
  }
}
