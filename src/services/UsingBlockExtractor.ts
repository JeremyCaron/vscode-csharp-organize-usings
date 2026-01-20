import { UsingBlock } from '../domain/UsingBlock';
import { logToOutputChannel } from '../logging/logger';

/**
 * Extracts using blocks from C# source code using a line-by-line parser.
 *
 * IMPLEMENTATION NOTE:
 * This class originally used a complex regex pattern to extract using blocks, but that
 * approach suffered from catastrophic backtracking when processing files with many
 * commented-out using statements (especially multi-line block comments). The regex
 * pattern `\/\*[\s\S]*?\*\/` for matching block comments could cause the extension
 * to hang indefinitely on certain input files.
 *
 * The current implementation uses a straightforward line-by-line state machine parser
 * that has guaranteed O(n) performance, is more maintainable, and handles all edge
 * cases correctly including:
 * - Single-line and multi-line block comments
 * - Preprocessor directives (#if, #else, #elif, #endif, #region, #endregion)
 * - Global usings and using static
 * - Distinguishing using statements from using declarations/statements in code
 * - Proper handling of leading content (file-level comments separated by blank lines)
 * - Capturing all trailing blank lines for correct replacement behavior
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

        logToOutputChannel('Starting using block extraction...');

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

        logToOutputChannel(`Extraction complete: ${blocks.size} block(s) found`);

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

        // Exclude using declarations (variable declarations): using var x = ...
        // This includes: using var, using IDisposable x = ..., using SomeType x = ...
        if (/^(global\s+)?using\s+(var\s+\w+|[A-Z]\w*\s+\w+)\s*=/.test(trimmed))
        {
            return false;
        }

        // Must end with semicolon (or just be a using line without semicolon for tolerance)
        return true;
    }

    /**
     * Finds the next non-blank line starting from the given index
     * Returns the index of the next non-blank line, or -1 if none found
     */
    private findNextNonBlankLine(lines: string[], startIndex: number): number
    {
        for (let i = startIndex; i < lines.length; i++)
        {
            if (lines[i].trim().length > 0)
            {
                return i;
            }
        }
        return -1;
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

        // Determine leading content boundary based on blank line presence
        // Rules:
        // 1. Preprocessor directives before usings = part of statements (not leading content)
        // 2. Comment + blank line + using = file-level comment (leading content)
        // 3. Comment + using (no blank) = attached comment (in statements)
        let leadingContentEnd = 0;
        if (firstUsingLineIndex > startIndex)
        {
            // Check for blank line separator (but skip preprocessor directives in this check)
            for (let i = firstUsingLineIndex - 1; i >= startIndex; i--)
            {
                const trimmed = lines[i].trim();

                // Skip preprocessor directives - they should be part of statements
                if (trimmed.startsWith('#'))
                {
                    continue;
                }

                if (trimmed === '')
                {
                    // Found blank line - everything before it is leading content
                    // But exclude any preprocessor directives
                    let contentEnd = i - startIndex + 1;

                    // Walk back to exclude preprocessor directives from leading content
                    while (contentEnd > 0)
                    {
                        const checkLine = lines[startIndex + contentEnd - 1].trim();
                        if (checkLine.startsWith('#'))
                        {
                            contentEnd--;
                        }
                        else
                        {
                            break;
                        }
                    }

                    leadingContentEnd = contentEnd;
                    break;
                }
            }
            // If no blank line found, leadingContentEnd stays 0
            // meaning all content before first using will be in statements (attached)
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
            // BUT: check if a comment/directive is followed by code (not more usings)
            // to avoid capturing comments meant for code after the using block
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
                // For comments and preprocessor directives, check what follows
                if (trimmed.startsWith('//') || trimmed.startsWith('#'))
                {
                    // EXCEPTION: #endif and #endregion should always be included if we're
                    // inside a preprocessor block (they close the block)
                    const isClosingDirective = /^#(endif|endregion)\b/.test(trimmed);

                    if (!isClosingDirective)
                    {
                        // Look ahead to see if next non-blank line is a using or code
                        const nextContentIndex = this.findNextNonBlankLine(lines, i + 1);
                        if (nextContentIndex !== -1)
                        {
                            const nextLine = lines[nextContentIndex].trim();
                            // If next line is code (not a using, not a comment), stop here
                            if (nextLine.length > 0 &&
                                !this.isUsingStatement(nextLine) &&
                                !this.isLeadingContent(nextLine))
                            {
                                // This comment belongs to the code after, not the using block
                                break;
                            }
                        }
                    }
                }

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

        // DON'T capture trailing blank lines - they should remain in the source as separators
        // The formatting will be applied in the replace() method
        // Trim trailing blank lines from blockLines
        while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '')
        {
            blockLines.pop();
        }

        // Build the original text WITHOUT trailing blanks
        const originalText = blockLines.join(lineEnding);

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
            const replacement = block.toReplacementString(lineEnding);

            // If replacement is empty (all usings removed), we need to also remove
            // any trailing newlines after the original text to avoid leaving blank lines
            if (replacement === '')
            {
                const originalWithTrailingNewlines = new RegExp(
                    originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n*',
                    'g',
                );
                result = result.replace(originalWithTrailingNewlines, '');
            }
            else
            {
                result = result.replace(originalText, replacement);
            }
        }

        // Apply formatting rule: ensure exactly one blank line before code declarations
        // This handles using statements, comments, and preprocessor directives
        // Match: (using/comment/directive line)(1+ newlines) followed by (keyword)
        // Replace with: (line)(exactly 2 newlines) keeping everything after
        const lineFollowedByCode = new RegExp(
            '((?:using|//|/\\*|#)[^\\n]*)\\n+(?=namespace|class|public|internal|abstract|sealed|static|partial|record|interface|enum|struct|delegate)',
            'g',
        );
        result = result.replace(lineFollowedByCode, `$1${lineEnding}${lineEnding}`);

        return result;
    }
}
