'use strict';
// Shipwright — skill-pack detector. Runs inside the session/subagent hook, so it stays pure
// filesystem and bounded: a shallow scan (depth <= 2, entry and read caps) collects file and dir
// names, npm dependencies, and text markers from small manifests. No process spawns.

const fs = require('fs');
const path = require('path');
const PACKS = require('./packs.js');

const MAX_DEPTH = 2;
const MAX_ENTRIES = 4000;
const MAX_READS = 40;
const MAX_READ_BYTES = 512 * 1024;
const SKIP_DIRS = new Set(['node_modules', 'bin', 'obj', 'dist', 'out', 'build', 'target', 'vendor', 'coverage', '.next', '.nuxt', '.venv', 'venv', '__pycache__']);

const PY_MANIFEST = /^(requirements.*\.txt|pyproject\.toml|Pipfile|setup\.py|setup\.cfg)$/;
const MANIFEST = /^(requirements.*\.txt|pyproject\.toml|Pipfile|setup\.py|setup\.cfg|go\.mod|pom\.xml|build\.gradle(\.kts)?|Package\.swift|Directory\.Packages\.props|.+\.(cs|fs)proj)$/;
const TEXT_MARKERS = [
  { marker: 'boto3', file: PY_MANIFEST, pattern: /\b(aio)?boto3\b/ },
  { marker: 'aws-sdk', file: MANIFEST, pattern: /\bboto3\b|aws-sdk-go|software\.amazon\.awssdk|com\.amazonaws|AWSSDK\.|aws-sdk-swift/ },
  { marker: 'aws-sdk-swift', file: /^Package\.swift$/, pattern: /aws-sdk-swift/ },
  { marker: 'aws-cdk', file: MANIFEST, pattern: /aws-cdk-lib|Amazon\.CDK|software\.amazon\.awscdk|aws-cdk-go/ },
  { marker: 'aws-lambda', file: MANIFEST, pattern: /aws-lambda-powertools|Amazon\.Lambda|aws-lambda-go|aws-lambda-java/ },
  { marker: 'cloudformation', file: /^template\.(ya?ml|json)$/, pattern: /AWSTemplateFormatVersion|AWS::[A-Za-z]+::/ },
  { marker: 'terraform-aws', file: /\.tf$/, pattern: /hashicorp\/aws|provider\s+"aws"/ },
  { marker: 'terraform-cloudflare', file: /\.tf$/, pattern: /cloudflare\/cloudflare|provider\s+"cloudflare"/ },
];

function scanFacts(root) {
  const facts = { deps: new Set(), files: new Set(), dirs: new Set(), text: new Set() };
  let visited = 0;
  let reads = 0;
  const read = (file) => {
    try {
      if (reads >= MAX_READS || fs.statSync(file).size > MAX_READ_BYTES) return null;
      reads++;
      return fs.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  };

  const queue = [[path.resolve(root), 0]];
  while (queue.length) {
    const [dir, depth] = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++visited > MAX_ENTRIES) return facts;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        facts.dirs.add(e.name);
        if (depth < MAX_DEPTH && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) queue.push([full, depth + 1]);
        continue;
      }
      if (!e.isFile()) continue;
      facts.files.add(e.name);
      if (e.name === 'package.json') {
        try {
          const pkg = JSON.parse((read(full) || '').replace(/^\uFEFF/, ''));
          for (const bucket of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
            Object.keys(bucket || {}).forEach((d) => facts.deps.add(d));
          }
        } catch { /* unreadable package.json carries no signal */ }
      }
      const pending = TEXT_MARKERS.filter((t) => t.file.test(e.name) && !facts.text.has(t.marker));
      if (pending.length) {
        const text = read(full);
        if (text) pending.filter((t) => t.pattern.test(text)).forEach((t) => facts.text.add(t.marker));
      }
    }
  }
  return facts;
}

function hit(signal, facts) {
  const sep = signal.indexOf(':');
  const set = facts[{ dep: 'deps', file: 'files', dir: 'dirs', text: 'text' }[signal.slice(0, sep)]];
  const value = signal.slice(sep + 1);
  if (!set) return false;
  if (!value.endsWith('*')) return set.has(value);
  const prefix = value.slice(0, -1);
  return [...set].some((v) => v.startsWith(prefix));
}

function detectPacks(facts) {
  return PACKS
    .map((pack) => ({ pack, reasons: pack.detect.filter((s) => hit(s, facts)) }))
    .filter((d) => d.reasons.length);
}

// A pack requested without repo signals (greenfield) can't match dependency rules yet, so its gated skills show.
function isIndexed(pack, skillName, facts, requested) {
  const rule = pack.skills[skillName];
  if (rule === undefined) return pack.indexUnlisted;
  if (typeof rule === 'boolean') return rule;
  return requested || rule.some((s) => hit(s, facts));
}

module.exports = { scanFacts, detectPacks, isIndexed };
