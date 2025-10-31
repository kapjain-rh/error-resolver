import * as vscode from 'vscode';
import { DetectedError, Resolution } from './errorResolver';

interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ClaudeRequest {
    model: string;
    max_tokens: number;
    messages: ClaudeMessage[];
}

interface ClaudeResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
    stop_reason: string;
}

export class ClaudeAnalyzer implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private apiKey: string | undefined;
    private apiEndpoint = 'https://api.anthropic.com/v1/messages';
    private model = 'claude-3-5-sonnet-20241022';

    constructor(private context: vscode.ExtensionContext) {
        this.loadApiKey();
    }

    /**
     * Load Claude API key from configuration
     */
    private loadApiKey(): void {
        const config = vscode.workspace.getConfiguration('error-resolver');
        this.apiKey = config.get<string>('claudeApiKey');
    }

    /**
     * Analyze error using Claude API
     */
    async analyzeError(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Check if API key is configured
        if (!this.apiKey || this.apiKey.trim() === '') {
            // Silently skip Claude API analysis if not configured
            return resolutions;
        }

        try {
            const analysis = await this.getClaudeAnalysis(error);

            if (analysis) {
                resolutions.push({
                    source: 'code', // Using 'code' source type for now, will be displayed as 'AI' in UI
                    title: '🤖 AI-Powered Analysis',
                    description: analysis.explanation,
                    codeSnippet: analysis.solution,
                    confidence: 85
                });

                // Add each specific suggestion as a separate resolution
                if (analysis.suggestions && analysis.suggestions.length > 0) {
                    analysis.suggestions.forEach((suggestion, index) => {
                        resolutions.push({
                            source: 'code',
                            title: `🤖 AI Suggestion ${index + 1}`,
                            description: suggestion,
                            confidence: 80
                        });
                    });
                }
            }
        } catch (error) {
            console.error('[ClaudeAnalyzer] Error analyzing with Claude:', error);

            // Show error to user if it's an API key issue
            if (error instanceof Error && error.message.includes('authentication')) {
                vscode.window.showErrorMessage(
                    'Claude API authentication failed. Please check your API key in settings.',
                    'Open Settings'
                ).then(action => {
                    if (action === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'error-resolver.claudeApiKey');
                    }
                });
            }
        }

        return resolutions;
    }

    /**
     * Get error analysis from Claude API
     */
    private async getClaudeAnalysis(error: DetectedError): Promise<{
        explanation: string;
        solution: string;
        suggestions: string[];
    } | null> {
        const prompt = this.buildPrompt(error);

        try {
            const requestBody: ClaudeRequest = {
                model: this.model,
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey!,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Claude API error (${response.status}): ${errorText}`);
            }

            const data = await response.json() as ClaudeResponse;

            if (data.content && data.content.length > 0) {
                const text = data.content[0].text;
                return this.parseClaudeResponse(text);
            }

            return null;
        } catch (error) {
            console.error('[ClaudeAnalyzer] API call failed:', error);
            throw error;
        }
    }

    /**
     * Build prompt for Claude
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
     * Parse Claude's response into structured data
     */
    private parseClaudeResponse(text: string): {
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

    /**
     * Test Claude API connection
     */
    async testConnection(): Promise<boolean> {
        if (!this.apiKey || this.apiKey.trim() === '') {
            return false;
        }

        try {
            const requestBody: ClaudeRequest = {
                model: this.model,
                max_tokens: 10,
                messages: [
                    {
                        role: 'user',
                        content: 'Hi'
                    }
                ]
            };

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            return response.ok;
        } catch (error) {
            console.error('[ClaudeAnalyzer] Connection test failed:', error);
            return false;
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
