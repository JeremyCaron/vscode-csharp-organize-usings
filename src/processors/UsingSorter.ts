import { UsingStatement } from '../domain/UsingStatement';
import { FormatOptions } from '../domain/FormatOptions';
import { UsingStatementComparator } from './UsingStatementComparator';

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
        // Separate into categories
        const comments = this.filterBy(statements, s => s.isComment);
        const directives = this.filterBy(statements, s => s.isPreprocessorDirective);
        const aliases = this.filterBy(statements, s => s.isAlias && s.isActualUsing());
        const regular = this.filterBy(statements, s => !s.isAlias && s.isActualUsing());

        // Sort each category
        const sortedRegular = this.sortAndDeduplicate(regular);
        const sortedAliases = this.sortAndDeduplicate(aliases);

        // Combine in order: comments, regular, aliases, directives
        return [
            ...comments,
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
}
