/**
 * Represents a single line in a using block - could be a using statement, comment,
 * preprocessor directive, or blank line.
 */
export class UsingStatement {
    public readonly originalText: string;
    public readonly namespace: string;
    public readonly rootNamespace: string;
    public readonly isAlias: boolean;
    public readonly isPreprocessorDirective: boolean;
    public readonly isComment: boolean;
    public readonly isBlankLine: boolean;

    private constructor(
        originalText: string,
        namespace: string,
        rootNamespace: string,
        isAlias: boolean,
        isPreprocessorDirective: boolean,
        isComment: boolean,
        isBlankLine: boolean
    ) {
        this.originalText = originalText;
        this.namespace = namespace;
        this.rootNamespace = rootNamespace;
        this.isAlias = isAlias;
        this.isPreprocessorDirective = isPreprocessorDirective;
        this.isComment = isComment;
        this.isBlankLine = isBlankLine;
    }

    /**
     * Parses a line of text into a UsingStatement object
     */
    public static parse(line: string): UsingStatement {
        const trimmed = line.trim();

        // Blank line
        if (trimmed.length === 0) {
            return new UsingStatement(line, '', '', false, false, false, true);
        }

        // Comment
        if (trimmed.startsWith('//')) {
            return new UsingStatement(line, '', '', false, false, true, false);
        }

        // Preprocessor directive
        if (trimmed.startsWith('#')) {
            return new UsingStatement(line, '', '', false, true, false, false);
        }

        // Using statement
        const isAlias = /using\s+\w+\s*=/.test(trimmed);
        const namespaceMatch = trimmed.match(/using\s+(?:\w+\s*=\s*)?([^;]+)/);
        const namespace = namespaceMatch ? namespaceMatch[1].trim() : '';
        const rootNamespace = namespace.split('.')[0];

        return new UsingStatement(line, namespace, rootNamespace, isAlias, false, false, false);
    }

    /**
     * Creates a blank line UsingStatement
     */
    public static blankLine(): UsingStatement {
        return new UsingStatement('', '', '', false, false, false, true);
    }

    /**
     * Returns true if this is an actual using statement (not comment, directive, or blank)
     */
    public isActualUsing(): boolean {
        return !this.isComment && !this.isPreprocessorDirective && !this.isBlankLine;
    }

    /**
     * Returns the text representation of this statement
     */
    public toString(): string {
        return this.originalText;
    }

    /**
     * Creates a key for deduplication purposes
     */
    public getDeduplicationKey(): string {
        if (!this.isActualUsing()) {
            // Comments, directives, and blanks don't participate in deduplication
            return '';
        }
        return this.namespace;
    }
}
