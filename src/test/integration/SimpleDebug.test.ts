import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';
import { UnusedUsingRemover } from '../../processors/UnusedUsingRemover';
import { FormatOptions } from '../../domain/FormatOptions';

/**
 * Simple debug test
 */
suite('Simple Debug', () =>
{
    test('mock diagnostic provider should filter diagnostics', () =>
    {
        const diagnostic = new vs.Diagnostic(
            new vs.Range(new vs.Position(0, 0), new vs.Position(0, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic.code = 'CS8019';
        diagnostic.source = 'csharp';

        const provider = new MockDiagnosticProvider([diagnostic]);
        const unused = provider.getUnusedUsingDiagnostics();

        assert.strictEqual(unused.length, 1, 'Should have 1 unused diagnostic');
    });

    test('unused using remover should remove based on diagnostics', () =>
    {
        const extractor = new UsingBlockExtractor();
        const input = [
            '#pragma warning disable CA1416',
            'using System.DirectoryServices;',
            'using UnusedNamespace;',
            'using Exceptionless.Core.Configuration;',
        ].join('\n');

        const blocks = extractor.extract(input, '\n');
        assert.strictEqual(blocks.size, 1, 'Should have 1 block');

        const block = Array.from(blocks.values())[0];
        console.log('Block startLine:', block.startLine);
        console.log('Block endLine:', block.endLine);
        console.log('Leading content:', block.getLeadingContent().map(s => `"${s.toString()}"`));
        console.log('Statements:', block.getStatements().map((s, i) => `  [${i}] "${s.toString()}"`));

        // Create diagnostic for line 2 (using UnusedNamespace;)
        const diagnostic = new vs.Diagnostic(
            new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic.code = 'CS8019';
        diagnostic.source = 'csharp';

        const provider = new MockDiagnosticProvider([diagnostic]);
        const config = new FormatOptions('System', false, false, true);
        const remover = new UnusedUsingRemover(provider, config);

        const result = remover.remove(block);
        console.log('Result length:', result.length);
        console.log('Result:', result.map(s => `"${s.toString()}"`));

        assert.strictEqual(result.length, 2, 'Should have 2 statements after removal (2 usings, pragma is leading content)');
    });

    test('when all usings removed, block should not have trailing blank line', () =>
    {
        const extractor = new UsingBlockExtractor();
        const input = [
            'using CliFx.Attributes;',
            'using CliFx.Infrastructure;',
            '',
            'namespace CliFrameworkBenchmarks.Commands;',
        ].join('\n');

        const blocks = extractor.extract(input, '\n');
        const block = Array.from(blocks.values())[0];

        const diagnostic1 = new vs.Diagnostic(
            new vs.Range(new vs.Position(0, 0), new vs.Position(0, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic1.code = 'CS8019';
        diagnostic1.source = 'csharp';

        const diagnostic2 = new vs.Diagnostic(
            new vs.Range(new vs.Position(1, 0), new vs.Position(1, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic2.code = 'CS8019';
        diagnostic2.source = 'csharp';

        const provider = new MockDiagnosticProvider([diagnostic1, diagnostic2]);
        const config = new FormatOptions('System', true, false, false);
        const processor = new UsingBlockProcessor(block, config, provider);
        processor.process();

        const lines = block.toLines();
        console.log('Lines after processing:', lines.map(l => `"${l}"`));

        const result = lines.join('\n');
        console.log('Result:', `"${result}"`);

        // Should be empty string (no usings left)
        assert.strictEqual(result, '', 'Should have no content when all usings removed');
    });

    test('debug originalText for full integration', () =>
    {
        const extractor = new UsingBlockExtractor();
        const input = [
            'using CliFx.Attributes;',
            'using CliFx.Infrastructure;',
            '',
            'namespace CliFrameworkBenchmarks.Commands;',
        ].join('\n');

        console.log('Input:', JSON.stringify(input));

        const blocks = extractor.extract(input, '\n');
        for (const [originalText, block] of blocks)
        {
            console.log('OriginalText:', JSON.stringify(originalText));
            console.log('Block startLine:', block.startLine);
            console.log('Block endLine:', block.endLine);
        }

        const diagnostic1 = new vs.Diagnostic(
            new vs.Range(new vs.Position(0, 0), new vs.Position(0, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic1.code = 'CS8019';
        diagnostic1.source = 'csharp';

        const diagnostic2 = new vs.Diagnostic(
            new vs.Range(new vs.Position(1, 0), new vs.Position(1, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic2.code = 'CS8019';
        diagnostic2.source = 'csharp';

        const provider = new MockDiagnosticProvider([diagnostic1, diagnostic2]);
        const config = new FormatOptions('System', true, false, false);

        for (const block of blocks.values())
        {
            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();
        }

        const result = extractor.replace(input, '\n', blocks);
        console.log('Result:', JSON.stringify(result));

        assert.strictEqual(result, 'namespace CliFrameworkBenchmarks.Commands;', 'Should have namespace on first line');
    });

    test('debug with leading comment and all usings removed', () =>
    {
        const extractor = new UsingBlockExtractor();
        const input = [
            '// File-level comment',
            '',
            'using CliFx.Attributes;',
            'using CliFx.Infrastructure;',
            '',
            'namespace CliFrameworkBenchmarks.Commands;',
        ].join('\n');

        const blocks = extractor.extract(input, '\n');
        const originalText = Array.from(blocks.keys())[0];
        const block = Array.from(blocks.values())[0];

        console.log('Original text:', JSON.stringify(originalText));
        console.log('Before processing:');
        console.log('  Leading content:', block.getLeadingContent().map(s => `"${s.toString()}"`));
        console.log('  Statements:', block.getStatements().map(s => `"${s.toString()}"`));

        const diagnostic1 = new vs.Diagnostic(
            new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic1.code = 'CS8019';
        diagnostic1.source = 'csharp';

        const diagnostic2 = new vs.Diagnostic(
            new vs.Range(new vs.Position(3, 0), new vs.Position(3, 100)),
            'Unnecessary using directive',
            vs.DiagnosticSeverity.Information,
        );
        diagnostic2.code = 'CS8019';
        diagnostic2.source = 'csharp';

        const provider = new MockDiagnosticProvider([diagnostic1, diagnostic2]);
        const config = new FormatOptions('System', true, false, false);
        const processor = new UsingBlockProcessor(block, config, provider);
        processor.process();

        console.log('After processing:');
        console.log('  Leading content:', block.getLeadingContent().map(s => `"${s.toString()}"`));
        console.log('  Statements:', block.getStatements().map(s => `"${s.toString()}"`));

        const lines = block.toLines();
        console.log('  toLines():', lines.map(l => `"${l}"`));

        const result = extractor.replace(input, '\n', blocks);
        console.log('Result:', JSON.stringify(result));

        const expected = [
            '// File-level comment',
            '',
            'namespace CliFrameworkBenchmarks.Commands;',
        ].join('\n');

        assert.strictEqual(result, expected, 'Should have blank line between comment and namespace');
    });

    test('should not add extra blank lines with splitGroups', () =>
    {
        const input = [
            'using System.Text;',
            'using Exceptionless.Core.Models.Data;',
            'namespace Exceptionless.Core.Extensions;',
        ].join('\n');

        const extractor = new UsingBlockExtractor();
        const blocks = extractor.extract(input, '\n');

        for (const block of blocks.values())
        {
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);
            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();
        }

        const result = extractor.replace(input, '\n', blocks);

        const expected = [
            'using System.Text;',
            '',
            'using Exceptionless.Core.Models.Data;',
            '',
            'namespace Exceptionless.Core.Extensions;',
        ].join('\n');

        assert.strictEqual(result, expected, 'Should have exactly one blank line before namespace');
    });
});
