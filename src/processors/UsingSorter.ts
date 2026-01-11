import { UsingStatement } from '../domain/UsingStatement';
import { FormatOptions } from '../domain/FormatOptions';
import { UsingStatementComparator } from './UsingStatementComparator';
import { logToOutputChannel } from '../logging/logger';

/**
 * Sorts using statements according to configuration
 */
export class UsingSorter
{
    private readonly config: FormatOptions;
    private readonly comparator: UsingStatementComparator;

    constructor(config: FormatOptions)
    {
        this.config = config;
        this.comparator = new UsingStatementComparator(config.sortOrder);
    }

    /**
     * Sorts an array of using statements
     */
    public sort(statements: ReadonlyArray<UsingStatement>): UsingStatement[]
    {
        // Attach comments to their following using statements
        const statementsWithComments = this.attachCommentsToUsings(statements);

        // Separate into categories
        const orphanedComments = this.filterBy(statementsWithComments, s => s.isComment);
        const directives = this.filterBy(statementsWithComments, s => s.isPreprocessorDirective);
        const aliases = this.filterBy(statementsWithComments, s => s.isAlias && s.isActualUsing());
        const regular = this.filterBy(statementsWithComments, s => !s.isAlias && s.isActualUsing());

        logToOutputChannel(`      Categorized: ${orphanedComments.length} orphaned comment(s), ${regular.length} regular using(s), ${aliases.length} alias(es), ${directives.length} directive(s)`);

        // Sort each category
        const sortedRegular = this.sortAndDeduplicate(regular);
        const sortedAliases = this.sortAndDeduplicate(aliases);

        const duplicatesRemoved = (regular.length - sortedRegular.length) + (aliases.length - sortedAliases.length);
        if (duplicatesRemoved > 0)
        {
            logToOutputChannel(`      Removed ${duplicatesRemoved} duplicate(s) during sorting`);
        }

        // Combine in order: orphaned comments, regular, aliases, directives
        return [
            ...orphanedComments,
            ...sortedRegular,
            ...sortedAliases,
            ...directives,
        ];
    }

    private filterBy(
        statements: ReadonlyArray<UsingStatement>,
        predicate: (s: UsingStatement) => boolean,
    ): UsingStatement[]
    {
        return Array.from(statements).filter(predicate);
    }

    private sortAndDeduplicate(statements: UsingStatement[]): UsingStatement[]
    {
        const sorted = [...statements].sort((a, b) => this.comparator.compare(a, b));
        return this.removeDuplicates(sorted);
    }

    private removeDuplicates(statements: UsingStatement[]): UsingStatement[]
    {
        const seen = new Set<string>();
        const result: UsingStatement[] = [];

        for (const stmt of statements)
        {
            const key = stmt.getDeduplicationKey();
            if (key && seen.has(key))
            {
                continue; // Skip duplicate
            }
            if (key)
            {
                seen.add(key);
            }
            result.push(stmt);
        }

        return result;
    }

    /**
     * Attaches comments directly preceding using statements to those statements
     * Returns statements where comments not followed by usings remain separate
     */
    private attachCommentsToUsings(statements: ReadonlyArray<UsingStatement>): UsingStatement[]
    {
        const result: UsingStatement[] = [];
        const pendingComments: UsingStatement[] = [];

        for (const stmt of statements)
        {
            if (stmt.isComment)
            {
                // Accumulate comments
                pendingComments.push(stmt);
            }
            else if (stmt.isActualUsing())
            {
                // Attach any pending comments to this using statement
                if (pendingComments.length > 0)
                {
                    stmt.setAttachedComments([...pendingComments]);
                    pendingComments.length = 0;
                }
                result.push(stmt);
            }
            else
            {
                // For preprocessor directives or blank lines:
                // Flush pending comments as orphaned, then add the directive/blank
                result.push(...pendingComments);
                pendingComments.length = 0;
                result.push(stmt);
            }
        }

        // Any remaining comments at the end are orphaned
        result.push(...pendingComments);

        return result;
    }
}
