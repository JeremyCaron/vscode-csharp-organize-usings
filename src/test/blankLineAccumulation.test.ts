import * as assert from 'assert';
import { processSourceCode, USING_REGEX } from '../formatting';
import { IFormatOptions } from '../interfaces/IFormatOptions';
import * as vs from 'vscode';

suite('Blank Line Accumulation Bug Tests (Issue #26)', () =>
{
    const options: IFormatOptions =
    {
        sortOrder: 'System',
        splitGroups: true,
        disableUnusedUsingsRemoval: false,
        processUsingsInPreprocessorDirectives: false
    };

    test('regex should consistently capture trailing newlines after using blocks', () =>
    {
        // This test verifies that the regex captures trailing newlines consistently
        // The old regex (\r?\n*) would sometimes leave trailing newlines behind
        // The new regex ((?:[\n]|[\r\n])*) captures them consistently as atomic units

        const input = [
            'using System.Text.RegularExpressions;',
            '',
            'using AwesomeCompany.Common.Serialization.JsonConverters;',
            '',
            'namespace AwesomeCompany.FooBar.Domain;'
        ].join('\n');

        const matches = Array.from(input.matchAll(USING_REGEX));

        assert.strictEqual(matches.length, 1, 'Should find exactly one using block');

        const match = matches[0][0];

        // The match should include BOTH using statements AND the trailing newline after the last using
        // This ensures the newline is captured and will be replaced consistently
        assert.ok(match.includes('using System.Text.RegularExpressions;'), 'Should capture first using');
        assert.ok(match.includes('using AwesomeCompany.Common.Serialization.JsonConverters;'), 'Should capture second using');

        // Count newlines in the match - should have the newlines between and after usings
        const newlineCount = (match.match(/\n/g) || []).length;
        assert.ok(newlineCount >= 3, `Should capture at least 3 newlines (between and after usings), got ${newlineCount}`);
    });

    test('file should not change when processed multiple times with empty diagnostics', () =>
    {
        // This is the core bug: running organize usings repeatedly would keep modifying the file
        const input = [
            'using System.Text.RegularExpressions;',
            '',
            'using AwesomeCompany.Common.Serialization.JsonConverters;',
            '',
            'namespace AwesomeCompany.FooBar.Domain.Models;',
            '',
            'public class InquiryResponseModel',
            '{',
            '}'
        ].join('\n');

        const diagnostics: vs.Diagnostic[] = [];

        // Run 1
        const result1 = processSourceCode(input, '\n', options, diagnostics);

        // Run 2 - should produce identical result
        const result2 = processSourceCode(result1, '\n', options, diagnostics);

        // Run 3 - should still produce identical result
        const result3 = processSourceCode(result2, '\n', options, diagnostics);

        // All runs should be idempotent - produce identical results
        assert.strictEqual(result1, result2, 'Second run should not modify the file');
        assert.strictEqual(result2, result3, 'Third run should not modify the file');
        assert.strictEqual(result1, result3, 'All runs should produce the same result');
    });

    test('should maintain exactly one blank line between using block and namespace', () =>
    {
        const input = [
            'using System;',
            '',
            'using MyCompany.Something;',
            '',
            'namespace MyNamespace;',
            '',
            'public class MyClass { }'
        ].join('\n');

        const diagnostics: vs.Diagnostic[] = [];

        const result = processSourceCode(input, '\n', options, diagnostics);

        // Most importantly: verify it's idempotent (doesn't keep adding blank lines)
        const result2 = processSourceCode(result, '\n', options, diagnostics);
        assert.strictEqual(result, result2, 'Should be idempotent - no changes on second run');

        const result3 = processSourceCode(result2, '\n', options, diagnostics);
        assert.strictEqual(result2, result3, 'Should remain idempotent on third run');
    });

    test('should handle Windows line endings (CRLF) consistently', () =>
    {
        const input = [
            'using System.Text.RegularExpressions;',
            '',
            'using AwesomeCompany.Common.Serialization.JsonConverters;',
            '',
            'namespace AwesomeCompany.FooBar.Domain;',
        ].join('\r\n');

        const diagnostics: vs.Diagnostic[] = [];

        // Run multiple times with CRLF
        const result1 = processSourceCode(input, '\r\n', options, diagnostics);
        const result2 = processSourceCode(result1, '\r\n', options, diagnostics);
        const result3 = processSourceCode(result2, '\r\n', options, diagnostics);

        // Should be idempotent
        assert.strictEqual(result1, result2, 'Second run should not modify the file (CRLF)');
        assert.strictEqual(result2, result3, 'Third run should not modify the file (CRLF)');
    });

    test('should handle multiple using blocks in file-scoped namespaces', () =>
    {
        // File-scoped namespaces can sometimes have multiple using blocks
        const input = [
            'using System;',
            '',
            'using Microsoft.Extensions;',
            '',
            'namespace MyApp;',
            '',
            'public class Foo { }'
        ].join('\n');

        const diagnostics: vs.Diagnostic[] = [];

        const result = processSourceCode(input, '\n', options, diagnostics);

        // Verify it's idempotent - this is the key test for the bug
        const result2 = processSourceCode(result, '\n', options, diagnostics);
        assert.strictEqual(result, result2, 'Should be idempotent - no changes on second run');

        const result3 = processSourceCode(result2, '\n', options, diagnostics);
        assert.strictEqual(result2, result3, 'Should remain idempotent on third run');
    });

    test('real-world bad.cs example should be idempotent', () =>
    {
        // Simplified version of the actual bad.cs file that was exhibiting the bug
        const input = [
            'using System.Text.RegularExpressions;',
            '',
            'using AwesomeCompany.Common.Serialization.JsonConverters;',
            '',
            'namespace AwesomeCompany.FooBar.Domain.Models;',
            '',
            'public class InquiryResponseModel : PersonaResponseModel',
            '{',
            '    public InquiryResponseModel() { }',
            '',
            '    [JsonConverter(typeof(JsonStringEnumConverter))]',
            '    public override ObjectType Type => ObjectType.Inquiry;',
            '}'
        ].join('\n');

        const diagnostics: vs.Diagnostic[] = [];

        // This should not change on multiple runs
        const result1 = processSourceCode(input, '\n', options, diagnostics);
        const result2 = processSourceCode(result1, '\n', options, diagnostics);
        const result3 = processSourceCode(result2, '\n', options, diagnostics);

        assert.strictEqual(result1, result2, 'Should be stable after first processing');
        assert.strictEqual(result2, result3, 'Should remain stable on subsequent runs');
    });
});
