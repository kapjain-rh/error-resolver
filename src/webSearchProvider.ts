import * as vscode from 'vscode';
import { DetectedError, Resolution } from './errorResolver';

export class WebSearchProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    /**
     * Search for solutions online
     */
    async searchSolutions(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Generate search URLs for different sources
        const searchUrls = this.generateSearchUrls(error);

        // Add search suggestions
        for (const { source, url, title } of searchUrls) {
            resolutions.push({
                source: 'web',
                title: `Search on ${source}`,
                description: title,
                url: url,
                confidence: 50
            });
        }

        // Generate documentation URLs if we can identify the technology
        const docUrls = this.generateDocUrls(error);
        resolutions.push(...docUrls);

        return resolutions;
    }

    /**
     * Generate search URLs for different platforms
     */
    private generateSearchUrls(error: DetectedError): Array<{ source: string; url: string; title: string }> {
        const query = this.buildSearchQuery(error);
        const encodedQuery = encodeURIComponent(query);

        return [
            {
                source: 'Stack Overflow',
                url: `https://stackoverflow.com/search?q=${encodedQuery}`,
                title: `Search Stack Overflow for "${query}"`
            },
            {
                source: 'GitHub Issues',
                url: `https://github.com/search?type=issues&q=${encodedQuery}`,
                title: `Search GitHub Issues for "${query}"`
            },
            {
                source: 'Google',
                url: `https://www.google.com/search?q=${encodedQuery}`,
                title: `Search Google for "${query}"`
            }
        ];
    }

    /**
     * Build search query from error
     */
    private buildSearchQuery(error: DetectedError): string {
        let query = error.errorMessage;

        // Add error type if available
        if (error.errorType) {
            query = `${error.errorType} ${query}`;
        }

        // Clean up and limit query length
        query = query
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200);

        return query;
    }

    /**
     * Generate documentation URLs based on error type
     */
    private generateDocUrls(error: DetectedError): Resolution[] {
        const resolutions: Resolution[] = [];

        // Detect technology from error type and message
        const tech = this.detectTechnology(error);

        if (tech) {
            const docUrl = this.getDocumentationUrl(tech);
            if (docUrl) {
                resolutions.push({
                    source: 'web',
                    title: `${tech.name} Documentation`,
                    description: `Check official ${tech.name} documentation for this error`,
                    url: docUrl,
                    confidence: 60
                });
            }

            // Add common error guides
            const errorGuideUrl = this.getErrorGuideUrl(tech, error);
            if (errorGuideUrl) {
                resolutions.push({
                    source: 'web',
                    title: `${tech.name} Error Guide`,
                    description: `Official error reference for ${error.errorType}`,
                    url: errorGuideUrl,
                    confidence: 65
                });
            }
        }

        return resolutions;
    }

    /**
     * Detect technology from error
     */
    private detectTechnology(error: DetectedError): { name: string; id: string } | null {
        const message = error.errorMessage.toLowerCase();
        const type = error.errorType.toLowerCase();

        // JavaScript/TypeScript
        if (type === 'typescript' || message.includes('typescript')) {
            return { name: 'TypeScript', id: 'typescript' };
        }
        if (type === 'npm' || message.includes('npm')) {
            return { name: 'npm', id: 'npm' };
        }

        // Python
        if (type === 'python' || message.includes('python')) {
            return { name: 'Python', id: 'python' };
        }

        // Java
        if (type === 'java' || message.includes('java')) {
            return { name: 'Java', id: 'java' };
        }

        // Go
        if (type === 'go' || message.includes('golang')) {
            return { name: 'Go', id: 'go' };
        }

        // React
        if (message.includes('react')) {
            return { name: 'React', id: 'react' };
        }

        // Node.js
        if (message.includes('node')) {
            return { name: 'Node.js', id: 'nodejs' };
        }

        // Docker
        if (message.includes('docker')) {
            return { name: 'Docker', id: 'docker' };
        }

        // Git
        if (message.includes('git')) {
            return { name: 'Git', id: 'git' };
        }

        return null;
    }

    /**
     * Get documentation URL for technology
     */
    private getDocumentationUrl(tech: { name: string; id: string }): string | null {
        const docUrls: Record<string, string> = {
            'typescript': 'https://www.typescriptlang.org/docs/',
            'npm': 'https://docs.npmjs.com/',
            'python': 'https://docs.python.org/',
            'java': 'https://docs.oracle.com/en/java/',
            'go': 'https://go.dev/doc/',
            'react': 'https://react.dev/',
            'nodejs': 'https://nodejs.org/docs/',
            'docker': 'https://docs.docker.com/',
            'git': 'https://git-scm.com/doc'
        };

        return docUrls[tech.id] || null;
    }

    /**
     * Get error guide URL for technology
     */
    private getErrorGuideUrl(tech: { name: string; id: string }, error: DetectedError): string | null {
        const errorGuides: Record<string, (error: DetectedError) => string> = {
            'typescript': (err) => `https://www.typescriptlang.org/docs/handbook/intro.html`,
            'python': (err) => `https://docs.python.org/3/library/exceptions.html`,
            'react': (err) => `https://react.dev/reference/react`,
            'nodejs': (err) => `https://nodejs.org/api/errors.html`,
        };

        const guideGenerator = errorGuides[tech.id];
        return guideGenerator ? guideGenerator(error) : null;
    }

    /**
     * Parse known error patterns and provide specific solutions
     */
    async getKnownSolutions(error: DetectedError): Promise<Resolution[]> {
        const resolutions: Resolution[] = [];

        // Common error patterns with known solutions
        const knownPatterns = [
            {
                pattern: /cannot find module/i,
                solution: {
                    title: 'Module Not Found',
                    description: 'This error typically occurs when a required module is not installed. Try running `npm install` or `yarn install` to install dependencies.',
                    confidence: 80
                }
            },
            {
                pattern: /EADDRINUSE/i,
                solution: {
                    title: 'Port Already in Use',
                    description: 'Another process is using this port. Try killing the process or using a different port.',
                    confidence: 85
                }
            },
            {
                pattern: /permission denied/i,
                solution: {
                    title: 'Permission Denied',
                    description: 'You do not have permission to access this resource. Try using sudo (on Unix) or running as administrator (on Windows).',
                    confidence: 75
                }
            },
            {
                pattern: /cannot read property.*of undefined/i,
                solution: {
                    title: 'Undefined Property Access',
                    description: 'You are trying to access a property of an undefined or null value. Add a null check before accessing the property.',
                    confidence: 80
                }
            }
        ];

        for (const { pattern, solution } of knownPatterns) {
            if (pattern.test(error.errorMessage)) {
                resolutions.push({
                    source: 'web',
                    title: solution.title,
                    description: solution.description,
                    confidence: solution.confidence
                });
            }
        }

        return resolutions;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
