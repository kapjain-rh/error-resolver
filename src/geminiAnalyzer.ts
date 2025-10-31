import * as vscode from 'vscode';
import { DetectedError, Resolution } from './errorResolver';

interface GeminiMessage {
    role: string;
    parts: Array<{ text: string }>;
}

interface GeminiRequest {
    contents: GeminiMessage[];
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
    }>;
}

export class GeminiAnalyzer implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private apiKey: string | undefined;
    private apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    constructor(private context: vscode.ExtensionContext) {
        this.loadApiKey();
    }

    /**
     * Load Gemini API key from configuration
     */
    private loadApiKey(): void {
        const config = vscode.workspace.getConfiguration('error-resolver');
        this.apiKey = config.get<string>('geminiApiKey');
    }

    /**
     * Analyze error using Gemini API
     */
    async analyzeError(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Check if API key is configured
        if (!this.apiKey || this.apiKey.trim() === '') {
            // Silently skip Gemini API analysis if not configured
            return resolutions;
        }

        try {
            const analysis = await this.getGeminiAnalysis(error);

            if (analysis) {
                resolutions.push({
                    source: 'rca', // Using 'rca' source type for now, will be displayed as 'GEMINI' in UI
                    title: '✨ Gemini AI Analysis',
                    description: analysis.explanation,
                    codeSnippet: analysis.solution,
                    confidence: 90
                });

                // Add each specific suggestion as a separate resolution
                if (analysis.suggestions && analysis.suggestions.length > 0) {
                    analysis.suggestions.forEach((suggestion, index) => {
                        resolutions.push({
                            source: 'rca',
                            title: `✨ Gemini Suggestion ${index + 1}`,
                            description: suggestion,
                            confidence: 85
                        });
                    });
                }
            }
        } catch (error) {
            console.error('[GeminiAnalyzer] Error analyzing with Gemini:', error);

            // Show error to user if it's an API key issue
            if (error instanceof Error && error.message.includes('API key')) {
                vscode.window.showErrorMessage(
                    'Gemini API authentication failed. Please check your API key in settings.',
                    'Open Settings'
                ).then(action => {
                    if (action === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'error-resolver.geminiApiKey');
                    }
                });
            }
        }

        return resolutions;
    }

    /**
     * Get error analysis from Gemini API
     */
    private async getGeminiAnalysis(error: DetectedError): Promise<{
        explanation: string;
        solution: string;
        suggestions: string[];
    } | null> {
        const prompt = this.buildPrompt(error);

        try {
            const requestBody: GeminiRequest = {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ]
            };

            const url = `${this.apiEndpoint}?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error (${response.status}): ${errorText}`);
            }

            const data = await response.json() as GeminiResponse;

            if (data.candidates && data.candidates.length > 0) {
                const text = data.candidates[0].content.parts[0].text;
                return this.parseGeminiResponse(text);
            }

            return null;
        } catch (error) {
            console.error('[GeminiAnalyzer] API call failed:', error);
            throw error;
        }
    }

    /**
     * Build prompt for Gemini
     */
    private buildPrompt(error: DetectedError): string {
        return `You are an expert software debugging assistant. Analyze the following error and provide a detailed, actionable solution.

Error Information:
- Type: ${error.errorType}
- Message: ${error.errorMessage}
${error.file ? `- File: ${error.file}${error.lineNumber ? `:${error.lineNumber}` : ''}` : ''}
${error.stackTrace ? `- Stack Trace:\n${error.stackTrace}` : ''}
${error.context ? `- Context:\n${error.context}` : ''}

Please provide your response in the following format:

EXPLANATION:
[A clear explanation of what caused this error and why it occurred]

SOLUTION:
[Specific code or commands to fix this error. If it's code, provide a complete, working code snippet]

SUGGESTIONS:
1. [First preventive measure or best practice]
2. [Second preventive measure or best practice]
3. [Third preventive measure or best practice]

Keep the explanation concise but thorough. Make the solution immediately actionable. Focus on practical suggestions.`;
    }

    /**
     * Parse Gemini's response into structured data
     */
    private parseGeminiResponse(text: string): {
        explanation: string;
        solution: string;
        suggestions: string[];
    } {
        const sections = {
            explanation: '',
            solution: '',
            suggestions: [] as string[]
        };

        // Extract EXPLANATION section
        const explanationMatch = text.match(/EXPLANATION:\s*([\s\S]*?)(?=SOLUTION:|$)/i);
        if (explanationMatch) {
            sections.explanation = explanationMatch[1].trim();
        }

        // Extract SOLUTION section
        const solutionMatch = text.match(/SOLUTION:\s*([\s\S]*?)(?=SUGGESTIONS:|$)/i);
        if (solutionMatch) {
            sections.solution = solutionMatch[1].trim();
        }

        // Extract SUGGESTIONS section
        const suggestionsMatch = text.match(/SUGGESTIONS:\s*([\s\S]*?)$/i);
        if (suggestionsMatch) {
            const suggestionText = suggestionsMatch[1].trim();
            // Parse numbered list
            const suggestionLines = suggestionText.split('\n')
                .map(line => line.trim())
                .filter(line => /^\d+\./.test(line))
                .map(line => line.replace(/^\d+\.\s*/, ''));

            sections.suggestions = suggestionLines;
        }

        // Fallback: if parsing failed, use the entire text as explanation
        if (!sections.explanation && !sections.solution) {
            sections.explanation = text.trim();
        }

        return sections;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
