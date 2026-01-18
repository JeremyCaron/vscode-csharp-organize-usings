import * as vs from 'vscode';
import { outputChannel, logToOutputChannel } from './logging/logger';
import { CodeActionProvider } from './codeActionProvider';
import { CSharpDocument } from './domain/CSharpDocument';
import { FormatOptions } from './domain/FormatOptions';
import { UsingBlockOrganizer } from './services/UsingBlockOrganizer';
import { VsCodeDiagnosticProvider } from './vscode/VsCodeDiagnosticProvider';

/**
 * Entry point for organizing usings in the editor.
 */
async function organizeEditorUsings(
    editor: vs.TextEditor,
    edit: vs.TextEditorEdit,
): Promise<void>
{
    // Immediate notification to confirm function is called
    logToOutputChannel('='.repeat(80));
    logToOutputChannel('organizeEditorUsings: FUNCTION CALLED');
    logToOutputChannel(`File: ${editor.document.fileName}`);
    logToOutputChannel(`Line count: ${editor.document.lineCount}`);
    logToOutputChannel('organizeEditorUsings: Starting...');
    try
    {
        // Create domain objects
        logToOutputChannel('organizeEditorUsings: Creating domain objects...');
        const document = CSharpDocument.fromTextEditor(editor);
        const config = FormatOptions.fromWorkspaceConfig();
        logToOutputChannel(`organizeEditorUsings: Config loaded, processUsingsInPreprocessorDirectives=${config.processUsingsInPreprocessorDirectives}`);
        const diagnosticProvider = new VsCodeDiagnosticProvider(document.uri);
        logToOutputChannel('organizeEditorUsings: Diagnostic provider created');

        // Create and execute the organizer
        logToOutputChannel('organizeEditorUsings: Creating organizer...');
        const organizer = new UsingBlockOrganizer(config, diagnosticProvider);
        logToOutputChannel('organizeEditorUsings: Calling organize...');
        const result = organizer.organize(document);
        logToOutputChannel('organizeEditorUsings: Organize complete');

        // Handle the result
        if (!result.success)
        {
            vs.window.showErrorMessage(result.message);
            logToOutputChannel('Error: ' + result.message);
            return;
        }

        // Apply changes if any
        if (result.hasChanges())
        {
            logToOutputChannel('organizeEditorUsings: Applying changes...');
            const fullRange = new vs.Range(
                new vs.Position(0, 0),
                editor.document.lineAt(editor.document.lineCount - 1).range.end,
            );
            edit.delete(fullRange);
            edit.insert(new vs.Position(0, 0), result.content);
            logToOutputChannel('organizeEditorUsings: Changes applied');
        }
        else
        {
            logToOutputChannel('organizeEditorUsings: No changes needed');
        }
        logToOutputChannel('organizeEditorUsings: Complete');
    }
    catch (error)
    {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : '';
        vs.window.showErrorMessage(`Failed to organize usings: ${message}`);
        logToOutputChannel('Error: ' + message);
        logToOutputChannel('Stack: ' + stack);
    }
}

export function activate(context: vs.ExtensionContext): void
{
    // Register the CodeActionProvider for C# files
    const codeActionProvider = vs.languages.registerCodeActionsProvider(
        { language: 'csharp', scheme: 'file' },
        new CodeActionProvider(),
        {
            providedCodeActionKinds: [vs.CodeActionKind.SourceOrganizeImports],
        },
    );

    var command = vs.commands.registerTextEditorCommand(
        'csharpOrganizeUsings.organize',
        organizeEditorUsings,
    );

    logToOutputChannel('Extension activated');

    context.subscriptions.push(command, codeActionProvider, outputChannel);
}
