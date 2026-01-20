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
            logToOutputChannel('      Unused using removal is disabled');
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

        logToOutputChannel(`      Block starts at file line ${block.startLine}, leading content length: ${leadingContentLength}`);

        // Get all file lines that have CS0246 errors - we should never remove these
        const allDiagnostics = this.diagnosticProvider.getAllDiagnostics();
        const linesWithCS0246 = new Set<number>();
        for (const diag of allDiagnostics)
        {
            const isCS0246 = diag.code?.toString() === 'CS0246' ||
                (typeof diag.code === 'object' && diag.code !== null && 'value' in diag.code &&
                 (diag.code as {value: string}).value === 'CS0246');
            if (isCS0246)
            {
                linesWithCS0246.add(diag.range.start.line);
            }
        }

        for (const diagnostic of diagnostics)
        {
            const { start, end } = diagnostic.range;

            // Handle multi-line diagnostics
            if (start.line !== end.line)
            {
                for (let i = start.line; i <= end.line; i++)
                {
                    // Skip lines that have CS0246 errors
                    if (linesWithCS0246.has(i))
                    {
                        logToOutputChannel(`      Skipping file line ${i} - has CS0246 error`);
                        continue;
                    }

                    const blockLineIndex = i - block.startLine - leadingContentLength;
                    logToOutputChannel(`      Diagnostic at file line ${i} -> block line index ${blockLineIndex}`);
                    lineNumbers.add(blockLineIndex);
                }
            }
            else
            {
                // Skip if this line has CS0246
                if (linesWithCS0246.has(start.line))
                {
                    logToOutputChannel(`      Skipping file line ${start.line} - has CS0246 error`);
                    continue;
                }

                const blockLineIndex = start.line - block.startLine - leadingContentLength;
                logToOutputChannel(`      Diagnostic at file line ${start.line} -> block line index ${blockLineIndex}`);
                lineNumbers.add(blockLineIndex);
            }
        }

        return lineNumbers;
    }

    private filterPreprocessorLines(unnecessaryLines: Set<number>, block: UsingBlock): Set<number>
    {
        const preprocessorRanges = this.findPreprocessorRanges(block);
        logToOutputChannel(`      Found ${preprocessorRanges.length} preprocessor range(s)`);
        for (const range of preprocessorRanges)
        {
            logToOutputChannel(`        Range: lines ${range.start.line} to ${range.end.line}`);
        }

        const filtered = new Set<number>();

        for (const lineNum of unnecessaryLines)
        {
            const inBlock = this.isInPreprocessorBlock(lineNum, preprocessorRanges);
            logToOutputChannel(`      Line ${lineNum}: inPreprocessorBlock=${inBlock}`);
            if (!inBlock)
            {
                filtered.add(lineNum);
            }
            else
            {
                logToOutputChannel(`        -> Preserving line ${lineNum} (in preprocessor block)`);
            }
        }

        return filtered;
    }

    private findPreprocessorRanges(block: UsingBlock): Array<vs.Range>
    {
        const result: vs.Range[] = [];
        const stack: { directive: string; lineIndex: number }[] = [];
        const statements = block.getStatements();

        logToOutputChannel(`      findPreprocessorRanges: ${statements.length} statements in block`);
        for (let i = 0; i < statements.length; i++)
        {
            const s = statements[i];
            logToOutputChannel(`        [${i}] isPreprocessor=${s.isPreprocessorDirective} "${s.toString()}"`);
        }

        for (let lineIndex = 0; lineIndex < statements.length; lineIndex++)
        {
            const stmt = statements[lineIndex];
            if (!stmt.isPreprocessorDirective)
            {
                continue;
            }

            const line = stmt.toString().trim();
            const match = line.match(/^#(if|elif|else|endif|region|endregion)\b/);

            if (match)
            {
                const directive = match[1];

                if (directive === 'if' || directive === 'region')
                {
                    stack.push({ directive, lineIndex });
                }
                else if (directive === 'elif' || directive === 'else')
                {
                    // #elif and #else close the previous block and start a new one
                    if (stack.length > 0 && stack[stack.length - 1].directive === 'if')
                    {
                        const lastDirective = stack[stack.length - 1];
                        const startPosition = new vs.Position(lastDirective.lineIndex, 0);
                        const endPosition = new vs.Position(lineIndex, 0);
                        result.push(new vs.Range(startPosition, endPosition));
                        // Update the stack to point to this new block start
                        stack[stack.length - 1] = { directive: 'if', lineIndex };
                    }
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
