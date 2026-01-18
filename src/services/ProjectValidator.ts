import { isProjectRestored, isUnityProject } from '../utils';
import { CSharpDocument } from '../domain/CSharpDocument';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import * as path from 'path';

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
     * Validates that the document's project is restored and ready,
     * and that diagnostics from the language server are reliable
     * @param document - The C# document to validate
     * @param diagnosticProvider - Provider for checking diagnostic reliability
     * @param totalUsingsInDocument - Total number of using statements in the document
     */
    public validate(
        document: CSharpDocument,
        diagnosticProvider: IDiagnosticProvider,
        totalUsingsInDocument: number
    ): ValidationResult
    {
        if (!document.projectFile)
        {
            return ValidationResult.invalid(
                'Could not find the parent project for the file that\'s open in the current editor.',
            );
        }

        if (!isProjectRestored(document.projectFile))
        {
            const projectName = path.basename(document.projectFile);
            const projectDir = path.dirname(document.projectFile);
            const isUnity = isUnityProject(projectDir);

            const errorMessage = isUnity
                ? `No action was taken because the project, ${projectName}, ` +
                  'has not been compiled by Unity. Please open the project in Unity and let it compile, then try again.'
                : `No action was taken because the project, ${projectName}, ` +
                  'has not been restored. Please run "dotnet restore" or build the project and try again.';

            return ValidationResult.invalid(errorMessage);
        }

        // Check if language server diagnostics are reliable
        if (!diagnosticProvider.areDiagnosticsReliable(document.uri, totalUsingsInDocument))
        {
            return ValidationResult.invalid(
                'No action was taken because the C# language server has not finished analyzing this file yet. ' +
                'Please wait a moment for the language server to complete its analysis and try again.'
            );
        }

        return ValidationResult.valid();
    }
}
