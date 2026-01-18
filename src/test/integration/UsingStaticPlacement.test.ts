import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';

class MockDiagnosticProvider implements IDiagnosticProvider
{
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        return this.diagnostics;
    }
}

suite('Using Static Placement', () =>
{
    suite('intermixed mode (default)', () =>
    {
        test('should sort static usings intermixed with regular usings', () =>
        {
            const rawContent = [
                'using Microsoft.Extensions.Logging;',
                'using System;',
                'using static System.Math;',
                'using System.Linq;',
                'using static Microsoft.Extensions.Logging.LogLevel;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', true, false, false, 'intermixed');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0 && l.trim() !== '');

            // Should be sorted alphabetically with System first, static intermixed
            // System group
            assert.strictEqual(usings[0], 'using System;');
            assert.strictEqual(usings[1], 'using System.Linq;');
            assert.strictEqual(usings[2], 'using static System.Math;');
            // Microsoft group (alphabetically: Extensions before static keyword sorts it after regular)
            assert.strictEqual(usings[3], 'using Microsoft.Extensions.Logging;');
            assert.strictEqual(usings[4], 'using static Microsoft.Extensions.Logging.LogLevel;');
        });

        test('should keep static usings in their namespace groups', () =>
        {
            const rawContent = [
                'using System;',
                'using static System.Math;',
                'using System.Text;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, false, false, 'intermixed');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System group (including static)
            assert.ok(lines[0].includes('System'));
            assert.ok(lines[1].includes('System'));
            assert.ok(lines[2].includes('System'));

            // Blank line separator
            assert.strictEqual(lines[3].trim(), '');

            // Microsoft group
            assert.ok(lines[4].includes('Microsoft'));
        });
    });

    suite('bottom mode', () =>
    {
        test('should place all static usings at bottom after regular usings', () =>
        {
            const rawContent = [
                'using System;',
                'using static System.Math;',
                'using Microsoft.Extensions.Logging;',
                'using static Microsoft.Extensions.Logging.LogLevel;',
                'using System.Linq;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', false, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0 && l.trim() !== '');

            // Regular usings first (System has priority, then alphabetically)
            assert.ok(usings[0].includes('using System;'));
            assert.ok(!usings[0].includes('static'));

            assert.ok(usings[1].includes('using System.Linq'));
            assert.ok(!usings[1].includes('static'));

            assert.ok(usings[2].includes('using Microsoft'));
            assert.ok(!usings[2].includes('static'));

            // Static usings at bottom (System has priority, then alphabetically)
            assert.ok(usings[3].includes('using static'));
            assert.ok(usings[3].includes('System.Math'));

            assert.ok(usings[4].includes('using static'));
            assert.ok(usings[4].includes('Microsoft'));
        });

        test('should group static usings at bottom with splitGroups enabled', () =>
        {
            const rawContent = [
                'using System;',
                'using static System.Math;',
                'using Microsoft.AspNetCore;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', true, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Regular usings grouped by namespace
            assert.ok(lines[0].includes('using System;'));
            assert.ok(!lines[0].includes('static'));

            assert.strictEqual(lines[1].trim(), ''); // Namespace group separator

            assert.ok(lines[2].includes('using Microsoft'));
            assert.ok(!lines[2].includes('static'));

            assert.strictEqual(lines[3].trim(), ''); // Separator before static usings

            // Static usings at bottom, grouped by namespace (System first due to sortOrder)
            assert.ok(lines[4].includes('using static System'));

            assert.strictEqual(lines[5].trim(), ''); // Namespace group separator

            assert.ok(lines[6].includes('using static Microsoft'));
        });
    });

    suite('groupedWithNamespace mode', () =>
    {
        test('should place static usings within their namespace group', () =>
        {
            const rawContent = [
                'using System;',
                'using System.Linq;',
                'using static System.Math;',
                'using Microsoft.AspNetCore;',
                'using static Microsoft.Extensions.Logging.LogLevel;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', true, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System namespace group
            assert.ok(lines[0].includes('using System;'));
            assert.ok(lines[1].includes('using System.Linq'));
            // Static using from System namespace
            assert.ok(lines[2].includes('using static System.Math'));

            // Blank line separator
            assert.strictEqual(lines[3].trim(), '');

            // Microsoft namespace group
            assert.ok(lines[4].includes('using Microsoft.AspNetCore'));
            // Static using from Microsoft namespace
            assert.ok(lines[5].includes('using static Microsoft.Extensions.Logging'));
        });

        test('should sort regular before static within each namespace group', () =>
        {
            const rawContent = [
                'using static System.Math;',
                'using System;',
                'using System.Text;',
                'using static System.Console;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', false, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Regular usings first
            assert.ok(usings[0].includes('using System;'));
            assert.ok(!usings[0].includes('static'));

            assert.ok(usings[1].includes('using System.Text'));
            assert.ok(!usings[1].includes('static'));

            // Then static usings from same namespace
            assert.ok(usings[2].includes('using static System.Console'));
            assert.ok(usings[3].includes('using static System.Math'));
        });

        test('should handle multiple namespaces with static usings', () =>
        {
            const rawContent = [
                'using System;',
                'using static System.Math;',
                'using Microsoft.AspNetCore;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
                'using MyCompany.Core;',
                'using static MyCompany.Helpers.StringHelpers;',
            ];

            const block = new UsingBlock(0, 5, rawContent);
            const config = new FormatOptions('System', true, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System group
            assert.ok(lines[0].includes('using System;'));
            assert.ok(lines[1].includes('using static System.Math'));

            assert.strictEqual(lines[2].trim(), '');

            // Microsoft group
            assert.ok(lines[3].includes('using Microsoft.AspNetCore'));
            assert.ok(lines[4].includes('using static Microsoft.AspNetCore'));

            assert.strictEqual(lines[5].trim(), '');

            // MyCompany group
            assert.ok(lines[6].includes('using MyCompany.Core'));
            assert.ok(lines[7].includes('using static MyCompany.Helpers'));
        });
    });

    suite('Interaction with aliases', () =>
    {
        test('should keep aliases at end regardless of static placement mode', () =>
        {
            const rawContent = [
                'using System;',
                'using static System.Math;',
                'using ILogger = Serilog.ILogger;',
                'using Microsoft.Extensions.Logging;',
            ];

            // Test all three modes
            for (const mode of ['intermixed', 'bottom', 'groupedWithNamespace'] as const)
            {
                const config = new FormatOptions('System', false, false, false, mode);
                const provider = new MockDiagnosticProvider([]);
                const processor = new UsingBlockProcessor(new UsingBlock(0, 3, [...rawContent]), config, provider);

                processor.process();
                const testBlock = processor['block'];
                const lines = testBlock.toLines();
                const usings = lines.filter(l => l.trim().length > 0);

                // Alias should always be at the end
                const lastUsing = usings[usings.length - 1];
                assert.ok(lastUsing.includes('ILogger ='), `Alias should be last in ${mode} mode`);
            }
        });
    });

    suite('global using static', () =>
    {
        test('should handle global using static correctly', () =>
        {
            const rawContent = [
                'global using System;',
                'global using static System.Math;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();
            const usings = lines.filter(l => l.trim().length > 0);

            // Regular usings first
            assert.ok(usings[0].includes('global using System;'));
            assert.ok(usings[1].includes('using Microsoft'));

            // Static at bottom
            assert.ok(usings[2].includes('global using static System.Math'));
        });
    });

    suite('bottom mode with splitGroups - blank line before static section', () =>
    {
        test('should add blank line before static usings even with same root namespace', () =>
        {
            const rawContent = [
                'using MyCompany.Apps.Purchasing.Api.Finances.Models;',
                'using MyCompany.Common.Exceptions;',
                'using MyCompany.Common.Extensions;',
                'using MyCompany.Domain.Features.Purchasing.Finances.Documents;',
                'using MyCompany.Domain.Features.Shared;',
                'using static MyCompany.Domain.Features.Purchasing.Finances.Documents.GetProviderFundDocumentsListService;',
            ];

            const block = new UsingBlock(0, 5, rawContent);
            const config = new FormatOptions('System', true, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // All regular usings (same root namespace "MyCompany")
            assert.strictEqual(lines[0], 'using MyCompany.Apps.Purchasing.Api.Finances.Models;');
            assert.strictEqual(lines[1], 'using MyCompany.Common.Exceptions;');
            assert.strictEqual(lines[2], 'using MyCompany.Common.Extensions;');
            assert.strictEqual(lines[3], 'using MyCompany.Domain.Features.Purchasing.Finances.Documents;');
            assert.strictEqual(lines[4], 'using MyCompany.Domain.Features.Shared;');

            // Blank line before static section (even though it's the same root namespace)
            assert.strictEqual(lines[5], '');

            // Static using
            assert.strictEqual(lines[6], 'using static MyCompany.Domain.Features.Purchasing.Finances.Documents.GetProviderFundDocumentsListService;');
            assert.strictEqual(lines[7], '');
        });

        test('should add blank line before static section with multiple root namespaces', () =>
        {
            const rawContent = [
                'using MyCompany.Analysis.Internal.Domain.Data;',
                'using MyCompany.Analysis.Internal.Domain.DataModels;',
                'using MyCompany.Analysis.Internal.Domain.Enums;',
                'using MyCompany.Common.Database.Services;',
                'using MyCompany.Common.Exceptions;',
                'using MyCompany.Venture.Domain.Enums;',
                'using MyCompany.Venture.Domain.Services;',
                'using AutoMapper;',
                'using Microsoft.EntityFrameworkCore;',
                'using static MyCompany.Analysis.Internal.Domain.Services.VentureIngestionService;',
            ];

            const block = new UsingBlock(0, 9, rawContent);
            const config = new FormatOptions('System', true, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // AutoMapper namespace
            assert.strictEqual(lines[0], 'using AutoMapper;');
            assert.strictEqual(lines[1], '');

            // Microsoft namespace
            assert.strictEqual(lines[2], 'using Microsoft.EntityFrameworkCore;');
            assert.strictEqual(lines[3], '');

            // MyCompany namespace
            assert.strictEqual(lines[4], 'using MyCompany.Analysis.Internal.Domain.Data;');
            assert.strictEqual(lines[5], 'using MyCompany.Analysis.Internal.Domain.DataModels;');
            assert.strictEqual(lines[6], 'using MyCompany.Analysis.Internal.Domain.Enums;');
            assert.strictEqual(lines[7], 'using MyCompany.Common.Database.Services;');
            assert.strictEqual(lines[8], 'using MyCompany.Common.Exceptions;');
            assert.strictEqual(lines[9], 'using MyCompany.Venture.Domain.Enums;');
            assert.strictEqual(lines[10], 'using MyCompany.Venture.Domain.Services;');
            assert.strictEqual(lines[11], '');

            // Static usings section (separate from regular usings)
            assert.strictEqual(lines[12], 'using static MyCompany.Analysis.Internal.Domain.Services.VentureIngestionService;');
            assert.strictEqual(lines[13], '');
        });
    });
});
