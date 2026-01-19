import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { FormatOptions } from '../../domain/FormatOptions';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

/**
 * Tests for specific bug fixes from real-world codebases
 */
suite('Bug Fixes', () =>
{
    const extractor = new UsingBlockExtractor();

    function processSourceCode(
        sourceCode: string,
        eol: string,
        config: FormatOptions,
        diagnostics: vs.Diagnostic[],
    ): string
    {
        const provider = new MockDiagnosticProvider(diagnostics);

        // Extract blocks
        const blocks = extractor.extract(sourceCode, eol);

        if (blocks.size === 0)
        {
            return sourceCode;
        }

        // Process each block
        for (const block of blocks.values())
        {
            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();
        }

        // Replace and return
        return extractor.replace(sourceCode, eol, blocks);
    }

    suite('Issue #1: Missing newline between file comment and namespace when all usings removed', () =>
    {
        test('should preserve newline between file comment and namespace when all usings removed', () =>
        {
            const input = [
                '// File-level comment',
                '',
                'using CliFx.Attributes;',
                'using CliFx.Infrastructure;',
                '',
                'namespace CliFrameworkBenchmarks.Commands;',
            ].join('\n');

            const config = new FormatOptions('System', true, false, false);

            // Mark both usings as unused
            const diagnostics = [
                createUnusedUsingDiagnostic(2), // using CliFx.Attributes; (now line 2)
                createUnusedUsingDiagnostic(3), // using CliFx.Infrastructure; (now line 3)
            ];

            const result = processSourceCode(input, '\n', config, diagnostics);

            const expected = [
                '// File-level comment',
                '',
                'namespace CliFrameworkBenchmarks.Commands;',
            ].join('\n');

            assert.strictEqual(result, expected, 'Should have blank line between comment and namespace');
        });

        test('should have namespace on first line when all usings removed and no file comment', () =>
        {
            const input = [
                'using CliFx.Attributes;',
                'using CliFx.Infrastructure;',
                '',
                'namespace CliFrameworkBenchmarks.Commands;',
            ].join('\n');

            const config = new FormatOptions('System', true, false, false);

            // Mark both usings as unused
            const diagnostics = [
                createUnusedUsingDiagnostic(0), // using CliFx.Attributes;
                createUnusedUsingDiagnostic(1), // using CliFx.Infrastructure;
            ];

            const result = processSourceCode(input, '\n', config, diagnostics);

            const expected = 'namespace CliFrameworkBenchmarks.Commands;';

            assert.strictEqual(result, expected, 'Should have namespace on first line with no extra blank lines');
        });
    });

    suite('Issue #2: Preprocessor directives before usings', () =>
    {
        test('should keep preprocessor directive before usings with blank line separator', () =>
        {
            const input = [
                '#pragma warning disable CA1416',
                'using System.DirectoryServices;',
                'using Exceptionless.Core.Configuration;',
            ].join('\n');

            const config = new FormatOptions('System', true, true, true);
            const diagnostics: vs.Diagnostic[] = [];

            const result = processSourceCode(input, '\n', config, diagnostics);

            const expected = [
                '#pragma warning disable CA1416',
                '',
                'using System.DirectoryServices;',
                '',
                'using Exceptionless.Core.Configuration;',
            ].join('\n');

            assert.strictEqual(result, expected, 'Should have preprocessor before usings with blank line');
        });

        test('should keep preprocessor directive when some usings are removed', () =>
        {
            const input = [
                '#pragma warning disable CA1416',
                'using System.DirectoryServices;',
                'using UnusedNamespace;',
                'using Exceptionless.Core.Configuration;',
            ].join('\n');

            const config = new FormatOptions('System', true, false, true);

            // Mark middle using as unused
            const diagnostics = [
                createUnusedUsingDiagnostic(2), // using UnusedNamespace;
            ];

            const result = processSourceCode(input, '\n', config, diagnostics);

            const expected = [
                '#pragma warning disable CA1416',
                '',
                'using System.DirectoryServices;',
                '',
                'using Exceptionless.Core.Configuration;',
            ].join('\n');

            assert.strictEqual(result, expected, 'Should keep preprocessor with remaining usings');
        });
    });

    // Helper function to create unused using diagnostics
    function createUnusedUsingDiagnostic(line: number): vs.Diagnostic
    {
        const diagnostic = new vs.Diagnostic(
            new vs.Range(
                new vs.Position(line, 0),
                new vs.Position(line, 100),
            ),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        // Set code to match what the real language server returns (OmniSharp format)
        diagnostic.code = 'CS8019';
        diagnostic.source = 'csharp';
        return diagnostic;
    }
});
