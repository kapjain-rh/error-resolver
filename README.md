# Error Resolver - AI-Powered Terminal Error Analysis

Automatically detect and resolve errors from terminal output with intelligent solutions from multiple sources including AI analysis, code search, RCA documentation, and web search.

## 🎬 Demo

![Error Resolver Demo](demo.mov)

> **Note:** The demo video shows the complete workflow - from error detection to AI-powered resolution with multiple solution sources.
>
> If the video doesn't play, you can also:
> - Download [demo.mov](demo.mov) directly
> - Or view it on the [GitHub repository](https://github.com/kapjain-rh/error-resolver)

## ✨ Features

### 🎯 Multiple Solution Sources
- **🤖 AI-Powered Analysis** - Intelligent error analysis from Gemini AI and Claude AI
- **💻 Code Analysis** - Search your codebase for similar error handling patterns
- **📄 RCA Knowledge Base** - Root Cause Analysis documentation with 95% confidence solutions
- **🌐 Web Search** - Instant Google Search with Gemini AI Overview
- **🔍 Smart Error Detection** - Automatically detect errors across multiple languages

### 🖥️ Monitored Terminal with zsh
- **Real zsh Shell** - Full zsh functionality with all your aliases and configurations
- **Command History** - Navigate with UP/DOWN arrows through your command history
- **Auto Error Detection** - Automatically detects errors as they happen
- **Smart Debouncing** - Groups related errors (500ms) to avoid notification spam
- **Deduplication** - Same error won't notify again for 5 minutes
- **Proper Formatting** - Clean output with proper line handling for npm, git, and build tools

### 🎨 Modern User Interface
- **Card-based Design** - Beautiful, collapsible error cards with smooth animations
- **Color-coded Badges** - Visual indicators for different solution sources
- **Confidence Scores** - See how relevant each solution is (0-100%)
- **Syntax Highlighting** - Code snippets with basic syntax highlighting
- **AI Highlighting** - AI-powered solutions highlighted with purple accent
- **Action Buttons** - Quick actions: Open File, Open Link, Copy Code

### 🌈 Multi-Language Support
- JavaScript/TypeScript (Error, TypeError, ReferenceError, SyntaxError, TS compiler)
- Python (Exceptions, tracebacks)
- Java (Exceptions)
- Go (panic messages)
- npm (npm ERR! messages)
- Compilation errors
- Test failures (FAIL/FAILED patterns)
- And more...

---

## 🚀 Quick Start

### Method 1: Monitored Terminal (Recommended - Auto-Detection)

1. **Create Monitored Terminal**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: "Error Resolver: Create Monitored Terminal"
   - Press Enter

2. **Run commands with errors:**
   ```bash
   $ npm install fake-package
   $ node -e "require('missing-module')"
   $ python3 -c "print(undefined_var)"
   ```

3. **Wait ~0.5 seconds** - Notification appears:
   ```
   ⚠️ Detected 1 error(s) in monitored terminal
   [Analyze] [Ignore]
   ```

4. **Click "Analyze"** - Solutions panel opens instantly!

### Method 2: Manual Analysis (Any Terminal)

1. **Run a command** in any terminal that produces an error
2. **Select and copy** the error output (`Cmd+C` or `Ctrl+C`)
3. **Press `Cmd+Shift+E`** (Mac) or `Ctrl+Shift+E` (Windows/Linux)
4. **View solutions** in the resolution panel!

### Method 3: Paste Error Text

1. Copy error text from anywhere (logs, documentation, Stack Overflow, etc.)
2. Press `Cmd+Shift+P` and type "Error Resolver: Analyze Error Text"
3. Paste the error and press Enter
4. Get instant solutions!

---

## 📋 Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Create Monitored Terminal** | - | Create zsh terminal with auto error detection |
| **Analyze Terminal Output** | `Cmd+Shift+E` / `Ctrl+Shift+E` | Analyze copied error from clipboard |
| **Analyze Error Text** | - | Paste/type error text manually |
| **Toggle Auto-Detection** | - | Pause/resume monitoring in monitored terminals |
| **Clear Notification Cache** | - | Reset error deduplication (for testing) |

---

## 🖥️ Monitored Terminal Features

### What Works
✅ **zsh shell** - Real `/bin/zsh` with all features
✅ **Command history** - UP/DOWN arrow navigation
✅ **`history` command** - View all commands in session
✅ **All zsh features** - Aliases, functions, zsh syntax
✅ **Error detection** - Automatic with 95% RCA confidence
✅ **Proper formatting** - Clean output for npm, git, builds
✅ **Backspace & Ctrl+C** - Full editing support
✅ **Multi-line output** - Handles complex error messages
✅ **Silent commands** - Works with commands that produce no output (cd, export)

### Limitations
❌ **Interactive REPLs** - Python/Node/IRB won't work (use VS Code's built-in terminal)
❌ **Tab completion** - Not available (requires PTY)
❌ **Custom prompts** - Uses simple `$ ` prompt
❌ **Left/right arrows** - Cursor navigation not implemented

