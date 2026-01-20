import * as assert from 'assert';
import * as vs from 'vscode';
import { UnusedUsingRemover } from '../../processors/UnusedUsingRemover';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

suite('UnusedUsingRemover', () =>
{
    suite('Basic removal', () =>
    {
        test('should remove unused using based on diagnostic', () =>
        {
            const rawContent = [
                'using System;', // line 0 - marked unused
                'using Microsoft.AspNetCore.Mvc;', // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should handle Roslyn diagnostic format (IDE0005)', () =>
        {
            const rawContent = [
                'using System;', // line 0 - marked unused
                'using Microsoft.AspNetCore.Mvc;', // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: { value: 'IDE0005', target: vs.Uri.parse('null') },
                    source: 'roslyn',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should remove multiple unused usings', () =>
        {
            const rawContent = [
                'using System;', // line 0 - unused
                'using System.Text;', // line 1 - used
                'using System.Linq;', // line 2 - unused
                'using Microsoft.AspNetCore.Mvc;', // line 3 - used
            ];

            const block = new UsingBlock(0, 3, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1)),
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].namespace, 'System.Text');
            assert.strictEqual(result[1].namespace, 'Microsoft.AspNetCore.Mvc');
        });
    });

    suite('Configuration options', () =>
    {
        test('should not remove when disableUnusedUsingsRemoval=true', () =>
        {
            const rawContent = [
                'using System;', // line 0 - unused but should be kept
                'using Microsoft.AspNetCore.Mvc;',
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, true, false); // disabled!
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep all statements
            assert.strictEqual(result.length, 2);
        });

        test('should not remove usings in preprocessor blocks when disabled', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused but in preprocessor
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
            ];

            const block = new UsingBlock(0, 4, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false); // processInPreprocessor=false
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep the using because it's inside preprocessor block
            assert.ok(result.some(s => s.namespace === 'System.Diagnostics'));
        });

        test('should remove usings in preprocessor blocks when enabled', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
            ];

            const block = new UsingBlock(0, 4, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, true); // processInPreprocessor=true
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove even though it's in preprocessor block
            assert.ok(!result.some(s => s.namespace === 'System.Diagnostics'));
        });
    });

    suite('Edge cases', () =>
    {
        test('should handle empty block', () =>
        {
            const block = new UsingBlock(0, 0, []);

            const provider = new MockDiagnosticProvider([]);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 0);
        });

        test('should handle no diagnostics', () =>
        {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const provider = new MockDiagnosticProvider([]);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // No diagnostics = keep everything
            assert.strictEqual(result.length, 2);
        });

        test('should handle all usings unused', () =>
        {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1)),
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 0);
        });

        test('should NOT remove usings that have CS0246 (namespace not found) errors', () =>
        {
            const rawContent = [
                'using System;',              // line 0 - marked unused AND has CS0246
                'using Microsoft.AspNetCore.Mvc;', // line 1 - marked unused, no CS0246
            ];

            const block = new UsingBlock(0, 1, rawContent);

            // Simulate diagnostics showing line 0 has both unused AND not found
            const allDiagnostics = [
                // Unused using on line 0
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 13)),
                } as vs.Diagnostic,
                // Namespace not found on line 0
                {
                    code: 'CS0246',
                    source: 'csharp',
                    message: 'The type or namespace name \'System\' could not be found',
                    severity: vs.DiagnosticSeverity.Error,
                    range: new vs.Range(new vs.Position(0, 6), new vs.Position(0, 13)),
                } as vs.Diagnostic,
                // Unused using on line 1 (no CS0246)
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 32)),
                } as vs.Diagnostic,
            ];

            // Need a mock that mimics real VsCodeDiagnosticProvider behavior
            const provider = new MockDiagnosticProviderWithCS0246(allDiagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep line 0 (has CS0246), remove line 1 (no CS0246)
            assert.strictEqual(result.length, 1, 'Should keep only the using with CS0246');
            assert.strictEqual(result[0].namespace, 'System', 'Should keep System because it has CS0246');
        });
    });

    suite('Multi-line diagnostics', () =>
    {
        test('should handle diagnostic spanning two lines', () =>
        {
            const rawContent = [
                'using System;',           // line 0
                'using System.Text;',      // line 1
                'using System.Linq;',      // line 2
                'using Microsoft.AspNetCore.Mvc;', // line 3 - used
            ];

            const block = new UsingBlock(0, 3, rawContent);

            // Diagnostic spans lines 1-2
            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(2, 21)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove both lines 1 and 2
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].namespace, 'System');
            assert.strictEqual(result[1].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should handle diagnostic spanning three lines', () =>
        {
            const rawContent = [
                'using System;',           // line 0 - keep
                'using System.Text;',      // line 1 - remove
                'using System.Linq;',      // line 2 - remove
                'using System.Collections;', // line 3 - remove
                'using Microsoft.AspNetCore.Mvc;', // line 4 - keep
            ];

            const block = new UsingBlock(0, 4, rawContent);

            // Diagnostic spans lines 1-3
            const diagnostics = [
                {
                    code: { value: 'IDE0005', target: vs.Uri.parse('null') },
                    source: 'roslyn',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(3, 28)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove lines 1, 2, and 3
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].namespace, 'System');
            assert.strictEqual(result[1].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should handle multiple multi-line diagnostics', () =>
        {
            const rawContent = [
                'using System;',           // line 0 - remove (diagnostic 1: lines 0-1)
                'using System.Text;',      // line 1 - remove (diagnostic 1: lines 0-1)
                'using Microsoft.AspNetCore.Mvc;', // line 2 - keep
                'using System.Linq;',      // line 3 - remove (diagnostic 2: lines 3-4)
                'using System.Collections;', // line 4 - remove (diagnostic 2: lines 3-4)
            ];

            const block = new UsingBlock(0, 4, rawContent);

            const diagnostics = [
                // First multi-line diagnostic: lines 0-1
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(1, 18)),
                } as vs.Diagnostic,
                // Second multi-line diagnostic: lines 3-4
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(3, 0), new vs.Position(4, 28)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep only line 2
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should NOT remove lines in multi-line diagnostic that have CS0246 errors', () =>
        {
            const rawContent = [
                'using System;',           // line 0 - has CS0246, should keep
                'using System.Text;',      // line 1 - part of multi-line diagnostic, should remove
                'using System.Linq;',      // line 2 - part of multi-line diagnostic, should remove
                'using Microsoft.AspNetCore.Mvc;', // line 3 - keep
            ];

            const block = new UsingBlock(0, 3, rawContent);

            // Multi-line diagnostic spans 0-2, but line 0 has CS0246
            const allDiagnostics = [
                // Multi-line unused diagnostic spanning lines 0-2
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(2, 21)),
                } as vs.Diagnostic,
                // CS0246 error on line 0
                {
                    code: 'CS0246',
                    source: 'csharp',
                    message: 'The type or namespace name \'System\' could not be found',
                    severity: vs.DiagnosticSeverity.Error,
                    range: new vs.Range(new vs.Position(0, 6), new vs.Position(0, 12)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProviderWithCS0246(allDiagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep line 0 (CS0246) and line 3, remove lines 1 and 2
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].namespace, 'System', 'Should keep System (has CS0246)');
            assert.strictEqual(result[1].namespace, 'Microsoft.AspNetCore.Mvc', 'Should keep AspNetCore.Mvc');
        });

        test('should handle multi-line diagnostic in preprocessor block when disabled', () =>
        {
            const rawContent = [
                'using System;',           // line 0
                '#if DEBUG',               // line 1
                'using System.Diagnostics;', // line 2 - in preprocessor
                'using System.Text;',      // line 3 - in preprocessor
                '#endif',                  // line 4
                'using Microsoft.AspNetCore.Mvc;', // line 5
            ];

            const block = new UsingBlock(0, 5, rawContent);

            // Multi-line diagnostic spans lines 2-3 (inside preprocessor)
            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(3, 21)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false); // processInPreprocessor=false
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep both lines in preprocessor block
            assert.ok(result.some(s => s.namespace === 'System.Diagnostics'));
            assert.ok(result.some(s => s.namespace === 'System.Text'));
        });

        test('should handle multi-line diagnostic in preprocessor block when enabled', () =>
        {
            const rawContent = [
                'using System;',           // line 0
                '#if DEBUG',               // line 1
                'using System.Diagnostics;', // line 2 - in preprocessor, remove
                'using System.Text;',      // line 3 - in preprocessor, remove
                '#endif',                  // line 4
                'using Microsoft.AspNetCore.Mvc;', // line 5
            ];

            const block = new UsingBlock(0, 5, rawContent);

            // Multi-line diagnostic spans lines 2-3 (inside preprocessor)
            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(3, 21)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, true); // processInPreprocessor=true
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove both lines in preprocessor block
            assert.ok(!result.some(s => s.namespace === 'System.Diagnostics'));
            assert.ok(!result.some(s => s.namespace === 'System.Text'));
        });

        test('should handle multi-line diagnostic spanning preprocessor boundary', () =>
        {
            const rawContent = [
                'using System;',           // line 0
                'using System.Text;',      // line 1 - outside preprocessor, part of multi-line
                '#if DEBUG',               // line 2
                'using System.Diagnostics;', // line 3 - inside preprocessor, part of multi-line
                '#endif',                  // line 4
                'using Microsoft.AspNetCore.Mvc;', // line 5
            ];

            const block = new UsingBlock(0, 5, rawContent);

            // Multi-line diagnostic spans lines 1-3 (crosses preprocessor boundary)
            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(3, 28)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false); // processInPreprocessor=false
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove line 1 (outside preprocessor) but keep line 3 (inside preprocessor)
            assert.ok(!result.some(s => s.namespace === 'System.Text'), 'System.Text should be removed');
            assert.ok(result.some(s => s.namespace === 'System.Diagnostics'), 'System.Diagnostics should be kept');
        });
    });
});

/**
 * Mock that mimics VsCodeDiagnosticProvider's behavior of filtering CS0246
 */
class MockDiagnosticProviderWithCS0246 implements IDiagnosticProvider
{
    constructor(private allDiagnostics: vs.Diagnostic[]) {}

    getAllDiagnostics(): vs.Diagnostic[]
    {
        return this.allDiagnostics;
    }

    getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        // Return all unused diagnostics without filtering
        // The UnusedUsingRemover will handle skipping lines with CS0246
        return this.allDiagnostics.filter(d =>
            d.code?.toString() === 'CS8019' ||
            (typeof d.code === 'object' && d.code !== null && 'value' in d.code &&
             ((d.code as {value: string}).value === 'IDE0005' || (d.code as {value: string}).value === 'CS8019')),
        );
    }

    areDiagnosticsReliable(_documentUri: vs.Uri, _totalUsingsInDocument: number): boolean
    {
        return true;
    }
}
