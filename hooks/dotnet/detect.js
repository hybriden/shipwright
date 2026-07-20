#!/usr/bin/env node
// Shipwright — near-zero-cost .NET project detector.
// This is THE GATE: every dotnet-skills action is fenced behind it, and it runs on
// every session/subagent start, so it must be effectively free on non-.NET repos.
//   - Pure filesystem. NO process spawns (no `dotnet`, no `git`) — those only run
//     AFTER this returns true, in the acquisition engine.
//   - Bounded shallow scan (depth <= 2), short-circuits on the first marker found.
//   - Hard entry-visit cap so a pathological tree can never turn this into real work.
// A non-.NET repo pays only a couple of readdir() calls and gets nothing injected.
'use strict';

const fs = require('fs');
const path = require('path');

// Root-level fingerprints of a .NET codebase (solutions, SDK pin, MSBuild props).
const MARKER_FILES = new Set([
  'global.json',
  'Directory.Build.props',
  'Directory.Build.targets',
  'Directory.Packages.props',
  'nuget.config',
  'NuGet.config',
]);
// Project files (may sit one or two levels down under src/, apps/, etc.).
const PROJECT_EXTS = new Set(['.sln', '.slnx', '.csproj', '.fsproj', '.vbproj']);
// Directories that never hold the markers but can be huge — never descend into them.
const SKIP_DIRS = new Set([
  'node_modules', 'bin', 'obj', 'dist', 'out', 'packages', 'target',
  'vendor', '.git', '.vs', '.idea', '.svn', '.hg',
]);

const MAX_DEPTH = 2;        // repo root + two levels — covers src/<Project>/<Project>.csproj
const MAX_ENTRIES = 4000;   // absolute ceiling on entries visited; guards against giant trees

function hit(marker, dir) {
  return { isDotnet: true, marker, dir };
}

/**
 * Detect whether `root` looks like a .NET project.
 * Returns { isDotnet, marker, dir } — short-circuits on the first hit.
 * On any fs error the scan degrades quietly (skip the unreadable dir).
 */
function detectDotnet(root) {
  root = root || process.cwd();
  let visited = 0;
  const queue = [[root, 0]]; // BFS so root-level markers (the common case) win first

  while (queue.length) {
    const [dir, depth] = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir — ignore, keep the scan cheap and resilient
    }
    const subdirs = [];
    for (const e of entries) {
      if (++visited > MAX_ENTRIES) return { isDotnet: false, marker: null, capped: true };
      if (e.isFile()) {
        if (MARKER_FILES.has(e.name)) return hit(e.name, dir);
        if (PROJECT_EXTS.has(path.extname(e.name).toLowerCase())) return hit(e.name, dir);
      } else if (
        e.isDirectory() &&
        depth < MAX_DEPTH &&
        !SKIP_DIRS.has(e.name) &&
        !e.name.startsWith('.')
      ) {
        subdirs.push(e.name);
      }
    }
    for (const name of subdirs) queue.push([path.join(dir, name), depth + 1]);
  }
  return { isDotnet: false, marker: null };
}

module.exports = { detectDotnet };

// CLI: `node detect.js [root] [--json]`
// Exit 0 when .NET is detected, 1 otherwise — usable as a plain shell gate.
if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const root = args.find((a) => !a.startsWith('--'));
  const res = detectDotnet(root);
  if (json) process.stdout.write(JSON.stringify(res));
  else if (res.isDotnet) process.stdout.write(`${res.marker}\n`);
  process.exit(res.isDotnet ? 0 : 1);
}
