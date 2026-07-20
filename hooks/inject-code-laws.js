#!/usr/bin/env node
// Shipwright — inject the always-on Code Laws into every session and subagent.
// Native Claude: SessionStart accepts raw stdout; SubagentStart needs the
// hookSpecificOutput JSON form or the context is dropped.
// Opt out: set SHIPWRIGHT_CODE_LAWS=off
const fs = require('fs');
const path = require('path');

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

if (process.env.SHIPWRIGHT_CODE_LAWS === 'off') {
  emit('');
  process.exit(0);
}

try {
  // Strip a UTF-8 BOM some editors prepend on Windows (breaks downstream parsing).
  const laws = fs.readFileSync(path.join(__dirname, 'code-laws.md'), 'utf8').replace(/^﻿/, '');
  emit(laws);
} catch (e) {
  emit(''); // best-effort — a missing file must never block the session
}
