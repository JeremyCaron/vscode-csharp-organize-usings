import * as vs from 'vscode';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';

/**
 * Diagnostic provider that uses VSCode's language server diagnostics
 */
export class VsCodeDiagnosticProvider implements IDiagnosticProvider
{
    private readonly documentUri: vs.Uri;

    constructor(documentUri: vs.Uri)
    {
        this.documentUri = documentUri;
    }

    public getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        return vs.languages.getDiagnostics(this.documentUri)
            .filter(d => this.isUnusedUsingDiagnostic(d));
    }

    private isUnusedUsingDiagnostic(diagnostic: vs.Diagnostic): boolean
    {
        // OmniSharp format
        if (diagnostic.source === 'csharp' && diagnostic.code?.toString() === 'CS8019')
        {
            return true;
        }

        // Roslyn format
        if (typeof diagnostic.code === 'object' &&
            diagnostic.code !== null &&
            'value' in diagnostic.code)
        {
            const value = (diagnostic.code as { value: string }).value;
            return value === 'IDE0005' || value === 'CS8019';
        }

        return false;
    }
}
