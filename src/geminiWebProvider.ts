import * as vscode from 'vscode';
import { DetectedError, Resolution } from './errorResolver';

export class GeminiWebProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    /**
     * Generate Gemini web search via Google (shows Gemini AI Overview)
     */
    async searchWithGemini(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Build search query
        const searchQuery = this.buildSearchQuery(error);
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

        resolutions.push({
            source: 'web',
            title: '✨ Search with Gemini AI (Google)',
            description: `Opens Google Search with Gemini AI Overview analyzing: "${error.errorMessage}"`,
            url: googleUrl,
            confidence: 75
        });

        return resolutions;
    }

    /**
     * Build optimized search query for Gemini AI Overview
     */
    private buildSearchQuery(error: DetectedError): string {
        let query = '';

        // Add error type and message
        if (error.errorType) {
            query = `${error.errorType} error: `;
        }
        query += error.errorMessage;

        // Add file context if available
        if (error.file) {
            const fileName = error.file.split('/').pop();
            query += ` in ${fileName}`;
        }

        // Keep query concise (Gemini AI Overview works best with focused queries)
        query = query
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200);

        return query;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
