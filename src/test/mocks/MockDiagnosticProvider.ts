import * as vs from 'vscode';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';

/**
 * Mock implementation of IDiagnosticProvider for testing.
 * This mock always returns diagnostics as reliable and provides
 * a simple way to inject test diagnostics.
 */
export class MockDiagnosticProvider implements IDiagnosticProvider
{
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getAllDiagnostics(): vs.Diagnostic[]
    {
        return this.diagnostics;
    }

    getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        // Filter to only return diagnostics that look like unused using diagnostics
        return this.diagnostics.filter(d => this.isUnusedUsingDiagnostic(d));
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

    areDiagnosticsReliable(_documentUri: vs.Uri, _totalUsingsInDocument: number): boolean
    {
        return true; // Mock always returns true for tests
    }
}
