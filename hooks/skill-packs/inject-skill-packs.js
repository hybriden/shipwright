#!/usr/bin/env node
// Shipwright — inject the skill-pack index into sessions and subagents.
// Cheap by construction (5s hook budget): a bounded fs scan picks the packs the repo needs and the
// index is rendered from cached catalogs. It never fetches — that spawns npx; acquisition is run's
// Stack Skills phase or the command the index surfaces. Opt out: SHIPWRIGHT_SKILL_PACKS=off.
'use strict';

const { emit } = require('../lib/common.js');

const event = process.argv[2] || 'SessionStart';

try {
  emit(event, require('./engine.js').renderIndex(process.cwd(), { event }));
} catch {
  emit(event, ''); // a hook must never block or crash the session
}
