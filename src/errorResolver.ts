import * as vscode from 'vscode';
import { CodeAnalyzer } from './codeAnalyzer';
import { RCALogSearcher } from './rcaLogSearcher';
import { ClaudeAnalyzer } from './claudeAnalyzer';
import { GeminiAnalyzer } from './geminiAnalyzer';
import { GeminiWebProvider } from './geminiWebProvider';
import { WebSearchProvider } from './webSearchProvider';
import { ErrorPatternLoader } from './errorPatternLoader';

export interface DetectedError {
    errorMessage: string;
    errorType: string;
    stackTrace?: string;
    lineNumber?: number;
    file?: string;
    context: string;
}

export interface ErrorResolution {
    error: DetectedError;
    resolutions: Resolution[];
    timestamp: Date;
}

export interface Resolution {
    source: 'code' | 'rca' | 'web';
    title: string;
    description: string;
    codeSnippet?: string;
    file?: string;
    lineNumber?: number;
    url?: string;
    confidence: number; // 0-100
}

export class ErrorResolver implements vscode.Disposable {
    private codeAnalyzer: CodeAnalyzer;
    private rcaSearcher: RCALogSearcher;
    private claudeAnalyzer: ClaudeAnalyzer;
    private geminiAnalyzer: GeminiAnalyzer;
    private geminiWebProvider: GeminiWebProvider;
    private webSearchProvider: WebSearchProvider;
    private patternLoader: ErrorPatternLoader;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.codeAnalyzer = new CodeAnalyzer();
        this.rcaSearcher = new RCALogSearcher(context);
        this.claudeAnalyzer = new ClaudeAnalyzer(context);
        this.geminiAnalyzer = new GeminiAnalyzer(context);
        this.geminiWebProvider = new GeminiWebProvider();
        this.webSearchProvider = new WebSearchProvider();
        this.patternLoader = new ErrorPatternLoader();

        this.disposables.push(this.patternLoader);

