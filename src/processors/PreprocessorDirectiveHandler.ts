import { UsingStatement } from '../domain/UsingStatement';

/**
 * Handles preprocessor directives in using blocks
 */
export class PreprocessorDirectiveHandler {
    /**
     * Separates preprocessor directive blocks from regular using statements
     */
    public separate(statements: ReadonlyArray<UsingStatement>): {
        directiveBlocks: UsingStatement[][];
        remainingUsings: UsingStatement[];
    } {
        const directiveBlocks: UsingStatement[][] = [];
        const remainingUsings: UsingStatement[] = [];
        let currentDirectiveBlock: UsingStatement[] | null = null;

        for (const stmt of statements) {
            // Check if the line starts with a preprocessor directive
            if (this.isDirectiveStart(stmt)) {
                // If we're in a directive block, add to it
                if (currentDirectiveBlock) {
                    currentDirectiveBlock.push(stmt);
                } else {
                    // Start a new directive block
                    currentDirectiveBlock = [stmt];
                }

                // If it's an ending directive (#endif or #endregion), finalize the block
                if (this.isDirectiveEnd(stmt) && currentDirectiveBlock) {
                    directiveBlocks.push(currentDirectiveBlock);
                    currentDirectiveBlock = null;
                }
            } else {
                // If we're currently in a directive block, add the line to it
                if (currentDirectiveBlock) {
                    currentDirectiveBlock.push(stmt);
                } else {
                    // Otherwise, treat it as a normal using statement
                    remainingUsings.push(stmt);
                }
            }
        }

        // Handle any unterminated directive block
        if (currentDirectiveBlock) {
            directiveBlocks.push(currentDirectiveBlock);
        }

        return { directiveBlocks, remainingUsings };
    }

    /**
     * Recombines sorted usings with directive blocks
     */
    public recombine(sortedUsings: UsingStatement[], directiveBlocks: UsingStatement[][]): UsingStatement[] {
        const result: UsingStatement[] = [];

        // Add sorted usings first
        result.push(...sortedUsings);

        // Add directive blocks with blank line separator
        for (const block of directiveBlocks) {
            result.push(...block);
            result.push(UsingStatement.blankLine());
        }

        // Remove any trailing empty lines to ensure a clean output
        while (result.length > 0 && result[result.length - 1].isBlankLine) {
            result.pop();
        }

        return result;
    }

    /**
     * Checks if there are any preprocessor directives in the statements
     */
    public hasDirectives(statements: ReadonlyArray<UsingStatement>): boolean {
        return statements.some(s => s.isPreprocessorDirective);
    }

    private isDirectiveStart(stmt: UsingStatement): boolean {
        if (!stmt.isPreprocessorDirective) {
            return false;
        }
        return /^\s*#(if|endif|region|endregion|define|undef|pragma|error|warning|line|nullable)\b/.test(stmt.toString());
    }

    private isDirectiveEnd(stmt: UsingStatement): boolean {
        if (!stmt.isPreprocessorDirective) {
            return false;
        }
        return /^\s*#(endif|endregion)\b/.test(stmt.toString());
    }
}
