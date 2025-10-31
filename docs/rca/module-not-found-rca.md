# RCA: Module Not Found Error

**Error Type:** runtime
**Severity:** High
**Date:** 2025-01-15
**Reported By:** Development Team

## Error Description

Application crashes with `Error: Cannot find module` when trying to import or require a package that doesn't exist in `node_modules`.

### Common Error Messages
- `Error: Cannot find module 'package-name'`
- `Cannot find module 'package-name' from 'file.js'`
- `Module not found: Error: Can't resolve 'package-name'`

## Root Cause

This error occurs when:
1. **Dependencies not installed** - `node_modules` directory is missing or incomplete
2. **Package not added to package.json** - Module was never added as a dependency
3. **Wrong import path** - Typo in the module name or incorrect relative path
4. **Different environment** - Code works locally but fails in CI/production
5. **Cache issues** - npm cache corruption or lock file mismatch

## Solution

Follow these steps to resolve the module not found error:

### Step 1: Install Dependencies

```bash
# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Clean npm cache
npm cache clean --force

# Reinstall all dependencies
npm install
```

### Step 2: Add Missing Package

If the module is genuinely missing from package.json:

```bash
# For runtime dependencies
npm install package-name --save

# For dev dependencies
npm install package-name --save-dev
```

### Step 3: Verify Import Path

Check your import statement:

```javascript
// ✅ Correct - package name
const express = require('express');

// ✅ Correct - relative path
const utils = require('./utils');

// ❌ Wrong - typo
const expres = require('expres');

// ❌ Wrong - missing ./
const utils = require('utils'); // Should be './utils'
```

### Step 4: Check Node Version

Some packages require specific Node.js versions:

```bash
# Check your Node version
node --version

# Check required version in package.json
cat package.json | grep "engines"

# Use nvm to switch versions if needed
nvm use 18
npm install
```

## Prevention

To prevent this error in the future:

1. **Always commit package-lock.json** - Ensures consistent dependencies across environments
2. **Use npm ci in CI/CD** - Faster and more reliable than npm install
3. **Document Node version** - Add "engines" field to package.json:
   ```json
   {
     "engines": {
       "node": ">=18.0.0",
       "npm": ">=9.0.0"
     }
   }
   ```
4. **Use path aliases** - Configure path mapping in tsconfig.json/jsconfig.json
5. **Add .nvmrc file** - Specify Node version in project root:
   ```
   18.17.0
   ```

## Testing

After applying the fix, verify with:

```bash
# Clear everything and reinstall
npm run clean  # or: rm -rf node_modules package-lock.json
npm install

# Run your application
npm start

# Run tests
npm test
```

## Related Issues

- [Issue #123] Module not found in Docker builds
- [Issue #456] Cannot find module after npm upgrade
- [RCA: npm Cache Issues](./npm-cache-rca.md)

## Additional Resources

- [npm Documentation: npm-install](https://docs.npmjs.com/cli/v9/commands/npm-install)
- [Node.js Module System](https://nodejs.org/api/modules.html)
- [Debugging Module Resolution](https://nodejs.org/api/modules.html#all-together)
