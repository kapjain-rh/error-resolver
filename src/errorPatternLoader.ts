import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Interface for field extraction configuration
 */
export interface FieldExtractor {
    regex: string;
    group: number;
}

/**
 * Interface for context extraction configuration
 */
export interface ContextExtraction {
    linesAbove: number;
    linesBelow: number;
    includeStackTrace?: boolean;
    stackTraceDepth?: number;
    aggregateMultiLine?: boolean;
}

/**
 * Interface for error pattern definition
 */
export interface ErrorPattern {
    name: string;
    enabled: boolean;
    type: string;
    pattern: string;
    priority: number;
    groupConsecutive?: boolean; // Whether to group consecutive errors of this type
    contextExtraction: ContextExtraction;
    extractFields?: { [key: string]: FieldExtractor };
}

/**
 * Interface for global settings
 */
export interface GlobalSettings {
    maxContextLines: number;
    defaultPriority: number;
    caseInsensitive: boolean;
    hotReload?: boolean;
}

/**
 * Interface for the complete pattern configuration
 */
export interface PatternConfig {
    globalSettings: GlobalSettings;
    patterns: ErrorPattern[];
}

/**
 * Loads and manages error pattern configurations from YAML files
 */
export class ErrorPatternLoader implements vscode.Disposable {
    private patterns: ErrorPattern[] = [];
    private globalSettings: GlobalSettings;
    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.globalSettings = {
            maxContextLines: 50,
            defaultPriority: 5,
            caseInsensitive: false,
            hotReload: true
        };