### How It Works
- Spawns real zsh process in pipe mode
- Captures stdout and stderr in real-time
- JavaScript-based command history (stored in memory)
- Debounced error detection (500ms after output stops)
- Line buffering handles `\r` correctly for npm/git output
- Fallback timer ensures prompt appears even with no output (300ms)

---

## ⚙️ Configuration

### How to Access Extension Settings

**After installing the extension, you MUST reload VS Code:**

1. Install the VSIX file:
   - `Cmd+Shift+P` → "Extensions: Install from VSIX"
   - Select `error-resolver-<version>.vsix`

2. **Reload VS Code** (Important!):
   - `Cmd+Shift+P` → "Developer: Reload Window"
   - Or close and reopen VS Code

3. Access Settings:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Preferences: Open Settings (UI)"
   - Search for: `@ext:kapjain.error-resolver`
   - OR search for: `kapjain`
   - OR search for: `error-resolver`

4. All settings will appear with "Error Resolver:" prefix

**Troubleshooting:**
- If settings don't appear, uninstall ALL previous versions first:
  - `Cmd+Shift+P` → "Extensions: Show Installed Extensions"
  - Search for "error" and uninstall any "Error Resolver" extensions
  - Then install v1.0.4 and reload

### Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `error-resolver.geminiApiKey` | `""` | Gemini API key (get from aistudio.google.com/app/apikey) |
| `error-resolver.enableGeminiAnalysis` | `false` | Enable Gemini AI-powered analysis |
| `error-resolver.claudeApiKey` | `""` | Claude API key (get from console.anthropic.com) |
| `error-resolver.enableClaudeAnalysis` | `false` | Enable Claude AI-powered analysis |
| `error-resolver.rcaLogPaths` | `[]` | Array of RCA log directory paths |
| `error-resolver.autoDetectErrors` | `true` | Auto-detect errors in monitored terminals |
| `error-resolver.maxResolutionsPerError` | `10` | Maximum solutions to show per error |
| `error-resolver.customPatternFiles` | `[]` | Custom error pattern YAML files |
| `error-resolver.enableBuiltinPatterns` | `true` | Enable built-in error patterns |

### Setting up AI Analysis (Optional)

#### Gemini AI (Recommended - Free for moderate use)

1. Get API key from https://aistudio.google.com/app/apikey
2. Open VS Code Settings (`Cmd/Ctrl + ,`)
3. Search: "Error Resolver: Gemini API Key"
4. Paste your API key
5. Enable: "Error Resolver: Enable Gemini Analysis"
6. ✨ AI solutions appear automatically with 85% confidence!

**Note:** Gemini API is FREE for moderate use - perfect for error analysis!

#### Claude AI (Optional)

1. Get API key from https://console.anthropic.com/
2. Open VS Code Settings
3. Search: "Error Resolver: Claude API Key"
4. Paste your API key
5. Enable: "Error Resolver: Enable Claude Analysis"
6. 🤖 Claude AI solutions appear alongside other sources!

