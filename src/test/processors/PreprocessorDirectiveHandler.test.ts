import * as assert from 'assert';
import { PreprocessorDirectiveHandler } from '../../processors/PreprocessorDirectiveHandler';
import { UsingStatement } from '../../domain/UsingStatement';

suite('PreprocessorDirectiveHandler', () =>
{
    let handler: PreprocessorDirectiveHandler;

    setup(() =>
    {
        handler = new PreprocessorDirectiveHandler();
    });

    suite('separate', () =>
    {
        test('should separate simple #if/#endif block', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System.Text;'),
            ];

            const result = handler.separate(statements);

            assert.strictEqual(result.directiveBlocks.length, 1, 'Should have 1 directive block');
            assert.strictEqual(result.directiveBlocks[0].length, 3, 'Directive block should have 3 items');
            assert.strictEqual(result.directiveBlocks[0][0].toString(), '#if DEBUG');
            assert.strictEqual(result.directiveBlocks[0][1].toString(), 'using System.Diagnostics;');
            assert.strictEqual(result.directiveBlocks[0][2].toString(), '#endif');

            assert.strictEqual(result.remainingUsings.length, 2, 'Should have 2 remaining usings');
            assert.strictEqual(result.remainingUsings[0].toString(), 'using System;');
            assert.strictEqual(result.remainingUsings[1].toString(), 'using System.Text;');
        });

        test('should handle #if/#else/#endif block', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('#if UNITY_ANDROID'),
                UsingStatement.parse('using Unity.Android;'),
                UsingStatement.parse('#else'),
                UsingStatement.parse('using System.Text;'),
                UsingStatement.parse('#endif'),
            ];

            const result = handler.separate(statements);

            // #if/#else/#endif should be treated as one block
            // because #else doesn't end the block, only #endif does
            assert.strictEqual(result.directiveBlocks.length, 1, 'Should have 1 directive block');
            assert.strictEqual(result.directiveBlocks[0].length, 5, 'Directive block should have 5 items');
            assert.strictEqual(result.directiveBlocks[0][0].toString(), '#if UNITY_ANDROID');
            assert.strictEqual(result.directiveBlocks[0][1].toString(), 'using Unity.Android;');
            assert.strictEqual(result.directiveBlocks[0][2].toString(), '#else');
            assert.strictEqual(result.directiveBlocks[0][3].toString(), 'using System.Text;');
            assert.strictEqual(result.directiveBlocks[0][4].toString(), '#endif');

            assert.strictEqual(result.remainingUsings.length, 1, 'Should have 1 remaining using');
        });

        test('should handle #region/#endregion block', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('#region Internal usings'),
                UsingStatement.parse('using MyApp.Internal;'),
                UsingStatement.parse('#endregion'),
                UsingStatement.parse('using System.Text;'),
            ];

            const result = handler.separate(statements);

            assert.strictEqual(result.directiveBlocks.length, 1, 'Should have 1 directive block');
            assert.strictEqual(result.directiveBlocks[0].length, 3, 'Directive block should have 3 items');
            assert.strictEqual(result.directiveBlocks[0][0].toString(), '#region Internal usings');
            assert.strictEqual(result.directiveBlocks[0][2].toString(), '#endregion');

            assert.strictEqual(result.remainingUsings.length, 2, 'Should have 2 remaining usings');
        });

        test('should handle multiple directive blocks', () =>
        {
            const statements = [
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System;'),
                UsingStatement.parse('#if UNITY'),
                UsingStatement.parse('using Unity.Core;'),
                UsingStatement.parse('#endif'),
            ];

            const result = handler.separate(statements);

            assert.strictEqual(result.directiveBlocks.length, 2, 'Should have 2 directive blocks');
            assert.strictEqual(result.directiveBlocks[0].length, 3);
            assert.strictEqual(result.directiveBlocks[1].length, 3);
            assert.strictEqual(result.remainingUsings.length, 1, 'Should have 1 remaining using');
        });

        test('should handle nested #if blocks', () =>
        {
            const statements = [
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('#if UNITY'),
                UsingStatement.parse('using Unity.Debug;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
                UsingStatement.parse('using System;'),
            ];

            const result = handler.separate(statements);

            // Note: The current implementation doesn't track nesting depth,
            // so the first #endif closes the block. This results in 2 blocks:
            // Block 1: #if DEBUG, #if UNITY, using Unity.Debug;, #endif
            // Block 2: #endif (treated as a new block that immediately closes)
            // This is a known limitation - nested blocks are not properly handled
            assert.strictEqual(result.directiveBlocks.length, 2, 'Should have 2 directive blocks (limitation: nesting not tracked)');
            assert.strictEqual(result.remainingUsings.length, 2, 'Should have 2 remaining usings');
            assert.strictEqual(result.remainingUsings[0].toString(), 'using System.Diagnostics;');
            assert.strictEqual(result.remainingUsings[1].toString(), 'using System;');
        });

        test('should handle #pragma directive', () =>
        {
            const statements = [
                UsingStatement.parse('#pragma warning disable CA1416'),
                UsingStatement.parse('using System.DirectoryServices;'),
                UsingStatement.parse('using System;'),
            ];

            const result = handler.separate(statements);

            // #pragma is a start but not an end, so it should capture until end of input
            assert.strictEqual(result.directiveBlocks.length, 1, 'Should have 1 directive block');
            assert.strictEqual(result.remainingUsings.length, 0, 'All usings captured in directive block');
        });

        test('should handle file with no directives', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using System.Text;'),
                UsingStatement.parse('using Microsoft.Extensions;'),
            ];

            const result = handler.separate(statements);

            assert.strictEqual(result.directiveBlocks.length, 0, 'Should have no directive blocks');
            assert.strictEqual(result.remainingUsings.length, 3, 'All usings should be remaining');
        });

        test('should handle empty input', () =>
        {
            const result = handler.separate([]);

            assert.strictEqual(result.directiveBlocks.length, 0);
            assert.strictEqual(result.remainingUsings.length, 0);
        });

        test('should handle blank lines within directive blocks', () =>
        {
            const statements = [
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse(''),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse(''),
                UsingStatement.parse('#endif'),
            ];

            const result = handler.separate(statements);

            assert.strictEqual(result.directiveBlocks.length, 1);
            assert.strictEqual(result.directiveBlocks[0].length, 5, 'Should include blank lines');
        });
    });

    suite('recombine', () =>
    {
        test('should combine sorted usings with directive blocks', () =>
        {
            const sortedUsings = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using System.Text;'),
            ];
            const directiveBlocks = [
                [
                    UsingStatement.parse('#if DEBUG'),
                    UsingStatement.parse('using System.Diagnostics;'),
                    UsingStatement.parse('#endif'),
                ],
            ];

            const result = handler.recombine(sortedUsings, directiveBlocks);

            assert.strictEqual(result.length, 5);
            assert.strictEqual(result[0].toString(), 'using System;');
            assert.strictEqual(result[1].toString(), 'using System.Text;');
            assert.strictEqual(result[2].toString(), '#if DEBUG');
            assert.strictEqual(result[3].toString(), 'using System.Diagnostics;');
            assert.strictEqual(result[4].toString(), '#endif');
        });

        test('should handle empty sorted usings', () =>
        {
            const directiveBlocks = [
                [
                    UsingStatement.parse('#if DEBUG'),
                    UsingStatement.parse('using System.Diagnostics;'),
                    UsingStatement.parse('#endif'),
                ],
            ];

            const result = handler.recombine([], directiveBlocks);

            assert.strictEqual(result.length, 3);
        });

        test('should handle empty directive blocks', () =>
        {
            const sortedUsings = [
                UsingStatement.parse('using System;'),
            ];

            const result = handler.recombine(sortedUsings, []);

            assert.strictEqual(result.length, 1);
        });

        test('should handle multiple directive blocks', () =>
        {
            const sortedUsings = [
                UsingStatement.parse('using System;'),
            ];
            const directiveBlocks = [
                [
                    UsingStatement.parse('#if DEBUG'),
                    UsingStatement.parse('using System.Diagnostics;'),
                    UsingStatement.parse('#endif'),
                ],
                [
                    UsingStatement.parse('#if UNITY'),
                    UsingStatement.parse('using Unity.Core;'),
                    UsingStatement.parse('#endif'),
                ],
            ];

            const result = handler.recombine(sortedUsings, directiveBlocks);

            assert.strictEqual(result.length, 7);
        });
    });

    suite('hasDirectives', () =>
    {
        test('should return true when directives present', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('#if DEBUG'),
                UsingStatement.parse('using System.Diagnostics;'),
                UsingStatement.parse('#endif'),
            ];

            assert.strictEqual(handler.hasDirectives(statements), true);
        });

        test('should return false when no directives', () =>
        {
            const statements = [
                UsingStatement.parse('using System;'),
                UsingStatement.parse('using System.Text;'),
            ];

            assert.strictEqual(handler.hasDirectives(statements), false);
        });

        test('should return false for empty input', () =>
        {
            assert.strictEqual(handler.hasDirectives([]), false);
        });
    });
});
