# Change Log

All notable changes to the "Error Resolver" extension will be documented in this file.

## [1.1.7] - 2025-10-31

### Changed
- 📝 **Updated Team & Contact Information** - Added Red Hat team and contact details
  - **Publisher**: Changed to Red Hat (redhat)
  - **Author**: Kapil Jain (kapjain@redhat.com)
  - **Repository**: Updated to https://github.com/redhat-developer/error-resolver
  - **Team Section**: Added Red Hat team information to README
  - **Support**: Primary contact - Kapil Jain (kapjain@redhat.com)

## [1.1.6] - 2025-10-31

### Changed
- 🎯 **Default Custom Pattern Source** - Changed default custom pattern file to project root
  - **Before v1.1.6:** Custom-only mode loaded from `.vscode/error-patterns.yaml` as primary
  - **After v1.1.6:** Custom-only mode loads from project root `error-patterns.yaml` as primary
  - **Loading order when `enableBuiltinPatterns: false`:**
    1. **Project root:** `error-patterns.yaml` (PRIMARY - your custom patterns)
    2. **.vscode folder:** `.vscode/error-patterns.yaml` (SECONDARY - overrides)
    3. **Custom paths:** From `customPatternFiles` setting (TERTIARY)
  - **Benefit:** Use your existing project root `error-patterns.yaml` as custom patterns
  - **Use case:** Perfect for extension development - edit the main pattern file directly

### Why This Change?
- During extension development, `error-patterns.yaml` in project root is the actual pattern file
- No need to maintain duplicate patterns in `.vscode/`
- Can use `.vscode/error-patterns.yaml` for testing-specific overrides
- More intuitive for users who want to customize patterns

## [1.1.5] - 2025-10-31

### Fixed
- 🔥 **COMPLETE REWRITE: Pattern Loading Logic** - Fixed persistent issue with built-in patterns loading
  - **Problem:** Even with `enableBuiltinPatterns: false`, workspace root patterns were still loading
  - **Root Cause:** Pattern loading used same logic for both modes, just skipping some files
  - **Solution:** Complete separation of loading modes:
    - **Built-in mode (`true`)**: Loads extension built-in + all workspace patterns
    - **Custom-only mode (`false`)**: ONLY loads `.vscode/error-patterns.yaml` + custom paths from settings
  - **Impact:** When disabled, absolutely NO built-in or workspace root patterns are loaded
  - **Verification:** Detailed logs show exact mode and patterns loaded

### Changed
- 📊 **Enhanced Pattern Logging** - More detailed output showing mode and all active patterns
  - Shows loading mode: "Loading built-in + workspace patterns" vs "Custom patterns only"
  - Lists each active pattern with name, type, and priority
  - Makes debugging pattern loading issues trivial

## [1.1.4] - 2025-10-31

### Fixed
- 🔧 **Pattern Loading Respects Settings** - Fixed `enableBuiltinPatterns` setting not being honored
  - **Problem:** Extension was loading both built-in AND workspace root patterns even when user wanted custom-only
  - **Solution:**
    - Added check for `enableBuiltinPatterns` setting before loading default patterns
    - Skip workspace root `error-patterns.yaml` when `enableBuiltinPatterns: false`
  - **Impact:** Users can now disable built-in patterns via settings to use ONLY `.vscode/error-patterns.yaml`
  - **Setting:** `error-resolver.enableBuiltinPatterns` (default: true)
  - **Use case:** Perfect for extension development and testing with specific patterns

### Changed
- 📊 **Enhanced Pattern Loading Logs** - Detailed visibility into pattern loading process
  - Shows all pattern file paths checked
  - Indicates which files exist vs. not found
  - Shows number of patterns loaded from each source
  - Lists all pattern names loaded
  - Helps debug pattern loading issues

### Added
- 📝 **Test Pattern File** - Created `.vscode/error-patterns.yaml` for development testing
  - Contains only Ginkgo test pattern for testing
  - Used when `enableBuiltinPatterns: false`
  - Demonstrates custom pattern file usage

## [1.1.3] - 2025-10-31

### Added
- 🎯 **TF-IDF-like Term Weighting** - Intelligent keyword scoring based on term rarity
  - **Product names** (bpfman, ebpf, ginkgo): 2.0x weight → Highly specific matches
  - **Version numbers** (0.5.7, v1.2.3): 1.8x weight → Version-specific issues
  - **Hyphenated terms** (operator-subscription): 1.6x weight → Technical specificity
  - **Medium terms** (mismatch, upgrade): 1.3x weight → Moderate specificity
  - **Common terms** (version, test, error): 1.0x weight → No boost (prevent false positives)

- 📊 **Percentile-based Confidence Ranking** - Automatic differentiation of similar scores
  - **Problem:** Multiple RCAs with high scores (150+) all showed 95% confidence
  - **Solution:** Rank by percentile: #1=95%, #2=88%, #3=81%, #4=74%, #5=67%
  - **Impact:** Even when 6 RCAs score 150+, they're differentiated by rank
  - **Algorithm:** `confidence = min(rawConfidence, 95 - (percentileRank * 45))`

### Changed
- 📈 **Enhanced Keyword Logging** - Shows term rarity multipliers and weighted scores
  - Example: `Keyword "bpfman": 3 matches, rarity: 2.00x, score: 60`
  - Helps debug why specific RCAs get high/low scores

- 🔍 **Better Score Transparency** - Logs raw confidence → percentile rank → final confidence
  - Shows: `Raw score confidence: 95% → Percentile rank: 20% → Final confidence: 88%`

## [1.1.2] - 2025-10-31

