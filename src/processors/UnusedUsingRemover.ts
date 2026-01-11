import * as vs from 'vscode';
import { UsingStatement } from '../domain/UsingStatement';
import { UsingBlock } from '../domain/UsingBlock';
import { FormatOptions } from '../domain/FormatOptions';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import { logToOutputChannel } from '../logging/logger';

/**
 * Removes unused using statements based on compiler diagnostics
 */
export class UnusedUsingRemover
{
    private readonly diagnosticProvider: IDiagnosticProvider;
    private readonly config: FormatOptions;

    constructor(diagnosticProvider: IDiagnosticProvider, config: FormatOptions)
    {
        this.diagnosticProvider = diagnosticProvider;
        this.config = config;
    }

    /**
     * Removes unused usings from a block
     */
    public remove(block: UsingBlock): UsingStatement[]
    {
        if (this.config.disableUnusedUsingsRemoval)
        {
            logToOutputChannel(`      Unused using removal is disabled`);
            return Array.from(block.getStatements());
        }

        const diagnostics = this.diagnosticProvider.getUnusedUsingDiagnostics();
        logToOutputChannel(`      Found ${diagnostics.length} unused using diagnostic(s) from language server`);

        const unnecessaryLines = this.getUnnecessaryLineNumbers(diagnostics, block);

        // Filter out preprocessor blocks if configured
        const linesToRemove = this.config.processUsingsInPreprocessorDirectives
            ? unnecessaryLines
            : this.filterPreprocessorLines(unnecessaryLines, block);

        if (linesToRemove.size > 0)
        {
            logToOutputChannel(`      Removing ${linesToRemove.size} unused using statement(s) at line indices: ${Array.from(linesToRemove).join(', ')}`);
        }

        return block.getStatements()
            .filter((_, index) => !linesToRemove.has(index));
    }

    private getUnnecessaryLineNumbers(diagnostics: vs.Diagnostic[], block: UsingBlock): Set<number>
    {
        const lineNumbers = new Set<number>();

        // Account for leading content: diagnostics are relative to the file, but block.startLine
        // points to the start of the block including leading content, and the statements array
        // doesn't include leading content. So we need to offset by the leading content length.
        const leadingContentLength = block.getLeadingContent().length;

        for (const diagnostic of diagnostics)
        {
            const { start, end } = diagnostic.range;

            // Handle multi-line diagnostics
            if (start.line !== end.line)
            {
                for (let i = start.line; i <= end.line; i++)
                {
                    lineNumbers.add(i - block.startLine - leadingContentLength);
                }
            }
            else
            {
                lineNumbers.add(start.line - block.startLine - leadingContentLength);
            }
        }

        return lineNumbers;
    }

    private filterPreprocessorLines(unnecessaryLines: Set<number>, block: UsingBlock): Set<number>
    {
        const preprocessorRanges = this.findPreprocessorRanges(block);
        const filtered = new Set<number>();

        for (const lineNum of unnecessaryLines)
        {
            if (!this.isInPreprocessorBlock(lineNum, preprocessorRanges))
            {
                filtered.add(lineNum);
            }
        }

        return filtered;
    }

    private findPreprocessorRanges(block: UsingBlock): Array<vs.Range>
    {
        const result: vs.Range[] = [];
        const stack: { directive: string; lineIndex: number }[] = [];
        const statements = block.getStatements();

        for (let lineIndex = 0; lineIndex < statements.length; lineIndex++)
        {
            const stmt = statements[lineIndex];
            if (!stmt.isPreprocessorDirective)
            {
                continue;
            }

            const line = stmt.toString().trim();
            const match = line.match(/^#(if|endif|region|endregion)\b/);

            if (match)
            {
                const directive = match[1];

                if (directive === 'if' || directive === 'region')
                {
                    stack.push({ directive, lineIndex });
                }
                else if ((directive === 'endif' || directive === 'endregion') && stack.length > 0)
                {
                    const lastDirective = stack.pop();
                    if (
                        (directive === 'endif' && lastDirective?.directive === 'if') ||
                        (directive === 'endregion' && lastDirective?.directive === 'region')
                    )
                    {
                        const startPosition = new vs.Position(lastDirective.lineIndex, 0);
                        const endPosition = new vs.Position(lineIndex, 0);
                        result.push(new vs.Range(startPosition, endPosition));
                    }
                }
            }
        }

        return result;
    }

    private isInPreprocessorBlock(lineIndex: number, ranges: Array<vs.Range>): boolean
    {
        for (const range of ranges)
        {
            if (lineIndex >= range.start.line && lineIndex <= range.end.line)
            {
                return true;
            }
        }
        return false;
    }
}
