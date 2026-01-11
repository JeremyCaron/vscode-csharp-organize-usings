import { isProjectRestored } from '../utils';
import { CSharpDocument } from '../domain/CSharpDocument';

/**
 * Result of project validation
 */
export class ValidationResult
{
    constructor(
        public readonly isValid: boolean,
        public readonly message: string,
    ) {}

    public static valid(): ValidationResult
    {
        return new ValidationResult(true, '');
    }

    public static invalid(message: string): ValidationResult
    {
        return new ValidationResult(false, message);
    }
}

/**
 * Validates that a C# project is ready for organizing usings
 */
export class ProjectValidator
{
    /**
     * Validates that the document's project is restored and ready
     */
    public validate(document: CSharpDocument): ValidationResult
    {
        if (!document.projectFile)
        {
            return ValidationResult.invalid(
                'Could not find the parent project for the file that\'s open in the current editor.',
            );
        }

        if (!isProjectRestored(document.projectFile))
        {
            return ValidationResult.invalid(
                `No action was taken because the project, ${document.projectFile}, ` +
                'has not been restored. Please restore the project and try again.',
            );
        }

        return ValidationResult.valid();
    }
}
