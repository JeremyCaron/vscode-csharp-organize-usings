import { UsingStatement } from '../domain/UsingStatement';

/**
 * Normalizes whitespace (blank lines) throughout the using block
 * according to consistent formatting rules.
 *
 * This is the ONLY place where blank lines should be added to the statements.
 */
export class WhitespaceNormalizer {
    /**
     * Adds blank lines according to formatting rules:
     * 1. Blank line after leading comments (before first using)
     * 2. Blank lines between different namespace groups (handled by UsingGroupSplitter)
     * 3. Blank line before preprocessor blocks
     * 4. Blank line after opening preprocessor directives (#if, #else, #elif)
     * 5. Blank line before closing preprocessor directives (#endif, #endregion)
     * 6. Blank line after preprocessor blocks
     */
    public normalize(statements: ReadonlyArray<UsingStatement>): UsingStatement[] {
        const result: UsingStatement[] = [];
        let inPreprocessorBlock = false;
        let preprocessorDepth = 0;

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const prev = i > 0 ? statements[i - 1] : null;
            const next = i < statements.length - 1 ? statements[i + 1] : null;

            // Track preprocessor block state
            if (stmt.isPreprocessorDirective) {
                const text = stmt.toString().trim();

                // Entering a preprocessor block
                if (/^#(if|region)\b/.test(text)) {
                    // Add blank line BEFORE the opening directive (if there's content before it)
                    if (prev && !prev.isBlankLine && !prev.isComment) {
                        result.push(UsingStatement.blankLine());
                    }

                    result.push(stmt);
                    inPreprocessorBlock = true;
                    preprocessorDepth++;

                    // Add blank line AFTER opening directive (if there's content after it)
                    if (next && next.isActualUsing() && !next.isBlankLine) {
                        result.push(UsingStatement.blankLine());
                    }

                    continue;
                }

                // Exiting a preprocessor block
                if (/^#(endif|endregion)\b/.test(text)) {
                    // Add blank line BEFORE closing directive (if there's content before it)
                    if (prev && !prev.isBlankLine && prev.isActualUsing()) {
                        result.push(UsingStatement.blankLine());
                    }

                    result.push(stmt);
                    preprocessorDepth--;
                    if (preprocessorDepth === 0) {
                        inPreprocessorBlock = false;
                    }

                    // Add blank line AFTER closing directive (if there's content after it)
                    if (next && !next.isBlankLine) {
                        result.push(UsingStatement.blankLine());
                    }

                    continue;
                }

                // Middle directives (#else, #elif)
                if (/^#(else|elif)\b/.test(text)) {
                    // Add blank line BEFORE #else/#elif (if there's content before it)
                    if (prev && !prev.isBlankLine && prev.isActualUsing()) {
                        result.push(UsingStatement.blankLine());
                    }

                    result.push(stmt);

                    // Add blank line AFTER #else/#elif (if there's content after it)
                    if (next && next.isActualUsing() && !next.isBlankLine) {
                        result.push(UsingStatement.blankLine());
                    }

                    continue;
                }

                // Other preprocessor directives
                result.push(stmt);
                continue;
            }

            // Handle comments
            if (stmt.isComment) {
                result.push(stmt);

                // Add blank line after last comment before first using
                if (next && next.isActualUsing()) {
                    result.push(UsingStatement.blankLine());
                }

                continue;
            }

            // Regular using statements and blank lines - just pass through
            // (UsingGroupSplitter already added blank lines between namespace groups)
            result.push(stmt);
        }

        return result;
    }
}
