import * as vs from "vscode";
import { outputChannel, logToOutputChannel } from "./logger";
import * as newFormatting from "./newFormatting";
import { CodeActionProvider } from "./codeActionProvider";

export function activate(context: vs.ExtensionContext): void 
{
    // Register the CodeActionProvider for C# files
    const codeActionProvider = vs.languages.registerCodeActionsProvider(
        { language: "csharp", scheme: "file" },
        new CodeActionProvider(),
        {
            providedCodeActionKinds: [vs.CodeActionKind.SourceOrganizeImports],
        }
    );

    var command = vs.commands.registerTextEditorCommand(
        "csharpOrganizeUsings.organize",
        newFormatting.organizeUsingsInEditor
    );

    logToOutputChannel("Extension activated");

    context.subscriptions.push(command, codeActionProvider, outputChannel);
}
