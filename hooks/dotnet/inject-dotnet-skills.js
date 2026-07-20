#!/usr/bin/env node
// Shipwright — inject the dotnet-skills index into .NET sessions and subagents.
//
// Cheap by construction (runs on every SessionStart/SubagentStart, 5s budget):
//   1. gate on detect.js — non-.NET repo => emit nothing, instantly, no spawns;
//   2. .NET repo => rebuild the index from the out-of-repo cache (a handful of small
//      file reads) and inject it, so Claude/subagents know which project-matched skills
//      exist and can Read the relevant SKILL.md on demand.
//
// It NEVER installs or refreshes (that shells out to `dotnet` and blows the 5s budget) —
// acquisition is explicit: shipwright:run's .NET Skills phase, or the command surfaced
// below when the cache is empty. Copies no content: only pointers are injected.
//
// Native Claude emit contract (mirrors inject-code-laws.js): SessionStart accepts raw
// stdout; SubagentStart needs the hookSpecificOutput JSON wrapper or context is dropped.
// Opt out: SHIPWRIGHT_DOTNET_SKILLS=off (independent of the Code Laws switch).
'use strict';

const path = require('path');
const { detectDotnet } = require('./detect.js');
const engine = require('./engine.js');

const event = process.argv[2] || 'SessionStart';

function emit(context) {
  if (event === 'SubagentStart') {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext: context },
    }));
  } else {
    process.stdout.write(context);
  }
}

function main() {
  if (process.env.SHIPWRIGHT_DOTNET_SKILLS === 'off') return emit('');

  const cwd = process.cwd();

  // THE GATE — pure fs, no spawns. Non-.NET repos stop here paying almost nothing.
  if (!detectDotnet(cwd).isDotnet) return emit('');

  const cfg = engine.readConfig(cwd);
  if (!cfg.enabled) return emit('');

  const cacheDir = engine.cacheDirFor(cwd);
  // The exact command to populate/refresh the cache. Always surfaced so both ad-hoc
  // sessions and shipwright:run's .NET Skills phase can trigger acquisition without
  // needing to know the plugin path (CLAUDE_PLUGIN_ROOT is not in the shell env).
  const acquireCmd = `node "${path.join(__dirname, 'engine.js')}" acquire --project "${cwd}"`;

  // Rebuild from cache (deterministic, ~a few small reads). Empty string when nothing cached yet.
  let index = '';
  try {
    index = engine.renderIndex(engine.buildIndex(cacheDir, { only: cfg.only, exclude: cfg.exclude }), cacheDir);
  } catch {
    index = '';
  }

  if (index && index.trim()) {
    index += engine.isFresh(cacheDir, cfg.refreshDays)
      ? `[dotnet-skills] refresh this list: ${acquireCmd}\n`
      : `[dotnet-skills] this list may be stale — refresh: ${acquireCmd}\n`;
    return emit(index);
  }

  // .NET detected but nothing cached yet — surface availability + how to populate, cheaply.
  return emit(
    `[dotnet-skills] .NET project detected — project-matched skills from managedcode/dotnet-skills ` +
    `are available but not cached yet.\n` +
    `Populate on demand (installs the tool if needed, writes to an out-of-repo cache): ${acquireCmd}\n` +
    `shipwright:run does this automatically in its .NET Skills phase.\n`
  );
}

try {
  main();
} catch {
  emit(''); // best-effort — a hook must never block or crash the session
}
