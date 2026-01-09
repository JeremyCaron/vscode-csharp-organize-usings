import * as vs from 'vscode';
import { logToOutputChannel } from "./logger";
import { CSharpDocument } from './domain/CSharpDocument';
import { FormatOptions } from './domain/FormatOptions';
import { UsingBlockOrganizer } from './services/UsingBlockOrganizer';
import { VsCodeDiagnosticProvider } from './processors/VsCodeDiagnosticProvider';

/**
 * Entry point for organizing usings in the editor.
 * This is the new, refactored implementation using OOP principles.
 */
export async function organizeUsingsInEditor(
    editor: vs.TextEditor,
    edit: vs.TextEditorEdit
): Promise<void> {
    try {
        // Create domain objects
        const document = new CSharpDocument(editor);
        const config = FormatOptions.fromWorkspaceConfig();
        const diagnosticProvider = new VsCodeDiagnosticProvider(document.uri);

        // Create and execute the organizer
        const organizer = new UsingBlockOrganizer(config, diagnosticProvider);
        const result = organizer.organize(document);

        // Handle the result
        if (!result.success) {
            vs.window.showErrorMessage(result.message);
            logToOutputChannel("Error: " + result.message);
            return;
        }

        // Apply changes if any
        if (result.hasChanges()) {
            const fullRange = new vs.Range(
                new vs.Position(0, 0),
                editor.document.lineAt(editor.document.lineCount - 1).range.end
            );
            edit.delete(fullRange);
            edit.insert(new vs.Position(0, 0), result.content);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vs.window.showErrorMessage(`Failed to organize usings: ${message}`);
        logToOutputChannel("Error: " + message);
    }
}
