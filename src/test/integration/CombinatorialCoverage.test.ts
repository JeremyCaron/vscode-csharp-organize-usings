import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

suite('Combinatorial Coverage - All Configuration Options', () =>
{
    suite('usingStaticPlacement with sortOrder', () =>
    {
        test('intermixed mode with Alphabetical sortOrder', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Apple.Helpers;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', false, false, false, 'intermixed');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Should be alphabetical, static intermixed
            assert.ok(usings[0].includes('Apple') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('static Apple'));
            assert.ok(usings[2].includes('System') && !usings[2].includes('static'));
            assert.ok(usings[3].includes('static System'));
            assert.ok(usings[4].includes('Zebra'));
        });

        test('bottom mode with Alphabetical sortOrder', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Apple.Helpers;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', false, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Regular usings alphabetically first
            assert.ok(usings[0].includes('Apple') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('System') && !usings[1].includes('static'));
            assert.ok(usings[2].includes('Zebra'));

            // Static usings alphabetically at bottom
            assert.ok(usings[3].includes('static Apple'));
            assert.ok(usings[4].includes('static System'));
        });

        test('groupedWithNamespace mode with Alphabetical sortOrder', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Apple.Helpers;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', false, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Apple namespace: regular then static
            assert.ok(usings[0].includes('Apple') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('static Apple'));

            // System namespace: regular then static
            assert.ok(usings[2].includes('System') && !usings[2].includes('static'));
            assert.ok(usings[3].includes('static System'));

            // Zebra namespace
            assert.ok(usings[4].includes('Zebra'));
        });

        test('intermixed mode with System sortOrder and splitGroups', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore;',
                'using System;',
                'using static System.Math;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, false, false, 'intermixed');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System group (regular and static intermixed)
            assert.ok(lines[0].includes('System') && !lines[0].includes('static'));
            assert.ok(lines[1].includes('static System'));

            // Blank line separator
            assert.strictEqual(lines[2].trim(), '');

            // Microsoft group (regular and static intermixed)
            assert.ok(lines[3].includes('Microsoft') && !lines[3].includes('static'));
            assert.ok(lines[4].includes('static Microsoft'));
        });

        test('groupedWithNamespace mode with Alphabetical sortOrder and splitGroups', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Apple.Helpers;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', true, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Apple namespace group
            assert.ok(lines[0].includes('Apple') && !lines[0].includes('static'));
            assert.ok(lines[1].includes('static Apple'));

            // Blank line
            assert.strictEqual(lines[2].trim(), '');

            // System namespace group
            assert.ok(lines[3].includes('System') && !lines[3].includes('static'));
            assert.ok(lines[4].includes('static System'));

            // Blank line
            assert.strictEqual(lines[5].trim(), '');

            // Zebra namespace group
            assert.ok(lines[6].includes('Zebra'));
        });
    });

    suite('usingStaticPlacement with disableUnusedUsingsRemoval', () =>
    {
        test('intermixed mode with unused removal disabled - keeps unused static usings', () =>
        {
            const rawContent = [
                'using System;', // line 0 - used
                'using static System.Math;', // line 1 - unused
                'using Microsoft.AspNetCore;', // line 2 - unused
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, true, false, 'intermixed'); // disabled removal

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(1, 0), new vs.Position(1, 1)),
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

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // All usings should be kept (removal disabled)
            assert.strictEqual(usings.length, 3);
            assert.ok(usings.some(u => u.includes('static System.Math')));
            assert.ok(usings.some(u => u.includes('Microsoft.AspNetCore')));
        });

        test('bottom mode with unused removal disabled - keeps unused static usings', () =>
        {
            const rawContent = [
                'using System;', // line 0 - used
                'using static System.Math;', // line 1 - unused
                'using Microsoft.AspNetCore;', // line 2 - used
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, true, false, 'bottom'); // disabled removal

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
            const usings = lines.filter(l => l.trim().length > 0);

            // All usings should be kept
            assert.strictEqual(usings.length, 3);

            // Regular usings first
            assert.ok(usings[0].includes('System') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('Microsoft'));

            // Static at bottom (even though unused)
            assert.ok(usings[2].includes('static System.Math'));
        });

        test('groupedWithNamespace mode with unused removal disabled - keeps unused static usings', () =>
        {
            const rawContent = [
                'using System;', // line 0 - used
                'using static System.Math;', // line 1 - unused
                'using Microsoft.AspNetCore;', // line 2 - used
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, true, false, 'groupedWithNamespace'); // disabled removal

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
            const usings = lines.filter(l => l.trim().length > 0);

            // All usings should be kept
            assert.strictEqual(usings.length, 3);

            // System namespace: regular then static
            assert.ok(usings[0].includes('System') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('static System.Math'));

            // Microsoft namespace
            assert.ok(usings[2].includes('Microsoft'));
        });

        test('intermixed mode with unused removal enabled - removes unused static usings', () =>
        {
            const rawContent = [
                'using System;', // line 0 - used
                'using static System.Math;', // line 1 - unused
                'using Microsoft.AspNetCore;', // line 2 - used
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, false, false, 'intermixed'); // enabled removal

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
            const usings = lines.filter(l => l.trim().length > 0);

            // Static using should be removed
            assert.strictEqual(usings.length, 2);
            assert.ok(!usings.some(u => u.includes('static System.Math')));
        });
    });

    suite('usingStaticPlacement with processUsingsInPreprocessorDirectives', () =>
    {
        test('intermixed mode with preprocessor processing enabled - removes static usings in directives', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using static System.Math;', // line 2 - unused
                '#endif',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', false, false, true, 'intermixed'); // enabled preprocessor

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

            // Static using should be removed from preprocessor block
            assert.ok(!lines.some(l => l.includes('static System.Math')));
        });

        test('bottom mode with preprocessor processing disabled - keeps static usings in directives', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using static System.Math;', // line 2 - unused but in preprocessor
                '#endif',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', false, false, false, 'bottom'); // disabled preprocessor

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

            // Static using should be kept in preprocessor block
            assert.ok(lines.some(l => l.includes('static System.Math')));
        });

        test('groupedWithNamespace mode with preprocessor processing enabled - removes static usings in directives', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using static System.Math;', // line 2 - unused
                '#endif',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', false, false, true, 'groupedWithNamespace'); // enabled preprocessor

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

            // Static using should be removed from preprocessor block
            assert.ok(!lines.some(l => l.includes('static System.Math')));
        });

        test('intermixed mode with preprocessor processing disabled and #elif blocks', () =>
        {
            const rawContent = [
                'using System;',
                '#if DEBUG',
                'using static System.Diagnostics.Debug;', // line 2 - unused
                '#elif RELEASE',
                'using static System.Console;', // line 4 - unused
                '#endif',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 6, rawContent);
            const config = new FormatOptions('System', false, false, false, 'intermixed'); // disabled preprocessor

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
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Both static usings should be kept in preprocessor blocks
            assert.ok(lines.some(l => l.includes('static System.Diagnostics.Debug')));
            assert.ok(lines.some(l => l.includes('static System.Console')));
        });
    });

    suite('Complex multi-option combinations', () =>
    {
        test('Alphabetical + splitGroups + intermixed mode', () =>
        {
            const rawContent = [
                'using Zebra.Something;',
                'using System;',
                'using static System.Math;',
                'using Apple.Core;',
                'using static Apple.Helpers;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 5, rawContent);
            const config = new FormatOptions('Alphabetical', true, false, false, 'intermixed');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Apple group
            assert.ok(lines[0].includes('Apple.Core'));
            assert.ok(lines[1].includes('static Apple'));
            assert.strictEqual(lines[2].trim(), ''); // blank line

            // Microsoft group
            assert.ok(lines[3].includes('Microsoft'));
            assert.strictEqual(lines[4].trim(), ''); // blank line

            // System group
            assert.ok(lines[5].includes('System') && !lines[5].includes('static'));
            assert.ok(lines[6].includes('static System'));
            assert.strictEqual(lines[7].trim(), ''); // blank line

            // Zebra group
            assert.ok(lines[8].includes('Zebra'));
        });

        test('System + splitGroups + bottom mode + unused removal', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore;',
                'using System;',
                'using static System.Math;', // line 2 - unused
                'using System.Text;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', true, false, false, 'bottom');

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

            // Debug: log the actual output
            // console.log('Actual lines:', lines);

            // System regular usings first
            assert.ok(lines[0].includes('System;'), `Line 0 should have System;, got: ${lines[0]}`);
            assert.ok(lines[1].includes('System.Text'), `Line 1 should have System.Text, got: ${lines[1]}`);

            // Blank line after System group
            assert.strictEqual(lines[2].trim(), '', `Line 2 should be blank, got: ${lines[2]}`);

            // Microsoft regular usings
            assert.ok(lines[3].includes('Microsoft') && !lines[3].includes('static'),
                `Line 3 should have Microsoft (non-static), got: ${lines[3]}`);

            // When splitGroups is true with bottom mode, static usings form their own separate section
            // There should be a blank line before the static section
            const staticLines = lines.filter(l => l.includes('using static'));
            assert.strictEqual(staticLines.length, 1, 'Should have exactly one static using');
            assert.ok(staticLines[0].includes('Microsoft'), 'Static using should be Microsoft');

            // Unused static should be removed
            assert.ok(!lines.some(l => l.includes('static System.Math')),
                'Should not contain removed static System.Math');
        });

        test('Alphabetical + splitGroups + groupedWithNamespace mode + aliases', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using ILogger = Serilog.ILogger;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', true, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Apple group
            assert.ok(usings[0].includes('Apple'));

            // System group (regular then static)
            assert.ok(usings[1].includes('System') && !usings[1].includes('static'));
            assert.ok(usings[2].includes('static System'));

            // Zebra group
            assert.ok(usings[3].includes('Zebra'));

            // Alias at the end
            const lastUsing = usings[usings.length - 1];
            assert.ok(lastUsing.includes('ILogger ='));
        });

        test('System + no splitGroups + bottom mode + all options enabled', () =>
        {
            const rawContent = [
                'using Microsoft.AspNetCore;',
                'using System;',
                'using static System.Math;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 4 - unused
                '#endif',
                'using static Microsoft.AspNetCore.Http.StatusCodes;', // line 6 - unused
            ];

            const block = new UsingBlock(0, 6, rawContent);
            const config = new FormatOptions('System', false, false, true, 'bottom'); // processUsingsInPreprocessorDirectives=true

            const diagnostics = [
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
            const usings = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));

            // No split groups, so all on consecutive lines
            // Regular usings (System first)
            assert.ok(usings[0].includes('System;'));
            assert.ok(usings[1].includes('Microsoft'));

            // Unused usings should be removed (including in preprocessor)
            assert.ok(!lines.some(l => l.includes('System.Diagnostics')));
            assert.ok(!lines.some(l => l.includes('static Microsoft')));
        });

        test('Alphabetical + no splitGroups + intermixed mode + disableUnusedUsingsRemoval', () =>
        {
            const rawContent = [
                'using Zebra;', // line 0 - unused
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Apple.Helpers;', // line 4 - unused
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('Alphabetical', false, true, false, 'intermixed'); // disabled removal

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
                    range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1)),
                } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // All usings should be kept (removal disabled)
            assert.strictEqual(usings.length, 5);

            // Alphabetical order with static intermixed
            assert.ok(usings[0].includes('Apple') && !usings[0].includes('static'));
            assert.ok(usings[1].includes('static Apple'));
            assert.ok(usings[2].includes('System') && !usings[2].includes('static'));
            assert.ok(usings[3].includes('static System'));
            assert.ok(usings[4].includes('Zebra'));
        });
    });

    suite('Large-scale real-world scenarios', () =>
    {
        test('Large block with Alphabetical + splitGroups + bottom mode', () =>
        {
            const rawContent = [
                'using System;',
                'using System.Collections.Generic;',
                'using System.Linq;',
                'using System.Text;',
                'using static System.Math;',
                'using static System.Console;',
                'using Microsoft.AspNetCore.Mvc;',
                'using Microsoft.Extensions.Logging;',
                'using Microsoft.EntityFrameworkCore;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
                'using Newtonsoft.Json;',
                'using Newtonsoft.Json.Linq;',
                'using Serilog;',
                'using Serilog.Events;',
                'using MyCompany.Core.Services;',
                'using MyCompany.Core.Models;',
                'using MyCompany.Data.Repositories;',
                'using static MyCompany.Core.Constants;',
                'using ThirdParty.Library;',
                'using ThirdParty.Library.Extensions;',
                'using ILogger = Serilog.ILogger;',
                'using JsonSerializer = Newtonsoft.Json.JsonSerializer;',
            ];

            const block = new UsingBlock(0, 21, rawContent);
            const config = new FormatOptions('Alphabetical', true, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Alphabetical ordering: M, M, N, S, S, T
            // Microsoft namespace
            assert.strictEqual(lines[0], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[1], 'using Microsoft.EntityFrameworkCore;');
            assert.strictEqual(lines[2], 'using Microsoft.Extensions.Logging;');
            // No trailing blank - added in replace step (was lines[3])

            // MyCompany namespace
            assert.strictEqual(lines[4], 'using MyCompany.Core.Models;');
            assert.strictEqual(lines[5], 'using MyCompany.Core.Services;');
            assert.strictEqual(lines[6], 'using MyCompany.Data.Repositories;');
            // No trailing blank - added in replace step (was lines[7])

            // Newtonsoft namespace
            assert.strictEqual(lines[8], 'using Newtonsoft.Json;');
            assert.strictEqual(lines[9], 'using Newtonsoft.Json.Linq;');
            // No trailing blank - added in replace step (was lines[10])

            // Serilog namespace
            assert.strictEqual(lines[11], 'using Serilog;');
            assert.strictEqual(lines[12], 'using Serilog.Events;');
            // No trailing blank - added in replace step (was lines[13])

            // System namespace
            assert.strictEqual(lines[14], 'using System;');
            assert.strictEqual(lines[15], 'using System.Collections.Generic;');
            assert.strictEqual(lines[16], 'using System.Linq;');
            assert.strictEqual(lines[17], 'using System.Text;');
            // No trailing blank - added in replace step (was lines[18])

            // ThirdParty namespace
            assert.strictEqual(lines[19], 'using ThirdParty.Library;');
            assert.strictEqual(lines[20], 'using ThirdParty.Library.Extensions;');
            // No trailing blank - added in replace step (was lines[21])

            // Static usings at bottom (alphabetical)
            assert.strictEqual(lines[22], 'using static Microsoft.AspNetCore.Http.StatusCodes;');
            // No trailing blank - added in replace step (was lines[23])
            assert.strictEqual(lines[24], 'using static MyCompany.Core.Constants;');
            // No trailing blank - added in replace step (was lines[25])
            assert.strictEqual(lines[26], 'using static System.Console;');
            assert.strictEqual(lines[27], 'using static System.Math;');
            // No trailing blank - added in replace step (was lines[28])

            // Aliases at the very end (alphabetical)
            assert.strictEqual(lines[29], 'using JsonSerializer = Newtonsoft.Json.JsonSerializer;');
            assert.strictEqual(lines[30], 'using ILogger = Serilog.ILogger;');
            // No trailing blank - added in replace step (was lines[31])
        });

        test('Large block with System + splitGroups + groupedWithNamespace mode + unused removal', () =>
        {
            const rawContent = [
                'using System;',
                'using System.Collections.Generic;',
                'using System.Linq;', // line 2 - unused
                'using System.Text;',
                'using static System.Math;',
                'using static System.Console;', // line 5 - unused
                'using Microsoft.AspNetCore.Mvc;',
                'using Microsoft.Extensions.Logging;',
                'using Microsoft.EntityFrameworkCore;', // line 8 - unused
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
                'using Newtonsoft.Json;',
                'using Newtonsoft.Json.Linq;', // line 11 - unused
                'using Serilog;',
                'using Serilog.Events;',
                'using MyCompany.Core.Services;',
                'using MyCompany.Core.Models;',
                'using MyCompany.Data.Repositories;',
                'using static MyCompany.Core.Constants;',
                'using ThirdParty.Library;', // line 18 - unused
                'using ThirdParty.Library.Extensions;',
                'using ILogger = Serilog.ILogger;',
                'using JsonSerializer = Newtonsoft.Json.JsonSerializer;',
            ];

            const block = new UsingBlock(0, 21, rawContent);
            const config = new FormatOptions('System', true, false, false, 'groupedWithNamespace');

            const diagnostics = [
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(5, 0), new vs.Position(5, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(8, 0), new vs.Position(8, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(11, 0), new vs.Position(11, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(18, 0), new vs.Position(18, 1)) } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System-first ordering with groupedWithNamespace mode (static usings grouped with their namespace)
            // System namespace (regular + static)
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using System.Collections.Generic;');
            assert.strictEqual(lines[2], 'using System.Text;');
            assert.strictEqual(lines[3], 'using static System.Math;');
            // No trailing blank - added in replace step (was lines[4])

            // Microsoft namespace (regular + static)
            assert.strictEqual(lines[5], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[6], 'using Microsoft.Extensions.Logging;');
            assert.strictEqual(lines[7], 'using static Microsoft.AspNetCore.Http.StatusCodes;');
            // No trailing blank - added in replace step (was lines[8])

            // MyCompany namespace (regular + static)
            assert.strictEqual(lines[9], 'using MyCompany.Core.Models;');
            assert.strictEqual(lines[10], 'using MyCompany.Core.Services;');
            assert.strictEqual(lines[11], 'using MyCompany.Data.Repositories;');
            assert.strictEqual(lines[12], 'using static MyCompany.Core.Constants;');
            // No trailing blank - added in replace step (was lines[13])

            // Newtonsoft namespace
            assert.strictEqual(lines[14], 'using Newtonsoft.Json;');
            // No trailing blank - added in replace step (was lines[15])

            // Serilog namespace
            assert.strictEqual(lines[16], 'using Serilog;');
            assert.strictEqual(lines[17], 'using Serilog.Events;');
            // No trailing blank - added in replace step (was lines[18])

            // ThirdParty namespace
            assert.strictEqual(lines[19], 'using ThirdParty.Library.Extensions;');
            // No trailing blank - added in replace step (was lines[20])

            // Aliases at the end (alphabetical)
            assert.strictEqual(lines[21], 'using JsonSerializer = Newtonsoft.Json.JsonSerializer;');
            assert.strictEqual(lines[22], 'using ILogger = Serilog.ILogger;');
            // No trailing blank - added in replace step (was lines[23])
        });

        test('Large block with Alphabetical + no splitGroups + intermixed mode + preprocessor', () =>
        {
            const rawContent = [
                'using System;',
                'using System.Collections.Generic;',
                'using static System.Math;',
                'using System.Text;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 5 - unused in DEBUG
                'using static System.Diagnostics.Debug;', // line 6 - unused in DEBUG
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
                'using Microsoft.Extensions.Logging;',
                'using Newtonsoft.Json;',
                'using static Newtonsoft.Json.JsonConvert;',
                '#if NETCOREAPP3_1',
                'using System.Text.Json;', // line 14 - unused
                '#elif NET5_0_OR_GREATER',
                'using System.Text.Json.Serialization;', // line 16 - unused
                '#endif',
                'using Serilog;',
                'using MyCompany.Core.Services;',
                'using static MyCompany.Core.Constants;',
                'using MyCompany.Data.Repositories;',
                'using ThirdParty.Library;',
                'using ILogger = Serilog.ILogger;',
            ];

            const block = new UsingBlock(0, 23, rawContent);
            const config = new FormatOptions('Alphabetical', false, false, true, 'intermixed'); // processUsingsInPreprocessorDirectives=true

            const diagnostics = [
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(5, 0), new vs.Position(5, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(14, 0), new vs.Position(14, 1)) } as vs.Diagnostic,
                { code: 'CS8019', source: 'csharp', message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning, range: new vs.Range(new vs.Position(16, 0), new vs.Position(16, 1)) } as vs.Diagnostic,
            ];

            const provider = new MockDiagnosticProvider(diagnostics);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Alphabetical ordering with no splitGroups (no blank lines), intermixed mode (static mixed with regular)
            // No blank lines between usings, static usings intermixed
            assert.strictEqual(lines[0], 'using static Microsoft.AspNetCore.Http.StatusCodes;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[2], 'using Microsoft.Extensions.Logging;');
            assert.strictEqual(lines[3], 'using static MyCompany.Core.Constants;');
            assert.strictEqual(lines[4], 'using MyCompany.Core.Services;');
            assert.strictEqual(lines[5], 'using MyCompany.Data.Repositories;');
            assert.strictEqual(lines[6], 'using Newtonsoft.Json;');
            assert.strictEqual(lines[7], 'using static Newtonsoft.Json.JsonConvert;');
            assert.strictEqual(lines[8], 'using Serilog;');
            assert.strictEqual(lines[9], 'using System;');
            assert.strictEqual(lines[10], 'using System.Collections.Generic;');
            assert.strictEqual(lines[11], 'using static System.Math;');
            assert.strictEqual(lines[12], 'using System.Text;');
            assert.strictEqual(lines[13], 'using ThirdParty.Library;');
            assert.strictEqual(lines[14], 'using ILogger = Serilog.ILogger;');
            // No trailing blank - added in replace step (was lines[15])

            // Empty preprocessor blocks (usings were removed)
            assert.strictEqual(lines[16], '#if DEBUG');
            assert.strictEqual(lines[17], '#endif');
            // No trailing blank - added in replace step (was lines[18])
            // No trailing blank - added in replace step (was lines[19])
            assert.strictEqual(lines[20], '#if NETCOREAPP3_1');
            assert.strictEqual(lines[21], '#elif NET5_0_OR_GREATER');
            assert.strictEqual(lines[22], '#endif');
            // No trailing blank - added in replace step (was lines[23])
        });

        test('Large block with System + splitGroups + bottom mode + all features', () =>
        {
            const rawContent = [
                '// Core System namespaces',
                'global using System;',
                'global using System.Collections.Generic;',
                'global using System.Linq;',
                'global using static System.Math;',
                'using System.Text;',
                'using System.Threading.Tasks;',
                'using static System.Console;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.AspNetCore.Builder;',
                'using Microsoft.AspNetCore.Hosting;',
                'using Microsoft.AspNetCore.Mvc;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
                'using Microsoft.Extensions.Configuration;',
                'using Microsoft.Extensions.DependencyInjection;',
                'using Microsoft.Extensions.Logging;',
                'using Newtonsoft.Json;',
                'using Newtonsoft.Json.Converters;',
                'using static Newtonsoft.Json.JsonConvert;',
                'using Serilog;',
                'using Serilog.Events;',
                'using Serilog.Formatting.Json;',
                'using MyCompany.Core;',
                'using MyCompany.Core.Interfaces;',
                'using MyCompany.Core.Models;',
                'using MyCompany.Core.Services;',
                'using static MyCompany.Core.Constants;',
                'using MyCompany.Data;',
                'using MyCompany.Data.Context;',
                'using MyCompany.Data.Repositories;',
                'using AutoMapper;',
                'using FluentValidation;',
                'using MediatR;',
                'using Config = Microsoft.Extensions.Configuration.IConfiguration;',
                'using ILogger = Serilog.ILogger;',
                'using JsonSettings = Newtonsoft.Json.JsonSerializerSettings;',
            ];

            const leadingContent = [
                '// Licensed under MIT',
                '// Copyright 2024 MyCompany',
            ];

            const block = new UsingBlock(2, 39, rawContent, leadingContent);
            const config = new FormatOptions('System', true, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System-first with splitGroups, bottom mode (all statics at bottom), with ALL features:
            // - Leading comments
            // - Global usings (both regular and static)
            // - Comment in rawContent
            // - Preprocessor directive
            // - Aliases

            // Leading comments preserved
            assert.strictEqual(lines[0], '// Licensed under MIT');
            assert.strictEqual(lines[1], '// Copyright 2024 MyCompany');
            // No trailing blank - added in replace step (was lines[2])

            // Comment from rawContent preserved
            assert.strictEqual(lines[3], '// Core System namespaces');

            // Global regular usings (System-first)
            assert.strictEqual(lines[4], 'global using System;');
            assert.strictEqual(lines[5], 'global using System.Collections.Generic;');
            assert.strictEqual(lines[6], 'global using System.Linq;');

            // Non-global regular usings (System-first, then alphabetical)
            assert.strictEqual(lines[7], 'using System.Text;');
            assert.strictEqual(lines[8], 'using System.Threading.Tasks;');
            // No trailing blank - added in replace step (was lines[9])

            assert.strictEqual(lines[10], 'using AutoMapper;');
            // No trailing blank - added in replace step (was lines[11])

            assert.strictEqual(lines[12], 'using FluentValidation;');
            // No trailing blank - added in replace step (was lines[13])

            assert.strictEqual(lines[14], 'using MediatR;');
            // No trailing blank - added in replace step (was lines[15])

            assert.strictEqual(lines[16], 'using Microsoft.AspNetCore.Builder;');
            assert.strictEqual(lines[17], 'using Microsoft.AspNetCore.Hosting;');
            assert.strictEqual(lines[18], 'using Microsoft.AspNetCore.Mvc;');
            assert.strictEqual(lines[19], 'using Microsoft.Extensions.Configuration;');
            assert.strictEqual(lines[20], 'using Microsoft.Extensions.DependencyInjection;');
            assert.strictEqual(lines[21], 'using Microsoft.Extensions.Logging;');
            // No trailing blank - added in replace step (was lines[22])

            assert.strictEqual(lines[23], 'using MyCompany.Core;');
            assert.strictEqual(lines[24], 'using MyCompany.Core.Interfaces;');
            assert.strictEqual(lines[25], 'using MyCompany.Core.Models;');
            assert.strictEqual(lines[26], 'using MyCompany.Core.Services;');
            assert.strictEqual(lines[27], 'using MyCompany.Data;');
            assert.strictEqual(lines[28], 'using MyCompany.Data.Context;');
            assert.strictEqual(lines[29], 'using MyCompany.Data.Repositories;');
            // No trailing blank - added in replace step (was lines[30])

            assert.strictEqual(lines[31], 'using Newtonsoft.Json;');
            assert.strictEqual(lines[32], 'using Newtonsoft.Json.Converters;');
            // No trailing blank - added in replace step (was lines[33])

            assert.strictEqual(lines[34], 'using Serilog;');
            assert.strictEqual(lines[35], 'using Serilog.Events;');
            assert.strictEqual(lines[36], 'using Serilog.Formatting.Json;');
            // No trailing blank - added in replace step (was lines[37])

            // Static usings at bottom (System-first, then alphabetical)
            // Note: Non-global static come before global static
            assert.strictEqual(lines[38], 'using static System.Console;');
            assert.strictEqual(lines[39], 'global using static System.Math;');
            // No trailing blank - added in replace step (was lines[40])

            assert.strictEqual(lines[41], 'using static Microsoft.AspNetCore.Http.StatusCodes;');
            // No trailing blank - added in replace step (was lines[42])

            assert.strictEqual(lines[43], 'using static MyCompany.Core.Constants;');
            // No trailing blank - added in replace step (was lines[44])

            assert.strictEqual(lines[45], 'using static Newtonsoft.Json.JsonConvert;');
            // No trailing blank - added in replace step (was lines[46])

            // Aliases at the end (alphabetical)
            assert.strictEqual(lines[47], 'using Config = Microsoft.Extensions.Configuration.IConfiguration;');
            assert.strictEqual(lines[48], 'using JsonSettings = Newtonsoft.Json.JsonSerializerSettings;');
            assert.strictEqual(lines[49], 'using ILogger = Serilog.ILogger;');
            // No trailing blank - added in replace step (was lines[50])

            // Preprocessor block at the very end
            assert.strictEqual(lines[51], '#if DEBUG');
            // No trailing blank - added in replace step (was lines[52])
            assert.strictEqual(lines[53], 'using System.Diagnostics;');
            // No trailing blank - added in replace step (was lines[54])
            assert.strictEqual(lines[55], '#endif');
            // No trailing blank - added in replace step (was lines[56])
        });
    });

    suite('Edge cases with all option combinations', () =>
    {
        test('Only static usings with bottom mode', () =>
        {
            const rawContent = [
                'using static System.Math;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', false, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // All static, should still respect System-first order
            assert.ok(usings[0].includes('static System'));
            assert.ok(usings[1].includes('static Microsoft'));
        });

        test('Only static usings with groupedWithNamespace mode and splitGroups', () =>
        {
            const rawContent = [
                'using static System.Math;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 1, rawContent);
            const config = new FormatOptions('System', true, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System group
            assert.ok(lines[0].includes('static System'));

            // Blank line
            assert.strictEqual(lines[1].trim(), '');

            // Microsoft group
            assert.ok(lines[2].includes('static Microsoft'));
        });

        test('Global static usings with all placement modes', () =>
        {
            for (const mode of ['intermixed', 'bottom', 'groupedWithNamespace'] as const)
            {
                const rawContent = [
                    'global using System;',
                    'global using static System.Math;',
                    'using Microsoft.AspNetCore;',
                    'using static Microsoft.AspNetCore.Http.StatusCodes;',
                ];

                const config = new FormatOptions('System', false, false, false, mode);
                const provider = new MockDiagnosticProvider([]);

                const processor = new UsingBlockProcessor(new UsingBlock(0, 3, [...rawContent]), config, provider);
                processor.process();

                const testBlock = processor['block'];
                const lines = testBlock.toLines();
                const usings = lines.filter(l => l.includes('using'));

                // All modes should preserve global keyword
                assert.ok(usings.some(l => l.includes('global using')), `${mode}: should have global usings`);

                if (mode === 'bottom')
                {
                    // In bottom mode: global regular, non-global regular, then all statics at bottom
                    // Find indices
                    const globalRegularIdx = usings.findIndex(l => l.includes('global using') && !l.includes('static'));
                    const nonGlobalRegularIdx = usings.findIndex(l => l.includes('using') && !l.includes('global') && !l.includes('static'));
                    const globalStaticIdx = usings.findIndex(l => l.includes('global using static'));
                    const nonGlobalStaticIdx = usings.findIndex(l => l.includes('using static') && !l.includes('global'));

                    // Global regular should come first
                    assert.ok(globalRegularIdx < nonGlobalRegularIdx, `${mode}: global regular before non-global regular`);
                    // Non-global regular should come before any statics
                    assert.ok(nonGlobalRegularIdx < globalStaticIdx, `${mode}: regular usings before static usings`);
                    assert.ok(nonGlobalRegularIdx < nonGlobalStaticIdx, `${mode}: regular usings before static usings`);
                }
                else
                {
                    // In intermixed and groupedWithNamespace modes: global usings (regular and static) come first
                    const globalLines = usings.filter(l => l.includes('global using'));
                    const nonGlobalLines = usings.filter(l => l.includes('using') && !l.includes('global'));

                    const lastGlobalIdx = usings.lastIndexOf(globalLines[globalLines.length - 1]);
                    const firstNonGlobalIdx = usings.indexOf(nonGlobalLines[0]);

                    assert.ok(lastGlobalIdx < firstNonGlobalIdx, `${mode}: global usings should come before non-global`);
                }
            }
        });
    });
});
