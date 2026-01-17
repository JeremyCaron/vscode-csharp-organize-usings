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

        // Separate regular and static usings based on placement setting
        let regularUsings: UsingStatement[];
        let staticUsings: UsingStatement[];

        if (this.config.usingStaticPlacement === 'intermixed')
        {
            // Don't separate - treat all non-alias usings as regular, sort alphabetically
            regularUsings = this.filterBy(statementsWithComments, s => !s.isAlias && s.isActualUsing());
            staticUsings = [];
        }
        else // 'bottom' or 'groupedWithNamespace'
        {
            // Separate static from regular usings
            // They'll be recombined differently depending on the mode
            regularUsings = this.filterBy(statementsWithComments, s => !s.isAlias && !s.isStatic && s.isActualUsing());
            staticUsings = this.filterBy(statementsWithComments, s => !s.isAlias && s.isStatic && s.isActualUsing());
        }

        logToOutputChannel(`      Categorized: ${orphanedComments.length} orphaned comment(s), ${regularUsings.length} regular using(s), `
            + `${ staticUsings.length } static using(s), ${ aliases.length } alias(es), ${ directives.length } directive(s)`);

        // Sort each category
        const sortedRegular = this.sortAndDeduplicate(regularUsings);
        const sortedStatic = this.sortAndDeduplicate(staticUsings);
        const sortedAliases = this.sortAndDeduplicate(aliases);

        const duplicatesRemoved =
            (regularUsings.length - sortedRegular.length) +
            (staticUsings.length - sortedStatic.length) +
            (aliases.length - sortedAliases.length);
        if (duplicatesRemoved > 0)
        {
            logToOutputChannel(`      Removed ${duplicatesRemoved} duplicate(s) during sorting`);
        }

        // Combine based on placement mode
        if (this.config.usingStaticPlacement === 'intermixed')
        {
            // Already mixed together in sortedRegular (sorted alphabetically)
            return [
                ...orphanedComments,
                ...sortedRegular,
                ...sortedAliases,
                ...directives,
            ];
        }
        else if (this.config.usingStaticPlacement === 'bottom')
        {
            // All regular usings first, then all static usings at bottom
            return [
                ...orphanedComments,
                ...sortedRegular,
                ...sortedStatic,
                ...sortedAliases,
                ...directives,
            ];
        }
        else // 'groupedWithNamespace'
        {
            // Interleave regular and static usings by namespace
            const interleaved = this.interleaveByNamespace(sortedRegular, sortedStatic);
            return [
                ...orphanedComments,
                ...interleaved,
                ...sortedAliases,
                ...directives,
            ];
        }
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
     * Interleaves regular and static usings by namespace
     * For each namespace: regular usings first, then static usings
     */
    private interleaveByNamespace(regular: UsingStatement[], static_: UsingStatement[]): UsingStatement[]
    {
        const result: UsingStatement[] = [];
        const staticByNamespace = new Map<string, UsingStatement[]>();

        // Group static usings by root namespace
        for (const stmt of static_)
        {
            const ns = stmt.rootNamespace;
            if (!staticByNamespace.has(ns))
            {
                staticByNamespace.set(ns, []);
            }
            staticByNamespace.get(ns)!.push(stmt);
        }

        // Process regular usings and insert corresponding static usings after each namespace group
        let currentNamespace = '';
        for (let i = 0; i < regular.length; i++)
        {
            const stmt = regular[i];
            result.push(stmt);

            // Check if we're at the end of a namespace group
            const isLastOfGroup = i === regular.length - 1 || regular[i + 1].rootNamespace !== stmt.rootNamespace;

            if (isLastOfGroup && staticByNamespace.has(stmt.rootNamespace))
            {
                // Add all static usings for this namespace
                result.push(...staticByNamespace.get(stmt.rootNamespace)!);
                staticByNamespace.delete(stmt.rootNamespace);
            }
        }

        // Add any remaining static usings that don't have corresponding regular usings
        for (const statics of staticByNamespace.values())
        {
            result.push(...statics);
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
