import * as assert from 'assert';
import { UsingStatement } from '../../domain/UsingStatement';

suite('UsingStatement', () =>
{
    suite('parse', () =>
    {
        test('should parse regular using statement', () =>
        {
            const stmt = UsingStatement.parse('using System;');

            assert.strictEqual(stmt.isActualUsing(), true);
            assert.strictEqual(stmt.isAlias, false);
            assert.strictEqual(stmt.namespace, 'System');
            assert.strictEqual(stmt.rootNamespace, 'System');
            assert.strictEqual(stmt.toString(), 'using System;');
        });

        test('should parse nested namespace', () =>
        {
            const stmt = UsingStatement.parse('using Microsoft.AspNetCore.Mvc;');

            assert.strictEqual(stmt.namespace, 'Microsoft.AspNetCore.Mvc');
            assert.strictEqual(stmt.rootNamespace, 'Microsoft');
        });

        test('should parse alias statement', () =>
        {
            const stmt = UsingStatement.parse('using ILogger = Serilog.ILogger;');

            assert.strictEqual(stmt.isActualUsing(), true);
            assert.strictEqual(stmt.isAlias, true);
            assert.ok(stmt.toString().includes('ILogger ='));
            assert.strictEqual(stmt.namespace, 'Serilog.ILogger');
            assert.strictEqual(stmt.rootNamespace, 'Serilog');
        });

        test('should parse comment line', () =>
        {
            const stmt = UsingStatement.parse('// This is a comment');

            assert.strictEqual(stmt.isActualUsing(), false);
            assert.strictEqual(stmt.isComment, true);
            assert.strictEqual(stmt.toString(), '// This is a comment');
        });

        test('should parse preprocessor directive', () =>
        {
            const stmt = UsingStatement.parse('#if UNITY_ANDROID');

            assert.strictEqual(stmt.isActualUsing(), false);
            assert.strictEqual(stmt.isPreprocessorDirective, true);
            assert.strictEqual(stmt.toString(), '#if UNITY_ANDROID');
        });

        test('should parse blank line', () =>
        {
            const stmt = UsingStatement.parse('');

            assert.strictEqual(stmt.isBlankLine, true);
            assert.strictEqual(stmt.isActualUsing(), false);
            assert.strictEqual(stmt.toString(), '');
        });

        // Note: Using declarations (using var x = ...) are filtered by the regex in UsingBlockExtractor
        // so these tests are not needed - the parser never sees them in practice
    });

    suite('blankLine factory', () =>
    {
        test('should create blank line statement', () =>
        {
            const stmt = UsingStatement.blankLine();

            assert.strictEqual(stmt.isBlankLine, true);
            assert.strictEqual(stmt.isActualUsing(), false);
            assert.strictEqual(stmt.toString(), '');
        });
    });

    suite('comparison', () =>
    {
        test('should consider two identical statements equal', () =>
        {
            const stmt1 = UsingStatement.parse('using System;');
            const stmt2 = UsingStatement.parse('using System;');

            // This would be used in de-duplication logic
            assert.strictEqual(stmt1.toString(), stmt2.toString());
        });

        test('should distinguish between statement and alias with same namespace', () =>
        {
            const stmt1 = UsingStatement.parse('using System;');
            const stmt2 = UsingStatement.parse('using Sys = System;');

            assert.notStrictEqual(stmt1.toString(), stmt2.toString());
            assert.strictEqual(stmt1.isAlias, false);
            assert.strictEqual(stmt2.isAlias, true);
        });
    });

    suite('edge cases', () =>
    {
        test('should handle using with whitespace', () =>
        {
            const stmt = UsingStatement.parse('  using System;  ');

            assert.strictEqual(stmt.isActualUsing(), true);
            assert.strictEqual(stmt.namespace, 'System');
        });

        test('should handle global using', () =>
        {
            const stmt = UsingStatement.parse('global using System;');

            assert.strictEqual(stmt.isActualUsing(), true);
            assert.strictEqual(stmt.namespace, 'System');
        });

        test('should handle using static', () =>
        {
            const stmt = UsingStatement.parse('using static System.Math;');

            assert.strictEqual(stmt.isActualUsing(), true);
            assert.strictEqual(stmt.namespace, 'System.Math');
        });
    });
});
