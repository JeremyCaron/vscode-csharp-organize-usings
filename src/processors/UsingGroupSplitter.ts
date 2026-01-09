import { UsingStatement } from '../domain/UsingStatement';

/**
 * Splits using statements into groups by root namespace
 */
export class UsingGroupSplitter {
    /**
     * Inserts blank lines between different root namespaces
     * Aliases are kept together but a blank line is inserted before them if their
     * namespace differs from the previous regular using
     */
    public split(statements: ReadonlyArray<UsingStatement>): UsingStatement[] {
        // Find where actual using statements start (after comments)
        const firstUsingIndex = statements.findIndex(s => s.isActualUsing());
        if (firstUsingIndex === -1) {
            return Array.from(statements); // No usings, return as-is
        }

        const leadingContent = firstUsingIndex > 0 ? statements.slice(0, firstUsingIndex) : [];
        const usingStatements = statements.slice(firstUsingIndex);

        // Add blank line after leading comments if needed
        if (leadingContent.length > 0) {
            const lastLeading = leadingContent[leadingContent.length - 1];
            // Only add blank line if the last leading line is not already blank
            if (!lastLeading.isBlankLine) {
                leadingContent.push(UsingStatement.blankLine());
            }
        }

        const result: UsingStatement[] = [...leadingContent];
        let previousRootNamespace = '';

        for (const stmt of usingStatements) {
            // Skip blank lines - they don't participate in grouping
            if (stmt.isBlankLine) {
                result.push(stmt);
                continue;
            }

            // Directives and comments shouldn't appear here but handle them just in case
            if (!stmt.isActualUsing()) {
                result.push(stmt);
                continue;
            }

            // For aliases, still check if we need a blank line before them
            // but don't update the previousRootNamespace after
            if (stmt.isAlias) {
                // Add blank line before first alias if namespace changed
                if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace) {
                    result.push(UsingStatement.blankLine());
                    previousRootNamespace = ''; // Reset so we don't add more blank lines between aliases
                }
                result.push(stmt);
                continue;
            }

            // Regular using statement - add blank line if namespace changes
            if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace) {
                result.push(UsingStatement.blankLine());
            }

            result.push(stmt);
            previousRootNamespace = stmt.rootNamespace;
        }

        return result;
    }
}
