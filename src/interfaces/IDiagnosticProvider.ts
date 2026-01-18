import * as vs from 'vscode';

/**
 * Interface for providing diagnostics about unused usings
 */
export interface IDiagnosticProvider
{
    /**
     * Gets all diagnostics for unused using statements
     */
    getUnusedUsingDiagnostics(): vs.Diagnostic[];

    /**
     * Gets all diagnostics for the document
     */
    getAllDiagnostics(): vs.Diagnostic[];

    /**
     * Checks if the language server diagnostics are reliable (not premature)
     * @param documentUri - The URI of the document to check
     * @param totalUsingsInDocument - Total number of using statements in the document
     * @returns true if diagnostics are reliable, false if they appear premature
     */
    areDiagnosticsReliable(documentUri: vs.Uri, totalUsingsInDocument: number): boolean;
}
