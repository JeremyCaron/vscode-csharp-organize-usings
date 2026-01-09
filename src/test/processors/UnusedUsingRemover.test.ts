import * as assert from 'assert';
import * as vs from 'vscode';
import { UnusedUsingRemover } from '../../processors/UnusedUsingRemover';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../processors/IDiagnosticProvider';

class MockDiagnosticProvider implements IDiagnosticProvider {
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getUnusedUsingDiagnostics(): vs.Diagnostic[] {
        return this.diagnostics;
    }
}

suite('UnusedUsingRemover', () => {
    suite('Basic removal', () => {
        test('should remove unused using based on diagnostic', () => {
            const rawContent = [
                'using System;', // line 0 - marked unused
                'using Microsoft.AspNetCore.Mvc;' // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should handle Roslyn diagnostic format (IDE0005)', () => {
            const rawContent = [
                'using System;', // line 0 - marked unused
                'using Microsoft.AspNetCore.Mvc;' // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: { value: 'IDE0005', target: vs.Uri.parse('null') },
                    source: 'roslyn',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].namespace, 'Microsoft.AspNetCore.Mvc');
        });

        test('should remove multiple unused usings', () => {
            const rawContent = [
                'using System;', // line 0 - unused
                'using System.Text;', // line 1 - used
                'using System.Linq;', // line 2 - unused
                'using Microsoft.AspNetCore.Mvc;' // line 3 - used
            ];

            const block = new UsingBlock(0, 3, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1))
                } as vs.Diagnostic
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

    suite('Configuration options', () => {
        test('should not remove when disableUnusedUsingsRemoval=true', () => {
            const rawContent = [
                'using System;', // line 0 - unused but should be kept
                'using Microsoft.AspNetCore.Mvc;'
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, true, false); // disabled!
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep all statements
            assert.strictEqual(result.length, 2);
        });

        test('should not remove usings in preprocessor blocks when disabled', () => {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused but in preprocessor
                '#endif',
                'using Microsoft.AspNetCore.Mvc;'
            ];

            const block = new UsingBlock(0, 4, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false); // processInPreprocessor=false
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should keep the using because it's inside preprocessor block
            assert.ok(result.some(s => s.namespace === 'System.Diagnostics'));
        });

        test('should remove usings in preprocessor blocks when enabled', () => {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused
                '#endif',
                'using Microsoft.AspNetCore.Mvc;'
            ];

            const block = new UsingBlock(0, 4, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, true); // processInPreprocessor=true
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should remove even though it's in preprocessor block
            assert.ok(!result.some(s => s.namespace === 'System.Diagnostics'));
        });
    });

    suite('Edge cases', () => {
        test('should handle empty block', () => {
            const block = new UsingBlock(0, 0, []);

            const provider = new MockDiagnosticProvider([]);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 0);
        });

        test('should handle no diagnostics', () => {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;'
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const provider = new MockDiagnosticProvider([]);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // No diagnostics = keep everything
            assert.strictEqual(result.length, 2);
        });

        test('should handle all usings unused', () => {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;'
            ];

            const block = new UsingBlock(0, 1, rawContent);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);
            const config = new FormatOptions('System', false, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            assert.strictEqual(result.length, 0);
        });
    });
});
