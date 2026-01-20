import { UsingStatement } from '../domain/UsingStatement';

/**
 * Compares using statements for sorting purposes
 */
export class UsingStatementComparator
{
    private readonly priorityNamespaces: string[];

    constructor(sortOrderConfig: string)
    {
        this.priorityNamespaces = sortOrderConfig
            .split(' ')
            .filter(s => s.length > 0);
    }

    /**
     * Compares two using statements for sorting
     * Returns negative if a comes before b, positive if b comes before a, 0 if equal
     */
    public compare(a: UsingStatement, b: UsingStatement): number
    {
        // Get namespace strings, trimming semicolons and whitespace
        const aNamespace = this.normalizeNamespace(a.namespace);
        const bNamespace = this.normalizeNamespace(b.namespace);

        // Check priority namespaces first
        const aPriority = this.getPriority(aNamespace);
        const bPriority = this.getPriority(bNamespace);

        if (aPriority !== bPriority)
        {
            return bPriority - aPriority; // Higher priority first
        }

        // Case-insensitive alphabetical comparison
        const comparison = this.caseInsensitiveCompare(aNamespace, bNamespace);
        if (comparison !== 0)
        {
            return comparison;
        }

        // If case-insensitive equal, shorter comes first
        return aNamespace.length - bNamespace.length;
    }

    private normalizeNamespace(namespace: string): string
    {
        // Remove "using " prefix if present and trim semicolons
        return namespace.replace(/^\s*using\s+/, '').replace(/;\s*$/, '').trim();
    }

    private getPriority(namespace: string): number
    {
        for (let i = 0; i < this.priorityNamespaces.length; i++)
        {
            const priority = this.priorityNamespaces[i];
            const nsTest = priority.length < namespace.length
                ? namespace.substring(0, priority.length)
                : namespace;

            if (priority === nsTest)
            {
                return this.priorityNamespaces.length - i;
            }
        }
        return 0;
    }

    private caseInsensitiveCompare(a: string, b: string): number
    {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        if (aLower < bLower) return -1;
        if (aLower > bLower) return 1;

        // If lowercase versions are equal, use case-sensitive comparison for tie-breaking
        // Prefer lowercase letters first (uppercase comes before lowercase in ASCII)
        let caseScore = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++)
        {
            if (a[i].toLowerCase() !== a[i]) caseScore--;
            if (b[i].toLowerCase() !== b[i]) caseScore++;
            if (caseScore !== 0) break;
        }

        return caseScore;
    }
}
