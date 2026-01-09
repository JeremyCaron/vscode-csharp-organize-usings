import { UsingBlock } from '../domain/UsingBlock';

/**
 * Extracts using blocks from C# source code using regex
 */
export class UsingBlockExtractor {
    // Regex to match using blocks
    // Matches using statements with optional leading comments and preprocessor directives
    private static readonly USING_REGEX = /^(?:(?:[\n]|[\r\n])*(?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|(?:\/\/.*(?:[\n]|[\r\n])*)*(?:using\s+(?!.*\s+=\s+)(?:\[.*?\]|\w+(?:\.\w+)*);|using\s+\w+\s*=\s*[\w.]+;))(?:[\n]|[\r\n])*)+/gm;

    /**
     * Extracts all using blocks from source code
     */
    public extract(sourceCode: string, lineEnding: string): Map<string, UsingBlock> {
        const blocks = new Map<string, UsingBlock>();
        const regex = new RegExp(UsingBlockExtractor.USING_REGEX.source, 'gm');

        let match: RegExpExecArray | null;
        while ((match = regex.exec(sourceCode)) !== null) {
            const rawBlock = match[0];
            const blockStartIndex = match.index;

            // Calculate line number
            const textBeforeBlock = sourceCode.substring(0, blockStartIndex);
            const startLine = textBeforeBlock.split(lineEnding).length - 1;

            // Split the block into lines
            const lines = rawBlock.split(lineEnding).map(l => l?.trim() ?? '');

            // Find first using statement to determine leading content
            const firstUsingIndex = lines.findIndex(line => /^\s*using\s+/.test(line));
            const leadingContent = firstUsingIndex > 0 ? lines.slice(0, firstUsingIndex) : [];
            const contentLines = firstUsingIndex >= 0 ? lines.slice(firstUsingIndex) : lines;

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
    public replace(sourceCode: string, lineEnding: string, blockMap: Map<string, UsingBlock>): string {
        let result = sourceCode;

        for (const [originalText, block] of blockMap) {
            const replacement = block.toLines().join(lineEnding);
            result = result.replace(originalText, replacement);
        }

        return result;
    }
}
