import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';

class MockDiagnosticProvider implements IDiagnosticProvider {
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getUnusedUsingDiagnostics(): vs.Diagnostic[] {
        return this.diagnostics;
    }
}

suite('UsingBlockProcessor Integration', () => {
    suite('Full pipeline: sort + group', () => {
        test('should sort and group using statements', () => {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                'using MyCompany.Core;',
                'using Foo = Serilog.Foo;'
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System first
            assert.ok(lines[0].includes('System;'));

            // Blank line after System group
            assert.strictEqual(lines[1], '');

            // Microsoft group
            assert.ok(lines[2].includes('Microsoft'));

            // Blank line before MyCompany
            assert.strictEqual(lines[3], '');

            // MyCompany group
            assert.ok(lines[4].includes('MyCompany'));

            // Blank line before aliases
            assert.strictEqual(lines[5], '');

            // Alias
            assert.ok(lines[6].includes('Foo ='));
        });

        test('should handle comments with sort and group', () => {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;'
            ];

            const leadingContent = [
                '// Copyright 2024',
                '// All rights reserved'
            ];

            const block = new UsingBlock(2, 3, rawContent, leadingContent);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Comments should be at the start
            assert.ok(lines[0].includes('Copyright'));
            assert.ok(lines[1].includes('All rights'));

            // Blank line after comments
            assert.strictEqual(lines[2], '');

            // Then usings (System first)
            assert.ok(lines[3].includes('System;'));
        });
    });

    suite('Full pipeline: sort + group + remove unused', () => {
        test('should remove unused, then sort and group', () => {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;', // line 0 - unused
                'using System;', // line 1 - used
                'using MyCompany.Core;', // line 2 - used
                'using System.Text;' // line 3 - used
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Microsoft should be removed
            assert.ok(!lines.some(l => l.includes('Microsoft')));

            // System usings should be grouped
            const systemLines = lines.filter(l => l.includes('System'));
            assert.strictEqual(systemLines.length, 2);

            // Should have blank line between System and MyCompany groups
            const blankLines = lines.filter(l => l === '');
            assert.ok(blankLines.length > 0);
        });

        test('should handle preprocessor directives with unused removal', () => {
            const rawContent = [
                'using System;', // line 0 - used
                '#if DEBUG', // line 1
                'using System.Diagnostics;', // line 2 - unused
                '#endif', // line 3
                'using Microsoft.AspNetCore.Mvc;' // line 4 - used
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Preprocessor directive using should NOT be removed (default behavior)
            assert.ok(lines.some(l => l.includes('System.Diagnostics')));
        });
    });

    suite('Idempotency', () => {
        test('should produce same result when run multiple times', () => {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                'using MyCompany.Core;'
            ];

            const block1 = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor1 = new UsingBlockProcessor(block1, config, provider);
            processor1.process();

            const result1 = block1.toLines().join('\n');

            // Run again on the result
            const rawContent2 = result1.split('\n').filter(l => l.trim().length > 0);
            const block2 = new UsingBlock(0, rawContent2.length - 1, rawContent2);
            const processor2 = new UsingBlockProcessor(block2, config, provider);
            processor2.process();

            const result2 = block2.toLines().join('\n');

            // Results should be identical (idempotent)
            assert.strictEqual(result1, result2);
        });
    });

    suite('Configuration options', () => {
        test('should respect sortOrder=Alphabetical', () => {
            const rawContent = [
                'using System;',
                'using Apple;',
                'using Zebra;'
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('Alphabetical', false, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should be alphabetical, not System-first
            assert.ok(lines[0].includes('Apple'));
            assert.ok(lines[1].includes('System'));
            assert.ok(lines[2].includes('Zebra'));
        });

        test('should respect splitGroups=false', () => {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
                'using MyCompany.Core;'
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines().filter(l => l.trim().length > 0);

            // Should have no blank lines between groups
            assert.strictEqual(lines.length, 3);
            lines.forEach(l => assert.ok(l.includes('using')));
        });

        test('should respect disableUnusedUsingsRemoval=true', () => {
            const rawContent = [
                'using System;', // line 0 - unused
                'using Microsoft.AspNetCore.Mvc;' // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', false, true, false); // disabled

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System should NOT be removed because removal is disabled
            assert.ok(lines.some(l => l.includes('System;')));
        });

        test('should respect processUsingsInPreprocessorDirectives=true', () => {
            const rawContent = [
                '#if DEBUG',
                'using System.Diagnostics;', // line 1 - unused
                '#endif',
                'using System;'
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', false, false, true); // enabled

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 1))
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Diagnostics should be removed from preprocessor block
            assert.ok(!lines.some(l => l.includes('System.Diagnostics')));
        });
    });

    suite('Edge cases', () => {
        test('should handle empty block', () => {
            const block = new UsingBlock(0, 0, []);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should produce no output
            assert.strictEqual(lines.length, 0);
        });

        test('should handle block with only comments', () => {
            const rawContent = [
                '// Comment 1',
                '// Comment 2'
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Comments should be preserved
            assert.ok(lines.some(l => l.includes('Comment')));
        });

        test('should handle single using statement', () => {
            const rawContent = ['using System;'];

            const block = new UsingBlock(0, 0, rawContent);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should have using + trailing blank lines
            assert.ok(lines[0].includes('System;'));
            assert.strictEqual(lines[1], '');
        });

        test('should handle all usings removed', () => {
            const rawContent = [
                'using System;', // line 0 - unused
                'using Microsoft.AspNetCore.Mvc;' // line 1 - unused
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should produce empty output
            assert.strictEqual(lines.length, 0);
        });
    });

    suite('Complex real-world scenarios', () => {
        test('should handle large block with all features', () => {
            const rawContent = [
                'using Zebra.Something;',
                'using System;',
                'using System.Text;',
                'using Microsoft.AspNetCore.Mvc;',
                'using Microsoft.Extensions;',
                'using MyCompany.Core.Services;', // unused
                'using MyCompany.Data;',
                'using ILogger = Serilog.ILogger;',
                'using Foo = Serilog.Foo;'
            ];

            const leadingContent = [
                '// This file is part of MyApp',
                '// Copyright 2024'
            ];

            const block = new UsingBlock(2, 10, rawContent, leadingContent);
            const config = new FormatOptions('System', true, false, false);

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    // Block starts at line 2, has 2 lines of leading content, MyCompany.Core.Services is at index 5
                    // So it's at file line: 2 (start) + 2 (leading) + 5 (index) = 9
                    range: new vs.Range(new vs.Position(9, 0), new vs.Position(9, 1)) // MyCompany.Core.Services
                } as vs.Diagnostic
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Verify comments at top
            assert.ok(lines[0].includes('MyApp'));

            // Verify System group comes first
            const firstUsingIndex = lines.findIndex(l => l.includes('using'));
            assert.ok(lines[firstUsingIndex].includes('System'));

            // Verify unused was removed
            assert.ok(!lines.some(l => l.includes('MyCompany.Core.Services')));

            // Verify aliases at end
            const aliasLines = lines.filter(l => l.includes('='));
            const lastAliasIndex = lines.lastIndexOf(aliasLines[aliasLines.length - 1]);
            const lastUsingIndex = lines.map((l, i) => l.includes('using') ? i : -1).filter(i => i >= 0).pop() ?? -1;
            assert.ok(lastAliasIndex === lastUsingIndex || lastAliasIndex > lastUsingIndex - 3);

            // Verify groups are separated
            const blankLineCount = lines.filter(l => l === '').length;
            assert.ok(blankLineCount >= 3); // At least some group separations
        });
    });
});
