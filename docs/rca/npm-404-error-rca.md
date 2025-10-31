# RCA: npm 404 Package Not Found

**Error Type:** npm
**Severity:** Medium
**Date:** 2025-01-15
**Reported By:** DevOps Team

## Error Description

npm fails to install a package with 404 error, indicating the package doesn't exist in the npm registry.

### Common Error Messages
- `npm error code E404`
- `npm error 404 Not Found - GET https://registry.npmjs.org/package-name`
- `npm error 404 'package-name@version' is not in this registry`

## Root Cause

This error occurs when:
1. **Typo in package name** - Package name is misspelled
2. **Package doesn't exist** - Package was never published or has been unpublished
3. **Private package** - Trying to install a private package without authentication
4. **Wrong registry** - Configured to use wrong npm registry
5. **Package scoped incorrectly** - Missing @ prefix for scoped packages

## Solution

### Step 1: Verify Package Name

Double-check the package name on npmjs.com:

```bash
# Search for the package
npm search package-name

# Or visit: https://www.npmjs.com/package/package-name
```

### Step 2: Check Package Spelling

Common typos and corrections:

```bash
# ❌ Wrong
npm install expres
npm install react-route

# ✅ Correct
npm install express
npm install react-router
```

### Step 3: Verify Registry Configuration

Check and reset npm registry:

```bash
# Check current registry
npm config get registry

# Should output: https://registry.npmjs.org/

# Reset to default if wrong
npm config set registry https://registry.npmjs.org/

# Clear cache
npm cache clean --force
```

### Step 4: Handle Private Packages

For private or scoped packages:

```bash
# Login to npm
npm login

# For organization scopes
npm install @organization/package-name

# Configure auth token (if using CI/CD)
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
```

### Step 5: Check Package Version

The specific version might not exist:

```bash
# View all available versions
npm view package-name versions

# Install latest version
npm install package-name@latest

# Install specific major version
npm install package-name@^2.0.0
```

## Prevention

1. **Use exact package names** - Copy from package documentation or npm website
2. **Check package.json** - Review all dependencies before committing:
   ```bash
   npm install --dry-run
   ```
3. **Lock file** - Commit package-lock.json to ensure version consistency
4. **Use npm ci** - In CI/CD to ensure exact dependencies:
   ```json
   {
     "scripts": {
       "ci": "npm ci"
     }
   }
   ```
5. **Registry configuration** - Document registry in .npmrc:
   ```
   registry=https://registry.npmjs.org/
   ```

## Quick Fix Commands

```bash
# Complete reset
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install

# For specific package
npm install package-name@latest --registry https://registry.npmjs.org/
```

## Testing

Verify the fix:

```bash
# Check installed packages
npm list --depth=0

# Verify app starts
npm start

# Run tests
npm test
```

## Related Issues

- [RCA: Module Not Found](./module-not-found-rca.md)
- [RCA: npm Registry Issues](./npm-registry-rca.md)

## Additional Resources

- [npm Error Codes](https://docs.npmjs.com/cli/v9/using-npm/errors)
- [npm Registry Documentation](https://docs.npmjs.com/cli/v9/using-npm/registry)
- [Scoped Packages Guide](https://docs.npmjs.com/cli/v9/using-npm/scope)
