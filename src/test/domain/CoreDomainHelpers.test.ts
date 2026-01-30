import * as assert from 'assert';
import * as path from 'path';
import * as vs from 'vscode';
import { CSharpDocument, LineEndingType } from '../../domain/CSharpDocument';
import { FormatOptions } from '../../domain/FormatOptions';
import { OrganizationResult } from '../../domain/OrganizationResult';

suite('Core domain helpers', () =>
{
    test('CSharpDocument.fromTextEditor captures content and line endings', () =>
    {
        const editor = {
            document: {
                uri: vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
                eol: vs.EndOfLine.LF,
                getText: () => 'line1\nline2',
                fileName: 'Fake.cs',
            },
        } as unknown as vs.TextEditor;

        const document = CSharpDocument.fromTextEditor(editor);

        assert.strictEqual(document.lineEnding, LineEndingType.LF);
        assert.strictEqual(document.getLineEndingString(), '\n');
        assert.deepStrictEqual(document.getLines(), ['line1', 'line2']);
    });

    test('OrganizationResult helpers return expected status', () =>
    {
        const success = OrganizationResult.success('content');
        const error = OrganizationResult.error('boom');
        const noChange = OrganizationResult.noChange();

        assert.strictEqual(success.success, true);
        assert.strictEqual(success.hasChanges(), true);

        assert.strictEqual(error.success, false);
        assert.strictEqual(error.message, 'boom');
        assert.strictEqual(error.hasChanges(), false);

        assert.strictEqual(noChange.success, true);
        assert.strictEqual(noChange.message, 'No changes needed');
        assert.strictEqual(noChange.hasChanges(), false);
    });

    test('FormatOptions default values are consistent', () =>
    {
        const config = FormatOptions.default();

        assert.strictEqual(config.sortOrder, 'System');
        assert.strictEqual(config.splitGroups, true);
        assert.strictEqual(config.disableUnusedUsingsRemoval, false);
        assert.strictEqual(config.processUsingsInPreprocessorDirectives, false);
        assert.strictEqual(config.usingStaticPlacement, 'bottom');
    });

    test('FormatOptions.fromWorkspaceConfig reads workspace values', () =>
    {
        const originalGetConfiguration = vs.workspace.getConfiguration;
        (vs.workspace as { getConfiguration: typeof vs.workspace.getConfiguration }).getConfiguration = () =>
        {
            const overrides: Record<string, unknown> = {
                'sortOrder': 'Alphabetical',
                'splitGroups': false,
                'disableUnusedUsingsRemoval': true,
                'processUsingsInPreprocessorDirectives': true,
                'usingStaticPlacement': 'intermixed',
            };

            const config = {
                get: <T>(key: string, defaultValue?: T) =>
                {
                    if (key in overrides)
                    {
                        return overrides[key] as T;
                    }
                    return defaultValue as T;
                },
                has: () => true,
                inspect: () => undefined,
                update: () => Promise.resolve(),
            };

            return config as unknown as vs.WorkspaceConfiguration;
        };

        try
        {
            const config = FormatOptions.fromWorkspaceConfig();

            assert.strictEqual(config.sortOrder, 'Alphabetical');
            assert.strictEqual(config.splitGroups, false);
            assert.strictEqual(config.disableUnusedUsingsRemoval, true);
            assert.strictEqual(config.processUsingsInPreprocessorDirectives, true);
            assert.strictEqual(config.usingStaticPlacement, 'intermixed');
        }
        finally
        {
            (vs.workspace as { getConfiguration: typeof vs.workspace.getConfiguration }).getConfiguration = originalGetConfiguration;
        }
    });
});
