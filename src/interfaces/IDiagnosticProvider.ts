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
}
