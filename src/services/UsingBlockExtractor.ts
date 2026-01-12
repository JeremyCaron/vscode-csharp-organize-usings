import { UsingBlock } from '../domain/UsingBlock';

/**
 * Extracts using blocks from C# source code using regex
 */
export class UsingBlockExtractor
{
    // Regex to match using blocks
    // Matches using statements with optional leading comments (single-line and block) and preprocessor directives
    // Supports: global using, using static, and usings inside namespace blocks
    private static readonly USING_REGEX =
        // eslint-disable-next-line max-len
        /(?:^|\bnamespace\s+[\w.]+\s*\{\s*(?:[\n]|[\r\n])+)(?:(?:[\n]|[\r\n])*(?:\s*#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|\s*(?:\/\/.*|\/\*[\s\S]*?\*\/|.*\*\/)(?:[\n]|[\r\n])*)*\s*(?:(?:global\s+)?(?:using\s+static\s+|using\s+)(?!.*\s+\w+\s*=\s*new)(?:\[.*?\]|[\w.]+);|(?:global\s+)?using\s+\w+\s*=\s*[\w.]+;)(?:[\n]|[\r\n])*)+/gm;

    /**
     * Extracts all using blocks from source code
     */
    public extract(sourceCode: string, lineEnding: string): Map<string, UsingBlock>
    {
        const blocks = new Map<string, UsingBlock>();
        const regex = new RegExp(UsingBlockExtractor.USING_REGEX.source, 'gm');

        let match: RegExpExecArray | null;
        while ((match = regex.exec(sourceCode)) !== null)
        {
            const rawBlock = match[0];
            const blockStartIndex = match.index;

            // Calculate line number
            const textBeforeBlock = sourceCode.substring(0, blockStartIndex);
            const startLine = textBeforeBlock.split(lineEnding).length - 1;

            // Split the block into lines
            const lines = rawBlock.split(lineEnding).map(l => l?.trim() ?? '');

            // Find first using statement to determine leading content
            const firstUsingIndex = lines.findIndex(line => /(?:global\s+)?(?:using\s+static\s+|using\s+)/.test(line));

            // Determine where leading content ends and using block content begins
            // Leading content should only include comments/directives that are separated
            // from the first using by a blank line. Adjacent comments should stick to the using.
            let leadingContentEnd = 0;
            if (firstUsingIndex > 0)
            {
                // Work backwards from the first using to find the last blank line
                for (let i = firstUsingIndex - 1; i >= 0; i--)
                {
                    const trimmed = lines[i].trim();
                    if (trimmed === '')
                    {
                        // Found a blank line - everything before this is leading content
                        leadingContentEnd = i + 1; // Include the blank line in leading content
                        break;
                    }
                    // If we reach the start without finding a blank line,
                    // all comments are adjacent to the using (leadingContentEnd stays 0)
                }
            }

            const leadingContent = leadingContentEnd > 0 ? lines.slice(0, leadingContentEnd) : [];
            const contentLines = firstUsingIndex >= 0 ? lines.slice(leadingContentEnd) : lines;

            // Calculate end line
            const endLine = startLine + lines.length - 1;

            const block = new UsingBlock(startLine, endLine, contentLines, leadingContent);
            blocks.set(rawBlock, block);
        }

        return blocks;
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