**You can use both AIs together, just one, or neither** - the extension works great with code analysis and RCA logs alone!

### Setting up RCA Knowledge Base (Highly Recommended)

RCA (Root Cause Analysis) documents provide **95% confidence solutions** from your team's knowledge base.

#### Quick Setup:

1. **Create RCA directory** in your workspace:
   ```bash
   mkdir -p docs/rca
   # or: rca/, logs/rca/, .rca/
   ```

2. **Create RCA documents** (Markdown format):

```markdown
# RCA: Module Not Found Error

## Error Description
Node.js cannot find the required module

## Keywords
- Cannot find module
- MODULE_NOT_FOUND
- require() error

## Solution

### Step 1: Install the missing package
```bash
npm install <package-name>
```

### Step 2: Check package.json
Ensure the package is listed in dependencies:
```json
{
  "dependencies": {
    "package-name": "^1.0.0"
  }
}
```

### Step 3: Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

## Prevention
Always run `npm install` after pulling code with updated dependencies.
```

3. **Automatic detection** - The extension:
   - Searches all RCA files when errors are detected
   - Matches based on error keywords
   - Extracts solutions, code snippets, step-by-step instructions
   - Shows them with **high confidence scores** (up to 95%)
   - Displays with **orange RCA badge** in resolution panel

#### Supported File Patterns:
- Files containing: `rca`, `RCA`, `root-cause`, `troubleshoot`, `postmortem`, `incident`
- Formats: `.md`, `.txt`, `.log`, `.json`
- Auto-discovered locations: `docs/rca/`, `rca/`, `logs/rca/`, `.rca/`

#### Example RCA:
See `docs/rca/module-not-found-rca.md` for a complete working example.

---

## 🎨 Resolution Panel UI

### Error Cards
- **Collapsible sections** - Click header to expand/collapse
- **Error icons** - Visual indicators for error types (TypeScript, Python, npm, etc.)
- **Auto-expand first** - First error opens automatically for quick access

### Solution Sources with Color-coded Badges

| Badge | Color | Description | Confidence |
|-------|-------|-------------|------------|
| 🤖 **AI** | Purple border | Gemini/Claude AI analysis | 85% |
| 📋 **RCA** | Orange | RCA documentation | 20-95% |
| 💻 **CODE** | Blue | Codebase analysis | 60-90% |
| 🌐 **WEB** | Green | Web search links | 50-65% |

### Action Buttons
- **Open File** - Jump to file at specific line
- **Open Link** - Open Stack Overflow/GitHub/Docs
- **Copy Code** - Copy solution code to clipboard
- **Search with Gemini** - Open Google with error context

### Confidence Indicators
- Visual progress bars (0-100%)
- Higher confidence = more relevant solution
- RCA solutions often have highest confidence (95%)

---

## 🧪 Testing the Extension

### Test Auto-Detection:

```bash
# 1. Create Monitored Terminal
Cmd+Shift+P → "Error Resolver: Create Monitored Terminal"

# 2. Test various errors:
$ npm install fake-package-12345
$ node -e "require('missing-module')"
$ python3 -c "import fake_module"
$ git clone https://invalid-url.com/repo.git

# 3. Each should trigger notification after ~0.5s
# 4. Click "Analyze" to see solutions
```

### Test Command History:

```bash
$ echo "test 1"
$ echo "test 2"
$ echo "test 3"

# Press UP arrow → shows "test 3"
# Press UP again → shows "test 2"
# Press DOWN → shows "test 3"
# Type: history → shows all commands
```

### Test Manual Analysis:

```bash
# In any terminal (not monitored):
$ npm test

# Copy error output
# Press Cmd+Shift+E
# Solutions panel opens!
```

---

## 🔧 Troubleshooting

### Monitored Terminal Issues

**Terminal hangs after pressing Enter:**
- Fixed with fallback timer (300ms)
- Prompt will always reappear even if command produces no output