        this.loadPatterns();
        this.setupFileWatchers();
    }

    /**
     * Load patterns from all available sources
     */
    private loadPatterns(): void {
        console.log('[ErrorPatternLoader] ====== Loading error patterns ======');

        const config = vscode.workspace.getConfiguration('error-resolver');
        const enableBuiltinPatterns = config.get<boolean>('enableBuiltinPatterns', true);

        console.log(`[ErrorPatternLoader] Built-in patterns enabled: ${enableBuiltinPatterns}`);

        const allConfigs: PatternConfig[] = [];

        if (enableBuiltinPatterns) {
            // NORMAL MODE: Load built-in + workspace patterns
            console.log('[ErrorPatternLoader] MODE: Loading built-in + workspace patterns');

            // Load default patterns from extension
            const defaultConfig = this.loadDefaultPatterns();
            if (defaultConfig) {
                allConfigs.push(defaultConfig);
                console.log('[ErrorPatternLoader] ✓ Loaded built-in patterns from extension');
            }

            // Load all workspace patterns
            const patternFiles = this.getPatternFilePaths();
            console.log('[ErrorPatternLoader] Workspace pattern paths:', patternFiles);

            for (const filePath of patternFiles) {
                console.log(`[ErrorPatternLoader] Checking: ${filePath}`);
                if (fs.existsSync(filePath)) {
                    const fileConfig = this.loadPatternFile(filePath);
                    if (fileConfig) {
                        allConfigs.push(fileConfig);
                        console.log(`[ErrorPatternLoader]   ✓ Loaded ${fileConfig.patterns.length} patterns`);
                    }
                } else {
                    console.log(`[ErrorPatternLoader]   ✗ Not found`);
                }
            }
        } else {
            // CUSTOM-ONLY MODE: Load ONLY workspace root and custom paths
            console.log('[ErrorPatternLoader] MODE: Custom patterns only (workspace root + custom paths)');

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;

                // PRIMARY: Load project root error-patterns.yaml
                const rootPatternPath = path.join(workspaceRoot, 'error-patterns.yaml');
                console.log(`[ErrorPatternLoader] Checking project root: ${rootPatternPath}`);

                if (fs.existsSync(rootPatternPath)) {
                    const rootConfig = this.loadPatternFile(rootPatternPath);
                    if (rootConfig) {
                        allConfigs.push(rootConfig);
                        console.log(`[ErrorPatternLoader] ✓ Loaded ${rootConfig.patterns.length} patterns from project root`);
                    }
                } else {
                    console.log('[ErrorPatternLoader] ✗ No error-patterns.yaml in project root');
                }

                // SECONDARY: Load .vscode/error-patterns.yaml (can override root patterns)
                const vscodePatternPath = path.join(workspaceRoot, '.vscode', 'error-patterns.yaml');
                console.log(`[ErrorPatternLoader] Checking .vscode override: ${vscodePatternPath}`);

                if (fs.existsSync(vscodePatternPath)) {
                    const vscodeConfig = this.loadPatternFile(vscodePatternPath);
                    if (vscodeConfig) {
                        allConfigs.push(vscodeConfig);
                        console.log(`[ErrorPatternLoader] ✓ Loaded ${vscodeConfig.patterns.length} patterns from .vscode/ (overrides)`);
                    }
                } else {
                    console.log('[ErrorPatternLoader] ✗ No .vscode/error-patterns.yaml override');
                }

                // TERTIARY: Load custom paths from settings (if any)
                const customPaths = config.get<string[]>('customPatternFiles', []);
                console.log(`[ErrorPatternLoader] Custom paths from settings: ${customPaths.length}`);

                for (const customPath of customPaths) {
                    const fullPath = path.isAbsolute(customPath)
                        ? customPath
                        : path.join(workspaceRoot, customPath);

                    console.log(`[ErrorPatternLoader] Checking custom path: ${fullPath}`);
                    if (fs.existsSync(fullPath)) {
                        const customConfig = this.loadPatternFile(fullPath);
                        if (customConfig) {
                            allConfigs.push(customConfig);
                            console.log(`[ErrorPatternLoader] ✓ Loaded ${customConfig.patterns.length} patterns from custom path`);
                        }
                    } else {
                        console.log('[ErrorPatternLoader] ✗ Custom path not found');
                    }
                }
            }
        }

        console.log(`[ErrorPatternLoader] Total config sources loaded: ${allConfigs.length}`);

        // Merge all configurations
        this.mergeConfigurations(allConfigs);

        console.log(`[ErrorPatternLoader] ====== Pattern Loading Complete ======`);
        console.log(`[ErrorPatternLoader] Total patterns loaded: ${this.patterns.length}`);
        console.log(`[ErrorPatternLoader] Pattern sources: ${enableBuiltinPatterns ? 'built-in + workspace' : 'custom only'}`);
        console.log(`[ErrorPatternLoader] Active patterns:`);
        this.patterns.forEach(p => {
            console.log(`[ErrorPatternLoader]   - ${p.name} (type: ${p.type}, priority: ${p.priority})`);
        });
    }

    /**
     * Get all possible pattern file paths (in priority order)
     */
    private getPatternFilePaths(): string[] {
        const paths: string[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;

            // 1. .vscode/error-patterns.yaml (highest priority)
            paths.push(path.join(workspaceRoot, '.vscode', 'error-patterns.yaml'));

            // 2. error-patterns.yaml in workspace root
            paths.push(path.join(workspaceRoot, 'error-patterns.yaml'));

            // 3. Custom paths from settings
            const config = vscode.workspace.getConfiguration('error-resolver');
            const customPaths = config.get<string[]>('customPatternFiles', []);
            for (const customPath of customPaths) {
                const fullPath = path.isAbsolute(customPath)
                    ? customPath
                    : path.join(workspaceRoot, customPath);
                paths.push(fullPath);
            }
        }

        return paths;
    }

    /**
     * Load default patterns bundled with the extension
     */
    private loadDefaultPatterns(): PatternConfig | null {
        try {
            // Extension's default pattern file
            const extensionPath = vscode.extensions.getExtension('error-resolver-team.error-resolver')?.extensionPath;
            if (!extensionPath) {
                console.warn('[ErrorPatternLoader] Could not find extension path');
                return null;
            }

            const defaultFilePath = path.join(extensionPath, 'error-patterns.yaml');
            if (fs.existsSync(defaultFilePath)) {
                return this.loadPatternFile(defaultFilePath);
            }

            console.warn('[ErrorPatternLoader] Default patterns file not found:', defaultFilePath);
            return null;
        } catch (error) {
            console.error('[ErrorPatternLoader] Error loading default patterns:', error);
            return null;
        }
    }

    /**
     * Load and parse a YAML pattern file
     */
    private loadPatternFile(filePath: string): PatternConfig | null {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const config = yaml.load(fileContent) as PatternConfig;

            // Validate configuration
            if (!this.validateConfig(config)) {
                console.error('[ErrorPatternLoader] Invalid configuration in:', filePath);
                return null;
            }

            return config;
        } catch (error) {
            console.error(`[ErrorPatternLoader] Error loading pattern file ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Validate pattern configuration
     */
    private validateConfig(config: any): config is PatternConfig {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Check globalSettings
        if (config.globalSettings && typeof config.globalSettings === 'object') {
            // Global settings are optional, just validate if present
        }

        // Check patterns array
        if (!Array.isArray(config.patterns)) {
            console.error('[ErrorPatternLoader] Missing or invalid patterns array');
            return false;
        }

        // Validate each pattern
        for (const pattern of config.patterns) {
            if (!pattern.name || !pattern.type || !pattern.pattern) {
                console.error('[ErrorPatternLoader] Pattern missing required fields:', pattern);
                return false;
            }
        }

        return true;
    }

    /**
     * Merge multiple configurations (custom overrides default)
     */
    private mergeConfigurations(configs: PatternConfig[]): void {
        if (configs.length === 0) {
            return;
        }

        // Start with first config's global settings
        if (configs[0].globalSettings) {
            this.globalSettings = { ...this.globalSettings, ...configs[0].globalSettings };
        }

        // Collect all patterns
        const allPatterns: ErrorPattern[] = [];
        const patternNames = new Set<string>();

        // Iterate in reverse (custom files override defaults)
        for (let i = configs.length - 1; i >= 0; i--) {
            const config = configs[i];

            // Merge global settings
            if (config.globalSettings) {
                this.globalSettings = { ...this.globalSettings, ...config.globalSettings };
            }

            // Add patterns (skip duplicates by name)
            for (const pattern of config.patterns) {
                if (!patternNames.has(pattern.name)) {
                    patternNames.add(pattern.name);
                    allPatterns.push(this.normalizePattern(pattern));
                }
            }
        }

        // Sort by priority (higher priority first)
        this.patterns = allPatterns
            .filter(p => p.enabled)
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Normalize pattern with default values
     */
    private normalizePattern(pattern: ErrorPattern): ErrorPattern {
        return {
            ...pattern,
            priority: pattern.priority ?? this.globalSettings.defaultPriority,
            contextExtraction: {
                linesAbove: pattern.contextExtraction?.linesAbove ?? 1,
                linesBelow: pattern.contextExtraction?.linesBelow ?? 3,
                includeStackTrace: pattern.contextExtraction?.includeStackTrace ?? false,
                stackTraceDepth: pattern.contextExtraction?.stackTraceDepth ?? 10,
                aggregateMultiLine: pattern.contextExtraction?.aggregateMultiLine ?? false
            }
        };
    }

    /**
     * Setup file watchers for hot reload
     */
    private setupFileWatchers(): void {
        if (!this.globalSettings.hotReload) {
            return;
        }

        const patternFiles = this.getPatternFilePaths();

        for (const filePath of patternFiles) {
            const dir = path.dirname(filePath);
            const fileName = path.basename(filePath);

            const pattern = new vscode.RelativePattern(dir, fileName);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidChange(() => {
                console.log('[ErrorPatternLoader] Pattern file changed, reloading...');
                this.loadPatterns();
            });

            watcher.onDidCreate(() => {
                console.log('[ErrorPatternLoader] Pattern file created, reloading...');
                this.loadPatterns();
            });

            this.fileWatchers.push(watcher);
            this.disposables.push(watcher);
        }
    }

    /**
     * Get all loaded patterns
     */
    getPatterns(): ErrorPattern[] {
        return this.patterns;
    }

    /**
     * Get patterns by type
     */
    getPatternsByType(type: string): ErrorPattern[] {
        return this.patterns.filter(p => p.type === type);
    }

    /**
     * Get global settings
     */
    getGlobalSettings(): GlobalSettings {
        return this.globalSettings;
    }

    /**
     * Reload patterns manually
     */
    reload(): void {
        console.log('[ErrorPatternLoader] Manual reload requested');
        this.loadPatterns();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.fileWatchers = [];
        this.disposables = [];
    }
}