        console.log(`[ErrorResolver] Initialized with ${this.patternLoader.getPatterns().length} error patterns`);
    }

    /**
     * Detect errors in terminal output
     */
    async detectErrors(output: string): Promise<DetectedError[]> {
        const errors: DetectedError[] = [];
        const lines = output.split('\n');
        const seenErrors = new Set<string>();

        // Track recent errors by type to group related errors
        let lastErrorType: string | null = null;
        let lastErrorLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Use dynamic patterns from YAML configuration
            const patterns = this.patternLoader.getPatterns();
            for (const patternConfig of patterns) {
                const regex = new RegExp(patternConfig.pattern, 'i');
                const match = line.match(regex);
                if (match) {
                    const errorMessage = match[1] || match[0];
                    const type = patternConfig.type;

                    // Group consecutive errors of the same type (within 10 lines)
                    // This prevents multiple detections for multi-line errors like npm errors
                    const shouldGroupWithPrevious =
                        lastErrorType === type &&
                        (i - lastErrorLine) <= 10 &&
                        (patternConfig.groupConsecutive === true);

                    if (shouldGroupWithPrevious) {
                        console.log(`[ErrorResolver] Grouping ${type} error at line ${i} with previous at ${lastErrorLine}`);

                        // Update the last error's context to include this line
                        if (errors.length > 0) {
                            const lastError = errors[errors.length - 1];
                            if (lastError.errorType === type) {
                                // Extend context to include new line
                                lastError.context = this.getContext(lines, lastErrorLine, Math.abs(i - lastErrorLine) + 3);
                                // Append to error message if it's meaningful
                                if (!lastError.errorMessage.includes(errorMessage.substring(0, 20))) {
                                    lastError.errorMessage += ` | ${errorMessage}`;
                                }
                            }
                        }
                        break; // Skip creating new error, grouped with previous
                    }

                    // Create unique key to avoid duplicate detections from same output
                    const errorKey = `${type}:${errorMessage.substring(0, 100)}`;

                    if (seenErrors.has(errorKey)) {
                        continue; // Skip this duplicate
                    }
                    seenErrors.add(errorKey);

                    const error: DetectedError = {
                        errorMessage,
                        errorType: type,
                        context: this.getContextForPattern(lines, i, patternConfig),
                    };

                    // Extract fields based on pattern configuration
                    if (patternConfig.extractFields) {
                        for (const [fieldName, fieldConfig] of Object.entries(patternConfig.extractFields)) {
                            const fieldRegex = new RegExp(fieldConfig.regex, 'i');
                            const fieldMatch = line.match(fieldRegex);
                            if (fieldMatch && fieldConfig.group < fieldMatch.length) {
                                const value = fieldMatch[fieldConfig.group];

                                // Map field names to DetectedError properties
                                if (fieldName === 'filePath' || fieldName === 'file') {
                                    error.file = value;
                                } else if (fieldName === 'lineNumber') {
                                    error.lineNumber = parseInt(value);
                                } else if (fieldName === 'errorMessage') {
                                    // Only override if more specific than default
                                    if (value && value.length > errorMessage.length) {
                                        error.errorMessage = value;
                                    }
                                }
                            }
                        }
                    }

                    // Try to capture stack trace if configured
                    if (patternConfig.contextExtraction.includeStackTrace) {
                        const stackTrace = this.extractStackTrace(
                            lines,
                            i,
                            patternConfig.contextExtraction.stackTraceDepth || 10
                        );
                        if (stackTrace) {
                            error.stackTrace = stackTrace;
                        }
                    }

                    errors.push(error);
                    lastErrorType = type;
                    lastErrorLine = i;

                    break; // Only match first pattern per line to avoid duplicates
                }
            }
        }

        return errors;
    }

    /**
     * Get context lines around the error using pattern configuration
     */
    private getContextForPattern(lines: string[], errorIndex: number, patternConfig: any): string {
        const linesAbove = patternConfig.contextExtraction.linesAbove || 1;
        const linesBelow = patternConfig.contextExtraction.linesBelow || 3;
        const maxLines = this.patternLoader.getGlobalSettings().maxContextLines;

        const start = Math.max(0, errorIndex - linesAbove);
        const end = Math.min(lines.length, errorIndex + linesBelow + 1);
        const contextLines = lines.slice(start, Math.min(end, start + maxLines));

        return contextLines.join('\n');
    }

    /**
     * Get context lines around the error (legacy method for backward compatibility)
     */
    private getContext(lines: string[], errorIndex: number, contextSize: number = 3): string {
        const start = Math.max(0, errorIndex - contextSize);
        const end = Math.min(lines.length, errorIndex + contextSize + 1);
        return lines.slice(start, end).join('\n');
    }

    /**
     * Extract stack trace from output
     */
    private extractStackTrace(lines: string[], startIndex: number, maxDepth: number = 20): string | undefined {
        const stackLines: string[] = [];
        let i = startIndex + 1;

        // Look for stack trace patterns
        while (i < lines.length && i < startIndex + maxDepth) {
            const line = lines[i];

            // Common stack trace patterns
            if (
                line.match(/^\s+at /) ||
                line.match(/^\s+File "/) ||
                line.match(/^\s+in /) ||
                line.match(/^\s+\d+: /) ||
                line.trim().startsWith('>')
            ) {
                stackLines.push(line);
                i++;
            } else if (line.trim() === '') {
                i++;
            } else {
                break;
            }
        }

        return stackLines.length > 0 ? stackLines.join('\n') : undefined;
    }

    /**
     * Analyze output and resolve errors
     */
    async analyzeAndResolve(output: string): Promise<ErrorResolution[]> {
        const errors = await this.detectErrors(output);
        return this.resolveErrors(errors);
    }

    /**
     * Resolve detected errors
     */
    async resolveErrors(errors: DetectedError[]): Promise<ErrorResolution[]> {
        const resolutions: ErrorResolution[] = [];

        for (const error of errors) {
            const errorResolution: ErrorResolution = {
                error,
                resolutions: [],
                timestamp: new Date()
            };

            // Check if AI analysis is enabled
            const config = vscode.workspace.getConfiguration('error-resolver');
            const enableGeminiAnalysis = config.get<boolean>('enableGeminiAnalysis', false);
            const enableClaudeAnalysis = config.get<boolean>('enableClaudeAnalysis', false);

            // Get resolutions from multiple sources in parallel
            const promises = [
                this.codeAnalyzer.analyzeError(error),
                this.rcaSearcher.searchRCALogs(error),
                this.geminiWebProvider.searchWithGemini(error), // Gemini web search (always enabled)
                this.webSearchProvider.searchSolutions(error), // Stack Overflow, GitHub, docs
                this.webSearchProvider.getKnownSolutions(error) // Known error patterns
            ];

            // Add Gemini API analysis if enabled (primary AI)
            if (enableGeminiAnalysis) {
                promises.push(this.geminiAnalyzer.analyzeError(error));
            }

            // Add Claude API analysis if enabled (secondary AI)
            if (enableClaudeAnalysis) {
                promises.push(this.claudeAnalyzer.analyzeError(error));
            }

            const allResolutions = await Promise.all(promises);

            // Flatten all resolutions
            errorResolution.resolutions = allResolutions.flat();

            // Sort by confidence
            errorResolution.resolutions.sort((a, b) => b.confidence - a.confidence);

            resolutions.push(errorResolution);
        }

        return resolutions;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.codeAnalyzer.dispose();
        this.rcaSearcher.dispose();
        this.claudeAnalyzer.dispose();
        this.geminiAnalyzer.dispose();
        this.geminiWebProvider.dispose();
        this.webSearchProvider.dispose();
    }
}
