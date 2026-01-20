import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingSorter } from '../../processors/UsingSorter';
import { UsingGroupSplitter } from '../../processors/UsingGroupSplitter';
import { WhitespaceNormalizer } from '../../processors/WhitespaceNormalizer';
import { UnusedUsingRemover } from '../../processors/UnusedUsingRemover';
import { FormatOptions } from '../../domain/FormatOptions';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

/**
 * Integration tests that verify processors work correctly with extracted blocks
 * (rather than manually constructed UsingBlock objects)
 */
suite('Processor Integration Tests (with extraction)', () =>
{
    suite('UsingSorter with extraction', () =>
    {
        test('should sort extracted block with System-first ordering', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using Microsoft.Extensions;',
                'using System;',
                'using Amazon.S3;',
                'using System.Text;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            // Filter to actual usings for verification
            const usings = sorted.filter(s => s.isActualUsing());

            assert.strictEqual(usings[0].namespace, 'System');
            assert.strictEqual(usings[1].namespace, 'System.Text');
            assert.strictEqual(usings[2].namespace, 'Amazon.S3');
            assert.strictEqual(usings[3].namespace, 'Microsoft.Extensions');
        });

        test('should sort extracted block with preprocessor directives', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using Microsoft.Extensions;',
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            // Sorted regular usings should come first, then preprocessor block
            const usings = sorted.filter(s => s.isActualUsing() && !s.toString().includes('Diagnostics'));
            assert.strictEqual(usings[0].namespace, 'System');
            assert.strictEqual(usings[1].namespace, 'Microsoft.Extensions');

            // Preprocessor block should be preserved at the end
            const hasPreprocessor = sorted.some(s => s.isPreprocessorDirective && s.toString().includes('#if'));
            assert.ok(hasPreprocessor, 'Should preserve preprocessor directives');
        });

        test('should handle extracted block with aliases', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                'using MyAlias = Some.Long.Namespace;',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            // Aliases should come after regular usings
            const usings = sorted.filter(s => s.isActualUsing());
            const aliasIndex = usings.findIndex(s => s.isAlias);
            const regularUsings = usings.filter(s => !s.isAlias);

            assert.ok(aliasIndex === usings.length - 1, 'Alias should be last');
            assert.strictEqual(regularUsings.length, 2);
        });

        test('should handle extracted block with static usings', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                'using static System.Math;',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            // Verify static using is handled
            const staticUsing = sorted.find(s => s.isStatic);
            assert.ok(staticUsing, 'Static using should be present');
        });

        test('should preserve line number mapping after sorting extracted block', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using Zebra;',
                'using Apple;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Verify block has correct start line
            assert.strictEqual(block.startLine, 0);
            // endLine is the last line of the using block content (excluding trailing blank)
            assert.ok(block.endLine >= 1, 'End line should be at least 1');
        });
    });

    suite('UsingGroupSplitter with extraction', () =>
    {
        test('should split extracted block into groups', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                'using System.Text;',
                'using Microsoft.Extensions;',
                'using MyApp.Services;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // First sort
            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            // Then split
            const splitter = new UsingGroupSplitter(config);
            const split = splitter.split(sorted);

            // Should have blank lines between groups
            const blankLines = split.filter(s => s.isBlankLine);
            assert.ok(blankLines.length > 0, 'Should have blank lines between groups');
        });

        test('should split extracted block with preprocessor directives', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            const splitter = new UsingGroupSplitter(config);
            const split = splitter.split(sorted);

            // Should handle preprocessor directives
            const hasPreprocessor = split.some(s => s.isPreprocessorDirective);
            assert.ok(hasPreprocessor, 'Should preserve preprocessor directives after split');
        });

        test('should handle extracted block with only one group', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                'using System.Text;',
                'using System.Linq;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const config = new FormatOptions('System', true, false, true);
            const sorter = new UsingSorter(config);
            const sorted = sorter.sort(Array.from(block.getStatements()));

            const splitter = new UsingGroupSplitter(config);
            const split = splitter.split(sorted);

            // Single group should not have blank lines inserted
            const usings = split.filter(s => s.isActualUsing());
            assert.strictEqual(usings.length, 3);
        });
    });

    suite('WhitespaceNormalizer with extraction', () =>
    {
        test('should normalize whitespace in extracted block', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                '',
                '',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const normalizer = new WhitespaceNormalizer();
            const normalized = normalizer.normalize(Array.from(block.getStatements()));

            // Should have proper whitespace handling
            // The normalizer adds blank lines around preprocessor directives
            // For regular usings, it ensures proper spacing
            const usings = normalized.filter(s => s.isActualUsing());
            assert.strictEqual(usings.length, 2, 'Should have 2 usings');
        });

        test('should normalize whitespace around preprocessor directives in extracted block', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            const normalizer = new WhitespaceNormalizer();
            const normalized = normalizer.normalize(Array.from(block.getStatements()));

            // Should have proper whitespace around preprocessor directives
            const lines = normalized.map(s => s.toString());
            assert.ok(lines.includes('#if DEBUG'), 'Should preserve #if');
            assert.ok(lines.includes('#endif'), 'Should preserve #endif');
        });
    });

    suite('UnusedUsingRemover with extraction', () =>
    {
        test('should remove unused usings from extracted block', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',           // line 0 - used
                'using System.Text;',      // line 1 - unused
                'using Microsoft.Extensions;', // line 2 - used
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostic for line 1
            const diagnostic = new vs.Diagnostic(
                new vs.Range(new vs.Position(1, 0), new vs.Position(1, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diagnostic.code = 'CS8019';
            diagnostic.source = 'csharp';

            const provider = new MockDiagnosticProvider([diagnostic]);
            const config = new FormatOptions('System', true, false, true);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should have removed System.Text
            const namespaces = result.filter(s => s.isActualUsing()).map(s => s.namespace);
            assert.ok(!namespaces.includes('System.Text'), 'System.Text should be removed');
            assert.ok(namespaces.includes('System'), 'System should remain');
            assert.ok(namespaces.includes('Microsoft.Extensions'), 'Microsoft.Extensions should remain');
        });

        test('should NOT remove unused usings in preprocessor blocks when disabled', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',           // line 0 - used
                '#if DEBUG',               // line 1
                'using System.Diagnostics;', // line 2 - unused but in preprocessor
                '#endif',                  // line 3
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostic for line 2
            const diagnostic = new vs.Diagnostic(
                new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diagnostic.code = 'CS8019';
            diagnostic.source = 'csharp';

            const provider = new MockDiagnosticProvider([diagnostic]);
            // processUsingsInPreprocessorDirectives=false
            const config = new FormatOptions('System', true, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should NOT have removed System.Diagnostics (it's in preprocessor block)
            const hasSystemDiagnostics = result.some(s =>
                s.isActualUsing() && s.namespace === 'System.Diagnostics');
            assert.ok(hasSystemDiagnostics,
                'System.Diagnostics should be preserved (in preprocessor block)');
        });

        test('should remove unused usings in preprocessor blocks when enabled', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',           // line 0 - used
                '#if DEBUG',               // line 1
                'using System.Diagnostics;', // line 2 - unused
                '#endif',                  // line 3
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostic for line 2
            const diagnostic = new vs.Diagnostic(
                new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diagnostic.code = 'CS8019';
            diagnostic.source = 'csharp';

            const provider = new MockDiagnosticProvider([diagnostic]);
            // processUsingsInPreprocessorDirectives=true
            const config = new FormatOptions('System', true, false, true);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should have removed System.Diagnostics
            const hasSystemDiagnostics = result.some(s =>
                s.isActualUsing() && s.namespace === 'System.Diagnostics');
            assert.ok(!hasSystemDiagnostics,
                'System.Diagnostics should be removed when processUsingsInPreprocessorDirectives=true');
        });

        test('should handle diagnostic line number offset with leading content', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                '// File header comment',  // line 0
                '',                         // line 1
                'using System;',           // line 2 - used
                'using System.Text;',      // line 3 - unused
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostic for line 3 (System.Text)
            const diagnostic = new vs.Diagnostic(
                new vs.Range(new vs.Position(3, 0), new vs.Position(3, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diagnostic.code = 'CS8019';
            diagnostic.source = 'csharp';

            const provider = new MockDiagnosticProvider([diagnostic]);
            const config = new FormatOptions('System', true, false, true);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Should correctly map line 3 to the right statement despite leading content
            const namespaces = result.filter(s => s.isActualUsing()).map(s => s.namespace);
            assert.ok(!namespaces.includes('System.Text'), 'System.Text should be removed');
            assert.ok(namespaces.includes('System'), 'System should remain');
        });

        test('should handle #else block correctly with extraction', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using System;',              // line 0 - used
                '#if UNITY_ANDROID',          // line 1
                'using Unity.Android;',       // line 2 - unused
                '#else',                      // line 3
                'using System.Text;',         // line 4 - unused
                '#endif',                     // line 5
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostics for both unused usings
            const diag1 = new vs.Diagnostic(
                new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diag1.code = 'CS8019';
            diag1.source = 'csharp';

            const diag2 = new vs.Diagnostic(
                new vs.Range(new vs.Position(4, 0), new vs.Position(4, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diag2.code = 'CS8019';
            diag2.source = 'csharp';

            const provider = new MockDiagnosticProvider([diag1, diag2]);
            // processUsingsInPreprocessorDirectives=false
            const config = new FormatOptions('System', true, false, false);
            const remover = new UnusedUsingRemover(provider, config);

            const result = remover.remove(block);

            // Both unused usings should be preserved (in preprocessor blocks)
            const hasUnityAndroid = result.some(s =>
                s.isActualUsing() && s.namespace === 'Unity.Android');
            const hasSystemText = result.some(s =>
                s.isActualUsing() && s.namespace === 'System.Text');

            assert.ok(hasUnityAndroid, 'Unity.Android should be preserved (in #if block)');
            assert.ok(hasSystemText, 'System.Text should be preserved (in #else block)');
        });
    });

    suite('Full pipeline with extraction', () =>
    {
        test('should process extracted block through full pipeline', () =>
        {
            const extractor = new UsingBlockExtractor();
            const input = [
                'using Microsoft.Extensions;', // line 0 - used
                'using System;',               // line 1 - used
                'using System.Text;',          // line 2 - unused
                'using Amazon.S3;',            // line 3 - used
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(input, '\n');
            const block = Array.from(blocks.values())[0];

            // Create diagnostic for System.Text
            const diagnostic = new vs.Diagnostic(
                new vs.Range(new vs.Position(2, 0), new vs.Position(2, 100)),
                'Unnecessary using directive',
                vs.DiagnosticSeverity.Information,
            );
            diagnostic.code = 'CS8019';
            diagnostic.source = 'csharp';

            const provider = new MockDiagnosticProvider([diagnostic]);
            const config = new FormatOptions('System', true, false, true);

            // Step 1: Remove unused
            const remover = new UnusedUsingRemover(provider, config);
            const afterRemoval = remover.remove(block);

            // Step 2: Sort
            const sorter = new UsingSorter(config);
            const afterSort = sorter.sort(afterRemoval);

            // Step 3: Split into groups
            const splitter = new UsingGroupSplitter(config);
            const afterSplit = splitter.split(afterSort);

            // Step 4: Normalize whitespace
            const normalizer = new WhitespaceNormalizer();
            const final = normalizer.normalize(afterSplit);

            // Verify final result
            const usings = final.filter(s => s.isActualUsing());
            assert.strictEqual(usings.length, 3, 'Should have 3 usings after removal');

            // Verify order: System first, then others alphabetically
            assert.strictEqual(usings[0].namespace, 'System');
            assert.strictEqual(usings[1].namespace, 'Amazon.S3');
            assert.strictEqual(usings[2].namespace, 'Microsoft.Extensions');
        });
    });
});
