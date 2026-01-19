import * as assert from 'assert';
import { UsingBlock } from '../../domain/UsingBlock';
import { FormatOptions } from '../../domain/FormatOptions';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

suite('SortOrder Configuration Tests', () =>
{
    suite('Default "System" sortOrder', () =>
    {
        test('should prioritize System namespace first', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using Microsoft.AspNetCore;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System should come first, then alphabetical
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Apple;');
            assert.strictEqual(lines[2], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[3], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[4])
        });

        test('should prioritize System.* subnamespaces', () =>
        {
            const rawContent = [
                'using System.Text;',
                'using Zebra;',
                'using System;',
                'using System.Linq;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // All System.* should come first (alphabetically sorted within)
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using System.Linq;');
            assert.strictEqual(lines[2], 'using System.Text;');
            assert.strictEqual(lines[3], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[4])
        });
    });

    suite('Empty string sortOrder', () =>
    {
        test('should sort purely alphabetically with empty string', () =>
        {
            const rawContent = [
                'using System;',
                'using Zebra;',
                'using Apple;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Pure alphabetical - no priority namespaces
            assert.strictEqual(lines[0], 'using Apple;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[2], 'using System;');
            assert.strictEqual(lines[3], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[4])
        });

        test('should sort purely alphabetically with splitGroups enabled', () =>
        {
            const rawContent = [
                'using System;',
                'using System.Linq;',
                'using Zebra;',
                'using Apple;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('', true, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Pure alphabetical with groups
            assert.strictEqual(lines[0], 'using Apple;');
            // No trailing blank - added in replace step (was lines[1])
            assert.strictEqual(lines[2], 'using Microsoft.AspNetCore;');
            // No trailing blank - added in replace step (was lines[3])
            assert.strictEqual(lines[4], 'using System;');
            assert.strictEqual(lines[5], 'using System.Linq;');
            // No trailing blank - added in replace step (was lines[6])
            assert.strictEqual(lines[7], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[8])
        });
    });

    suite('Multi-priority sortOrder', () =>
    {
        test('should respect "System Microsoft" priority order', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using Microsoft.AspNetCore;',
                'using System;',
                'using Apple;',
                'using Microsoft.Extensions.Logging;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System Microsoft', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System first, then Microsoft, then alphabetical
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[2], 'using Microsoft.Extensions.Logging;');
            assert.strictEqual(lines[3], 'using Apple;');
            assert.strictEqual(lines[4], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[5])
        });

        test('should respect "System Microsoft MyCompany" priority order with splitGroups', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using MyCompany.Core;',
                'using Microsoft.AspNetCore;',
                'using System;',
                'using Apple;',
                'using MyCompany.Data;',
                'using Microsoft.Extensions;',
            ];

            const block = new UsingBlock(0, 6, rawContent);
            const config = new FormatOptions('System Microsoft MyCompany', true, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System first (with blank line after)
            assert.strictEqual(lines[0], 'using System;');
            // No trailing blank - added in replace step (was lines[1])

            // Microsoft second (with blank line after)
            assert.strictEqual(lines[2], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[3], 'using Microsoft.Extensions;');
            // No trailing blank - added in replace step (was lines[4])

            // MyCompany third (with blank line after)
            assert.strictEqual(lines[5], 'using MyCompany.Core;');
            assert.strictEqual(lines[6], 'using MyCompany.Data;');
            // No trailing blank - added in replace step (was lines[7])

            // Then alphabetical (Apple, Zebra)
            assert.strictEqual(lines[8], 'using Apple;');
            // No trailing blank - added in replace step (was lines[9])
            assert.strictEqual(lines[10], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[11])
        });
    });

    suite('Non-matching namespace in sortOrder', () =>
    {
        test('should fall back to alphabetical when sortOrder namespace does not exist', () =>
        {
            const rawContent = [
                'using System;',
                'using Zebra;',
                'using Apple;',
                'using Microsoft.AspNetCore;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('NonExistent', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // No priority namespace matches, so pure alphabetical
            assert.strictEqual(lines[0], 'using Apple;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[2], 'using System;');
            assert.strictEqual(lines[3], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[4])
        });

        test('should handle partial matches correctly', () =>
        {
            const rawContent = [
                'using System;',
                'using SystemX.Foo;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('System', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // "System" prefix matches both "System" and "SystemX.Foo" (prefix matching)
            // Within the System priority group, they sort alphabetically
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using SystemX.Foo;');
            assert.strictEqual(lines[2], 'using Apple;');
            // No trailing blank - added in replace step (was lines[3])
        });
    });

    suite('Edge cases with whitespace and malformed values', () =>
    {
        test('should handle leading/trailing spaces in sortOrder', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('  System  ', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Leading/trailing spaces should be handled (trimmed or ignored)
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Apple;');
            assert.strictEqual(lines[2], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[3])
        });

        test('should handle multiple spaces between priority namespaces', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using Microsoft.AspNetCore;',
                'using System;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 3, rawContent);
            const config = new FormatOptions('System   Microsoft', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Multiple spaces should be filtered out (.filter(s => s.length > 0))
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[2], 'using Apple;');
            assert.strictEqual(lines[3], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[4])
        });

        test('should handle sortOrder with only spaces', () =>
        {
            const rawContent = [
                'using System;',
                'using Zebra;',
                'using Apple;',
            ];

            const block = new UsingBlock(0, 2, rawContent);
            const config = new FormatOptions('   ', false, false, false);
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Only spaces should result in empty priority list -> pure alphabetical
            assert.strictEqual(lines[0], 'using Apple;');
            assert.strictEqual(lines[1], 'using System;');
            assert.strictEqual(lines[2], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[3])
        });
    });

    suite('sortOrder interaction with usingStaticPlacement', () =>
    {
        test('should respect sortOrder with static usings in bottom mode', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using System;',
                'using static System.Math;',
                'using Apple;',
                'using static Zebra.Constants;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System', false, false, false, 'bottom');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // Regular usings: System first, then alphabetical
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using Apple;');
            assert.strictEqual(lines[2], 'using Zebra;');

            // Static usings at bottom: System first, then alphabetical
            assert.strictEqual(lines[3], 'using static System.Math;');
            assert.strictEqual(lines[4], 'using static Zebra.Constants;');
            // No trailing blank - added in replace step (was lines[5])
        });

        test('should respect multi-priority sortOrder with groupedWithNamespace mode', () =>
        {
            const rawContent = [
                'using Zebra;',
                'using Microsoft.AspNetCore;',
                'using System;',
                'using static System.Math;',
                'using static Microsoft.AspNetCore.Http.StatusCodes;',
            ];

            const block = new UsingBlock(0, 4, rawContent);
            const config = new FormatOptions('System Microsoft', false, false, false, 'groupedWithNamespace');
            const provider = new MockDiagnosticProvider([]);

            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();

            const lines = block.toLines();

            // System namespace (regular + static)
            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], 'using static System.Math;');

            // Microsoft namespace (regular + static)
            assert.strictEqual(lines[2], 'using Microsoft.AspNetCore;');
            assert.strictEqual(lines[3], 'using static Microsoft.AspNetCore.Http.StatusCodes;');

            // Zebra (no priority, alphabetically last)
            assert.strictEqual(lines[4], 'using Zebra;');
            // No trailing blank - added in replace step (was lines[5])
        });
    });
});
