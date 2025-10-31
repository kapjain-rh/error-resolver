<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
# Change Log

All notable changes to the "Error Resolver" extension will be documented in this file.

## [1.0.0] - 2025-10-31

### Added
- <� **Dynamic Error Pattern System** - Configure error patterns using YAML files
- =� **YAML Configuration** - `error-patterns.yaml` for customizable error detection
- = **Hot Reload** - Pattern changes apply instantly without restart
- <� **Customizable Context** - Control lines above/below error, stack trace depth
- =
 **Field Extractors** - Extract specific fields (file path, line number, etc.)
- � **Priority System** - Control pattern matching order with priority levels
- =� **Multiple Sources** - Load patterns from extension, workspace, and custom paths
- >� **Ginkgo Test Pattern** - Built-in support for `[FAILED] in [It]` format
- =� **bpfman-operator RCA** - Comprehensive RCA for version mismatch issues
- <� **TF-IDF-like Term Weighting** - Intelligent keyword scoring based on term rarity
- =� **Percentile-based Confidence Ranking** - Automatic differentiation of similar scores
- =� **Monitored Terminal with zsh** - Real zsh shell with full functionality
- =� **Command History** - Navigate with UP/DOWN arrows, `history` command
- > **Auto Error Detection** - Automatically detect errors as they happen
- � **Smart Debouncing** - Groups related errors (500ms) to avoid spam
- = **Error Deduplication** - Same error won't notify again for 5 minutes
- <� **Proper Output Formatting** - Clean output with line buffering for npm/git/build tools
- � **Fallback Timer** - Ensures prompt appears even for silent commands (300ms)
- > **Claude AI Integration** - AI-powered error analysis (85% confidence)
- > **Gemini AI Integration** - AI-powered error analysis with web interface
- =� **RCA Knowledge Base** - Root Cause Analysis documentation (up to 95% confidence)
- =� **Code Analysis** - Search codebase for similar error patterns
- < **Web Search** - Instant Google Search with Gemini AI Overview
- <� **Modern UI** - Card-based design with collapsible sections
- <� **Color-coded Badges** - Visual indicators for solution sources
- =� **Confidence Scores** - See relevance of each solution (0-100%)
- ( **Keyboard Shortcut** - `Cmd+Shift+E` / `Ctrl+Shift+E` for quick analysis
- < **Multi-Language Support** - JavaScript, TypeScript, Python, Java, Go, npm, etc.

### Configuration Settings
- `customPatternFiles` - Custom pattern file paths
- `enableBuiltinPatterns` - Toggle built-in patterns (default: true)
- `geminiApiKey` - Gemini API key for AI analysis
- `enableGeminiAnalysis` - Enable Gemini AI analysis
- `claudeApiKey` - Claude API key for AI analysis
- `enableClaudeAnalysis` - Enable Claude AI analysis
- `rcaLogPaths` - Paths to RCA log directories
- `autoDetectErrors` - Auto-detect errors (default: true)
- `maxResolutionsPerError` - Max solutions per error (default: 10)

### Pattern Loading Behavior
- **Built-in mode (`enableBuiltinPatterns: true`)**: Loads extension built-in + all workspace patterns
- **Custom-only mode (`enableBuiltinPatterns: false`)**: Loads ONLY project root + .vscode + custom paths
  - PRIMARY: Project root `error-patterns.yaml`
  - SECONDARY: `.vscode/error-patterns.yaml` (overrides)
  - TERTIARY: Custom paths from settings

### Team & Support
- **Publisher**: Red Hat (redhat)
- **Author**: Kapil Jain (kapjain@redhat.com)
- **Repository**: https://github.com/kapjain-rh/error-resolver
- **Support**: kapjain@redhat.com
- **License**: MIT

### Performance
- � Patterns loaded once on startup with file watching
- = Hot reload only when pattern files change
- =� Better performance with priority-based early matching

### Known Limitations
- L Interactive REPLs (Python/Node) require built-in terminal (no PTY support)
- L Tab completion not available (requires PTY)
- L Left/right arrow navigation not implemented
- L Custom zsh prompts not supported (uses simple `$ `)
>>>>>>> 3949a49 (Readme Updated)
>>>>>>> 23ac9d8 (Readme Updated)
