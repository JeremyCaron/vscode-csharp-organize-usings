/**
 * Result of organizing usings operation
 */
export class OrganizationResult
{
    private constructor(
        public readonly success: boolean,
        public readonly content: string,
        public readonly message: string,
    ) {}

    /**
     * Creates a successful result with new content
     */
    public static success(content: string): OrganizationResult
    {
        return new OrganizationResult(true, content, '');
    }

    /**
     * Creates an error result
     */
    public static error(message: string): OrganizationResult
    {
        return new OrganizationResult(false, '', message);
    }

    /**
     * Creates a result indicating no changes were needed
     */
    public static noChange(): OrganizationResult
    {
        return new OrganizationResult(true, '', 'No changes needed');
    }

    /**
     * Returns true if changes were made
     */
    public hasChanges(): boolean
    {
        return this.success && this.content.length > 0;
    }
}
