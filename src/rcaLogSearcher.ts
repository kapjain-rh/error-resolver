import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DetectedError, Resolution } from './errorResolver';

export class RCALogSearcher implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private rcaLogPaths: string[] = [];
    private documentFrequency: Map<string, number> = new Map(); // IDF cache
    private totalDocuments: number = 0;

    constructor(private context: vscode.ExtensionContext) {
        this.loadRCALogPaths();
    }

    /**
     * Load RCA log paths from configuration
     */
    private loadRCALogPaths(): void {
        const config = vscode.workspace.getConfiguration('error-resolver');
        const configuredPaths = config.get<string[]>('rcaLogPaths', []);

        this.rcaLogPaths = [...configuredPaths];

        // Also look for common RCA log locations
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log('[RCALogSearcher] Workspace folders:', workspaceFolders?.length);

        if (workspaceFolders && workspaceFolders.length > 0) {
            for (const folder of workspaceFolders) {
                console.log('[RCALogSearcher] Checking folder:', folder.uri.fsPath);

                const commonPaths = [
                    path.join(folder.uri.fsPath, 'logs', 'rca'),
                    path.join(folder.uri.fsPath, 'rca'),
                    path.join(folder.uri.fsPath, 'docs', 'rca'),
                    path.join(folder.uri.fsPath, '.rca'),
                ];

                for (const commonPath of commonPaths) {
                    console.log('[RCALogSearcher] Checking path:', commonPath, 'exists:', fs.existsSync(commonPath));
                    if (fs.existsSync(commonPath)) {
                        this.rcaLogPaths.push(commonPath);
                        console.log('[RCALogSearcher] Added RCA path:', commonPath);
                    }
                }
            }
        } else {
            console.log('[RCALogSearcher] No workspace folders found!');
            console.log('[RCALogSearcher] Please open a folder in VS Code (File > Open Folder)');
        }

        console.log('[RCALogSearcher] Final RCA paths:', this.rcaLogPaths);
    }

    /**
     * Search RCA logs for similar errors
     */
    async searchRCALogs(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        console.log('[RCALogSearcher] Searching for error:', error.errorMessage);

        // Reload RCA paths in case workspace was opened after activation
        if (this.rcaLogPaths.length === 0) {
            console.log('[RCALogSearcher] No RCA paths found during activation, reloading...');
            this.loadRCALogPaths();
        }

        console.log('[RCALogSearcher] RCA log paths:', this.rcaLogPaths);

        // Search in configured RCA log paths
        for (const logPath of this.rcaLogPaths) {
            const pathResolutions = await this.searchInPath(logPath, error);
            resolutions.push(...pathResolutions);
        }

        // Search for RCA files in workspace
        const workspaceResolutions = await this.searchWorkspace(error);
        resolutions.push(...workspaceResolutions);

        console.log('[RCALogSearcher] Found', resolutions.length, 'total RCA resolutions');

        // Sort by confidence score (descending)
        const sortedResolutions = resolutions.sort((a, b) => b.confidence - a.confidence);

        // Apply percentile-based ranking to differentiate similar high scores
        // This ensures varied confidence even when multiple RCAs score similarly
        if (sortedResolutions.length > 1) {
            sortedResolutions.forEach((resolution, index) => {
                // Calculate percentile rank (0 = best, 1 = worst)
                const percentileRank = index / Math.max(1, sortedResolutions.length - 1);

                // Map to confidence range 95% (best) down to 50% (worst)
                // Top result: 95%, 2nd: ~88%, 3rd: ~81%, etc.
                const percentileConfidence = Math.round(95 - (percentileRank * 45));

                // Use the lower of: original confidence or percentile confidence
                // This ensures we don't inflate scores, only differentiate high scorers
                const originalConfidence = resolution.confidence;
                resolution.confidence = Math.min(originalConfidence, percentileConfidence);

                console.log(`[RCALogSearcher] ${resolution.title}:`,
                           `Raw score confidence: ${originalConfidence}%`,
                           `→ Percentile rank: ${(percentileRank * 100).toFixed(0)}%`,
                           `→ Final confidence: ${resolution.confidence}%`);
            });
        }

        // Return only top 5 most relevant
        const topResolutions = sortedResolutions.slice(0, 5);

        console.log('[RCALogSearcher] Returning top', topResolutions.length, 'most relevant RCAs');
        topResolutions.forEach((r, i) => {
            console.log(`[RCALogSearcher] #${i + 1}: ${r.title} (confidence: ${r.confidence}%)`);
        });

        return topResolutions;
    }

    /**
     * Search in a specific path for RCA logs
     */
    private async searchInPath(searchPath: string, error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        try {
            if (!fs.existsSync(searchPath)) {
                return resolutions;
            }

            const stat = fs.statSync(searchPath);

            if (stat.isDirectory()) {
                // Search all files in directory
                const files = fs.readdirSync(searchPath);

                for (const file of files) {
                    const filePath = path.join(searchPath, file);
                    const fileStat = fs.statSync(filePath);

                    if (fileStat.isFile() && this.isRCAFile(file)) {
                        const fileResolutions = await this.analyzeRCAFile(filePath, error);
                        resolutions.push(...fileResolutions);
                    } else if (fileStat.isDirectory()) {
                        // Recursive search (limited depth)
                        const subResolutions = await this.searchInPath(filePath, error);
                        resolutions.push(...subResolutions);
                    }
                }
            } else if (stat.isFile() && this.isRCAFile(searchPath)) {
                const fileResolutions = await this.analyzeRCAFile(searchPath, error);
                resolutions.push(...fileResolutions);
            }
        } catch (err) {
            console.error(`Error searching RCA path ${searchPath}:`, err);
        }

        return resolutions;
    }

    /**
     * Search workspace for RCA files
     */
    private async searchWorkspace(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        try {
            // Search for RCA-related files with multiple patterns
            const patterns = [
                '**/*rca*.{md,txt,log,json}',
                '**/*RCA*.{md,txt,log,json}',
                '**/*root-cause*.{md,txt,log,json}',
                '**/*troubleshoot*.{md,txt,log,json}',
                '**/*postmortem*.{md,txt,log,json}',
                '**/*incident*.{md,txt,log,json}',
            ];

            const allFiles: vscode.Uri[] = [];
            for (const pattern of patterns) {
                const files = await vscode.workspace.findFiles(
                    pattern,
                    '**/node_modules/**',
                    50
                );
                allFiles.push(...files);
            }

            // Remove duplicates
            const uniqueFiles = Array.from(new Set(allFiles.map(f => f.fsPath)))
                .map(fsPath => vscode.Uri.file(fsPath));

            console.log('[RCALogSearcher] Found', uniqueFiles.length, 'RCA files in workspace');
            uniqueFiles.forEach(f => console.log('[RCALogSearcher] File:', f.fsPath));

            for (const file of uniqueFiles) {
                const fileResolutions = await this.analyzeRCAFile(file.fsPath, error);
                resolutions.push(...fileResolutions);
            }
        } catch (err) {
            console.error('Error searching workspace for RCA files:', err);
        }

        return resolutions;
    }

    /**
     * Check if a file is an RCA file
     */
    private isRCAFile(fileName: string): boolean {
        const rcaPatterns = [
            /rca/i,
            /root.?cause/i,
            /troubleshoot/i,
            /postmortem/i,
            /incident/i,
        ];

        return rcaPatterns.some(pattern => pattern.test(fileName));
    }

    /**
     * Analyze an RCA file for similar errors
     */
    private async analyzeRCAFile(filePath: string, error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();

            // Extract keywords from error
            const errorKeywords = this.extractKeywords(error.errorMessage);
            console.log('[RCALogSearcher] Analyzing file:', path.basename(filePath));
            console.log('[RCALogSearcher] Keywords:', errorKeywords);

            // Check if RCA file mentions this error
            const relevanceScore = this.calculateRelevance(text, errorKeywords, error.errorType);
            console.log('[RCALogSearcher] File:', path.basename(filePath), 'Relevance score:', relevanceScore);

            // Increased threshold from 20 to 50 for better filtering
            if (relevanceScore >= 50) {
                // Parse RCA content for solution
                const solution = this.extractSolution(text, errorKeywords);

                // Extract code snippets from the solution
                let codeSnippet: string | undefined;
                if (solution) {
                    const codeBlocks = this.extractCodeBlocks(solution);
                    if (codeBlocks.length > 0) {
                        // Use the first (usually most relevant) code block
                        codeSnippet = codeBlocks[0];
                    }
                }

                // Extract clean description without code blocks
                let description = solution || `Found relevant RCA documentation for ${error.errorType} error`;
                if (solution && codeSnippet) {
                    // Remove code blocks from description
                    description = solution.replace(/```[\w]*\n[\s\S]*?```/g, '[See code snippet below]')
                                         .replace(/`[^`]+`/g, '')
                                         .trim();
                }

                // Convert relevance score to confidence percentage
                // Score range is typically 50-150, map to 50-95% confidence
                let adjustedConfidence = Math.min(50 + Math.floor(relevanceScore / 2), 95);

                // Small bonus for explicit solution sections (2-3% boost)
                const hasSolutionSection = solution && (solution.includes('## Solution') ||
                                                       solution.includes('## Resolution') ||
                                                       solution.includes('## Fix'));
                if (hasSolutionSection) {
                    adjustedConfidence = Math.min(adjustedConfidence + 3, 95);
                }

                console.log('[RCALogSearcher] File:', path.basename(filePath),
                           'Score:', relevanceScore,
                           '→ Confidence:', adjustedConfidence + '%',
                           '(base:', 50 + Math.floor(relevanceScore / 2),
                           '+ solution bonus:', hasSolutionSection ? 3 : 0, ')');

                resolutions.push({
                    source: 'rca',
                    title: `📋 RCA: ${path.basename(filePath)}`,
                    description: description,
                    codeSnippet: codeSnippet,
                    file: filePath,
                    confidence: adjustedConfidence
                });
            }
        } catch (err) {
            console.error(`Error analyzing RCA file ${filePath}:`, err);
        }

        return resolutions;
    }

    /**
     * Extract keywords from error message
     */
    private extractKeywords(errorMessage: string): string[] {
        const commonWords = ['error', 'exception', 'the', 'a', 'an', 'is', 'at', 'in', 'of', 'to'];

        const words = errorMessage
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));

        return [...new Set(words)];
    }

    /**
     * Calculate relevance score with improved semantic matching
     */
    private calculateRelevance(text: string, keywords: string[], errorType: string): number {
        let score = 0;
        const lowerText = text.toLowerCase();

        // Check for error type match (high weight - very important)
        if (lowerText.includes(errorType.toLowerCase())) {
            score += 40; // Increased from 20
        }

        // Check for exact phrase matches from original error (very high weight)
        const errorPhrases = this.extractPhrases(keywords);
        for (const phrase of errorPhrases) {
            if (lowerText.includes(phrase.toLowerCase())) {
                score += 30; // NEW: Reward exact phrase matches
            }
        }

        // Check for individual keyword matches with TF-IDF-like weighting
        const keywordScores = new Map<string, number>();
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
            const matches = lowerText.match(regex);
            if (matches) {
                // Calculate term rarity weight (IDF-like)
                const rarityWeight = this.calculateTermRarity(keyword);

                // Base score with diminishing returns for repeats
                const baseScore = 15 + Math.min(matches.length - 1, 3) * 5;

                // Apply rarity multiplier (1.0 to 2.0)
                const weightedScore = Math.round(baseScore * rarityWeight);

                keywordScores.set(keyword, weightedScore);
                score += weightedScore;

                console.log(`[RCALogSearcher] Keyword "${keyword}": ${matches.length} matches, rarity: ${rarityWeight.toFixed(2)}x, score: ${weightedScore}`);
            }
        }

        // Bonus if multiple keywords appear together (co-occurrence)
        if (keywordScores.size >= 3) {
            score += 20; // NEW: Bonus for multiple keyword matches
        }

        // Check for solution indicators with proximity to keywords
        const solutionIndicators = [
            'solution', 'fix', 'resolved', 'workaround', 'resolution',
            'how to fix', 'to resolve', 'steps to', 'prevention', 'root cause'
        ];

        let hasSolutionSection = false;
        for (const indicator of solutionIndicators) {
            if (lowerText.includes(indicator)) {
                score += 10; // Reduced from 15 to make threshold more meaningful
                if (indicator === 'solution' || indicator === 'resolution' || indicator === 'fix') {
                    hasSolutionSection = true;
                }
            }
        }

        // Extra bonus for having explicit solution sections
        if (hasSolutionSection) {
            score += 15; // NEW: Reward documents with clear solution sections
        }

        // Check for technical details (file paths, line numbers, version numbers)
        if (/\/[\w\/-]+\.\w+:\d+/.test(text)) {
            score += 10; // NEW: Bonus for having file references with line numbers
        }

        // Penalty for very short documents (likely not detailed enough)
        if (text.length < 500) {
            score -= 10; // NEW: Penalize very short RCA docs
        }

        console.log('[RCALogSearcher] Relevance breakdown - Type:',
                    lowerText.includes(errorType.toLowerCase()) ? 40 : 0,
                    'Keywords:', keywordScores.size,
                    'Total:', score);

        return Math.max(score, 0); // Never return negative
    }

    /**
     * Extract multi-word phrases from keywords for exact matching
     */
    private extractPhrases(keywords: string[]): string[] {
        // Try to reconstruct meaningful phrases from keywords
        const phrases: string[] = [];

        // Group consecutive keywords that might form a phrase
        if (keywords.length >= 2) {
            for (let i = 0; i < keywords.length - 1; i++) {
                phrases.push(`${keywords[i]} ${keywords[i + 1]}`);
            }
        }

        return phrases;
    }

    /**
     * Extract solution from RCA content with better parsing
     */
    private extractSolution(text: string, keywords: string[]): string | undefined {
        // Try to extract complete solution sections
        const solutionPatterns = [
            /## Solution[\s\S]*?(?=##|$)/i,
            /## Resolution[\s\S]*?(?=##|$)/i,
            /## Fix[\s\S]*?(?=##|$)/i,
            /### Solution[\s\S]*?(?=###|##|$)/i,
            /### Resolution[\s\S]*?(?=###|##|$)/i,
            /### Fix[\s\S]*?(?=###|##|$)/i,
            /Solution:[\s\S]*?(?=\n\n|$)/i,
            /Resolution:[\s\S]*?(?=\n\n|$)/i,
            /How to fix:[\s\S]*?(?=\n\n|$)/i,
        ];

        for (const pattern of solutionPatterns) {
            const match = text.match(pattern);
            if (match) {
                const solution = match[0].trim();

                // Also try to extract any code blocks within the solution
                const codeBlocks = this.extractCodeBlocks(solution);
                if (codeBlocks.length > 0) {
                    // Append code snippets to solution
                    return solution;
                }

                return solution;
            }
        }

        // Look for step-by-step instructions
        const stepsPattern = /(?:Steps?(?:\s+to\s+(?:fix|resolve|solve))?|Instructions?):?\s*\n((?:[\s]*(?:\d+\.|-|\*)\s+.+\n?)+)/i;
        const stepsMatch = text.match(stepsPattern);
        if (stepsMatch) {
            return `Steps to resolve:\n${stepsMatch[1].trim()}`;
        }

        // If no explicit solution section, find paragraphs mentioning keywords and solution
        const lines = text.split('\n');
        const relevantParagraphs: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();

            if (keywords.some(k => line.includes(k.toLowerCase())) &&
                (line.includes('fix') || line.includes('solution') || line.includes('resolve') ||
                 line.includes('workaround') || line.includes('to solve'))) {
                // Get surrounding context (more lines for better context)
                const start = Math.max(0, i - 3);
                const end = Math.min(lines.length, i + 10);
                const context = lines.slice(start, end).join('\n');

                // Check if this section has code blocks
                const hasCode = /```[\s\S]*?```|`[^`]+`/.test(context);
                relevantParagraphs.push(context);

                if (hasCode) {
                    // Prioritize sections with code
                    return context;
                }
            }
        }

        if (relevantParagraphs.length > 0) {
            return relevantParagraphs[0];
        }

        return undefined;
    }

    /**
     * Extract code blocks from text
     */
    private extractCodeBlocks(text: string): string[] {
        const codeBlocks: string[] = [];

        // Match fenced code blocks (```language ... ```)
        const fencedPattern = /```[\w]*\n([\s\S]*?)```/g;
        let match;
        while ((match = fencedPattern.exec(text)) !== null) {
            codeBlocks.push(match[1].trim());
        }

        // Match inline code (`code`)
        const inlinePattern = /`([^`]+)`/g;
        while ((match = inlinePattern.exec(text)) !== null) {
            if (match[1].length > 10) { // Only meaningful code snippets
                codeBlocks.push(match[1]);
            }
        }

        return codeBlocks;
    }

    /**
     * Calculate term rarity weight (IDF-like scoring)
     * Rare/specific terms get higher weights, common terms get lower weights
     */
    private calculateTermRarity(term: string): number {
        const lowerTerm = term.toLowerCase();

        // Very rare/specific terms (product names, version numbers) - 2.0x weight
        if (/^(bpfman|ebpf|ginkgo|konflux|subscription|daemon)$/.test(lowerTerm)) {
            return 2.0;
        }

        // Version numbers (0.5.7, v1.2.3, etc.) - 1.8x weight
        if (/^v?\d+\.\d+(\.\d+)?(-\w+)?$/.test(lowerTerm)) {
            return 1.8;
        }

        // Hyphenated technical terms (operator-subscription, etc.) - 1.6x weight
        if (/-/.test(lowerTerm) && lowerTerm.length > 8) {
            return 1.6;
        }

        // Medium specificity terms (mismatch, upgrade, deployment) - 1.3x weight
        if (/^(mismatch|upgrade|deployment|release|operator|alignment)$/.test(lowerTerm)) {
            return 1.3;
        }

        // Common technical terms (version, test, build) - 1.0x weight (no boost)
        if (/^(version|test|build|error|issue|problem)$/.test(lowerTerm)) {
            return 1.0;
        }

        // Default for other terms - 1.2x weight (slight boost for specificity)
        return 1.2;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
