import { UsingStatement } from './UsingStatement';

/**
 * Represents a block of using statements found in a C# source file
 */
export class UsingBlock
{
    public readonly startLine: number;
    public readonly endLine: number;
    private statements: UsingStatement[];
    private leadingContent: UsingStatement[];

    constructor(
        startLine: number,
        endLine: number,
        rawContent: string[],
        leadingContent: string[] = [],
    )
    {
        this.startLine = startLine;
        this.endLine = endLine;
        this.leadingContent = leadingContent.map(line => UsingStatement.parse(line));
        this.statements = this.parseStatements(rawContent);
    }

    /**
     * Gets the using statements in this block
     */
    public getStatements(): ReadonlyArray<UsingStatement>
    {
        return this.statements;
    }

    /**
     * Sets the using statements in this block
     */
    public setStatements(statements: UsingStatement[]): void
    {
        this.statements = statements;
    }

    /**
     * Gets the leading content (comments, blank lines before the usings)
     */
    public getLeadingContent(): ReadonlyArray<UsingStatement>
    {
        return this.leadingContent;
    }

    /**
     * Converts this block back to an array of lines
     */
    public toLines(): string[]
    {
        const result: string[] = [];

        // Add leading content if present, but strip trailing blank lines
        // because UsingGroupSplitter will add them back when needed
        if (this.leadingContent.length > 0)
        {
            const leadingLines = this.leadingContent.map(s => s.toString());

            // Find the last non-blank line
            let lastNonBlankIndex = leadingLines.length - 1;
            while (lastNonBlankIndex >= 0 && leadingLines[lastNonBlankIndex].trim() === '')
            {
                lastNonBlankIndex--;
            }

            // Add only up to the last non-blank line
            result.push(...leadingLines.slice(0, lastNonBlankIndex + 1));
        }

        // Add using statements (which may include a blank line after leading content added by UsingGroupSplitter)
        // For statements with attached comments, expand them to include comment lines
        for (const stmt of this.statements)
        {
            if (stmt.isActualUsing() && stmt.getAttachedComments().length > 0)
            {
                // Use toLines() to include attached comments
                result.push(...stmt.toLines());
            }
            else
            {
                // Just add the single line
                result.push(stmt.toString());
            }
        }

        // Don't add trailing blank line here - that's a formatting concern
        // handled in the replacement step, not part of the block content itself
        return result;
    }

    /**
     * Converts this block to a replacement string with proper trailing newlines
     * This method handles the complexity of matching the original text structure
     */
    public toReplacementString(lineEnding: string): string
    {
        const lines = this.toLines();

        // If there are no lines, return empty string
        if (lines.length === 0)
        {
            return '';
        }

        // Simply join the lines - don't worry about trailing separators
        // That's handled in the formatting step in the replace() method
        return lines.join(lineEnding);
    }

    /**
     * Returns the number of actual using statements (excluding comments, directives, blanks)
     */
    public getActualUsingCount(): number
    {
        return this.statements.filter(s => s.isActualUsing()).length;
    }

    private parseStatements(lines: string[]): UsingStatement[]
    {
        // Don't filter out blank lines! We need to preserve them for accurate line number mapping
        // when removing unused usings based on diagnostic line numbers.
        return lines.map(line => UsingStatement.parse(line));
    }
}
