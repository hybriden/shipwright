#!/usr/bin/env node
// Shipwright — Oxlint/Oxfmt compatibility check for JS/TS projects.
//
// Shipwright prefers Oxlint + Oxfmt to ESLint + Prettier for speed, but only where the switch keeps
// behavior. This gathers the evidence without changing the project:
//   lint   — @oxlint/migrate converts the ESLint flat config and lists the rules it skipped; Oxlint
//            then runs that config (proving it loads, JS plugins included) and its findings are
//            compared with ESLint's on the same tree, timing both.
//   format — `oxfmt --migrate=prettier` converts the Prettier config and names unsupported plugins
//            and options; files Oxfmt would reformat that Prettier leaves alone are output drift.
// Generated configs exist only while the check runs. Tools come via npx; nothing is vendored.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const common = require('../lib/common.js');

const CONFIG_DEFAULTS = {
  enabled: true,           // master switch
  parity: true,            // also run ESLint/Prettier and compare their results with Oxlint/Oxfmt
  oxlintVersion: 'latest', // oxlint and @oxlint/migrate release together
  oxfmtVersion: 'latest',
};
const CACHE_DAYS = 7;
const PARITY_TIMEOUT = 600000;

const ESLINT_FLAT = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'];
const ESLINT_LEGACY = ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];
const PRETTIER_CONFIGS = ['.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yml', '.prettierrc.yaml', '.prettierrc.toml', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.ts', '.prettierrc.cts', '.prettierrc.mts', 'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs', 'prettier.config.ts', 'prettier.config.cts', 'prettier.config.mts'];
const OXLINT_CONFIGS = ['.oxlintrc.json', 'oxlint.config.ts'];
const OXFMT_CONFIGS = ['.oxfmtrc.json', '.oxfmtrc.jsonc', 'oxfmt.config.ts', 'oxfmt.config.mts'];
const BIOME_CONFIGS = ['biome.json', 'biome.jsonc'];
const VERDICT_INPUTS = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', '.gitignore', '.eslintignore', '.prettierignore'];
// Rules skipped because strict mode / ESM already forbids what they check cost nothing.
const HARMLESS_SKIP = /superseded|deprecated/i;

function inspect(root) {
  let pkg;
  try {
    pkg = common.readJson(path.join(root, 'package.json'));
  } catch {
    return null;
  }
  const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  const present = (names) => names.find((n) => fs.existsSync(path.join(root, n)));
  return {
    eslint: deps.has('eslint'),
    eslintFlat: present(ESLINT_FLAT),
    eslintLegacy: present(ESLINT_LEGACY) || (pkg.eslintConfig ? 'package.json#eslintConfig' : undefined),
    typeAware: deps.has('typescript-eslint') || deps.has('@typescript-eslint/eslint-plugin'),
    prettier: deps.has('prettier'),
    prettierConfig: present(PRETTIER_CONFIGS),
    oxlint: deps.has('oxlint') || Boolean(present(OXLINT_CONFIGS)),
    oxfmt: deps.has('oxfmt') || Boolean(present(OXFMT_CONFIGS)),
    biome: deps.has('@biomejs/biome') || Boolean(present(BIOME_CONFIGS)),
  };
}

// Runs fn while the tools may write these files at the project root, then deletes the ones that weren't there before.
function withGenerated(root, names, fn) {
  const created = names.map((n) => path.join(root, n)).filter((f) => !fs.existsSync(f));
  try {
    return fn();
  } finally {
    created.forEach((f) => fs.rmSync(f, { force: true }));
  }
}

function firstJson(stdout) {
  const start = stdout.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return null;
  }
}

const outputLines = (text) => common.stripAnsi(text).split(/\r?\n/).map((l) => l.trim().replace(/\\/g, '/')).filter(Boolean);
const tail = (r) => common.stripAnsi(r.stderr || r.stdout).trim().slice(-300);
const relative = (root, file) => path.relative(root, file).replace(/\\/g, '/');

