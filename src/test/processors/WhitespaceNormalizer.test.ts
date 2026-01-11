import * as assert from 'assert';
import { WhitespaceNormalizer } from '../../processors/WhitespaceNormalizer';
import { UsingStatement } from '../../domain/UsingStatement';

suite('WhitespaceNormalizer', () => {
    const normalizer = new WhitespaceNormalizer();

    function parseStatements(lines: string[]): UsingStatement[] {
        return lines.map(line => UsingStatement.parse(line));
    }

    function toLines(statements: UsingStatement[]): string[] {
        return statements.map(s => s.toString());
    }

    suite('Comments', () => {
        test('should add blank line after comments before first using', () => {
            const input = parseStatements([
                '// Copyright 2024',
                '// License: MIT',
                'using System;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            assert.strictEqual(lines.length, 4);
            assert.ok(lines[0].includes('Copyright'));
            assert.ok(lines[1].includes('License'));
            assert.strictEqual(lines[2], '');
            assert.ok(lines[3].includes('System'));
        });

        test('should handle existing blank line after comment', () => {
            const input = parseStatements([
                '// Comment',
                '',
                'using System;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have: comment, blank (from input, preserved), using
            // The normalizer doesn't add another blank because next is already a blank, not a using
            assert.strictEqual(lines.length, 3);
            assert.ok(lines[0].includes('Comment'));
            assert.strictEqual(lines[1], '');
            assert.ok(lines[2].includes('System'));
        });
    });

    suite('Preprocessor blocks', () => {
        test('should add blank line before #if', () => {
            const input = parseStatements([
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const ifIndex = lines.findIndex(l => l.includes('#if DEBUG'));
            assert.ok(ifIndex > 0);
            assert.strictEqual(lines[ifIndex - 1], '', 'Should have blank line before #if');
        });

        test('should add blank line after #if', () => {
            const input = parseStatements([
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const ifIndex = lines.findIndex(l => l.includes('#if DEBUG'));
            assert.strictEqual(lines[ifIndex + 1], '', 'Should have blank line after #if');
        });

        test('should add blank line before #endif', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const endifIndex = lines.findIndex(l => l.includes('#endif'));
            assert.ok(endifIndex > 0);
            assert.strictEqual(lines[endifIndex - 1], '', 'Should have blank line before #endif');
        });

        test('should add blank line after #endif', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using System;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const endifIndex = lines.findIndex(l => l.includes('#endif'));
            assert.strictEqual(lines[endifIndex + 1], '', 'Should have blank line after #endif');
        });

        test('should handle #else directive', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#else',
                'using System.Runtime;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const elseIndex = lines.findIndex(l => l.includes('#else'));

            // Should have blank before #else
            assert.strictEqual(lines[elseIndex - 1], '', 'Should have blank line before #else');

            // Should have blank after #else
            assert.strictEqual(lines[elseIndex + 1], '', 'Should have blank line after #else');
        });

        test('should handle #elif directive', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#elif TRACE',
                'using System.Diagnostics.Trace;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            const elifIndex = lines.findIndex(l => l.includes('#elif'));

            // Should have blank before #elif
            assert.strictEqual(lines[elifIndex - 1], '', 'Should have blank line before #elif');

            // Should have blank after #elif
            assert.strictEqual(lines[elifIndex + 1], '', 'Should have blank line after #elif');
        });

        test('should handle nested preprocessor blocks', () => {
            const input = parseStatements([
                '#if DEBUG',
                '#if TRACE',
                'using System.Diagnostics.Trace;',
                '#endif',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Outer #if
            const outerIfIndex = lines.findIndex(l => l.includes('#if DEBUG'));

            // Inner #if should have blank after
            const innerIfIndex = lines.findIndex(l => l.includes('#if TRACE'));
            assert.strictEqual(lines[innerIfIndex + 1], '', 'Inner #if should have blank after');

            // Inner #endif should have blank before
            const innerEndifIndex = lines.findIndex(l => l === '#endif');
            assert.strictEqual(lines[innerEndifIndex - 1], '', 'Inner #endif should have blank before');
        });

        test('should not add blank after #if if followed by #endif', () => {
            const input = parseStatements([
                '#if DEBUG',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should only have the two directives and blanks around, not between
            const ifIndex = lines.findIndex(l => l.includes('#if'));
            const endifIndex = lines.findIndex(l => l.includes('#endif'));

            // Should not add blank between #if and #endif when there's no content
            assert.strictEqual(endifIndex - ifIndex, 1, 'Should not have blank between empty directives');
        });
    });

    suite('Complete examples', () => {
        test('should format simple file with preprocessor block', () => {
            const input = parseStatements([
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.Extensions;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have proper structure:
            // using System;
            // <blank>
            // #if DEBUG
            // <blank>
            // using System.Diagnostics;
            // <blank>
            // #endif
            // <blank>
            // using Microsoft.Extensions;

            assert.strictEqual(lines[0], 'using System;');
            assert.strictEqual(lines[1], '');
            assert.ok(lines[2].includes('#if DEBUG'));
            assert.strictEqual(lines[3], '');
            assert.ok(lines[4].includes('Diagnostics'));
            assert.strictEqual(lines[5], '');
            assert.ok(lines[6].includes('#endif'));
            assert.strictEqual(lines[7], '');
            assert.ok(lines[8].includes('Microsoft'));
        });

        test('should format file with comments and preprocessor blocks', () => {
            const input = parseStatements([
                '// Copyright header',
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#else',
                'using System.Runtime;',
                '#endif',
                'using Microsoft.Extensions;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have blank after comment
            const commentIndex = 0;
            assert.ok(lines[commentIndex].includes('Copyright'));
            assert.strictEqual(lines[commentIndex + 1], '');

            // Should have blank before #if
            const ifIndex = lines.findIndex(l => l.includes('#if'));
            assert.strictEqual(lines[ifIndex - 1], '');

            // Should have blanks around #else
            const elseIndex = lines.findIndex(l => l.includes('#else'));
            assert.strictEqual(lines[elseIndex - 1], '');
            assert.strictEqual(lines[elseIndex + 1], '');

            // Should have blank after #endif
            const endifIndex = lines.findIndex(l => l.includes('#endif'));
            assert.strictEqual(lines[endifIndex + 1], '');
        });

        test('should be idempotent', () => {
            const input = parseStatements([
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result1 = normalizer.normalize(input);
            const result2 = normalizer.normalize(result1);
            const result3 = normalizer.normalize(result2);

            const lines1 = toLines(result1);
            const lines2 = toLines(result2);
            const lines3 = toLines(result3);

            assert.deepStrictEqual(lines1, lines2, 'Second run should produce same output');
            assert.deepStrictEqual(lines2, lines3, 'Third run should produce same output');
        });

        test('should handle complex Unity example', () => {
            const input = parseStatements([
                'using System.Collections;',
                'using System.Runtime.CompilerServices;',
                '#if UNITY_ANDROID',
                'using Microsoft.CodeAnalysis.CSharp;',
                '#else',
                'using System.Configuration.Assemblies;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have blank before #if
            const ifIndex = lines.findIndex(l => l.includes('#if UNITY_ANDROID'));
            assert.strictEqual(lines[ifIndex - 1], '', 'Should have blank before #if');

            // Should have blank after #if
            assert.strictEqual(lines[ifIndex + 1], '', 'Should have blank after #if');

            // Should have blanks around #else
            const elseIndex = lines.findIndex(l => l.includes('#else'));
            assert.strictEqual(lines[elseIndex - 1], '', 'Should have blank before #else');
            assert.strictEqual(lines[elseIndex + 1], '', 'Should have blank after #else');

            // Should have blank before #endif
            const endifIndex = lines.findIndex(l => l.includes('#endif'));
            assert.strictEqual(lines[endifIndex - 1], '', 'Should have blank before #endif');

            // Should have blank after #endif if there's content after
            // (in this case there's no content after so no blank needed)
        });
    });

    suite('Edge cases', () => {
        test('should handle empty input', () => {
            const input: UsingStatement[] = [];
            const result = normalizer.normalize(input);
            assert.strictEqual(result.length, 0);
        });

        test('should handle only comments', () => {
            const input = parseStatements([
                '// Comment 1',
                '// Comment 2'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should just pass through comments without blanks
            assert.strictEqual(lines.length, 2);
            assert.ok(lines[0].includes('Comment 1'));
            assert.ok(lines[1].includes('Comment 2'));
        });

        test('should handle only preprocessor directives', () => {
            const input = parseStatements([
                '#if DEBUG',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have directives without excessive blanks between them
            assert.strictEqual(lines.length, 2);
            assert.ok(lines[0].includes('#if'));
            assert.ok(lines[1].includes('#endif'));
        });

        test('should handle blank lines in input gracefully', () => {
            const input = parseStatements([
                'using System;',
                '',
                '',
                'using Microsoft.Extensions;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should preserve the structure with blanks
            assert.ok(lines[0].includes('System'));
            assert.ok(lines[lines.length - 1].includes('Microsoft'));
        });

        test('should not add blank before #if if it is the first statement', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // First line should be #if without blank before
            assert.ok(lines[0].includes('#if DEBUG'));
        });

        test('should not add blank after #endif if it is the last statement', () => {
            const input = parseStatements([
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Last line should be #endif without extra blanks after
            const lastNonBlank = lines.filter(l => l.trim().length > 0).pop();
            assert.ok(lastNonBlank?.includes('#endif'));
        });

        test('should handle #region and #endregion', () => {
            const input = parseStatements([
                '#region My Region',
                'using System;',
                '#endregion'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should add blanks around region like it does for #if/#endif
            const regionIndex = lines.findIndex(l => l.includes('#region'));
            assert.strictEqual(lines[regionIndex + 1], '', 'Should have blank after #region');

            const endregionIndex = lines.findIndex(l => l.includes('#endregion'));
            assert.strictEqual(lines[endregionIndex - 1], '', 'Should have blank before #endregion');
        });
    });

    suite('Interaction with grouped usings', () => {
        test('should preserve group separators from UsingGroupSplitter', () => {
            // UsingGroupSplitter adds blank lines between namespace groups
            // WhitespaceNormalizer should preserve those
            const input = parseStatements([
                'using System;',
                'using System.Text;',
                '', // Blank from grouper
                'using Microsoft.Extensions;'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should preserve the blank line between groups
            assert.ok(lines[0].includes('System'));
            assert.ok(lines[1].includes('System.Text'));
            assert.strictEqual(lines[2], '');
            assert.ok(lines[3].includes('Microsoft'));
        });

        test('should work with grouped usings and preprocessor blocks', () => {
            const input = parseStatements([
                'using System;',
                '', // Group separator
                'using Microsoft.Extensions;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif'
            ]);

            const result = normalizer.normalize(input);
            const lines = toLines(result);

            // Should have group separator and preprocessor separators
            assert.ok(lines[0].includes('System'));
            assert.strictEqual(lines[1], ''); // Group separator
            assert.ok(lines[2].includes('Microsoft'));
            assert.strictEqual(lines[3], ''); // Before #if
            assert.ok(lines[4].includes('#if'));
        });
    });
});
