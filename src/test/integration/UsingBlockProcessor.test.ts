import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

suite('UsingBlockProcessor Integration', () =>
{
    suite('Full pipeline: sort + group', () =>
    {
        test('should sort and group using statements', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                'using MyCompany.Core;',
                'using Foo = Serilog.Foo;',
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

        test('should handle comments with sort and group', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
            ];

            const leadingContent = [
                '// Copyright 2024',
                '// All rights reserved',
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

    suite('Full pipeline: sort + group + remove unused', () =>
    {
        test('should remove unused, then sort and group', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;', // line 0 - unused
                'using System;', // line 1 - used
                'using MyCompany.Core;', // line 2 - used
                'using System.Text;', // line 3 - used
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Microsoft was removed, System group comes first
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using System.Text;');
            assert.strictEqual(lines[2], '');

            // MyCompany group after System
            assert.strictEqual(lines[3], 'using MyCompany.Core;');
            assert.strictEqual(lines[4], '');
        });

        test('should handle preprocessor directives with unused removal', () =>
        {
            const rawContent = [
                'using System;', // line 0 - used
                '#if DEBUG', // line 1
                'using System.Diagnostics;', // line 2 - unused
                '#endif', // line 3
                'using Microsoft.AspNetCore.Mvc;', // line 4 - used
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System group first
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], '');

            // Microsoft group
            assert.strictEqual(lines[2], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[3], '');

            // Preprocessor block at end (unused using inside NOT removed by default)
            assert.strictEqual(lines[4], '#if DEBUG');
            assert.strictEqual(lines[5], '');
            assert.strictEqual(lines[6], 'using System.Diagnostics;');
            assert.strictEqual(lines[7], '');
            assert.strictEqual(lines[8], '#endif');
            assert.strictEqual(lines[9], '');
        });
    });

    suite('Idempotency', () =>
    {
        test('should produce same result when run multiple times', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                'using MyCompany.Core;',
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

    suite('Configuration options', () =>
    {
        test('should respect sortOrder=Alphabetical', () =>
        {
            const rawContent = [
                'using System;',
                'using Apple;',
                'using Zebra;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('Alphabetical', false, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Alphabetical ordering (not System-first)
            assert.strictEqual(lines[0], 'using Apple;');
            assert.strictEqual(lines[1], 'using System;');
            assert.strictEqual(lines[2], 'using Zebra;');
            assert.strictEqual(lines[3], '');
        });

        test('should respect splitGroups=false', () =>
        {
            const rawContent = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
                'using MyCompany.Core;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // No blank lines between groups (splitGroups=false)
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[2], 'using MyCompany.Core;');
            assert.strictEqual(lines[3], '');
        });

        test('should respect disableUnusedUsingsRemoval=true', () =>
        {
            const rawContent = [
                'using System;', // line 0 - unused
                'using Microsoft.AspNetCore.Mvc;', // line 1 - used
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', false, true, false); // disabled

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System should NOT be removed because removal is disabled
            assert.ok(lines.some(l => l.includes('System;')));
        });

        test('should respect processUsingsInPreprocessorDirectives=true', () =>
        {
            const rawContent = [
                '#if DEBUG',
                'using System.Diagnostics;', // line 1 - unused
                '#endif',
                'using System;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', false, false, true); // enabled

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Diagnostics should be removed from preprocessor block
            assert.ok(!lines.some(l => l.includes('System.Diagnostics')));
        });

        test('should NOT remove unused usings in #else blocks when processUsingsInPreprocessorDirectives=false', () =>
        {
            const rawContent = [
                'using System.Collections;',
                'using System.Runtime.CompilerServices;',
                '#if UNITY_ANDROID',
                'using Microsoft.CodeAnalysis.CSharp;',
                '#else',
                'using System.Configuration.Assemblies;', // line 5 - unused, but in preprocessor block
                '#endif',
            ];

            const block = new UsingBlock(0, 6, rawContent);
            const config = new FormatOptions('System', false, false, false); // processUsingsInPreprocessorDirectives=false

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(5, 0), new vs.Position(5, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System.Configuration.Assemblies should NOT be removed (it's in a preprocessor block)
            assert.ok(lines.some(l => l.includes('System.Configuration.Assemblies')),
                'Using in #else block should be preserved when processUsingsInPreprocessorDirectives=false');
        });

        test('should NOT remove unused usings in #elif blocks when processUsingsInPreprocessorDirectives=false', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused
                '#elif RELEASE',
                'using System.Runtime.InteropServices;', // line 4 - unused
                '#else',
                'using System.Text;', // line 6 - unused
                '#endif',
            ];

            const block = new UsingBlock(0, 7, rawContent);
            const config = new FormatOptions('System', false, false, false); // processUsingsInPreprocessorDirectives=false

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1)),
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1)),
                } as vs.Diagnostic,
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // All usings in preprocessor blocks should be preserved
            assert.ok(lines.some(l => l.includes('System.Diagnostics')),
                'Using in #if block should be preserved');
            assert.ok(lines.some(l => l.includes('System.Runtime.InteropServices')),
                'Using in #elif block should be preserved');
            assert.ok(lines.some(l => l.includes('System.Text')),
                'Using in #else block should be preserved');
        });
    });

    suite('Edge cases', () =>
    {
        test('should handle empty block', () =>
        {
            const block = new UsingBlock(0, 0, []);
            const config = new FormatOptions('System', true, true, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should produce no output
            assert.strictEqual(lines.length, 0);
        });

        test('should handle block with only comments', () =>
        {
            const rawContent = [
                '// Comment 1',
                '// Comment 2',
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

        test('should handle single using statement', () =>
        {
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

        test('should handle all usings removed', () =>
        {
            const rawContent = [
                'using System;', // line 0 - unused
                'using Microsoft.AspNetCore.Mvc;', // line 1 - unused
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', true, false, false);

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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Should produce empty output
            assert.strictEqual(lines.length, 0);
        });
    });

    suite('Complex real-world scenarios', () =>
    {
        test('should handle large block with all features', () =>
        {
            const rawContent = [
                'using Zebra.Something;',
                'using System;',
                'using System.Text;',
                'using Microsoft.AspNetCore.Mvc;',
                'using Microsoft.Extensions;',
                'using MyCompany.Core.Services;', // unused
                'using MyCompany.Data;',
                'using ILogger = Serilog.ILogger;',
                'using Foo = Serilog.Foo;',
            ];

            const leadingContent = [
                '// This file is part of MyApp',
                '// Copyright 2024',
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
                    range: new vs.Range(new vs.Position(9, 0), new vs.Position(9, 1)), // MyCompany.Core.Services
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Leading comments preserved
            assert.strictEqual(lines[0], '// This file is part of MyApp');
            assert.strictEqual(lines[1], '// Copyright 2024');
            assert.strictEqual(lines[2], '');

            // System group first (System-first ordering with splitGroups)
            assert.strictEqual(lines[3], 'using System;');
            assert.strictEqual(lines[4], 'using System.Text;');
            assert.strictEqual(lines[5], '');

            // Microsoft group
            assert.strictEqual(lines[6], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[7], 'using Microsoft.Extensions;');
            assert.strictEqual(lines[8], '');

            // MyCompany group (unused MyCompany.Core.Services was removed)
            assert.strictEqual(lines[9], 'using MyCompany.Data;');
            assert.strictEqual(lines[10], '');

            // Zebra group
            assert.strictEqual(lines[11], 'using Zebra.Something;');
            assert.strictEqual(lines[12], '');

            // Aliases at the end (alphabetical: Foo before ILogger)
            assert.strictEqual(lines[13], 'using Foo = Serilog.Foo;');
            assert.strictEqual(lines[14], 'using ILogger = Serilog.ILogger;');
            assert.strictEqual(lines[15], '');
        });
    });
});
