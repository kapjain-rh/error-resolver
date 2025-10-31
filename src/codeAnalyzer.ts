import * as vscode from 'vscode';
import * as path from 'path';
import { DetectedError, Resolution } from './errorResolver';

export class CodeAnalyzer implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    /**
     * Analyze error and find resolutions from codebase
     */
    async analyzeError(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Search for similar error messages in comments
        const commentResolutions = await this.searchInComments(error);
        resolutions.push(...commentResolutions);

        // Search for try-catch blocks handling similar errors
        const tryCatchResolutions = await this.searchTryCatchBlocks(error);
        resolutions.push(...tryCatchResolutions);

        // Search for error documentation
        const docResolutions = await this.searchDocumentation(error);
        resolutions.push(...docResolutions);

        // If error has file and line number, analyze that specific location
        if (error.file && error.lineNumber) {
            const contextResolution = await this.analyzeErrorContext(error);
            if (contextResolution) {
                resolutions.push(contextResolution);
            }
        }

        return resolutions;
    }

    /**
     * Search for error handling in comments
     */
    private async searchInComments(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return resolutions;
        }

        try {
            // Search for comments mentioning the error
            const searchPattern = this.extractKeywords(error.errorMessage);
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,go,cpp,c,cs,rb,php}',
                '**/node_modules/**',
                100
            );

            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].toLowerCase();

                    // Look for comments with error keywords
                    if (
                        (line.includes('//') || line.includes('#') || line.includes('/*')) &&
                        searchPattern.some(keyword => line.includes(keyword.toLowerCase()))
                    ) {
                        // Found a comment mentioning this error
                        const context = this.getCodeContext(lines, i, 5);

                        resolutions.push({
                            source: 'code',
                            title: `Similar error handling found in ${path.basename(file.fsPath)}`,
                            description: `Found comment or code handling similar error at line ${i + 1}`,
                            codeSnippet: context,
                            file: file.fsPath,
                            lineNumber: i + 1,
                            confidence: 60
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error searching comments:', error);
        }

        return resolutions;
    }

    /**
     * Search for try-catch blocks handling similar errors
     */
    private async searchTryCatchBlocks(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return resolutions;
        }

        try {
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,go}',
                '**/node_modules/**',
                100
            );

            const errorKeywords = this.extractKeywords(error.errorMessage);

            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();

                // Search for catch blocks
                const catchPattern = /(catch|except)\s*\([^)]*\)\s*{([^}]+)}/gi;
                let match;

                while ((match = catchPattern.exec(text)) !== null) {
                    const catchBlock = match[0];

                    // Check if catch block handles similar error
                    if (errorKeywords.some(keyword =>
                        catchBlock.toLowerCase().includes(keyword.toLowerCase())
                    )) {
                        const position = document.positionAt(match.index);

                        resolutions.push({
                            source: 'code',
                            title: `Error handler found in ${path.basename(file.fsPath)}`,
                            description: `Found error handling code that may help resolve this issue`,
                            codeSnippet: catchBlock,
                            file: file.fsPath,
                            lineNumber: position.line + 1,
                            confidence: 70
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error searching try-catch blocks:', error);
        }

        return resolutions;
    }

    /**
     * Search documentation files for error information
     */
    private async searchDocumentation(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        try {
            const docFiles = await vscode.workspace.findFiles(
                '**/*.{md,txt,rst,doc}',
                '**/node_modules/**',
                50
            );

            const errorKeywords = this.extractKeywords(error.errorMessage);

            for (const file of docFiles) {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText().toLowerCase();

                // Check if doc mentions the error
                const relevanceScore = errorKeywords.filter(keyword =>
                    text.includes(keyword.toLowerCase())
                ).length;

                if (relevanceScore > 0) {
                    resolutions.push({
                        source: 'code',
                        title: `Documentation: ${path.basename(file.fsPath)}`,
                        description: `Found ${relevanceScore} matching keywords in documentation`,
                        file: file.fsPath,
                        confidence: Math.min(relevanceScore * 15, 50)
                    });
                }
            }
        } catch (error) {
            console.error('Error searching documentation:', error);
        }

        return resolutions;
    }

    /**
     * Analyze the specific error context if file and line are available
     */
    private async analyzeErrorContext(error: DetectedError): Promise<Resolution | null> {
        if (!error.file || !error.lineNumber) {
            return null;
        }

        try {
            const uri = vscode.Uri.file(error.file);
            const document = await vscode.workspace.openTextDocument(uri);
            const line = document.lineAt(error.lineNumber - 1);

            // Get surrounding context
            const startLine = Math.max(0, error.lineNumber - 10);
            const endLine = Math.min(document.lineCount, error.lineNumber + 10);

            let contextSnippet = '';
            for (let i = startLine; i < endLine; i++) {
                contextSnippet += document.lineAt(i).text + '\n';
            }

            return {
                source: 'code',
                title: `Error location in ${path.basename(error.file)}`,
                description: `Error occurred at line ${error.lineNumber}`,
                codeSnippet: contextSnippet,
                file: error.file,
                lineNumber: error.lineNumber,
                confidence: 90
            };
        } catch (err) {
            console.error('Error analyzing error context:', err);
            return null;
        }
    }

    /**
     * Extract keywords from error message
     */
    private extractKeywords(errorMessage: string): string[] {
        // Remove common words and extract meaningful keywords
        const commonWords = ['error', 'exception', 'the', 'a', 'an', 'is', 'at', 'in', 'of', 'to'];

        const words = errorMessage
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));

        return [...new Set(words)]; // Remove duplicates
    }

    /**
     * Get code context around a line
     */
    private getCodeContext(lines: string[], lineIndex: number, contextSize: number): string {
        const start = Math.max(0, lineIndex - contextSize);
        const end = Math.min(lines.length, lineIndex + contextSize + 1);
        return lines.slice(start, end).join('\n');
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
