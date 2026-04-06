# Advanced Debugging Techniques

Specialized debugging strategies for complex error categories. Load this reference when the error category (from Phase 0 Triage) matches one of the patterns below.

### Concurrency Debugging (Race Conditions, Flaky Tests)

**Symptoms:** Test passes sometimes, fails sometimes. Or fails only when run with other tests but passes in isolation.

**Investigation:**

1. **Shared mutable state:** Look for global variables, singletons, module-level caches, or database state that isn't reset between tests
2. **Timing dependencies:** Look for `setTimeout`, `setInterval`, unresolved promises, or missing `await`
3. **Resource contention:** Look for tests that use the same port, file, or database table
4. **Order dependency:** Run the failing test in isolation. If it passes alone, another test is leaking state

**Techniques:**
- Run the test suite with `--randomize` or `--shuffle` flag to expose order dependencies
- Add `beforeEach`/`afterEach` cleanup to reset shared state
- For async issues: check every `async` function has a matching `await` at the call site
- For timer issues: use fake timers (`jest.useFakeTimers()`, `sinon.useFakeTimers()`)
- For promise issues: look for fire-and-forget promises (missing `await` or `.catch`)

**Root cause pattern:** "Test A mutates [shared resource] and test B reads it without reset."

### Timeout and Hang Debugging

**Symptoms:** Process hangs, test times out, command never completes.

**Investigation:**

1. **Identify what's blocking:**
   - Unresolved promise? Missing callback? Deadlocked async operation?
   - Waiting for network that will never respond? (Missing mock, wrong URL, service down)
   - Infinite loop? (Add a counter log to suspect loops)
   - Waiting for stdin/user input? (Process expects interaction that isn't coming)

2. **Narrowing technique:**
   - Add timeout logging: log a message before and after each suspect async operation
   - The last "before" log without a matching "after" is the hang point
   - For Node.js: use `--inspect` flag and check for pending async operations
   - For tests: reduce the timeout to fail fast (`jest --testTimeout=5000`)

3. **Common causes:**
   | Hang Pattern | Cause | Fix |
   |-------------|-------|-----|
   | Test hangs after all assertions pass | Open handle (server, DB connection, timer) | Close/dispose in `afterAll` |
   | Hangs on import | Circular dependency with side effects | Break the circular import |
   | Hangs on network call | No mock, real service not running | Add mock or start service |
   | Hangs intermittently | Race condition in async setup | Add proper await/synchronization |

### Dependency Conflict Resolution

**Symptoms:** `peer dep` warnings, version mismatch errors, `Cannot find module`, or subtle runtime errors after `npm install`.

**Investigation:**

1. **Check the dependency tree:**
   ```bash
   npm ls <package-name>        # Show all versions of a specific package
   npm ls --all | grep "WARN"   # Find peer dep warnings
   ```
2. **Check for version conflicts:**
   - Two packages requiring incompatible versions of the same dependency
   - A package using `require()` expecting CJS but getting ESM (or vice versa)
   - Lock file drift: `package-lock.json` doesn't match `package.json`

3. **Resolution strategies:**
   | Conflict Type | Fix |
   |--------------|-----|
   | Peer dep mismatch | Align to the version range that satisfies both peers |
   | Duplicate packages | Add `overrides` (npm) or `resolutions` (yarn) in package.json |
   | CJS/ESM mismatch | Check the package's `exports` field, use correct import syntax |
   | Lock file drift | Delete lock file + `node_modules`, reinstall from scratch |
   | Type version mismatch | Align `@types/` package version with the runtime package version |

### Environment Fingerprinting

**Symptoms:** "Works on my machine" or "Works locally but fails in CI" or "Worked yesterday."

**Capture this environment fingerprint when the error seems environment-related:**

```bash
# Runtime versions
node --version && npm --version       # Node.js
python --version && pip --version     # Python
go version                            # Go
rustc --version && cargo --version    # Rust

# OS and shell
uname -a || ver                       # OS info
echo $SHELL $BASH_VERSION             # Shell info

# Key env vars (DO NOT log secrets)
env | grep -E '^(NODE_ENV|PATH|HOME|CI|DATABASE_URL|PORT)='

# Disk and memory
df -h . && free -h                    # Space and memory (Linux)

# Package state
npm ls --depth=0 2>&1 | head -30     # Installed packages
```

**Compare fingerprints** between the working and broken environments. Differences in versions, env vars, or paths are likely the cause.

**Common environment causes:**
- `NODE_ENV=production` vs `development` (changes which dependencies load)
- Different Node/Python versions (syntax or API differences)
- Missing env vars (`.env` file not copied, secret not set in CI)
- Different OS (path separators, case sensitivity, line endings)
- Stale `node_modules` (delete and reinstall)

### Error Message Decoding

Don't take error messages at face value. Common misreadings:

| Error Says | Often Actually Means |
|-----------|---------------------|
| `Cannot find module 'X'` | X exists but has a broken export, or a transitive dep is missing |
| `X is not a function` | X was imported but is `undefined` — check the export name |
| `Maximum call stack exceeded` | Infinite recursion, often from circular references |
| `ECONNREFUSED 127.0.0.1:3000` | The server isn't running, not a network issue |
| `Unexpected token '<'` | Server returned HTML (error page) instead of JSON |
| `Cannot read property 'X' of undefined` | The PARENT object is undefined — investigate one level up |
| `EPERM: operation not permitted` | File is locked by another process, or antivirus blocking |
| `ERR_MODULE_NOT_FOUND` | ESM/CJS mismatch — file exists but wrong module system |
| `Jest encountered an unexpected token` | Missing transform for file type (JSX, TS, ESM) |
| `ENOMEM` | Not always out of memory — can be too many open files or processes |
