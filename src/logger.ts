import * as vs from "vscode";

// Create and export the output channel
export const outputChannel =
    vs.window.createOutputChannel("C# Organize Usings");

export function log(message: string): void {
    outputChannel.appendLine(message);
}