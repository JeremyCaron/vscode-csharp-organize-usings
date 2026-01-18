/**
 * Represents a single line in a using block - could be a using statement, comment,
 * preprocessor directive, or blank line.
 */
export class UsingStatement
{
    public readonly originalText: string;
    public readonly namespace: string;
    public readonly rootNamespace: string;
    public readonly isAlias: boolean;
    public readonly isStatic: boolean;
    public readonly isPreprocessorDirective: boolean;
    public readonly isComment: boolean;
    public readonly isBlankLine: boolean;
    private attachedComments: UsingStatement[] = [];

    private constructor(
        originalText: string,
        namespace: string,
        rootNamespace: string,
        isAlias: boolean,
        isStatic: boolean,
        isPreprocessorDirective: boolean,
        isComment: boolean,
        isBlankLine: boolean,
    )
    {
        this.originalText = originalText;
        this.namespace = namespace;
        this.rootNamespace = rootNamespace;
        this.isAlias = isAlias;
        this.isStatic = isStatic;
        this.isPreprocessorDirective = isPreprocessorDirective;
        this.isComment = isComment;
        this.isBlankLine = isBlankLine;
    }

    /**
     * Parses a line of text into a UsingStatement object
     */
    public static parse(line: string): UsingStatement
    {
        const trimmed = line.trim();

        // Blank line
        if (trimmed.length === 0)
        {
            return new UsingStatement(line, '', '', false, false, false, false, true);
        }

        // Comment (single-line or block comment)
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.includes('*/'))
        {
            return new UsingStatement(line, '', '', false, false, false, true, false);
        }

        // Preprocessor directive
        if (trimmed.startsWith('#'))
        {
            return new UsingStatement(line, '', '', false, false, true, false, false);
        }

        // Using statement
        // Strip global and static keywords for parsing, but preserve in originalText
        const isStatic = /(?:global\s+)?using\s+static\s+/.test(trimmed);
        const isAlias = /using\s+\w+\s*=/.test(trimmed);
        const namespaceMatch = trimmed.match(/(?:global\s+)?(?:using\s+static\s+|using\s+)(?:\w+\s*=\s*)?([^;]+)/);
        const namespace = namespaceMatch ? namespaceMatch[1].trim() : '';
        const rootNamespace = namespace.split('.')[0];

        return new UsingStatement(line, namespace, rootNamespace, isAlias, isStatic, false, false, false);
    }

    /**
     * Creates a blank line UsingStatement
     */
    public static blankLine(): UsingStatement
    {
        return new UsingStatement('', '', '', false, false, false, false, true);
    }

    /**
     * Returns true if this is an actual using statement (not comment, directive, or blank)
     */
    public isActualUsing(): boolean
    {
        return !this.isComment && !this.isPreprocessorDirective && !this.isBlankLine;
    }

    /**
     * Returns the text representation of this statement
     * For actual using statements, includes any attached comments
     */
    public toString(): string
    {
        return this.originalText;
    }

    /**
     * Returns all lines including attached comments followed by the statement itself
     * Used when rendering the using statement with its attached comments
     */
    public toLines(): string[]
    {
        const lines: string[] = [];

        // Add attached comments first
        for (const comment of this.attachedComments)
        {
            lines.push(comment.toString());
        }

        // Add the statement itself
        lines.push(this.originalText);

        return lines;
    }

    /**
     * Creates a key for deduplication purposes
     */
    public getDeduplicationKey(): string
    {
        if (!this.isActualUsing())
        {
            // Comments, directives, and blanks don't participate in deduplication
            return '';
        }
        return this.namespace;
    }

    /**
     * Attaches a comment to this using statement
     */
    public attachComment(comment: UsingStatement): void
    {
        if (!comment.isComment)
        {
            throw new Error('Only comments can be attached');
        }
        this.attachedComments.push(comment);
    }

    /**
     * Gets the comments attached to this using statement
     */
    public getAttachedComments(): ReadonlyArray<UsingStatement>
    {
        return this.attachedComments;
    }

    /**
     * Sets the attached comments for this using statement
     */
    public setAttachedComments(comments: UsingStatement[]): void
    {
        this.attachedComments = comments;
    }
}
