# RCA: TypeScript Cannot Find Name Error

**Error Type:** typescript
**Severity:** High
**Date:** 2025-01-15
**Reported By:** Frontend Team

## Error Description

TypeScript compiler fails with "Cannot find name" error when trying to use a variable, type, or function that the compiler doesn't recognize.

### Common Error Messages
- `error TS2304: Cannot find name 'React'`
- `error TS2304: Cannot find name 'process'`
- `error TS2304: Cannot find name 'describe'` (test frameworks)
- `error TS2304: Cannot find name 'jQuery'` or `Cannot find name '$'`

## Root Cause

This error occurs when:
1. **Missing type definitions** - Package doesn't include TypeScript types
2. **Missing import** - Variable/type used without importing
3. **Wrong tsconfig.json** - Incorrect compiler options or lib settings
4. **Global types not configured** - Missing ambient declarations
5. **Test framework types missing** - Jest, Mocha types not installed

## Solution

### Step 1: Install Type Definitions

For packages without built-in types:

```bash
# React
npm install --save-dev @types/react @types/react-dom

# Node.js
npm install --save-dev @types/node

# Jest
npm install --save-dev @types/jest

# Express
npm install --save-dev @types/express

# jQuery
npm install --save-dev @types/jquery
```

### Step 2: Add Missing Imports

```typescript
// ❌ Wrong - using without import
function MyComponent() {
  return <div>Hello</div>;
}

// ✅ Correct - import React
import React from 'react';

function MyComponent() {
  return <div>Hello</div>;
}
```

### Step 3: Configure tsconfig.json

Ensure proper lib and types configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "types": ["node", "jest"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Step 4: Add Global Type Declarations

Create `global.d.ts` or `types.d.ts`:

```typescript
// For global variables
declare const process: {
  env: {
    NODE_ENV: string;
    [key: string]: string | undefined;
  };
};

// For modules without types
declare module 'some-package-without-types' {
  export function someFunction(): void;
}

// For global jQuery
declare const $: any;
declare const jQuery: any;
```

### Step 5: Fix Test Framework Types

For Jest/Mocha tests:

```bash
# Install types
npm install --save-dev @types/jest

# Update tsconfig.json
{
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

## Common Scenarios

### Scenario 1: process.env not found

```typescript
// Solution 1: Install @types/node
npm install --save-dev @types/node

// Solution 2: Add to global.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    API_URL: string;
  }
}
```

### Scenario 2: React JSX not recognized

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",  // or "react" for older React
    "lib": ["ES2020", "DOM"]
  }
}
```

### Scenario 3: Cannot find describe/it/test

```bash
# Install Jest types
npm install --save-dev @types/jest

# Or for Mocha
npm install --save-dev @types/mocha

# Update tsconfig.json
{
  "compilerOptions": {
    "types": ["jest"]  // or ["mocha"]
  }
}
```

## Prevention

1. **Always install type definitions**:
   ```bash
   # Check if types are needed
   npm install package-name
   # Then check for types
   npm install --save-dev @types/package-name
   ```

2. **Use TypeScript-first packages** when possible

3. **Configure IDE** for better autocomplete:
   - VSCode: Install TypeScript extension
   - Enable "typescript.suggest.autoImports"

4. **Add to package.json scripts**:
   ```json
   {
     "scripts": {
       "type-check": "tsc --noEmit",
       "type-check:watch": "tsc --noEmit --watch"
     }
   }
   ```

5. **Use strict mode** to catch issues early:
   ```json
   {
     "compilerOptions": {
       "strict": true
     }
   }
   ```

## Testing

Verify the fix:

```bash
# Type check without emitting files
npx tsc --noEmit

# Build the project
npm run build

# Run tests
npm test
```

## Quick Fix Checklist

- [ ] Install @types/node: `npm i -D @types/node`
- [ ] Install @types/react: `npm i -D @types/react @types/react-dom`
- [ ] Install @types/jest: `npm i -D @types/jest`
- [ ] Check tsconfig.json has correct "lib" array
- [ ] Check tsconfig.json has correct "types" array
- [ ] Add imports for used variables
- [ ] Create global.d.ts for global types
- [ ] Restart TypeScript server in IDE

## Related Issues

- [RCA: Module Resolution Issues](./module-resolution-rca.md)
- [RCA: TypeScript Configuration](./typescript-config-rca.md)

## Additional Resources

- [TypeScript: Type Declarations](https://www.typescriptlang.org/docs/handbook/2/type-declarations.html)
- [DefinitelyTyped Repository](https://github.com/DefinitelyTyped/DefinitelyTyped)
- [TypeScript Error Reference](https://typescript.tv/errors/)
