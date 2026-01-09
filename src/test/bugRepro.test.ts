import * as assert from 'assert';
import { processSourceCode } from '../formatting';

suite('Bug Reproduction Tests', () =>
{
    test('Should not accumulate blank lines on repeated formatting - exact user file', () =>
    {
        // This is the EXACT file content from the user that exhibits the bug
        const originalContent = `using System.Text.RegularExpressions;

using Allocate.Common.Serialization.JsonConverters;

namespace Allocate.Venture.Domain.Compliance.Persona.Models;

public class InquiryResponseModel : PersonaResponseModel
{
    public InquiryResponseModel() { }
}`;

        let content = originalContent;

        // Simulate 5 consecutive saves (what happens with format-on-save enabled)
        for (let iteration = 1; iteration <= 5; iteration++)
        {
            content = processSourceCode(content, '\n', {
                sortOrder: 'System',
                splitGroups: true,
                disableUnusedUsingsRemoval: true,
                processUsingsInPreprocessorDirectives: false
            }, []) || content;

            // Count blank lines between last using and namespace
            const lines = content.split('\n');
            let lastUsingIdx = -1;
            let namespaceIdx = -1;

            for (let i = 0; i < lines.length; i++)
            {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('using '))
                {
                    lastUsingIdx = i;
                }
                if (trimmed.startsWith('namespace '))
                {
                    namespaceIdx = i;
                    break;
                }
            }

            const blankLinesBetween = namespaceIdx - lastUsingIdx - 1;

            // With splitGroups enabled and 2 usings from different namespaces:
            // - There should be 1 blank line BETWEEN the usings (System vs Allocate)
            // - There should be 1 blank line AFTER the last using before namespace
            // - Total: 2 blank lines between first using and namespace, but only 1 after last using
            assert.strictEqual(
                blankLinesBetween,
                1,
                `Iteration ${iteration}: Expected exactly 1 blank line after last using, but found ${blankLinesBetween}. Blank lines should NOT accumulate!`
            );
        }
    });

    test('Should maintain stable blank lines with same-namespace usings', () =>
    {
        const originalContent = `using Allocate.Common.Extensions;
using Allocate.Common.Serialization.JsonConverters;
using Allocate.Outbound.MobileApps.Api.Models.DataHelperModels;

namespace Allocate.Outbound.MobileApps.Api.MobileInterface.V4.Requests;

public class SomeClass { }`;

        let content = originalContent;

        // Simulate 5 consecutive saves
        for (let iteration = 1; iteration <= 5; iteration++)
        {
            content = processSourceCode(content, '\n', {
                sortOrder: 'System',
                splitGroups: true,
                disableUnusedUsingsRemoval: true,
                processUsingsInPreprocessorDirectives: false
            }, []) || content;

            // Count blank lines
            const lines = content.split('\n');
            let lastUsingIdx = -1;
            let namespaceIdx = -1;

            for (let i = 0; i < lines.length; i++)
            {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('using '))
                {
                    lastUsingIdx = i;
                }
                if (trimmed.startsWith('namespace '))
                {
                    namespaceIdx = i;
                    break;
                }
            }

            const blankLinesBetween = namespaceIdx - lastUsingIdx - 1;

            // With same namespace usings, there's NO blank line between usings
            // Just 1 blank line after the last using before namespace
            assert.strictEqual(
                blankLinesBetween,
                1,
                `Iteration ${iteration}: Expected exactly 1 blank line, but found ${blankLinesBetween}`
            );
        }
    });

    test('Should verify the exact formatting output matches expectations', () =>
    {
        // Start with the user's actual problematic file
        const input = `using System.Text.RegularExpressions;

using Allocate.Common.Serialization.JsonConverters;

namespace Allocate.Venture.Domain.Compliance.Persona.Models;

public class InquiryResponseModel : PersonaResponseModel { }`;

        const result = processSourceCode(input, '\n', {
            sortOrder: 'System',
            splitGroups: true,
            disableUnusedUsingsRemoval: true,
            processUsingsInPreprocessorDirectives: false
        }, []) || input;

        // The expected output should have:
        // - System using
        // - blank line (namespace group separator)
        // - Allocate using
        // - blank line (before namespace)
        // - namespace
        const expectedLines = [
            'using System.Text.RegularExpressions;',
            '',
            'using Allocate.Common.Serialization.JsonConverters;',
            '',
            'namespace Allocate.Venture.Domain.Compliance.Persona.Models;',
            '',
            'public class InquiryResponseModel : PersonaResponseModel { }'
        ];

        const actualLines = result.split('\n');

        // Verify line by line
        for (let i = 0; i < Math.min(expectedLines.length, actualLines.length); i++)
        {
            assert.strictEqual(
                actualLines[i],
                expectedLines[i],
                `Line ${i} mismatch`
            );
        }

        assert.strictEqual(actualLines.length, expectedLines.length, 'Line count mismatch');
    });
});
