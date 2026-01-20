import * as vs from 'vscode';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import { logToOutputChannel } from '../logging/logger';

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

    public getAllDiagnostics(): vs.Diagnostic[]
    {
        return vs.languages.getDiagnostics(this.documentUri);
    }

    public getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        const allDiagnostics = this.getAllDiagnostics();
        logToOutputChannel(`      Total diagnostics for this file: ${allDiagnostics.length}`);

        // Log all diagnostic codes for debugging
        const diagnosticSummary = allDiagnostics.map(d => {
            const code = typeof d.code === 'object' && d.code !== null && 'value' in d.code
                ? (d.code as {value: string}).value
                : d.code?.toString();
            return `${code} at line ${d.range.start.line}`;
        }).join(', ');
        if (diagnosticSummary) {
            logToOutputChannel(`      Diagnostic codes: ${diagnosticSummary}`);
        }

        const unusedDiagnostics = allDiagnostics.filter(d => this.isUnusedUsingDiagnostic(d));
        logToOutputChannel(`      Found ${unusedDiagnostics.length} unused using diagnostic(s)`);

        // Get all lines that have "namespace not found" errors
        const linesWithNotFoundErrors = new Set<number>();
        for (const diagnostic of allDiagnostics)
        {
            if (this.isNamespaceNotFoundDiagnostic(diagnostic))
            {
                linesWithNotFoundErrors.add(diagnostic.range.start.line);
                logToOutputChannel(`      Found CS0246 on line ${diagnostic.range.start.line}`);
            }
        }

        // Log unused diagnostic line numbers for comparison
        logToOutputChannel(`      Unused diagnostics on lines: ${unusedDiagnostics.map(d => d.range.start.line).join(', ')}`);
        logToOutputChannel(`      CS0246 errors on lines: ${Array.from(linesWithNotFoundErrors).join(', ')}`);

        // Don't filter diagnostics here - just log them
        // The UnusedUsingRemover will handle skipping individual lines with CS0246
        const reliableUnusedDiagnostics = unusedDiagnostics;

        if (reliableUnusedDiagnostics.length < unusedDiagnostics.length)
        {
            const skipped = unusedDiagnostics.length - reliableUnusedDiagnostics.length;
            logToOutputChannel(`      Skipped ${skipped} unused using diagnostic(s) due to namespace not found errors`);
        }

        logToOutputChannel(`      Returning ${reliableUnusedDiagnostics.length} reliable unused using diagnostic(s)`);
        return reliableUnusedDiagnostics;
    }

    public areDiagnosticsReliable(documentUri: vs.Uri, totalUsingsInDocument: number): boolean
    {
        const allDiagnostics = vs.languages.getDiagnostics(documentUri);
        const unusedUsingDiags = this.getUnusedUsingDiagnostics();

        // If we have NO C# diagnostics at all, server hasn't started analyzing yet
        const hasCSharpDiagnostics = allDiagnostics.some(d =>
            d.source === 'csharp' ||
            (typeof d.code === 'object' && d.code !== null && 'value' in d.code)
        );

        if (!hasCSharpDiagnostics)
        {
            logToOutputChannel('      No C# diagnostics found - language server may not have started analyzing yet');
            return false;
        }

        // Heuristic: If ALL usings in the file are marked unused and there are more than 3,
        // that's highly suspicious - likely premature diagnostics before the language server
        // has finished analyzing project references
        if (unusedUsingDiags.length === totalUsingsInDocument && totalUsingsInDocument > 3)
        {
            logToOutputChannel(`      All ${totalUsingsInDocument} usings are marked unused - diagnostics appear premature`);
            logToOutputChannel('      This typically happens when the language server is still analyzing project references');
            return false;
        }

        return true;
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

    private isNamespaceNotFoundDiagnostic(diagnostic: vs.Diagnostic): boolean
    {
        // CS0246: The type or namespace name could not be found
        // OmniSharp format
        if (diagnostic.source === 'csharp' && diagnostic.code?.toString() === 'CS0246')
        {
            return true;
        }

        // Roslyn format
        if (typeof diagnostic.code === 'object' &&
            diagnostic.code !== null &&
            'value' in diagnostic.code)
        {
            const value = (diagnostic.code as { value: string }).value;
            return value === 'CS0246';
        }

        return false;
    }
}
