import * as assert from 'assert';
import { UsingSorter } from '../../processors/UsingSorter';
import { UsingStatement } from '../../domain/UsingStatement';
import { FormatOptions } from '../../domain/FormatOptions';

suite('UsingSorter', () =>
{
    suite('System-first sorting', () =>
    {
        test('should put System namespaces first', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using MyCompany.Something;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[1].namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(sorted[2].namespace, 'MyCompany.Something');
        });

        test('should sort System namespaces alphabetically among themselves', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using System.Text;'),
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using System.Collections;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[1].namespace, 'System.Collections');
            assert.strictEqual(sorted[2].namespace, 'System.Text');
        });

        test('should put aliases after regular usings', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Foo = Serilog.Foo;'),
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('using ILogger = Serilog.ILogger;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[1].namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(sorted[2].toString().match(/using (\w+) =/)![1], 'Foo');
            assert.strictEqual(sorted[3].toString().match(/using (\w+) =/)![1], 'ILogger');
        });

        test('should sort aliases alphabetically by alias name', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using ZAlias = Something.Z;'),
                UsingStatement.parse('using AAlias = Something.A;'),
                UsingStatement.parse('using MAlias = Something.M;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].toString().match(/using (\w+) =/)![1], 'AAlias');
            assert.strictEqual(sorted[1].toString().match(/using (\w+) =/)![1], 'MAlias');
            assert.strictEqual(sorted[2].toString().match(/using (\w+) =/)![1], 'ZAlias');
        });
    });

    suite('Alphabetical sorting', () =>
    {
        test('should sort all namespaces alphabetically', () =>
        {
            const config = new FormatOptions('Alphabetical', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Zebra;'),
                UsingStatement.parse('using Apple;'),
                UsingStatement.parse('using Microsoft;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].namespace, 'Apple');
            assert.strictEqual(sorted[1].namespace, 'Microsoft');
            assert.strictEqual(sorted[2].namespace, 'Zebra');
        });

        test('should still put aliases last even in alphabetical mode', () =>
        {
            const config = new FormatOptions('Alphabetical', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Zebra;'),
                UsingStatement.parse('using MyAlias = Something;'),
                UsingStatement.parse('using Apple;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].namespace, 'Apple');
            assert.strictEqual(sorted[1].namespace, 'Zebra');
            assert.strictEqual(sorted[2].toString().match(/using (\w+) =/)![1], 'MyAlias');
        });
    });

    suite('Duplicate removal', () =>
    {
        test('should remove exact duplicates', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted.length, 2);
            assert.strictEqual(sorted.filter(s => s.namespace === 'System').length, 1);
        });

        test('should remove duplicate aliases', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using ILogger = Serilog.ILogger;'),
                UsingStatement.parse('using ILogger = Serilog.ILogger;'),
                UsingStatement.parse('using Foo = Serilog.Foo;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted.length, 2);
        });
    });

    suite('Non-using content preservation', () =>
    {
        test('should attach comments directly before using statements', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Comment about Microsoft'),
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // Should have 2 using statements (comments are attached, not standalone)
            assert.strictEqual(sorted.filter(s => s.isActualUsing()).length, 2);

            // System should be first
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 0);

            // Microsoft should be second with the comment attached
            assert.strictEqual(sorted[1].namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Comment about Microsoft'));
        });

        test('should attach comment even if it seems unrelated', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// This comment comes before Microsoft using'),
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // System should be first with no comments
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 0);

            // Microsoft should be second with the comment attached
            assert.strictEqual(sorted[1].namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
        });

        test('should preserve preprocessor directives', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // Preprocessor structure should be maintained
            assert.ok(sorted.some(s => s.isPreprocessorDirective));
        });

        test('should not sort blank lines', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.blankLine(),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // Blank lines are typically filtered before sorting, but if present
            // they should not cause issues
            assert.ok(sorted.every(s => s.isActualUsing()));
        });
    });

    suite('Edge cases', () =>
    {
        test('should handle empty input', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const sorted = sorter.sort([]);

            assert.strictEqual(sorted.length, 0);
        });

        test('should handle single statement', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted.length, 1);
            assert.strictEqual(sorted[0].namespace, 'System');
        });

        test('should handle all aliases', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using Z = Something.Z;'),
                UsingStatement.parse('using A = Something.A;'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted[0].toString().match(/using (\w+) =/)![1], 'A');
            assert.strictEqual(sorted[1].toString().match(/using (\w+) =/)![1], 'Z');
        });

        test('should handle all comments', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Comment 1'),
                UsingStatement.parse('// Comment 2'),
            ];

            const sorted = sorter.sort(statements);

            assert.strictEqual(sorted.length, 2);
            assert.ok(sorted.every(s => s.isComment));
        });
    });

    suite('Comment sticking behavior', () =>
    {
        test('should attach single comment to following using', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Special third-party library'),
                UsingStatement.parse('using Serilog;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // System should be first with no comments
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 0);

            // Serilog should be second with the comment attached
            assert.strictEqual(sorted[1].namespace, 'Serilog');
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Special third-party library'));
        });

        test('should attach multiple comments to following using', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Line 1 of comment'),
                UsingStatement.parse('// Line 2 of comment'),
                UsingStatement.parse('using Serilog;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // System first
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 0);

            // Serilog with both comment lines
            assert.strictEqual(sorted[1].namespace, 'Serilog');
            assert.strictEqual(sorted[1].getAttachedComments().length, 2);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Line 1'));
            assert.ok(sorted[1].getAttachedComments()[1].originalText.includes('Line 2'));
        });

        test('should handle multiple usings with comments', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Comment for Zebra'),
                UsingStatement.parse('using Zebra;'),
                UsingStatement.parse('// Comment for Apple'),
                UsingStatement.parse('using Apple;'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // Should be sorted: System first (System-first sort), then Apple, then Zebra (alphabetical)
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 0);

            assert.strictEqual(sorted[1].namespace, 'Apple');
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Comment for Apple'));

            assert.strictEqual(sorted[2].namespace, 'Zebra');
            assert.strictEqual(sorted[2].getAttachedComments().length, 1);
            assert.ok(sorted[2].getAttachedComments()[0].originalText.includes('Comment for Zebra'));
        });

        test('should not attach comments separated by preprocessor directive', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Comment before directive'),
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // The comment should be orphaned (not attached to anything)
            assert.strictEqual(sorted[0].isComment, true);
            assert.ok(sorted[0].originalText.includes('Comment before directive'));

            // Find the System using and verify no comments attached
            const systemUsing = sorted.find(s => s.namespace === 'System');
            assert.ok(systemUsing);
            assert.strictEqual(systemUsing.getAttachedComments().length, 0);
        });

        test('should work with System-first sorting', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('// Microsoft using'),
                UsingStatement.parse('using Microsoft.AspNetCore.Mvc;'),
                UsingStatement.parse('// System using'),
                UsingStatement.parse('using System;'),
            ];

            const sorted = sorter.sort(statements);

            // System should come first with its comment
            assert.strictEqual(sorted[0].namespace, 'System');
            assert.strictEqual(sorted[0].getAttachedComments().length, 1);
            assert.ok(sorted[0].getAttachedComments()[0].originalText.includes('System using'));

            // Microsoft second with its comment
            assert.strictEqual(sorted[1].namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Microsoft using'));
        });

        test('should attach comments to aliases', () =>
        {
            const config = new FormatOptions('System', false, false, false);
            const sorter = new UsingSorter(config);

            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('// Custom logger alias'),
                UsingStatement.parse('using ILogger = Serilog.ILogger;'),
            ];

            const sorted = sorter.sort(statements);

            // System first
            assert.strictEqual(sorted[0].namespace, 'System');

            // Alias with comment
            assert.strictEqual(sorted[1].isAlias, true);
            assert.strictEqual(sorted[1].getAttachedComments().length, 1);
            assert.ok(sorted[1].getAttachedComments()[0].originalText.includes('Custom logger alias'));
        });
    });
});
