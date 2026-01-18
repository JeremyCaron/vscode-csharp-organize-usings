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
        return this.diagnostics;
    }

    areDiagnosticsReliable(_documentUri: vs.Uri, _totalUsingsInDocument: number): boolean
    {
        return true; // Mock always returns true for tests
    }
}