### Notes
- 📦 **Stable Release** - Rebuilt package with all fixes from 1.1.1
- ✅ No hardcoded error patterns - fully YAML-driven
- ✅ Enhanced RCA confidence logging for debugging
- ✅ All error grouping behavior configurable via YAML

## [1.1.1] - 2025-10-31

### Fixed
- 🎯 **RCA Confidence Scores** - Fixed confidence calculation to show differentiated scores (50-95%)
  - **Problem:** All RCA results were showing flat 95% confidence regardless of relevance
  - **Solution:** Formula-based calculation: `confidence = 50% + (relevanceScore / 2)` + 3% bonus for solution sections
  - **Impact:** RCA results now show varied confidence scores reflecting actual match quality
  - **Examples:** Low relevance = 50-60%, Medium = 65-75%, High = 80-90%, Excellent = 95%

### Changed
- 🔧 **Removed Hardcoded Error Type Grouping** - Made error grouping fully dynamic via YAML
  - **Before:** Hardcoded list `['npm', 'compilation', 'test']` in code
  - **After:** Configurable `groupConsecutive: true` field in YAML patterns
  - **Impact:** All error behavior now controlled via YAML configuration, no code changes needed
- 📊 **Enhanced RCA Logging** - Added detailed confidence calculation logging
  - Shows relevance score → confidence percentage conversion
  - Displays base confidence + solution bonus breakdown
  - Helps debug why specific RCA files have certain confidence scores

## [1.1.0] - 2025-10-30

### Added
- 🎯 **Dynamic Error Pattern System** - Configure error patterns using YAML files
- 📝 **YAML Configuration** - `error-patterns.yaml` for customizable error detection
- 🔄 **Hot Reload** - Pattern changes apply instantly without restart
- 🎨 **Customizable Context** - Control lines above/below error, stack trace depth
- 🔍 **Field Extractors** - Extract specific fields (file path, line number, etc.)
- ⚡ **Priority System** - Control pattern matching order with priority levels
- 📂 **Multiple Sources** - Load patterns from extension, workspace, and custom paths
- 🧪 **Ginkgo Test Pattern** - Built-in support for `[FAILED] in [It]` format
- 📋 **bpfman-operator RCA** - Comprehensive RCA for version mismatch issues
- ⚙️ **New Settings**:
  - `customPatternFiles` - Custom pattern file paths
  - `enableBuiltinPatterns` - Toggle built-in patterns

### Changed
- ♻️ **Error Detection** - Now uses dynamic YAML patterns instead of hardcoded regex
- 📊 **Context Extraction** - Pattern-specific configuration for better accuracy
- 🎯 **Field Extraction** - Configurable regex-based field extraction per pattern
- 🎯 **RCA Relevance Filtering** - Improved semantic matching returns only top 5 most relevant RCAs
  - Increased relevance threshold from 20 to 50 for better filtering
  - Enhanced scoring: exact phrase matching, co-occurrence bonus, technical detail detection
  - Smart ranking: error type match (40pts), phrase match (30pts), keywords (15pts+)
  - Results sorted by confidence and limited to top 5 most relevant documents
  - **Differentiated confidence scores:** Formula-based calculation (50% + score/2) instead of flat 95%
  - Ensures RCA results show varied confidence (50-95%) reflecting match quality

### Performance
- ⚡ Patterns loaded once on startup with file watching
- 🔄 Hot reload only when pattern files change
- 📈 Better performance with priority-based early matching

## [1.0.0] - 2025-10-30

### Added
- 🖥️ **Monitored Terminal with zsh** - Real zsh shell with full functionality
- 📜 **Command History** - Navigate with UP/DOWN arrows, `history` command
- 🤖 **Auto Error Detection** - Automatically detect errors as they happen
- ⏱️ **Smart Debouncing** - Groups related errors (500ms) to avoid spam
- 🔄 **Error Deduplication** - Same error won't notify again for 5 minutes
- 🎨 **Proper Output Formatting** - Clean output with line buffering for npm/git/build tools
- ⏲️ **Fallback Timer** - Ensures prompt appears even for silent commands (300ms)
- 🤖 **Claude AI Integration** - AI-powered error analysis (85% confidence)
- 📄 **RCA Knowledge Base** - Root Cause Analysis documentation (up to 95% confidence)
- 💻 **Code Analysis** - Search codebase for similar error patterns
- 🌐 **Web Search** - Instant Google Search with Gemini AI Overview
- 🎨 **Modern UI** - Card-based design with collapsible sections
- 🏷️ **Color-coded Badges** - Visual indicators for solution sources
- 📊 **Confidence Scores** - See relevance of each solution (0-100%)
- ⌨️ **Keyboard Shortcut** - `Cmd+Shift+E` / `Ctrl+Shift+E` for quick analysis
- 🌈 **Multi-Language Support** - JavaScript, TypeScript, Python, Java, Go, npm, etc.

### Fixed
- ✅ Terminal hanging after pressing Enter (fallback timer)
- ✅ Output formatting with `\r` handling (line buffering)
- ✅ Prompt positioning issues (proper line clearing)
- ✅ Input blocking during command execution (state tracking)

### Known Limitations
- ❌ Interactive REPLs (Python/Node) require built-in terminal (no PTY support)
- ❌ Tab completion not available (requires PTY)
- ❌ Left/right arrow navigation not implemented
- ❌ Custom zsh prompts not supported (uses simple `$ `)

## [0.0.1] - Initial Release

### Added
- Basic terminal error analysis
- Manual error analysis from clipboard
- Code-based solutions
- Web search integration