**Output formatting looks wrong:**
- Line buffering handles `\r` correctly for npm/git
- If issues persist, reload VS Code: `Cmd+Shift+P` → "Reload Window"

**Can't type in terminal:**
- This is expected while command is executing
- Wait for `$ ` prompt to appear
- If stuck, press Ctrl+C

**Python/Node REPL doesn't work:**
- Interactive REPLs require PTY (not available without node-pty)
- Use VS Code's built-in terminal for Python/Node/IRB
- Use monitored terminal for regular commands

### Error Detection Issues

**Errors not detected:**
- Check Debug Console (View → Output → "Extension Host")
- Look for `[TerminalMonitor]` and `[ErrorResolver]` logs
- Verify monitoring is enabled: Check status bar or run "Toggle Auto-Detection"

**Too many notifications:**
- Deduplication prevents same error for 5 minutes
- Debouncing groups errors within 500ms
- Use "Clear Notification Cache" to reset for testing

**Solutions panel is empty:**
- Check if error pattern is recognized (see Supported Error Types)
- Configure RCA paths if using knowledge base
- Enable AI analysis for more solutions

### RCA Setup Issues

**RCA solutions not appearing:**
1. Check RCA directory exists: `docs/rca/`, `rca/`, or custom path
2. Verify file naming: must contain "rca", "root-cause", etc.
3. Check file format: `.md`, `.txt`, `.log`, `.json`
4. Look for keyword matches in error vs RCA document
5. Check Debug Console for `[RCALogSearcher]` logs

**Low confidence scores:**
- Add more keywords to RCA documents
- Include exact error messages
- Add "Solution" and "Step" sections for higher scores

---

## 🏗️ Architecture

### Core Components

**extension.ts** - Main entry point
- Registers commands and event handlers
- Manages error notification with debouncing (500ms)
- Implements error deduplication cache (5-minute TTL)
- Coordinates between TerminalMonitor, ErrorResolver, ResolutionPanel

**terminalMonitor.ts** - Terminal output capture
- Creates monitored terminals using VS Code Pseudoterminal API
- Spawns real zsh shell (`/bin/zsh`)
- Captures stdout/stderr with proper line buffering
- Implements JavaScript-based command history
- Handles `\r` correctly for npm/git output
- Fallback timer for silent commands (300ms)

**errorResolver.ts** - Error detection and resolution
- Detects errors using regex patterns
- Extracts error context, stack traces, file paths, line numbers
- Coordinates parallel resolution from multiple sources
- Sorts resolutions by confidence score
- Checks AI enablement settings

**claudeAnalyzer.ts** - Claude AI integration
- Uses claude-3-5-sonnet-20241022 model
- Builds structured prompts with error context
- Parses responses into explanation, solution, prevention
- Returns 85% confidence AI resolutions
- Handles API errors gracefully

**codeAnalyzer.ts** - Codebase search
- Searches comments for error keywords
- Finds try-catch blocks with similar errors
- Searches documentation files
- Analyzes specific error locations if file/line available
- Returns 60-90% confidence based on match quality

**rcaLogSearcher.ts** - RCA documentation search
- Auto-discovers RCA locations
- Searches workspace for RCA file patterns
- Calculates relevance scores based on keyword matches
- Extracts solutions with step-by-step instructions
- Returns 20-95% confidence (highest for good matches)

**resolutionPanel.ts** - Modern webview UI
- Card-based design with collapsible sections
- SVG icons for error types and sources
- Color-coded badges (RCA=orange, CODE=blue, WEB=green, AI=purple)
- Confidence bars and syntax highlighting
- Action buttons with hover effects
- Auto-expands first error for better UX

### Data Flow

```
1. User runs command → TerminalMonitor captures output
2. Output received → Debounce 500ms
3. ErrorResolver.detectErrors() → Finds errors with regex
4. ErrorResolver.resolveErrors() → Queries sources in parallel:
   ├─ ClaudeAnalyzer → Claude API (if enabled)
   ├─ CodeAnalyzer → Search codebase
   ├─ RCALogSearcher → Search RCA docs
   └─ WebSearchProvider → Generate search URLs
5. Aggregate results → Sort by confidence
6. ResolutionPanel → Display in modern UI
```

