import * as assert from 'assert';
import * as path from 'path';
import * as vs from 'vscode';
import { CodeActionProvider } from '../../codeActionProvider';
import { activate } from '../../extension';

suite('Extension activation', () =>
{
    let originalRegisterCodeActionsProvider: typeof vs.languages.registerCodeActionsProvider;
    let originalRegisterTextEditorCommand: typeof vs.commands.registerTextEditorCommand;

    setup(() =>
    {
        originalRegisterCodeActionsProvider = vs.languages.registerCodeActionsProvider;
        originalRegisterTextEditorCommand = vs.commands.registerTextEditorCommand;
    });

    teardown(() =>
    {
        (vs.languages as { registerCodeActionsProvider: typeof vs.languages.registerCodeActionsProvider })
            .registerCodeActionsProvider = originalRegisterCodeActionsProvider;
        (vs.commands as { registerTextEditorCommand: typeof vs.commands.registerTextEditorCommand })
            .registerTextEditorCommand = originalRegisterTextEditorCommand;
    });

    test('registers code action provider and organize command', () =>
    {
        const calls: {
            selector?: vs.DocumentSelector;
            options?: vs.CodeActionProviderMetadata;
            commandId?: string;
        } = {};

        (vs.languages as { registerCodeActionsProvider: typeof vs.languages.registerCodeActionsProvider })
            .registerCodeActionsProvider = (
                selector: vs.DocumentSelector,
                _provider: vs.CodeActionProvider,
                options?: vs.CodeActionProviderMetadata,
            ) =>
            {
                calls.selector = selector;
                calls.options = options;
                return new vs.Disposable(() => {});
            };

        (vs.commands as { registerTextEditorCommand: typeof vs.commands.registerTextEditorCommand })
            .registerTextEditorCommand = (command: string) =>
            {
                calls.commandId = command;
                return new vs.Disposable(() => {});
            };

        const context = { subscriptions: [] } as unknown as vs.ExtensionContext;
        activate(context);

        assert.strictEqual(calls.commandId, 'csharpOrganizeUsings.organize');
        assert.ok(calls.selector);
        assert.deepStrictEqual(
            calls.options?.providedCodeActionKinds,
            [vs.CodeActionKind.SourceOrganizeImports],
        );
        assert.strictEqual(context.subscriptions.length, 3);
    });

    test('organize command leaves editor unchanged when no using blocks', async () =>
    {
        let commandCallback: ((editor: vs.TextEditor, edit: vs.TextEditorEdit) => void | Thenable<void>) | undefined;

        (vs.languages as { registerCodeActionsProvider: typeof vs.languages.registerCodeActionsProvider })
            .registerCodeActionsProvider = (
                _selector: vs.DocumentSelector,
                _provider: vs.CodeActionProvider,
            ) => new vs.Disposable(() => {});

        (vs.commands as { registerTextEditorCommand: typeof vs.commands.registerTextEditorCommand })
            .registerTextEditorCommand = (
                _command: string,
                callback: (editor: vs.TextEditor, edit: vs.TextEditorEdit) => void | Thenable<void>,
            ) =>
            {
                commandCallback = callback;
                return new vs.Disposable(() => {});
            };

        const context = { subscriptions: [] } as unknown as vs.ExtensionContext;
        activate(context);
        assert.ok(commandCallback, 'Expected organize command handler to be registered');

        const originalGetDiagnostics = vs.languages.getDiagnostics;
        const originalGetConfiguration = vs.workspace.getConfiguration;
        (vs.languages as { getDiagnostics: typeof vs.languages.getDiagnostics }).getDiagnostics = () => [];
        (vs.workspace as { getConfiguration: typeof vs.workspace.getConfiguration }).getConfiguration = () =>
        {
            const config = {
                get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
                has: () => true,
                inspect: () => undefined,
                update: () => Promise.resolve(),
            };

            return config as unknown as vs.WorkspaceConfiguration;
        };

        try
        {
            let deleteCalled = false;
            let insertCalled = false;

            const fakeDocument = {
                uri: vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
                eol: vs.EndOfLine.LF,
                getText: () => 'namespace MyApp;\n\npublic class Foo {}',
                lineCount: 3,
                lineAt: () =>
                {
                    return {
                        range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 0)),
                    };
                },
                fileName: 'NoUsings.cs',
            } as unknown as vs.TextDocument;

            const fakeEditor = { document: fakeDocument } as unknown as vs.TextEditor;
            const fakeEdit = {
                delete: () => { deleteCalled = true; },
                insert: () => { insertCalled = true; },
            } as unknown as vs.TextEditorEdit;

            await commandCallback?.(fakeEditor, fakeEdit);

            assert.strictEqual(deleteCalled, false);
            assert.strictEqual(insertCalled, false);
        }
        finally
        {
            (vs.languages as { getDiagnostics: typeof vs.languages.getDiagnostics }).getDiagnostics = originalGetDiagnostics;
            (vs.workspace as { getConfiguration: typeof vs.workspace.getConfiguration }).getConfiguration = originalGetConfiguration;
        }
    });

    test('code action provider emits organize imports action', () =>
    {
        const provider = new CodeActionProvider();
        const document = {
            uri: vs.Uri.file(path.join(process.cwd(), 'src', 'utils.ts')),
        } as unknown as vs.TextDocument;

        const actions = provider.provideCodeActions(
            document,
            new vs.Range(new vs.Position(0, 0), new vs.Position(0, 0)),
            {} as vs.CodeActionContext,
            {} as vs.CancellationToken,
        );

        assert.ok(Array.isArray(actions));
        const actionList = actions as vs.CodeAction[];
        assert.strictEqual(actionList.length, 1);
        assert.strictEqual(actionList[0].command?.command, 'csharpOrganizeUsings.organize');
    });
});
