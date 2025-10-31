import * as vscode from 'vscode';
import { exec, spawn, ChildProcess } from 'child_process';
import * as os from 'os';

export class TerminalMonitor implements vscode.Disposable {
    private terminalOutputs: Map<vscode.Terminal, string> = new Map();
    private isMonitoring: boolean = false;
    private outputCallbacks: ((output: string) => void)[] = [];
    private disposables: vscode.Disposable[] = [];
    private monitoredTerminals: Set<vscode.Terminal> = new Set();

    constructor() {
        // Listen for terminals being closed
        this.disposables.push(
            vscode.window.onDidCloseTerminal((terminal) => {
                this.terminalOutputs.delete(terminal);
                this.monitoredTerminals.delete(terminal);
            })
        );
    }

    startMonitoring(): void {
        this.isMonitoring = true;
        console.log('[TerminalMonitor] Monitoring started');
    }

    stopMonitoring(): void {
        this.isMonitoring = false;
        this.terminalOutputs.clear();
        console.log('[TerminalMonitor] Monitoring stopped');
    }

    /**
     * Creates a monitored terminal with real zsh shell and command history
     */
    createMonitoredTerminal(name?: string): vscode.Terminal {
        const writeEmitter = new vscode.EventEmitter<string>();
        let terminalOutput = '';
        let shellProcess: ChildProcess | null = null;
        let currentLine = '';
        let commandHistory: string[] = [];
        let historyIndex = -1;
        let atPrompt = false;  // Track if we're ready for input
        let inInteractiveMode = false;  // Track if we're in an interactive sub-shell (python, node, etc.)
        let fallbackPromptTimer: NodeJS.Timeout | null = null;  // Fallback to show prompt if no output
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();

        console.log('[TerminalMonitor] Creating monitored terminal, cwd:', cwd);

        const pseudoterminal: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,

            open: () => {
                console.log('[TerminalMonitor] Terminal opened, spawning shell');

                // Spawn zsh in pipe mode (without full PTY features)
                // We provide command history via JavaScript
                shellProcess = spawn('/bin/zsh', [], {
                    cwd: cwd,
                    env: {
                        ...process.env,
                        PS1: '$ ',  // Simple prompt
                        TERM: 'dumb',  // Disable fancy terminal features
                        HISTFILE: `${os.homedir()}/.zsh_history_monitored`,
                        HISTSIZE: '10000',
                        SAVEHIST: '10000'
                    }
                });

                console.log('[TerminalMonitor] Shell spawned, PID:', shellProcess.pid);

                if (shellProcess.stdout) {
                    let outputTimer: NodeJS.Timeout | null = null;
                    let lastOutputEndsWithNewline = true;
                    let lineBuffer = '';  // Buffer for current line

                    shellProcess.stdout.on('data', (data: Buffer) => {
                        const output = data.toString();

                        // Clear fallback prompt timer since we got output
                        if (fallbackPromptTimer) {
                            clearTimeout(fallbackPromptTimer);
                            fallbackPromptTimer = null;
                        }

                        // In interactive mode, pass output directly without processing
                        if (inInteractiveMode) {
                            writeEmitter.fire(output);
                            terminalOutput += output;
                            if (this.isMonitoring) {
                                this.notifyOutputReceived(output);
                            }
                            atPrompt = true;  // Always allow input in interactive mode
                            return;
                        }

                        // Process output character by character to handle \r correctly
                        for (let i = 0; i < output.length; i++) {
                            const char = output[i];

                            if (char === '\r') {
                                // Check if next char is \n (Windows line ending)
                                if (i + 1 < output.length && output[i + 1] === '\n') {
                                    // \r\n - output line and clear buffer
                                    writeEmitter.fire(lineBuffer + '\r\n');
                                    terminalOutput += lineBuffer + '\n';
                                    if (this.isMonitoring) {
                                        this.notifyOutputReceived(lineBuffer + '\n');
                                    }
                                    lineBuffer = '';
                                    i++; // Skip the \n
                                } else {
                                    // Standalone \r - clear buffer (line will be overwritten)
                                    lineBuffer = '';
                                }
                            } else if (char === '\n') {
                                // Unix line ending - output line and clear buffer
                                writeEmitter.fire(lineBuffer + '\r\n');
                                terminalOutput += lineBuffer + '\n';
                                if (this.isMonitoring) {
                                    this.notifyOutputReceived(lineBuffer + '\n');
                                }
                                lineBuffer = '';
                            } else {
                                // Regular character - add to buffer
                                lineBuffer += char;
                            }
                        }

                        // If there's buffered content, display it (for partial lines)
                        if (lineBuffer) {
                            writeEmitter.fire('\r\x1b[K' + lineBuffer);
                            lastOutputEndsWithNewline = false;
                        } else {
                            lastOutputEndsWithNewline = true;
                        }

                        // Show prompt after output finishes (debounced)
                        if (outputTimer) {
                            clearTimeout(outputTimer);
                        }
                        outputTimer = setTimeout(() => {
                            // Clear fallback timer since we're showing prompt now
                            if (fallbackPromptTimer) {
                                clearTimeout(fallbackPromptTimer);
                                fallbackPromptTimer = null;
                            }

                            // Ensure we're on a new line before showing prompt
                            if (!lastOutputEndsWithNewline) {
                                writeEmitter.fire('\r\n');
                            }
                            // Clear line and show prompt at beginning
                            writeEmitter.fire('\r\x1b[K$ ');
                            atPrompt = true;  // Ready for input
                        }, 100);
                    });
                }

                if (shellProcess.stderr) {
                    let errorTimer: NodeJS.Timeout | null = null;
                    let lastErrorEndsWithNewline = true;
                    let errorLineBuffer = '';  // Buffer for current error line

                    shellProcess.stderr.on('data', (data: Buffer) => {
                        const output = data.toString();

                        // Clear fallback prompt timer since we got output
                        if (fallbackPromptTimer) {
                            clearTimeout(fallbackPromptTimer);
                            fallbackPromptTimer = null;
                        }

                        // In interactive mode, pass output directly without processing
                        if (inInteractiveMode) {
                            writeEmitter.fire('\x1b[31m' + output + '\x1b[0m');
                            terminalOutput += output;
                            if (this.isMonitoring) {
                                this.notifyOutputReceived(output);
                            }
                            atPrompt = true;  // Always allow input in interactive mode
                            return;
                        }

                        // Process output character by character to handle \r correctly
                        for (let i = 0; i < output.length; i++) {
                            const char = output[i];

                            if (char === '\r') {
                                // Check if next char is \n (Windows line ending)
                                if (i + 1 < output.length && output[i + 1] === '\n') {
                                    // \r\n - output line and clear buffer
                                    writeEmitter.fire('\x1b[31m' + errorLineBuffer + '\x1b[0m\r\n');
                                    terminalOutput += errorLineBuffer + '\n';
                                    if (this.isMonitoring) {
                                        this.notifyOutputReceived(errorLineBuffer + '\n');
                                    }
                                    errorLineBuffer = '';
                                    i++; // Skip the \n
                                } else {
                                    // Standalone \r - clear buffer (line will be overwritten)
                                    errorLineBuffer = '';
                                }
                            } else if (char === '\n') {
                                // Unix line ending - output line and clear buffer
                                writeEmitter.fire('\x1b[31m' + errorLineBuffer + '\x1b[0m\r\n');
                                terminalOutput += errorLineBuffer + '\n';
                                if (this.isMonitoring) {
                                    this.notifyOutputReceived(errorLineBuffer + '\n');
                                }
                                errorLineBuffer = '';
                            } else {
                                // Regular character - add to buffer
                                errorLineBuffer += char;
                            }
                        }

                        // If there's buffered content, display it (for partial lines)
                        if (errorLineBuffer) {
                            writeEmitter.fire('\r\x1b[K\x1b[31m' + errorLineBuffer + '\x1b[0m');
                            lastErrorEndsWithNewline = false;
                        } else {
                            lastErrorEndsWithNewline = true;
                        }

                        // Show prompt after error output finishes (debounced)
                        if (errorTimer) {
                            clearTimeout(errorTimer);
                        }
                        errorTimer = setTimeout(() => {
                            // Clear fallback timer since we're showing prompt now
                            if (fallbackPromptTimer) {
                                clearTimeout(fallbackPromptTimer);
                                fallbackPromptTimer = null;
                            }

                            // Ensure we're on a new line before showing prompt
                            if (!lastErrorEndsWithNewline) {
                                writeEmitter.fire('\r\n');
                            }
                            // Clear line and show prompt at beginning
                            writeEmitter.fire('\r\x1b[K$ ');
                            atPrompt = true;  // Ready for input
                        }, 100);
                    });
                }

                shellProcess.on('exit', (code) => {
                    console.log('[TerminalMonitor] Shell exited with code:', code);
                    writeEmitter.fire(`\r\n[Shell exited with code ${code}]\r\n`);
                });

                // Show welcome and initial prompt
                writeEmitter.fire('\x1b[32m╔═══════════════════════════════════════════════════════════╗\x1b[0m\r\n');
                writeEmitter.fire('\x1b[32m║\x1b[0m  \x1b[1mError Resolver Monitored Terminal\x1b[0m                     \x1b[32m║\x1b[0m\r\n');
                writeEmitter.fire('\x1b[32m╚═══════════════════════════════════════════════════════════╝\x1b[0m\r\n');
                writeEmitter.fire('\r\n\r\x1b[K$ ');
                atPrompt = true;  // Ready for input
            },

            close: () => {
                console.log('[TerminalMonitor] Terminal closed');
                if (shellProcess && !shellProcess.killed) {
                    shellProcess.kill();
                }
            },

            handleInput: (data: string) => {
                if (!shellProcess || !shellProcess.stdin) {return;}

                // In interactive mode, pass input directly to shell without our processing
                if (inInteractiveMode) {
                    // Handle Ctrl+D to exit interactive mode
                    if (data === '\x04') {
                        inInteractiveMode = false;
                        shellProcess.stdin.write(data);
                        // After a delay, show our prompt again
                        setTimeout(() => {
                            writeEmitter.fire('\r\x1b[K$ ');
                            atPrompt = true;
                        }, 200);
                        return;
                    }

                    // Handle Enter
                    if (data === '\r') {
                        writeEmitter.fire('\r\n');
                        shellProcess.stdin.write('\n');
                        return;
                    }

                    // Handle backspace
                    if (data === '\x7f' || data === '\b') {
                        writeEmitter.fire('\b \b');
                        shellProcess.stdin.write('\x7f');
                        return;
                    }

                    // Handle Ctrl+C
                    if (data === '\x03') {
                        writeEmitter.fire('^C\r\n');
                        shellProcess.stdin.write('\x03');
                        return;
                    }

                    // Regular characters - echo and send to shell
                    writeEmitter.fire(data);
                    shellProcess.stdin.write(data);
                    return;
                }

                // Only accept input when at prompt (normal mode)
                if (!atPrompt) {
                    return;
                }

                // Handle arrow keys for history navigation
                if (data === '\x1b[A') {
                    // Up arrow - go back in history
                    if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
                        // Clear current line
                        for (let i = 0; i < currentLine.length; i++) {
                            writeEmitter.fire('\b \b');
                        }

                        historyIndex++;
                        currentLine = commandHistory[commandHistory.length - 1 - historyIndex];
                        writeEmitter.fire(currentLine);
                    }
                    return;
                } else if (data === '\x1b[B') {
                    // Down arrow - go forward in history
                    if (historyIndex > 0) {
                        // Clear current line
                        for (let i = 0; i < currentLine.length; i++) {
                            writeEmitter.fire('\b \b');
                        }

                        historyIndex--;
                        currentLine = commandHistory[commandHistory.length - 1 - historyIndex];
                        writeEmitter.fire(currentLine);
                    } else if (historyIndex === 0) {
                        // Clear to empty line
                        for (let i = 0; i < currentLine.length; i++) {
                            writeEmitter.fire('\b \b');
                        }
                        historyIndex = -1;
                        currentLine = '';
                    }
                    return;
                } else if (data === '\x1b[C' || data === '\x1b[D') {
                    // Ignore left/right arrows for now
                    return;
                }

                if (data === '\r') {
                    // Enter - execute command
                    writeEmitter.fire('\r\n');
                    atPrompt = false;  // No longer at prompt

                    // Add to history if not empty
                    if (currentLine.trim()) {
                        commandHistory.push(currentLine);
                        historyIndex = -1;
                    }

                    // Intercept 'history' command to show our JavaScript history
                    if (currentLine.trim() === 'history') {
                        if (commandHistory.length === 0) {
                            writeEmitter.fire('No commands in history.\r\n');
                        } else {
                            commandHistory.forEach((cmd, index) => {
                                writeEmitter.fire(`  ${index + 1}  ${cmd}\r\n`);
                            });
                        }
                        writeEmitter.fire('\r\x1b[K$ ');
                        atPrompt = true;  // Back at prompt
                        currentLine = '';
                        return;
                    }

                    // Detect interactive shells and enter interactive mode
                    const trimmedCmd = currentLine.trim();

                    // For Python, add flags to force interactive mode and unbuffered output
                    if (trimmedCmd === 'python' || trimmedCmd === 'python3' || trimmedCmd === 'python2' ||
                        trimmedCmd.startsWith('python ') || trimmedCmd.startsWith('python3 ') || trimmedCmd.startsWith('python2 ')) {
                        inInteractiveMode = true;
                        console.log('[TerminalMonitor] Entering interactive mode for Python');
                        // Add -i (interactive) and -u (unbuffered) flags
                        const pythonCmd = trimmedCmd.replace(/^(python[23]?)/, '$1 -i -u');
                        shellProcess.stdin.write(pythonCmd + '\n');
                        currentLine = '';

                        // Set fallback timer to show prompt if no output (300ms)
                        fallbackPromptTimer = setTimeout(() => {
                            if (!atPrompt && inInteractiveMode) {
                                atPrompt = true;
                            }
                        }, 300);
                        return;
                    }

                    const interactiveCommands = ['node', 'irb', 'ruby', 'php -a', 'lua', 'R'];
                    if (interactiveCommands.some(cmd => trimmedCmd === cmd || trimmedCmd.startsWith(cmd + ' '))) {
                        inInteractiveMode = true;
                        console.log('[TerminalMonitor] Entering interactive mode for:', trimmedCmd);
                    }

                    shellProcess.stdin.write(currentLine + '\n');
                    currentLine = '';

                    // Set fallback timer to show prompt if command produces no output (300ms)
                    fallbackPromptTimer = setTimeout(() => {
                        if (!atPrompt) {
                            writeEmitter.fire('\r\x1b[K$ ');
                            atPrompt = true;
                        }
                    }, 300);
                } else if (data === '\x7f' || data === '\b') {
                    // Backspace
                    if (currentLine.length > 0) {
                        currentLine = currentLine.slice(0, -1);
                        writeEmitter.fire('\b \b');
                    }
                } else if (data === '\x03') {
                    // Ctrl+C
                    writeEmitter.fire('^C\r\n\r\x1b[K$ ');
                    currentLine = '';
                    historyIndex = -1;
                    atPrompt = true;  // Back at prompt
                    shellProcess.stdin.write('\x03');
                } else {
                    // Regular character - echo and add to line
                    currentLine += data;
                    writeEmitter.fire(data);
                }
            }
        };

        const terminal = vscode.window.createTerminal({
            name: name || 'Monitored Terminal',
            pty: pseudoterminal
        });

        this.monitoredTerminals.add(terminal);
        this.terminalOutputs.set(terminal, '');

        // Store reference to update output
        const outputInterval = setInterval(() => {
            if (terminalOutput) {
                this.terminalOutputs.set(terminal, terminalOutput);
            }
        }, 1000);

        // Clean up interval when terminal closes
        const closeListener = vscode.window.onDidCloseTerminal(t => {
            if (t === terminal) {
                clearInterval(outputInterval);
                closeListener.dispose();
                if (shellProcess && !shellProcess.killed) {
                    shellProcess.kill();
                }
            }
        });

        this.disposables.push(closeListener);

        return terminal;
    }

    /**
     * Show command prompt
     */
    private showPrompt(writeEmitter: vscode.EventEmitter<string>): void {
        writeEmitter.fire('\x1b[36m$\x1b[0m ');
    }

    /**
     * Execute a command and capture output
     */
    private executeCommand(
        command: string,
        writeEmitter: vscode.EventEmitter<string>,
        cwd: string,
        onOutput: (output: string) => void
    ): void {
        console.log('[TerminalMonitor] Starting command execution:', command);

        exec(command, { cwd, env: process.env }, (error, stdout, stderr) => {
            let output = '';

            // Write stdout
            if (stdout) {
                const stdoutStr = stdout.toString();
                writeEmitter.fire(stdoutStr);
                output += stdoutStr;
                console.log('[TerminalMonitor] STDOUT:', stdoutStr.substring(0, 100));
            }

            // Write stderr (usually contains errors)
            if (stderr) {
                const stderrStr = stderr.toString();
                writeEmitter.fire('\x1b[31m' + stderrStr + '\x1b[0m'); // Red color for errors
                output += stderrStr;
                console.log('[TerminalMonitor] STDERR:', stderrStr.substring(0, 100));
            }

            // Handle error
            if (error) {
                const errorMsg = error.message;
                if (!stderr) { // Only show if not already shown in stderr
                    writeEmitter.fire('\x1b[31m' + errorMsg + '\x1b[0m\r\n');
                    output += errorMsg + '\n';
                }
                console.log('[TerminalMonitor] Command error:', errorMsg);
            }

            // Notify listeners
            if (output) {
                onOutput(output);
            }

            // Show prompt again
            this.showPrompt(writeEmitter);
        });
    }

    /**
     * Register a callback for when output is received
     */
    onOutputReceived(callback: (output: string) => void): void {
        this.outputCallbacks.push(callback);
        console.log('[TerminalMonitor] Output callback registered, total callbacks:', this.outputCallbacks.length);
    }

    private notifyOutputReceived(output: string): void {
        console.log('[TerminalMonitor] Notifying', this.outputCallbacks.length, 'callbacks');
        this.outputCallbacks.forEach(callback => {
            try {
                callback(output);
            } catch (err) {
                console.error('[TerminalMonitor] Callback error:', err);
            }
        });
    }

    /**
     * Get all captured terminal output
     */
    getTerminalOutput(): string {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            return Array.from(this.terminalOutputs.values()).join('\n\n--- TERMINAL ---\n\n');
        }
        return this.terminalOutputs.get(activeTerminal) || '';
    }

    /**
     * Check if monitoring is active
     */
    isMonitoringActive(): boolean {
        return this.isMonitoring;
    }

    /**
     * Get count of monitored terminals
     */
    getMonitoredTerminalCount(): number {
        return this.monitoredTerminals.size;
    }

    dispose(): void {
        this.stopMonitoring();
        this.disposables.forEach(d => d.dispose());
        this.monitoredTerminals.clear();
    }
}
