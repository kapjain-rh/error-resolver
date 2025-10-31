import * as vscode from 'vscode';
import { TerminalMonitor } from './terminalMonitor';
import { ErrorResolver } from './errorResolver';
import { ResolutionPanel } from './resolutionPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Error Resolver extension is now active');

    // Initialize the terminal monitor
    const terminalMonitor = new TerminalMonitor();
    const errorResolver = new ErrorResolver(context);
    const resolutionPanel = new ResolutionPanel(context);

    // Register command to toggle monitoring for monitored terminals
    const toggleMonitoringCmd = vscode.commands.registerCommand(
        'error-resolver.toggleMonitoring',
        () => {
            if (terminalMonitor.isMonitoringActive()) {
                terminalMonitor.stopMonitoring();
                vscode.window.showInformationMessage('⏸️ Auto-detection paused for monitored terminals');
            } else {
                terminalMonitor.startMonitoring();
                vscode.window.showInformationMessage('▶️ Auto-detection enabled for monitored terminals');
            }
        }
    );

    // Register command to analyze current terminal
    const analyzeTerminalCmd = vscode.commands.registerCommand(
        'error-resolver.analyzeTerminal',
        async () => {
            // Get terminal output from clipboard
            const clipboardContent = await vscode.env.clipboard.readText();

            if (!clipboardContent || clipboardContent.trim().length === 0) {
                const action = await vscode.window.showInformationMessage(
                    'Copy your terminal output to clipboard first, then run this command again.',
                    'Show Instructions'
                );

                if (action === 'Show Instructions') {
                    vscode.window.showInformationMessage(
                        'Instructions: 1) Select terminal text with mouse, 2) Copy (Cmd+C), 3) Run this command again'
                    );
                }
                return;
            }

            vscode.window.showInformationMessage('Analyzing terminal output for errors...');
            const resolutions = await errorResolver.analyzeAndResolve(clipboardContent);

            if (resolutions.length > 0) {
                resolutionPanel.show(resolutions);
            } else {
                vscode.window.showInformationMessage('No errors detected in terminal output');
            }
        }
    );

    // Register command to analyze from input
    const analyzeFromInputCmd = vscode.commands.registerCommand(
        'error-resolver.analyzeFromInput',
        async () => {
            const input = await vscode.window.showInputBox({
                prompt: 'Paste your terminal output or error message here',
                placeHolder: 'Error: Cannot find module...',
                ignoreFocusOut: true,
                value: await vscode.env.clipboard.readText()
            });

            if (!input || input.trim().length === 0) {
                return;
            }

            vscode.window.showInformationMessage('Analyzing for errors...');
            const resolutions = await errorResolver.analyzeAndResolve(input);

            if (resolutions.length > 0) {
                resolutionPanel.show(resolutions);
            } else {
                vscode.window.showInformationMessage('No errors detected in the provided text');
            }
        }
    );

    // Register command to create monitored terminal
    const createMonitoredTerminalCmd = vscode.commands.registerCommand(
        'error-resolver.createMonitoredTerminal',
        () => {
            const terminal = terminalMonitor.createMonitoredTerminal('Monitored Terminal');
            terminal.show();

            // Auto-start monitoring if not already started
            if (!terminalMonitor.isMonitoringActive()) {
                terminalMonitor.startMonitoring();
            }

            vscode.window.showInformationMessage(
                'Created monitored terminal. Errors will be auto-detected! 🔍'
            );
        }
    );

    // Handle terminal output in real-time with debouncing
    let outputBuffer = '';
    let debounceTimer: NodeJS.Timeout | undefined;
    const notifiedErrors = new Set<string>();

    // Command to clear notification cache for testing
    const clearCacheCmd = vscode.commands.registerCommand(
        'error-resolver.clearCache',
        () => {
            notifiedErrors.clear();
            vscode.window.showInformationMessage('Error notification cache cleared! 🗑️');
            console.log('[Extension] Notification cache cleared');
        }
    );

    console.log('[Extension] Registering output callback');

    terminalMonitor.onOutputReceived(async (output: string) => {
        console.log('[Extension] Output received callback triggered!');
        console.log('[Extension] Output length:', output.length);
        console.log('[Extension] Output preview:', output.substring(0, 100));

        // Accumulate output
        outputBuffer += output;

        // Clear previous timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Debounce: wait for output to settle before analyzing
        debounceTimer = setTimeout(async () => {
            console.log('[Extension] Analyzing buffer, length:', outputBuffer.length);

            const errors = await errorResolver.detectErrors(outputBuffer);
            console.log('[Extension] Detected errors:', errors.length);

            if (errors.length > 0) {
                console.log('[Extension] Errors found:', errors.map(e => e.errorMessage));
            }

            // Filter out already notified errors
            const newErrors = errors.filter(error => {
                const errorKey = `${error.errorType}:${error.errorMessage}`;
                if (notifiedErrors.has(errorKey)) {
                    console.log('[Extension] Skipping duplicate error:', errorKey);
                    return false;
                }
                notifiedErrors.add(errorKey);

                // Clear old notifications after 5 minutes
                setTimeout(() => notifiedErrors.delete(errorKey), 5 * 60 * 1000);
                return true;
            });

            console.log('[Extension] New errors to notify:', newErrors.length);

            if (newErrors.length > 0) {
                // Show notification for detected errors
                console.log('[Extension] Showing notification...');
                const action = await vscode.window.showWarningMessage(
                    `Detected ${newErrors.length} error(s) in monitored terminal`,
                    'Analyze',
                    'Ignore'
                );

                console.log('[Extension] User action:', action);

                if (action === 'Analyze') {
                    const resolutions = await errorResolver.resolveErrors(newErrors);
                    resolutionPanel.show(resolutions);
                }
            }

            // Clear buffer after analysis
            outputBuffer = '';
        }, 500); // Wait 500ms after output stops
    });

    console.log('[Extension] Output callback registered successfully');

    context.subscriptions.push(
        toggleMonitoringCmd,
        analyzeTerminalCmd,
        analyzeFromInputCmd,
        createMonitoredTerminalCmd,
        clearCacheCmd,
        terminalMonitor,
        errorResolver,
        resolutionPanel
    );
}

export function deactivate() {
    console.log('Error Resolver extension is now deactivated');
}
