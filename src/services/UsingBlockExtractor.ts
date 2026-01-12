import { UsingBlock } from '../domain/UsingBlock';

/**
 * Extracts using blocks from C# source code using a line-by-line parser
 */
export class UsingBlockExtractor
{
    /**
     * Extracts all using blocks from source code
     */
    public extract(sourceCode: string, lineEnding: string): Map<string, UsingBlock>
    {
        const blocks = new Map<string, UsingBlock>();
        const lines = sourceCode.split(lineEnding);

        let i = 0;
        while (i < lines.length)
        {
            // Look for start of a using block
            const blockStart = this.findUsingBlockStart(lines, i);
            if (blockStart === null)
            {
                i++;
                continue;
            }

            // Extract the using block starting from blockStart.index
            const blockInfo = this.extractBlock(lines, blockStart.index, lineEnding);
            if (blockInfo)
            {
                const { originalText, block, endIndex } = blockInfo;
                blocks.set(originalText, block);
                i = endIndex + 1;
            }
            else
            {
                i++;
            }
        }

        return blocks;
    }

    /**
     * Finds the start of a using block (either at file level or inside a namespace)
     * Returns the line index where using block content begins, or null if none found
     */
    private findUsingBlockStart(lines: string[], startIndex: number): { index: number } | null
    {
        for (let i = startIndex; i < lines.length; i++)
        {
            const line = lines[i];
            const trimmed = line.trim();

            // Check for using statement (but not using declaration/statement in code)
            if (this.isUsingStatement(trimmed))
            {
                // Look backwards to find leading content
                const leadingStartIndex = this.findLeadingContentStart(lines, i);
                return { index: leadingStartIndex };
            }

            // Check for namespace with opening brace (usings might be inside)
            const namespaceMatch = trimmed.match(/^namespace\s+[\w.]+\s*\{/);
            if (namespaceMatch)
            {
                // Look for using statements inside this namespace
                for (let j = i + 1; j < lines.length; j++)
                {
                    const innerLine = lines[j].trim();
                    if (this.isUsingStatement(innerLine))
                    {
                        const leadingStartIndex = this.findLeadingContentStart(lines, j);
                        return { index: leadingStartIndex };
                    }
                    // Stop if we hit code or a closing brace
                    if (innerLine === '}' || (innerLine.length > 0 && !this.isLeadingContent(innerLine)))
                    {
                        break;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Determines if a line looks like leading content (comments, preprocessor, blank)
     */
    private isLeadingContent(trimmed: string): boolean
    {
        if (trimmed === '') return true;
        if (trimmed.startsWith('//')) return true;
        if (trimmed.startsWith('/*')) return true;
        if (trimmed.startsWith('*')) return true;
        if (trimmed.endsWith('*/')) return true;
        if (trimmed.startsWith('#')) return true;
        return false;
    }

    /**
     * Finds where leading content starts (working backwards from firstUsingIndex)
     */
    private findLeadingContentStart(lines: string[], firstUsingIndex: number): number
    {
        let leadingStart = firstUsingIndex;

        // Work backwards to find comments/preprocessor directives
        for (let i = firstUsingIndex - 1; i >= 0; i--)
        {
            const trimmed = lines[i].trim();

            if (this.isLeadingContent(trimmed))
            {
                leadingStart = i;
            }
            else
            {
                // Hit non-leading content, stop
                break;
            }
        }

        return leadingStart;
    }

    /**
     * Checks if a line is a using statement (not a using declaration)
     */
    private isUsingStatement(trimmed: string): boolean
    {
        if (!trimmed.startsWith('using ') && !trimmed.startsWith('global using '))
        {
            return false;
        }

        // Exclude using declarations with parentheses: using (var x = ...)
        if (/^(global\s+)?using\s*\(/.test(trimmed))
        {
            return false;
        }

        // Exclude using declarations (with assignment to new): using var x = new ...
        if (/\s+\w+\s*=\s*new\s/.test(trimmed))
        {
            return false;
        }

        // Must end with semicolon (or just be a using line without semicolon for tolerance)
        return true;
    }

    /**
     * Extracts a complete using block starting from startIndex
     */
    private extractBlock(lines: string[], startIndex: number, lineEnding: string):
        { originalText: string; block: UsingBlock; endIndex: number } | null
    {
        const blockLines: string[] = [];
        let endIndex = startIndex;
        let foundFirstUsing = false;
        let inBlockComment = false;

        // Find the first using statement to determine leading content boundary
        let firstUsingLineIndex = -1;
        for (let i = startIndex; i < lines.length; i++)
        {
            const trimmed = lines[i].trim();
            if (this.isUsingStatement(trimmed))
            {
                firstUsingLineIndex = i;
                break;
            }
        }

        if (firstUsingLineIndex === -1)
        {
            return null; // No using statement found
        }

        // Determine leading content boundary (separated by blank line from first using)
        let leadingContentEnd = 0;
        if (firstUsingLineIndex > startIndex)
        {
            // Work backwards from first using to find last blank line
            for (let i = firstUsingLineIndex - 1; i >= startIndex; i--)
            {
                const trimmed = lines[i].trim();
                if (trimmed === '')
                {
                    // Found blank line separator
                    leadingContentEnd = i - startIndex + 1;
                    break;
                }
            }
        }

        // Collect all lines in the block
        for (let i = startIndex; i < lines.length; i++)
        {
            const line = lines[i];
            const trimmed = line.trim();

            // Track block comments
            if (trimmed.includes('/*'))
            {
                inBlockComment = true;
            }
            if (trimmed.includes('*/'))
            {
                inBlockComment = false;
            }

            // Check if this line is part of the using block
            if (this.isUsingStatement(trimmed))
            {
                blockLines.push(line);
                endIndex = i;
                foundFirstUsing = true;
                continue;
            }

            // Include comments, preprocessor directives, and blank lines
            if (foundFirstUsing && (
                trimmed === '' ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('/*') ||
                trimmed.startsWith('*') ||
                trimmed.endsWith('*/') ||
                trimmed.startsWith('#') ||
                inBlockComment
            ))
            {
                blockLines.push(line);
                endIndex = i;
                continue;
            }

            // Include leading content before first using
            if (!foundFirstUsing && this.isLeadingContent(trimmed))
            {
                blockLines.push(line);
                endIndex = i;
                continue;
            }

            // If we found usings and hit something else, block is done
            if (foundFirstUsing && trimmed.length > 0)
            {
                break;
            }

            // Before first using, include the line if it's leading content
            if (!foundFirstUsing)
            {
                blockLines.push(line);
                endIndex = i;
            }
        }

        if (blockLines.length === 0 || !foundFirstUsing)
        {
            return null;
        }

        // Capture all trailing blank lines after the using block
        // This ensures we replace the entire block including all trailing whitespace
        // We'll capture blank lines until we hit non-blank content or the next namespace/class
        let additionalBlankLines = 0;
        for (let i = endIndex + 1; i < lines.length; i++)
        {
            const trimmed = lines[i].trim();
            if (trimmed === '')
            {
                blockLines.push(lines[i]);
                endIndex = i;
                additionalBlankLines++;
            }
            else
            {
                // Stop at first non-blank line (could be namespace, class, etc.)
                break;
            }
        }

        // Build the original text
        const originalText = blockLines.join(lineEnding);

        // Trim trailing blank lines from blockLines for processing
        while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '')
        {
            blockLines.pop();
        }

        // Trim lines for processing
        const trimmedLines = blockLines.map(l => l.trim());

        // Split into leading content and content lines
        const leadingContent = leadingContentEnd > 0 ? trimmedLines.slice(0, leadingContentEnd) : [];
        const contentLines = trimmedLines.slice(leadingContentEnd);

        const block = new UsingBlock(startIndex, endIndex, contentLines, leadingContent);

        return { originalText, block, endIndex };
    }

    /**
     * Replaces using blocks in source code with processed versions
     */
    public replace(sourceCode: string, lineEnding: string, blockMap: Map<string, UsingBlock>): string
    {
        let result = sourceCode;

        for (const [originalText, block] of blockMap)
        {
            const replacement = block.toLines().join(lineEnding);
            result = result.replace(originalText, replacement);
        }

        return result;
    }
}