// @oxlint/migrate --details prints "Skipped N rules:" then "- <count> <group>" headers with "- <rule>[: reason]" items.
function parseSkipped(stdout) {
  const groups = {};
  let group = null;
  let inBlock = false;
  for (const line of common.stripAnsi(stdout).split(/\r?\n/)) {
    if (/Skipped \d+ rules?:/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    let m;
    if ((m = line.match(/^\s*- \d+ (.+?)\s*$/))) {
      group = m[1];
      groups[group] = [];
    } else if (group && (m = line.match(/^\s*- (.+?)\s*$/))) {
      groups[group].push(m[1]);
    } else if (line.trim()) {
      inBlock = false;
    }
  }
  return groups;
}

// ESLint "react-hooks/rules-of-hooks" and Oxlint "react(rules-of-hooks)" name the same rule.
const localRule = (id) => (id || 'parse-error').replace(/^.*[/(]/, '').replace(/\)$/, '');

function countFindings(pairs) {
  const counts = new Map();
  for (const [file, rule] of pairs) {
    const key = `${file} ${localRule(rule)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function compareFindings(eslint, oxlint) {
  const surplus = (a, b) => [...a].flatMap(([key, n]) => (n > (b.get(key) || 0) ? [`${key} ×${n - (b.get(key) || 0)}`] : []));
  const total = (m) => [...m.values()].reduce((sum, n) => sum + n, 0);
  return { eslint: total(eslint), oxlint: total(oxlint), missed: surplus(eslint, oxlint), extra: surplus(oxlint, eslint).length };
}

function checkLint(root, info, cfg) {
  if (info.oxlint) return { verdict: info.eslint ? 'COEXISTING' : 'ADOPTED' };
  if (!info.eslint) return info.biome ? { verdict: 'NOT_APPLICABLE', note: 'Biome already lints at native speed' } : { verdict: 'GREENFIELD' };
  if (!info.eslintFlat) {
    return info.eslintLegacy
      ? { verdict: 'NEEDS_FLAT_CONFIG', note: `@oxlint/migrate reads only ESLint flat config — convert first: npx @eslint/migrate-config ${info.eslintLegacy}` }
      : { verdict: 'UNKNOWN', reason: 'eslint is installed but no config file was found' };
  }
  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    return { verdict: 'UNKNOWN', reason: 'dependencies not installed — the ESLint config imports its plugins' };
  }

  return withGenerated(root, ['.oxlintrc.json', '.oxlintrc.json.bak'], () => {
    const migrate = common.runNpx(['--yes', '--', `@oxlint/migrate@${cfg.oxlintVersion}`, info.eslintFlat, '--details', ...(info.typeAware ? ['--type-aware'] : [])], { cwd: root });
    if (!migrate.ok) return { verdict: 'UNKNOWN', reason: 'config migration failed', detail: tail(migrate) };
    const gaps = Object.entries(parseSkipped(migrate.stdout))
      .flatMap(([group, rules]) => rules.filter((r) => !HARMLESS_SKIP.test(r)).map((r) => `${r} (${group})`));
    let jsPlugins = [];
    try {
      jsPlugins = common.readJson(path.join(root, '.oxlintrc.json')).jsPlugins || [];
    } catch { /* migrate wrote no config */ }

    const lintArgs = info.typeAware
      ? ['--yes', '-p', `oxlint@${cfg.oxlintVersion}`, '-p', 'oxlint-tsgolint', '--', 'oxlint', '--type-aware', '--format', 'json']
      : ['--yes', '--', `oxlint@${cfg.oxlintVersion}`, '--format', 'json'];
    common.runNpx(lintArgs, { cwd: root }); // the first run downloads the package; time the second
    const oxlint = common.runNpx(lintArgs, { cwd: root, timeout: PARITY_TIMEOUT });
    const oxReport = firstJson(oxlint.stdout);
    if (!oxReport || !Array.isArray(oxReport.diagnostics)) {
      return { verdict: 'UNKNOWN', reason: 'oxlint could not run the migrated config', detail: tail(oxlint), gaps };
    }

    const result = { gaps, jsPlugins, oxlintMs: oxlint.ms };
    if (cfg.parity) {
      const eslint = common.runNpx(['--no', '--', 'eslint', '--format', 'json', '.'], { cwd: root, timeout: PARITY_TIMEOUT });
      const esReport = firstJson(eslint.stdout);
      if (Array.isArray(esReport)) {
        result.parity = compareFindings(
          countFindings(esReport.flatMap((f) => f.messages.map((m) => [relative(root, f.filePath), m.ruleId]))),
          countFindings(oxReport.diagnostics.map((d) => [String(d.filename).replace(/\\/g, '/'), d.code])),
        );
        result.eslintMs = eslint.ms;
      } else {
        result.parityError = tail(eslint);
      }
    }
    result.verdict = !gaps.length && !(result.parity?.missed.length) ? 'COMPATIBLE' : 'PARTIAL';
    return result;
  });
}

function checkFormat(root, info, cfg) {
  if (info.oxfmt) return { verdict: info.prettier ? 'COEXISTING' : 'ADOPTED' };
  if (!info.prettier) return info.biome ? { verdict: 'NOT_APPLICABLE', note: 'Biome already formats at native speed' } : { verdict: 'GREENFIELD' };

  return withGenerated(root, ['.oxfmtrc.json'], () => {
    const migrate = common.runNpx(['--yes', '--', `oxfmt@${cfg.oxfmtVersion}`, '--migrate=prettier'], { cwd: root });
    if (!migrate.ok) return { verdict: 'UNKNOWN', reason: 'config migration failed', detail: tail(migrate) };
    const unsupported = outputLines(`${migrate.stdout}\n${migrate.stderr}`)
      .filter((l) => l.startsWith('- ') && /not supported|cannot be (auto-)?migrated|manual/i.test(l))
      .map((l) => l.slice(2).replace(/,?\s*skipping\.*$/i, ''));

    const oxfmt = common.runNpx(['--yes', '--', `oxfmt@${cfg.oxfmtVersion}`, '--list-different'], { cwd: root, timeout: PARITY_TIMEOUT });
    const reformatted = outputLines(oxfmt.stdout).filter((f) => f !== '.oxfmtrc.json');
    const result = { unsupported, oxfmtMs: oxfmt.ms };
    if (cfg.parity) {
      const prettier = common.runNpx(['--no', '--', 'prettier', '--list-different', '.'], { cwd: root, timeout: PARITY_TIMEOUT });
      // Prettier exits 1 when files differ and 2 on errors; npx reports a missing binary on stderr.
      if (prettier.status <= 1 && !/\[error\]|npm (error|ERR!)/i.test(prettier.stderr)) {
        const prettierDiffers = new Set(outputLines(prettier.stdout));
        result.drift = reformatted.filter((f) => !prettierDiffers.has(f));
        result.prettierMs = prettier.ms;
      } else {
        result.parityError = tail(prettier);
      }
    }
    result.verdict = !unsupported.length && !(result.drift?.length) ? 'COMPATIBLE' : 'PARTIAL';
    return result;
  });
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
// Under a few seconds npx startup dominates both timings, so a comparison would mislead.
const speedup = (slowName, slowMs, fastName, fastMs) => (slowMs >= 3000 && fastMs ? ` (${slowName} ${seconds(slowMs)} → ${fastName} ${seconds(fastMs)}, incl. npx startup)` : '');

function recommend({ lint, format }) {
  const out = [];
  if (lint.verdict === 'COMPATIBLE') {
    out.push(`Lint: Oxlint can replace ESLint${lint.parity ? ' with the same findings on this codebase' : ' (every rule migrates; findings not compared)'}${speedup('ESLint', lint.eslintMs, 'Oxlint', lint.oxlintMs)} — migrate with the oxc pack's migrate-oxlint skill.`);
  } else if (lint.verdict === 'PARTIAL') {
    const leftovers = [...lint.gaps, ...(lint.parity?.missed || [])];
    out.push(`Lint: run Oxlint first${speedup('ESLint', lint.eslintMs, 'Oxlint', lint.oxlintMs)} and keep ESLint (with eslint-plugin-oxlint) only for: ${leftovers.slice(0, 8).join('; ')}${leftovers.length > 8 ? ` (+${leftovers.length - 8} more)` : ''}.`);
  } else if (lint.verdict === 'NEEDS_FLAT_CONFIG') {
    out.push(`Lint: ${lint.note}, then re-check.`);
  } else if (lint.verdict === 'GREENFIELD') {
    out.push('Lint: no linter — choose Oxlint when a task sets one up.');
  }
  if (format.verdict === 'COMPATIBLE') {
    out.push(`Format: Oxfmt can replace Prettier${format.drift ? ' with identical output on this codebase' : ' (config migrates cleanly; output not compared)'}${speedup('Prettier', format.prettierMs, 'Oxfmt', format.oxfmtMs)} — migrate with the oxc pack's migrate-oxfmt skill.`);
  } else if (format.verdict === 'PARTIAL') {
    const reasons = [...format.unsupported, ...(format.drift?.length ? [`${format.drift.length} file(s) format differently: ${format.drift.slice(0, 5).join(', ')}`] : [])];
    out.push(`Format: keep Prettier unless a reformat or a lost plugin is acceptable — ${reasons.join('; ')}.`);
  } else if (format.verdict === 'GREENFIELD') {
    out.push('Format: no formatter — choose Oxfmt when a task sets one up.');
  }
  return out;
}

function inputsKey(root, info, cfg) {
  const hash = crypto.createHash('sha256').update(JSON.stringify([cfg.parity, cfg.oxlintVersion, cfg.oxfmtVersion]));
  for (const name of [...VERDICT_INPUTS, info.eslintFlat, info.eslintLegacy, info.prettierConfig].filter(Boolean)) {
    try {
      hash.update(name).update(fs.readFileSync(path.join(root, name)));
    } catch { /* absent input */ }
  }
  return hash.digest('hex');
}

function check({ projectRoot, fresh = false } = {}) {
  projectRoot = path.resolve(projectRoot || process.cwd());
  const cfg = common.readConfig(projectRoot, 'oxc', CONFIG_DEFAULTS);
  if (!cfg.enabled) return { applicable: false, reason: 'disabled' };
  const info = inspect(projectRoot);
  if (!info) return { applicable: false, reason: 'no package.json' };

  // A verdict holds while dependencies, lockfile, ignore files, and lint/format configs are byte-identical.
  const key = inputsKey(projectRoot, info, cfg);
  const cacheFile = common.cacheRoot('oxc-compat', `${common.projectHash(projectRoot)}.json`);
  if (!fresh) {
    try {
      const cached = common.readJson(cacheFile);
      if (cached.key === key && Date.now() - Date.parse(cached.checkedAt) < CACHE_DAYS * 86400000) return { ...cached.result, cached: true };
    } catch { /* no usable cache */ }
  }

  const result = { applicable: true, lint: checkLint(projectRoot, info, cfg), format: checkFormat(projectRoot, info, cfg) };
  result.recommendations = recommend(result);
  if (result.lint.verdict !== 'UNKNOWN' && result.format.verdict !== 'UNKNOWN') {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ key, checkedAt: new Date().toISOString(), result }, null, 2));
  }
  return result;
}

