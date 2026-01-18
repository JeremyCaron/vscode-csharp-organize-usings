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
export class CSharpDocument
{
    public readonly filePath: string;
    public readonly content: string;
    public readonly lineEnding: LineEndingType;
    public readonly projectFile: string;
    public readonly uri: vs.Uri;

    constructor(
        uri: vs.Uri,
        content: string,
        lineEnding: LineEndingType,
    )
    {
        this.uri = uri;
        this.filePath = uri.fsPath;
        this.content = content;
        this.lineEnding = lineEnding;
        this.projectFile = getCurrentProjectFile(this.filePath);
    }

    /**
     * Creates a CSharpDocument from a VS Code TextEditor
     */
    static fromTextEditor(editor: vs.TextEditor): CSharpDocument
    {
        const lineEnding = editor.document.eol === vs.EndOfLine.LF
            ? LineEndingType.LF
            : LineEndingType.CRLF;

        return new CSharpDocument(
            editor.document.uri,
            editor.document.getText(),
            lineEnding,
        );
    }

    /**
     * Gets the lines in this document
     */
    public getLines(): string[]
    {
        return this.content.split(this.getLineEndingString());
    }

    /**
     * Gets the line ending string for this document
     */
    public getLineEndingString(): string
    {
        return this.lineEnding === LineEndingType.LF ? '\n' : '\r\n';
    }

    /**
     * Creates a new document with different content
     */
    public withContent(newContent: string): string
    {
        return newContent;
    }
}
