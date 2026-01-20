import * as vs from 'vscode';
import { logToOutputChannel } from './logging/logger';

export class CodeActionProvider implements vs.CodeActionProvider
{
    public provideCodeActions(
        document: vs.TextDocument,
        _range: vs.Range | vs.Selection,
        _context: vs.CodeActionContext,
        _token: vs.CancellationToken,
    ): vs.ProviderResult<vs.CodeAction[]>
    {
        logToOutputChannel('provideCodeActions called for ' + document.uri.fsPath);
        const codeActions: vs.CodeAction[] = [];

        // Create a code action to organize usings
        const organizeUsingsAction = new vs.CodeAction(
            'Organize C# Usings',
            vs.CodeActionKind.SourceOrganizeImports,
        );

        // Attach a command to the action that your extension will implement
        organizeUsingsAction.command = {
            command: 'csharpOrganizeUsings.organize',
            title: 'Organize C# Usings',
            tooltip: 'Removes unused & duplicate using statements and sorts them into blocks by namespace.',
        };

        codeActions.push(organizeUsingsAction);
        return codeActions;
    }
}
