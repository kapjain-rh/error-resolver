import * as vscode from 'vscode';
import { ErrorResolution } from './errorResolver';

export class ResolutionPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Show the resolution panel with error resolutions
     */
    show(resolutions: ErrorResolution[]): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'errorResolution',
                '🔍 Error Analysis',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.disposables);

            // Handle messages from the webview
            this.panel.webview.onDidReceiveMessage(
                message => this.handleMessage(message),
                null,
                this.disposables
            );
        }

        this.panel.webview.html = this.getHtmlContent(resolutions);
    }

    /**
     * Handle messages from webview
     */
    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'openFile':
                if (message.file && message.line) {
                    await this.openFile(message.file, message.line);
                }
                break;

            case 'openUrl':
                if (message.url) {
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                }
                break;

            case 'copyCode':
                if (message.code) {
                    await vscode.env.clipboard.writeText(message.code);
                    vscode.window.showInformationMessage('✓ Code copied to clipboard');
                }
                break;

        }
    }


    /**
     * Open a file at a specific line
     */
    private async openFile(filePath: string, line: number): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    /**
     * Get SVG icon for error type
     */
    private getErrorIcon(errorType: string): string {
        const icons: Record<string, string> = {
            'typescript': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3178C6"/><path d="M12 12V22L2 17V7" fill="#3178C6" opacity="0.7"/><path d="M12 12V22L22 17V7" fill="#3178C6" opacity="0.7"/></svg>`,
            'javascript': `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#F7DF1E"/><text x="5" y="18" font-size="16" font-weight="bold">JS</text></svg>`,
            'python': `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#3776AB" d="M12 2C10.9 2 10 2.9 10 4V8H14V9H8C6.9 9 6 9.9 6 11V13C6 14.1 6.9 15 8 15H10V11H14V15H16C17.1 15 18 14.1 18 13V4C18 2.9 17.1 2 16 2H12M12 4C12.6 4 13 4.4 13 5C13 5.6 12.6 6 12 6C11.4 6 11 5.6 11 5C11 4.4 11.4 4 12 4Z"/></svg>`,
            'npm': `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="#CB3837"/><text x="4" y="17" font-size="10" fill="white" font-weight="bold">npm</text></svg>`,
            'default': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L1 21H23L12 2Z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 9V13M12 16V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
        };
        return icons[errorType.toLowerCase()] || icons['default'];
    }

    /**
     * Get source badge color and icon
     */
    private getSourceStyle(source: string): { color: string; icon: string; label: string } {
        const styles: Record<string, any> = {
            'code': {
                color: '#0078D4',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 7L3 12L8 17M16 7L21 12L16 17M13 3L11 21" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
                label: 'CODE'
            },
            'rca': {
                color: '#F59E0B',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="white" stroke-width="2"/></svg>`,
                label: 'RCA'
            },
            'web': {
                color: '#10B981',
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/><path d="M12 3C8 3 6 7.5 6 12C6 16.5 8 21 12 21M12 3C16 3 18 7.5 18 12C18 16.5 16 21 12 21M12 3V21M3 12H21" stroke="white" stroke-width="2"/></svg>`,
                label: 'WEB'
            }
        };
        return styles[source] || styles['web'];
    }

    /**
     * Generate HTML content for the webview
     */
    private getHtmlContent(resolutions: ErrorResolution[]): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
    <title>Error Analysis</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #0078D4;
            --success: #10B981;
            --warning: #F59E0B;
            --error: #EF4444;
            --ai: #8B5CF6;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            --radius: 8px;
            --radius-lg: 12px;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 24px;
        }

        .header {
            margin-bottom: 32px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, var(--vscode-foreground) 0%, var(--vscode-descriptionForeground) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .count-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
        }

        .error-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--radius-lg);
            margin-bottom: 24px;
            overflow: hidden;
            box-shadow: var(--shadow-md);
            transition: all 0.2s ease;
        }

        .error-card:hover {
            box-shadow: var(--shadow-lg);
            border-color: var(--vscode-focusBorder);
        }

        .error-header {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            transition: background 0.2s ease;
        }

        .error-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .error-icon-wrapper {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: var(--vscode-inputValidation-errorBackground);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .error-content {
            flex: 1;
            min-width: 0;
        }

        .error-type-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .error-message {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
            line-height: 1.5;
            color: var(--vscode-foreground);
        }

        .error-file-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .chevron {
            flex-shrink: 0;
            transition: transform 0.2s ease;
        }

        .error-header.expanded .chevron {
            transform: rotate(180deg);
        }

        .error-details {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .error-details.expanded {
            max-height: 5000px;
        }

        .error-context {
            background: var(--vscode-textCodeBlock-background);
            padding: 16px;
            margin: 0 20px 20px 20px;
            border-radius: var(--radius);
            border-left: 3px solid var(--vscode-focusBorder);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            line-height: 1.5;
        }

        .resolutions-section {
            padding: 0 20px 20px 20px;
        }

        .resolutions-header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vscode-foreground);
        }

        .resolution {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--radius);
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.2s ease;
            position: relative;
        }

        .resolution:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: var(--shadow);
        }

        .resolution.ai-resolution {
            border-left: 3px solid var(--ai);
        }

        .resolution-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            gap: 12px;
        }

        .resolution-meta {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .resolution-source {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            color: white;
        }

        .confidence-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .confidence-bar {
            width: 60px;
            height: 6px;
            background: var(--vscode-editorWidget-background);
            border-radius: 3px;
            overflow: hidden;
        }

        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--success) 0%, var(--primary) 100%);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .resolution-title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .resolution-description {
            margin-bottom: 12px;
            line-height: 1.6;
            color: var(--vscode-foreground);
        }

        .code-snippet {
            background: var(--vscode-textCodeBlock-background);
            padding: 16px;
            border-radius: var(--radius);
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            overflow-x: auto;
            line-height: 1.5;
            margin-top: 12px;
            border: 1px solid var(--vscode-panel-border);
            position: relative;
        }

        .code-snippet code {
            color: var(--vscode-editor-foreground);
        }

        .actions {
            margin-top: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
            box-shadow: var(--shadow);
        }

        button:active {
            transform: translateY(0);
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .no-resolutions {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .loading-skeleton {
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Syntax highlighting */
        .keyword { color: #C586C0; }
        .string { color: #CE9178; }
        .comment { color: #6A9955; font-style: italic; }
        .function { color: #DCDCAA; }
        .number { color: #B5CEA8; }

    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Error Analysis</h1>
        <div class="subtitle">
            <span>Analyzed errors with AI-powered solutions</span>
            <span class="count-badge">${resolutions.length} error${resolutions.length !== 1 ? 's' : ''}</span>
        </div>
    </div>

    ${resolutions.map((errorRes, index) => this.renderErrorResolution(errorRes, index)).join('')}

    <script>
        const vscode = acquireVsCodeApi();

        // Toggle error details
        function toggleError(index) {
            const header = document.getElementById('error-header-' + index);
            const details = document.getElementById('error-details-' + index);

            header.classList.toggle('expanded');
            details.classList.toggle('expanded');
        }

        function openFile(file, line) {
            vscode.postMessage({
                command: 'openFile',
                file: file,
                line: line
            });
        }

        function openUrl(url) {
            vscode.postMessage({
                command: 'openUrl',
                url: url
            });
        }

        function copyCode(code) {
            vscode.postMessage({
                command: 'copyCode',
                code: code
            });
        }

        // Auto-expand first error
        window.addEventListener('load', () => {
            const firstHeader = document.getElementById('error-header-0');
            const firstDetails = document.getElementById('error-details-0');
            if (firstHeader && firstDetails) {
                firstHeader.classList.add('expanded');
                firstDetails.classList.add('expanded');
            }
        });
    </script>
</body>
</html>`;
    }

    /**
     * Render a single error resolution
     */
    private renderErrorResolution(errorRes: ErrorResolution, index: number): string {
        const { error, resolutions } = errorRes;
        const errorIcon = this.getErrorIcon(error.errorType);

        return `
            <div class="error-card">
                <div class="error-header" id="error-header-${index}" onclick="toggleError(${index})">
                    <div class="error-icon-wrapper">
                        ${errorIcon}
                    </div>
                    <div class="error-content">
                        <div class="error-type-badge">
                            ${this.escapeHtml(error.errorType)}
                        </div>
                        <div class="error-message">${this.escapeHtml(error.errorMessage)}</div>
                        ${error.file ? `<div class="error-file-info">
                            📄 ${this.escapeHtml(error.file)}${error.lineNumber ? `:${error.lineNumber}` : ''}
                        </div>` : ''}
                    </div>
                    <svg class="chevron" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                    </svg>
                </div>

                <div class="error-details" id="error-details-${index}">
                    ${error.context ? `<div class="error-context">${this.escapeHtml(error.context)}</div>` : ''}

                    <div class="resolutions-section">
                        <div class="resolutions-header">
                            💡 Solutions (${resolutions.length})
                        </div>

                        ${resolutions.length > 0 ? resolutions.map(res => this.renderResolution(res)).join('') :
                            '<div class="no-resolutions">No specific solutions found</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single resolution
     */
    private renderResolution(resolution: any): string {
        const isGemini = resolution.title.includes('✨');
        const isAI = resolution.title.includes('🤖') || isGemini;

        // Override style for Gemini
        let sourceStyle;
        if (isGemini) {
            sourceStyle = {
                color: '#4285F4', // Google Blue
                icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white"/></svg>`,
                label: 'GEMINI'
            };
        } else {
            sourceStyle = this.getSourceStyle(resolution.source);
        }

        return `
            <div class="resolution ${isAI ? 'ai-resolution' : ''}">
                <div class="resolution-header">
                    <div class="resolution-meta">
                        <span class="resolution-source" style="background-color: ${sourceStyle.color}">
                            ${sourceStyle.icon}
                            ${sourceStyle.label}
                        </span>
                        <span class="confidence-badge">
                            ${resolution.confidence}%
                            <span class="confidence-bar">
                                <span class="confidence-fill" style="width: ${resolution.confidence}%"></span>
                            </span>
                        </span>
                    </div>
                </div>
                <div class="resolution-title">${this.escapeHtml(resolution.title)}</div>
                <div class="resolution-description">${this.escapeHtml(resolution.description)}</div>

                ${resolution.codeSnippet ? `
                    <div class="code-snippet"><code>${this.escapeHtml(resolution.codeSnippet)}</code></div>
                ` : ''}

                <div class="actions">
                    ${resolution.file ? `
                        <button onclick="openFile('${this.escapeJsString(resolution.file)}', ${resolution.lineNumber || 1})">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L13 1.586A2 2 0 0011.586 1H9z"/>
                            </svg>
                            Open File
                        </button>
                    ` : ''}
                    ${resolution.url ? `
                        <button onclick="openUrl('${this.escapeJsString(resolution.url)}')">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                            </svg>
                            Open Link
                        </button>
                    ` : ''}
                    ${resolution.codeSnippet ? `
                        <button class="secondary" onclick="copyCode(\`${this.escapeJsString(resolution.codeSnippet)}\`)">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                            </svg>
                            Copy Code
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Escape JavaScript string
     */
    private escapeJsString(text: string): string {
        return text.replace(/\\/g, '\\\\')
                   .replace(/`/g, '\\`')
                   .replace(/\$/g, '\\$')
                   .replace(/'/g, "\\'")
                   .replace(/"/g, '\\"')
                   .replace(/\n/g, '\\n')
                   .replace(/\r/g, '\\r');
    }

    dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
    }
}
