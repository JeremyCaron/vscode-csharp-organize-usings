import { UsingStatement } from '../domain/UsingStatement';
import { FormatOptions } from '../domain/FormatOptions';

/**
 * Splits using statements into groups by root namespace
 */
export class UsingGroupSplitter
{
    private readonly config: FormatOptions;

    constructor(config: FormatOptions)
    {
        this.config = config;
    }

    /**
     * Inserts blank lines between different root namespaces
     * Aliases are kept together but a blank line is inserted before them if their
     * namespace differs from the previous regular using
     */
    public split(statements: ReadonlyArray<UsingStatement>): UsingStatement[]
    {
        // Find where actual using statements start (after orphaned comments)
        // Note: Attached comments will be on using statements, not standalone
        const firstUsingIndex = statements.findIndex(s => s.isActualUsing());
        if (firstUsingIndex === -1)
        {
            return Array.from(statements); // No usings, return as-is
        }

        const leadingContent = firstUsingIndex > 0 ? statements.slice(0, firstUsingIndex) : [];
        const usingStatements = statements.slice(firstUsingIndex);

        // Add blank line after leading (orphaned) comments if needed
        if (leadingContent.length > 0)
        {
            const lastLeading = leadingContent[leadingContent.length - 1];
            // Only add blank line if the last leading line is not already blank
            if (!lastLeading.isBlankLine)
            {
                leadingContent.push(UsingStatement.blankLine());
            }
        }

        const result: UsingStatement[] = [...leadingContent];
        let previousRootNamespace = '';
        let previousWasStatic = false;

        for (const stmt of usingStatements)
        {
            // Skip blank lines - they don't participate in grouping
            if (stmt.isBlankLine)
            {
                result.push(stmt);
                continue;
            }

            // Standalone directives and comments shouldn't appear here but handle them just in case
            // (Comments attached to usings are handled as part of the using statement)
            if (!stmt.isActualUsing())
            {
                result.push(stmt);
                continue;
            }

            // For aliases, still check if we need a blank line before them
            // but don't update the previousRootNamespace after
            if (stmt.isAlias)
            {
                // Add blank line before first alias if namespace changed
                if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace)
                {
                    result.push(UsingStatement.blankLine());
                    previousRootNamespace = ''; // Reset so we don't add more blank lines between aliases
                }
                result.push(stmt);
                continue;
            }

            // Handle static usings
            if (stmt.isStatic)
            {
                if (this.config.usingStaticPlacement === 'groupedWithNamespace')
                {
                    // Static usings grouped with their namespace, but after regular usings
                    // Add blank line if namespace changes
                    if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace)
                    {
                        result.push(UsingStatement.blankLine());
                    }
                    result.push(stmt);
                    previousRootNamespace = stmt.rootNamespace;
                    previousWasStatic = true;
                    continue;
                }
                else if (this.config.usingStaticPlacement === 'bottom')
                {
                    // In bottom mode, static usings are a separate section
                    // Always add blank line before first static using (transitioning from regular to static)
                    if (!previousWasStatic && previousRootNamespace)
                    {
                        result.push(UsingStatement.blankLine());
                    }
                    // Add blank line if namespace changes within the static section
                    else if (previousWasStatic && previousRootNamespace && stmt.rootNamespace !== previousRootNamespace)
                    {
                        result.push(UsingStatement.blankLine());
                    }
                    result.push(stmt);
                    previousRootNamespace = stmt.rootNamespace;
                    previousWasStatic = true;
                    continue;
                }
                else // 'intermixed' mode
                {
                    // In intermixed mode, static usings are treated like regular usings
                    // Add blank line if namespace changes
                    if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace)
                    {
                        result.push(UsingStatement.blankLine());
                    }
                    result.push(stmt);
                    previousRootNamespace = stmt.rootNamespace;
                    previousWasStatic = false; // Treat as regular for grouping purposes
                    continue;
                }
            }

            // Regular using statement (non-static, non-alias)
            // Add blank line if namespace changes
            if (previousRootNamespace && stmt.rootNamespace !== previousRootNamespace)
            {
                result.push(UsingStatement.blankLine());
            }

            result.push(stmt);
            previousRootNamespace = stmt.rootNamespace;
            previousWasStatic = false;
        }

        return result;
    }
}
