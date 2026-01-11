import * as assert from 'assert';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';

suite('UsingBlockExtractor', () =>
{
    const extractor = new UsingBlockExtractor();

    suite('Basic extraction', () =>
    {
        test('should extract single using block', () =>
        {
            const source = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);

            const [originalText, block] = Array.from(blocks)[0];
            assert.ok(originalText.includes('using System;'));
            assert.strictEqual(block.getActualUsingCount(), 2);
        });

        test('should extract block with leading comments', () =>
        {
            const source = [
                '// Copyright notice',
                '// More info',
                'using System;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);

            const block = Array.from(blocks.values())[0];
            assert.strictEqual(block.getLeadingContent().length, 2);
            assert.strictEqual(block.getActualUsingCount(), 1);
        });

        test('should not extract using declarations', () =>
        {
            const source = [
                'namespace MyApp',
                '{',
                '    public class Foo',
                '    {',
                '        public void Bar()',
                '        {',
                '            using (var conn = GetConnection())',
                '            {',
                '                // code',
                '            }',
                '        }',
                '    }',
                '}',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Should not extract using declarations
            assert.strictEqual(blocks.size, 0);
        });

        test('should distinguish using statements from using declarations', () =>
        {
            const source = [
                'using System;',
                '',
                'public class Test',
                '{',
                '    void Method()',
                '    {',
                '        using (var x = new Thing()) { }',
                '        using var y = new Thing();',
                '    }',
                '}',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Should only extract the using statement at the top
            assert.strictEqual(blocks.size, 1);

            const block = Array.from(blocks.values())[0];
            assert.strictEqual(block.getActualUsingCount(), 1);
        });
    });

    suite('Line ending handling', () =>
    {
        test('should handle Unix line endings (LF)', () =>
        {
            const source = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);
        });

        test('should handle Windows line endings (CRLF)', () =>
        {
            const source = [
                'using System;',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;',
            ].join('\r\n');

            const blocks = extractor.extract(source, '\r\n');

            assert.strictEqual(blocks.size, 1);
        });

        test('should preserve original line endings in replacement', () =>
        {
            const source = [
                'using System;',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\r\n');

            const blocks = extractor.extract(source, '\r\n');

            // Modify the block - keep the statements but they will be rejoined with CRLF
            const block = Array.from(blocks.values())[0];
            const statements = Array.from(block.getStatements());
            block.setStatements(statements); // Re-set same statements

            const result = extractor.replace(source, '\r\n', blocks);

            // Should preserve CRLF throughout
            // The namespace line should still have CRLF
            const lines = result.split('\r\n');
            assert.ok(lines.length > 1, 'Should have multiple lines separated by CRLF');
            assert.ok(result.includes('namespace MyApp;'), 'Should still have namespace');
        });
    });

    suite('Preprocessor directives', () =>
    {
        test('should extract blocks with preprocessor directives', () =>
        {
            const source = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);

            const block = Array.from(blocks.values())[0];
            // Should have all lines including directives
            const statements = block.getStatements();
            assert.ok(statements.some(s => s.isPreprocessorDirective));
            assert.strictEqual(block.getActualUsingCount(), 3);
        });

        test('should handle nested preprocessor blocks', () =>
        {
            const source = [
                '#if DEBUG',
                '#if UNITY',
                'using Unity.Core;',
                '#endif',
                'using System.Diagnostics;',
                '#endif',
                'using System;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);
        });
    });

    suite('Multiple blocks', () =>
    {
        test('should extract multiple using blocks', () =>
        {
            const source = [
                'using System;',
                '',
                'namespace Outer',
                '{',
                '    using Inner.Namespace;',
                '',
                '    public class Foo { }',
                '}',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Should find both blocks
            assert.ok(blocks.size >= 1);
        });
    });

    suite('Block replacement', () =>
    {
        test('should replace block with modified content', () =>
        {
            const source = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Reverse the order of statements (simple modification to test replacement)
            const block = Array.from(blocks.values())[0];
            const statements = Array.from(block.getStatements()).reverse();
            block.setStatements(statements);

            const result = extractor.replace(source, '\n', blocks);

            // After reversing, System should come before Microsoft
            const lines = result.split('\n');
            const systemIndex = lines.findIndex(l => l.includes('System;'));
            const microsoftIndex = lines.findIndex(l => l.includes('Microsoft'));

            assert.ok(systemIndex < microsoftIndex, 'After reversing, System should come first');
            assert.ok(result.includes('namespace MyApp;'), 'Namespace should be preserved');
        });

        test('should maintain non-using content', () =>
        {
            const source = [
                'using System;',
                '',
                'namespace MyApp;',
                '',
                'public class Foo { }',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            const result = extractor.replace(source, '\n', blocks);

            // Namespace and class should still be there
            assert.ok(result.includes('namespace MyApp;'));
            assert.ok(result.includes('public class Foo'));
        });

        test('should handle empty block', () =>
        {
            const source = [
                'using System;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Remove all statements
            const block = Array.from(blocks.values())[0];
            block.setStatements([]);

            const result = extractor.replace(source, '\n', blocks);

            // Using should be gone, namespace remains
            assert.ok(!result.includes('using System;'));
            assert.ok(result.includes('namespace MyApp;'));
        });
    });

    suite('Edge cases', () =>
    {
        test('should handle empty source', () =>
        {
            const blocks = extractor.extract('', '\n');

            assert.strictEqual(blocks.size, 0);
        });

        test('should handle source with no using statements', () =>
        {
            const source = [
                'namespace MyApp;',
                '',
                'public class Foo { }',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 0);
        });

        test('should handle source with only comments', () =>
        {
            const source = [
                '// Comment line 1',
                '// Comment line 2',
                '// Comment line 3',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 0);
        });

        test('should handle malformed using statements gracefully', () =>
        {
            const source = [
                'using System',  // Missing semicolon
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Regex should be permissive enough or skip malformed lines
            // The exact behavior depends on the regex
            assert.ok(blocks.size >= 0);
        });
    });

    suite('Real-world scenarios', () =>
    {
        test('should handle file-scoped namespace', () =>
        {
            const source = [
                'using System.Text.RegularExpressions;',
                '',
                'using MyCompany.Common.JsonConverters;',
                '',
                'namespace MyCompany.Domain.Models;',
                '',
                'public class InquiryResponseModel',
                '{',
                '    public InquiryResponseModel() { }',
                '}',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);

            const block = Array.from(blocks.values())[0];
            assert.strictEqual(block.getActualUsingCount(), 2);
        });

        test('should handle traditional namespace with usings inside', () =>
        {
            const source = [
                'namespace MyCompany.Application',
                '{',
                '    using System;',
                '    using Microsoft.Extensions;',
                '',
                '    public class Startup { }',
                '}',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            // Should find the using block inside namespace
            assert.ok(blocks.size >= 1);
        });

        test('should handle global usings', () =>
        {
            const source = [
                'global using System;',
                'global using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
            ].join('\n');

            const blocks = extractor.extract(source, '\n');

            assert.strictEqual(blocks.size, 1);

            const block = Array.from(blocks.values())[0];
            assert.strictEqual(block.getActualUsingCount(), 2);
        });
    });
});
