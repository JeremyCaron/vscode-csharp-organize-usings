/**
 * Compatibility layer that provides the same exports as the old formatting.ts
 * but implemented using the new OOP architecture.
 * This allows tests to continue working without modification.
 */

import * as vs from 'vscode';
import { IFormatOptions } from './interfaces/IFormatOptions';
import { UsingStatement } from './domain/UsingStatement';
import { UsingBlock } from './domain/UsingBlock';
import { FormatOptions } from './domain/FormatOptions';
import { UsingSorter } from './processors/UsingSorter';
import { UsingGroupSplitter } from './processors/UsingGroupSplitter';
import { UnusedUsingRemover } from './processors/UnusedUsingRemover';
import { VsCodeDiagnosticProvider } from './processors/VsCodeDiagnosticProvider';
import { UsingBlockExtractor } from './services/UsingBlockExtractor';
import { UsingBlockProcessor } from './processors/UsingBlockProcessor';

// Export the regex for tests
export const USING_REGEX = /^(?:(?:[\n]|[\r\n])*(?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|(?:\/\/.*(?:[\n]|[\r\n])*)*(?:using\s+(?!.*\s+=\s+)(?:\[.*?\]|\w+(?:\.\w+)*);|using\s+\w+\s*=\s*[\w.]+;))(?:[\n]|[\r\n])*)+/gm;

/**
 * Compatibility wrapper for sortUsings function
 */
export function sortUsings(usings: string[], options: IFormatOptions): void {
    const config = new FormatOptions(
        options.sortOrder,
        options.splitGroups,
        options.disableUnusedUsingsRemoval,
        options.processUsingsInPreprocessorDirectives
    );

    const statements = usings.map(line => UsingStatement.parse(line));
    const sorter = new UsingSorter(config);
    const sorted = sorter.sort(statements);

    // Update the original array in place (matching old behavior)
    usings.length = 0;
    usings.push(...sorted.map(s => s.toString()));
}

/**
 * Compatibility wrapper for splitGroups function
 */
export function splitGroups(usings: string[]): void {
    const statements = usings.map(line => UsingStatement.parse(line));
    const grouper = new UsingGroupSplitter();
    const grouped = grouper.split(statements);

    // Update the original array in place (matching old behavior)
    usings.length = 0;
    usings.push(...grouped.map(s => s.toString()));
}

/**
 * Compatibility wrapper for removeUnnecessaryUsings function
 * This must match the old behavior exactly - filtering by array index
 */
export function removeUnnecessaryUsings(
    diagnostics: vs.Diagnostic[],
    usings: string[],
    offsetFromFileStart: number,
    processUsingsInPreprocessorDirectives: boolean = false
): void {
    // Filter diagnostics to get only unused using diagnostics
    const unusedDiagnostics = diagnostics.filter(diagnostic => {
        // OmniSharp format
        if (diagnostic.source === 'csharp' && diagnostic.code?.toString() === 'CS8019') {
            return true;
        }
        // Roslyn format
        if (typeof diagnostic.code === 'object' &&
            diagnostic.code !== null &&
            'value' in diagnostic.code) {
            const value = (diagnostic.code as any).value;
            return value === 'IDE0005' || value === 'CS8019';
        }
        return false;
    });

    if (unusedDiagnostics.length === 0) {
        return;
    }

    // Get line numbers from diagnostics
    const unnecessaryLineIndexes = new Set<number>();
    for (const diagnostic of unusedDiagnostics) {
        const { start, end } = diagnostic.range;
        if (start.line !== end.line) {
            for (let i = start.line; i <= end.line; i++) {
                unnecessaryLineIndexes.add(i - offsetFromFileStart);
            }
        } else {
            unnecessaryLineIndexes.add(start.line - offsetFromFileStart);
        }
    }

    // Filter out preprocessor blocks if configured
    if (!processUsingsInPreprocessorDirectives) {
        const preprocessorRanges = findPreprocessorRanges(usings);
        const filtered = new Set<number>();
        for (const lineNum of unnecessaryLineIndexes) {
            if (!isInPreprocessorBlock(lineNum, preprocessorRanges)) {
                filtered.add(lineNum);
            }
        }
        unnecessaryLineIndexes.clear();
        filtered.forEach(n => unnecessaryLineIndexes.add(n));
    }

    // Filter out the unnecessary usings by their index
    const filteredUsings = usings.filter((_, index) => !unnecessaryLineIndexes.has(index));

    // Update the original array in place (matching old behavior)
    usings.length = 0;
    usings.push(...filteredUsings);
}

