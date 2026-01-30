import * as assert from 'assert';
import * as path from 'path';
import * as vs from 'vscode';
import { CSharpDocument, LineEndingType } from '../../domain/CSharpDocument';
import { FormatOptions } from '../../domain/FormatOptions';
import { UsingBlockOrganizer } from '../../services/UsingBlockOrganizer';
import { MockDiagnosticProvider } from '../mocks/MockDiagnosticProvider';

suite('UsingBlockOrganizer', () =>
{
    test('returns noChange when no using blocks are found', () =>
    {
        const content = [
            'namespace MyApp;',
            '',
            'public class Foo { }',
        ].join('\n');

        const document = new CSharpDocument(
            vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
            content,
            LineEndingType.LF,
        );
        const config = FormatOptions.default();
        const provider = new MockDiagnosticProvider([]);
        const organizer = new UsingBlockOrganizer(config, provider);

        const result = organizer.organize(document);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.hasChanges(), false);
        assert.strictEqual(result.message, 'No changes needed');
    });

    test('returns noChange when processing yields identical content', () =>
    {
        const content = [
            'using System;',
            'using Zeta;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const document = new CSharpDocument(
            vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
            content,
            LineEndingType.LF,
        );
        const config = new FormatOptions('System', false, true, false, 'bottom');
        const provider = new MockDiagnosticProvider([]);
        const organizer = new UsingBlockOrganizer(config, provider);

        const result = organizer.organize(document);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.hasChanges(), false);
        assert.strictEqual(result.message, 'No changes needed');
    });

    test('processes multiple using blocks in a single document', () =>
    {
        const content = [
            'using Zeta;',
            'using System;',
            '',
            'namespace MyApp {',
            '    using Foo;',
            '    using Bar;',
            '    class Foo { }',
            '}',
        ].join('\n');

        const document = new CSharpDocument(
            vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
            content,
            LineEndingType.LF,
        );
        const config = new FormatOptions('System', false, true, false, 'bottom');
        const provider = new MockDiagnosticProvider([]);
        const organizer = new UsingBlockOrganizer(config, provider);

        const result = organizer.organize(document);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.hasChanges(), true);

        const topBlockSystemIndex = result.content.indexOf('using System;');
        const topBlockZetaIndex = result.content.indexOf('using Zeta;');
        assert.ok(topBlockSystemIndex < topBlockZetaIndex, 'System should be before Zeta in the top block');

        const namespaceBlock = result.content.slice(result.content.indexOf('namespace MyApp'));
        const barIndex = namespaceBlock.indexOf('using Bar;');
        const fooIndex = namespaceBlock.indexOf('using Foo;');
        assert.ok(barIndex < fooIndex, 'Bar should be before Foo inside namespace block');
    });

    test('does not add blank line between XML doc comments and class declaration', () =>
    {
        // Regression test: the replace() method was incorrectly adding a blank line
        // before "public class" when XML doc comments preceded the class declaration.
        // This happened because a global regex matched lines starting with "//"
        // (including XML doc comments like "/// </summary>") followed by code keywords.
        const content = [
            'using System.Text;',
            '',
            'using MyCompany.Common.Config;',
            'using MyCompany.Common.Files;',
            'using MyCompany.Common.Logging;',
            '',
            'using NSubstitute;',
            '',
            'using Xyz.Abc;',
            '',
            'namespace MyCompany.Yeah.Wow;',
            '',
            '/// <summary>',
            '/// A thing, that does stuff!!',
            '/// </summary>',
            'public class Thing : OtherThing;',
        ].join('\n');

        const document = new CSharpDocument(
            vs.Uri.file(path.join(process.cwd(), 'src', 'test.cs')),
            content,
            LineEndingType.LF,
        );
        const config = new FormatOptions('System', false, true, false, 'bottom');
        const provider = new MockDiagnosticProvider([]);
        const organizer = new UsingBlockOrganizer(config, provider);

        const result = organizer.organize(document);

        // The key assertion: there should NOT be a blank line between /// </summary> and public class
        assert.ok(
            !result.content.includes('/// </summary>\n\npublic class'),
            'Should not add blank line between XML doc comment and class declaration',
        );
        // Verify the correct format is preserved
        assert.ok(
            result.content.includes('/// </summary>\npublic class'),
            'Should preserve single newline between XML doc comment and class declaration',
        );
    });
});