function render(result) {
  if (!result.applicable) return `[oxc] not applicable (${result.reason}).\n`;
  const describe = (kind, r) => {
    const bits = [r.reason, r.note];
    if (r.gaps) bits.push(`${r.gaps.length} ESLint rule(s) not migrated${r.gaps.length ? `: ${r.gaps.slice(0, 6).join(', ')}` : ''}`);
    if (r.jsPlugins?.length) bits.push(`via Oxlint JS plugins: ${r.jsPlugins.join(', ')}`);
    if (r.parity) bits.push(`findings ESLint ${r.parity.eslint} / Oxlint ${r.parity.oxlint}, missed by Oxlint ${r.parity.missed.length}`);
    if (r.unsupported?.length) bits.push(`unsupported: ${r.unsupported.join('; ')}`);
    if (r.drift) bits.push(`${r.drift.length} file(s) format differently than Prettier`);
    if (r.parityError) bits.push(`parity not measured: ${r.parityError}`);
    const detail = bits.filter(Boolean).join('; ');
    return `- ${kind}: ${r.verdict}${detail ? ` — ${detail}` : ''}`;
  };
  return [
    `[oxc] Oxlint/Oxfmt compatibility${result.cached ? ' (cached — --fresh re-checks)' : ''}; project left unchanged:`,
    describe('lint', result.lint),
    describe('format', result.format),
    ...(result.recommendations.length ? ['Recommendations:', ...result.recommendations.map((r) => `- ${r}`)] : []),
    'Policy: skills/_shared/js-toolchain.md — switch tooling only when the task asks for it.',
  ].join('\n') + '\n';
}

module.exports = { check, render, parseSkipped };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--project');
  const projectRoot = path.resolve(i >= 0 ? argv[i + 1] : process.cwd());
  const fresh = argv.includes('--fresh');
  if (argv[0] === 'check') {
    process.stdout.write(`${JSON.stringify(check({ projectRoot, fresh }), null, 2)}\n`);
  } else if (argv[0] === 'report') {
    process.stdout.write(render(check({ projectRoot, fresh })));
  } else {
    process.stderr.write('usage: oxc-compat.js <check|report> [--project <dir>] [--fresh]\n');
    process.exit(2);
  }
}