function findPreprocessorRanges(usings: string[]): Array<vs.Range> {
    const result: vs.Range[] = [];
    const stack: { directive: string; lineIndex: number }[] = [];

    for (let lineIndex = 0; lineIndex < usings.length; lineIndex++) {
        const line = usings[lineIndex].trim();
        const match = line.match(/^#(if|endif|region|endregion)\b/);

        if (match) {
            const directive = match[1];

            if (directive === 'if' || directive === 'region') {
                stack.push({ directive, lineIndex });
            } else if ((directive === 'endif' || directive === 'endregion') && stack.length > 0) {
                const lastDirective = stack.pop();
                if (
                    (directive === 'endif' && lastDirective?.directive === 'if') ||
                    (directive === 'endregion' && lastDirective?.directive === 'region')
                ) {
                    const startPosition = new vs.Position(lastDirective.lineIndex, 0);
                    const endPosition = new vs.Position(lineIndex, 0);
                    result.push(new vs.Range(startPosition, endPosition));
                }
            }
        }
    }

    return result;
}

function isInPreprocessorBlock(lineIndex: number, ranges: Array<vs.Range>): boolean {
    for (const range of ranges) {
        if (lineIndex >= range.start.line && lineIndex <= range.end.line) {
            return true;
        }
    }
    return false;
}

/**
 * Compatibility wrapper for removeDuplicates function
 */
export function removeDuplicates(usings: string[]): void {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const using of usings) {
        const stmt = UsingStatement.parse(using);
        const key = stmt.getDeduplicationKey();

        if (key && seen.has(key)) {
            continue; // Skip duplicate
        }

        if (key) {
            seen.add(key);
        }

        result.push(using);
    }

    usings.length = 0;
    usings.push(...result);
}

/**
 * Compatibility wrapper for processSourceCode function
 * This is used by integration tests
 */
export function processSourceCode(
    sourceCodeText: string,
    endOfline: string,
    options: IFormatOptions,
    diagnostics: vs.Diagnostic[]
): string {
    // Create a mock diagnostic provider
    class MockDiagnosticProvider {
        getUnusedUsingDiagnostics() {
            return diagnostics.filter(diagnostic => {
                // OmniSharp format
                if (diagnostic.source === 'csharp' && diagnostic.code?.toString() === 'CS8019') {
                    return true;
                }
                // Roslyn format
                if (typeof diagnostic.code === 'object' &&
                    diagnostic.code !== null &&
                    'value' in diagnostic.code) {
                    const value = (diagnostic.code as any).value;
                    return value === 'IDE0005' || value === 'CS8019';
                }
                return false;
            });
        }
    }

    const config = new FormatOptions(
        options.sortOrder,
        options.splitGroups,
        options.disableUnusedUsingsRemoval,
        options.processUsingsInPreprocessorDirectives
    );

    const diagnosticProvider = new MockDiagnosticProvider();

    // Use the extractor to process blocks
    const extractor = new UsingBlockExtractor();
    const blocks = extractor.extract(sourceCodeText, endOfline);

    if (blocks.size === 0) {
        return '';
    }

    // Process each block
    for (const [originalText, block] of blocks) {
        const processor = new UsingBlockProcessor(block, config, diagnosticProvider as any);
        processor.process();
    }

    // Replace blocks in the source code
    const newContent = extractor.replace(sourceCodeText, endOfline, blocks);

    // Return empty string if no changes (matching old behavior)
    return (newContent !== sourceCodeText) ? newContent : '';
}
