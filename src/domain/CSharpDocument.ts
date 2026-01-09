import * as vs from 'vscode';
import { getCurrentProjectFile } from '../utils';

/**
 * Line ending types
 */
export enum LineEndingType {
    LF = 'LF',
    CRLF = 'CRLF'
}

/**
 * Represents a C# document being processed
 */
export class CSharpDocument {
    public readonly filePath: string;
    public readonly content: string;
    public readonly lineEnding: LineEndingType;
    public readonly projectFile: string;
    public readonly uri: vs.Uri;

    constructor(editor: vs.TextEditor) {
        this.filePath = editor.document.uri.fsPath;
        this.content = editor.document.getText();
        this.lineEnding = editor.document.eol === vs.EndOfLine.LF
            ? LineEndingType.LF
            : LineEndingType.CRLF;
        this.projectFile = getCurrentProjectFile(this.filePath);
        this.uri = editor.document.uri;
    }

    /**
     * Gets the lines in this document
     */
    public getLines(): string[] {
        return this.content.split(this.getLineEndingString());
    }

    /**
     * Gets the line ending string for this document
     */
    public getLineEndingString(): string {
        return this.lineEnding === LineEndingType.LF ? '\n' : '\r\n';
    }

    /**
     * Creates a new document with different content
     */
    public withContent(newContent: string): string {
        return newContent;
    }
}