---

## 📦 Installation

### For Development:

```bash
# Clone the repository
git clone https://github.com/yourusername/error-resolver.git
cd error-resolver

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code
code .

# Press F5 to launch Extension Development Host
```

### For Users:

1. Download `.vsix` file from releases
2. Open VS Code
3. Press `Cmd+Shift+P` → "Extensions: Install from VSIX"
4. Select the downloaded file
5. Reload VS Code

---

## 🛠️ Development

### Build Commands:

```bash
npm run compile          # Type check, lint, build
npm run watch            # Watch and rebuild on changes
npm run check-types      # TypeScript type checking
npm run lint             # Run ESLint
npm run package          # Production build (minified)
npm run test             # Run tests
```

### Building the Extension:

To build a distributable VSIX package:

```bash
# Install dependencies (if not already done)
npm install

# Build the VSIX package
npx @vscode/vsce package

# This creates error-resolver-<version>.vsix in the project root
```

**Install the built extension:**
1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX"
4. Select the `error-resolver-<version>.vsix` file
5. Reload VS Code when prompted

**Verify the build:**
```bash
ls -lh error-resolver-*.vsix    # Check VSIX file size and version
```

### Project Structure:

```
error-resolver/
├── src/
│   ├── extension.ts         # Main entry point
│   ├── terminalMonitor.ts   # Terminal capture & zsh shell
│   ├── errorResolver.ts     # Error detection & resolution
│   ├── claudeAnalyzer.ts    # Claude AI integration
│   ├── codeAnalyzer.ts      # Codebase search
│   ├── rcaLogSearcher.ts    # RCA documentation search
│   ├── resolutionPanel.ts   # Modern webview UI
│   └── webSearchProvider.ts # Web search links
├── docs/
│   └── rca/                 # Example RCA documents
├── dist/                    # Compiled output
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript config
└── esbuild.js              # Build configuration
```

---

## 📝 Release Notes

### Version 1.0.0

**Major Features:**
- ✅ Monitored Terminal with real zsh shell
- ✅ Command history (UP/DOWN arrows)
- ✅ Auto error detection with smart debouncing
- ✅ Error deduplication (5-minute cache)
- ✅ Claude AI integration (85% confidence)
- ✅ RCA knowledge base (up to 95% confidence)
- ✅ Modern card-based UI with collapsible sections
- ✅ Proper output formatting for npm/git/build tools
- ✅ Fallback timer for silent commands
- ✅ Multi-language error detection
- ✅ Confidence scoring system

**Bug Fixes:**
- Fixed terminal hanging after Enter
- Fixed output formatting with `\r` handling
- Fixed prompt positioning issues
- Fixed input blocking during command execution

**Known Limitations:**
- Interactive REPLs (Python/Node) require built-in terminal
- Tab completion not available
- Left/right arrow navigation not implemented

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 👥 Team

**Developed by Red Hat**

This extension is developed and maintained by the Red Hat team.

**Contact:**
- **Name**: Kapil Jain
- **Email**: kapjain@redhat.com
- **Organization**: Red Hat

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Built with VS Code Extension API
- Uses Claude API (Anthropic) and Gemini API (Google)
- Inspired by terminal error debugging workflows
- Thanks to the open-source community
- Developed by Red Hat team

---

## 📞 Support

**Primary Contact:**
- **Kapil Jain** - kapjain@redhat.com

**Resources:**
- **Issues**: https://github.com/kapjain-rh/error-resolver/issues
- **Discussions**: https://github.com/kapjain-rh/error-resolver/discussions
- **Repository**: https://github.com/kapjain-rh/error-resolver

---

**Happy Debugging!** 🐛 ✨

*Developed with ❤️ by Red Hat*
