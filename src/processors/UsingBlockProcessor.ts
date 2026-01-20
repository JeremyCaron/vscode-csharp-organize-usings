import { UsingBlock } from '../domain/UsingBlock';
import { UsingStatement } from '../domain/UsingStatement';
import { FormatOptions } from '../domain/FormatOptions';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import { UnusedUsingRemover } from './UnusedUsingRemover';
import { UsingSorter } from './UsingSorter';
import { UsingGroupSplitter } from './UsingGroupSplitter';
import { PreprocessorDirectiveHandler } from './PreprocessorDirectiveHandler';
import { WhitespaceNormalizer } from './WhitespaceNormalizer';
import { logToOutputChannel } from '../logging/logger';

/**
 * Processes a using block through a pipeline of transformations.
 * Uses a fluent API pattern similar to LINQ in C#.
 */
export class UsingBlockProcessor
{
    private block: UsingBlock;
    private readonly config: FormatOptions;
    private readonly diagnosticProvider: IDiagnosticProvider;

    constructor(block: UsingBlock, config: FormatOptions, diagnosticProvider: IDiagnosticProvider)
    {
        this.block = block;
        this.config = config;
        this.diagnosticProvider = diagnosticProvider;
    }

    /**
     * Executes the full processing pipeline
     */
    public process(): UsingBlock
    {
        logToOutputChannel('  Pipeline Step 1: Remove unused using statements');
        this.removeUnused();

        logToOutputChannel('  Pipeline Step 2: Filter empty lines');
        this.filterEmptyLines();

        logToOutputChannel('  Pipeline Step 3: Sort statements');
        this.sortStatements();

        logToOutputChannel('  Pipeline Step 4: Split into groups');
        this.splitIntoGroups();

        logToOutputChannel('  Pipeline Step 5: Normalize whitespace');
        this.normalizeWhitespace();  // Single place where ALL blank lines are added

        logToOutputChannel('  Pipeline Step 6: Normalize leading whitespace');
        this.normalizeLeadingWhitespace();

        return this.block;
    }

    /**
     * Removes unused using statements
     */
    private removeUnused(): void
    {
        const beforeCount = this.block.getStatements().length;
        const remover = new UnusedUsingRemover(this.diagnosticProvider, this.config);
        const filtered = remover.remove(this.block);
        this.block.setStatements(filtered);
        const afterCount = this.block.getStatements().length;
        const removed = beforeCount - afterCount;
        if (removed > 0)
        {
            logToOutputChannel(`    Removed ${removed} unused using statement(s): ${beforeCount} -> ${afterCount}`);
        }
        else
        {
            logToOutputChannel('    No unused using statements found');
        }
    }

    /**
     * Filters out all blank lines - they'll be added back strategically later
     */
    private filterEmptyLines(): void
    {
        const statements = this.block.getStatements();
        const beforeCount = statements.length;
        const filtered = statements.filter(s => !s.isBlankLine);
        this.block.setStatements(Array.from(filtered));
        const afterCount = filtered.length;
        const removed = beforeCount - afterCount;
        if (removed > 0)
        {
            logToOutputChannel(`    Filtered ${removed} blank line(s): ${beforeCount} -> ${afterCount}`);
        }
        else
        {
            logToOutputChannel('    No blank lines to filter');
        }
    }

    /**
     * Sorts the using statements
     */
    private sortStatements(): void
    {
        const statements = this.block.getStatements();

        // Check if we have preprocessor directives
        const directiveHandler = new PreprocessorDirectiveHandler();
        if (directiveHandler.hasDirectives(statements))
        {
            logToOutputChannel('    Sorting with preprocessor directives');
            this.sortWithDirectives(directiveHandler);
        }
        else
        {
            logToOutputChannel('    Sorting without preprocessor directives');
            this.sortWithoutDirectives();
        }
    }

    /**
     * Sorts statements without preprocessor directives
     */
    private sortWithoutDirectives(): void
    {
        const sorter = new UsingSorter(this.config);
        const sorted = sorter.sort(this.block.getStatements());
        this.block.setStatements(sorted);
    }

    /**
     * Sorts statements that contain preprocessor directives
     */
    private sortWithDirectives(directiveHandler: PreprocessorDirectiveHandler): void
    {
        // Separate directive blocks from regular usings
        const { directiveBlocks, remainingUsings } = directiveHandler.separate(this.block.getStatements());

        // Sort the remaining usings
        const sorter = new UsingSorter(this.config);
        const sortedUsings = sorter.sort(remainingUsings);

        // Recombine
        const recombined = directiveHandler.recombine(sortedUsings, directiveBlocks);
        this.block.setStatements(recombined);
    }

    /**
     * Splits statements into groups by root namespace
     */
    private splitIntoGroups(): void
    {
        if (!this.config.splitGroups)
        {
            logToOutputChannel('    Split groups disabled, skipping');
            return;
        }

        const statements = this.block.getStatements();
        if (statements.length === 0)
        {
            logToOutputChannel('    No statements to group');
            return;
        }

        const beforeCount = statements.length;
        const grouper = new UsingGroupSplitter(this.config);
        const grouped = grouper.split(statements);
        this.block.setStatements(grouped);
        const afterCount = grouped.length;
        const blankLinesAdded = afterCount - beforeCount;
        if (blankLinesAdded > 0)
        {
            logToOutputChannel(`    Added ${blankLinesAdded} blank line(s) between groups: ${beforeCount} -> ${afterCount}`);
        }
        else
        {
            logToOutputChannel('    No group separators needed');
        }
    }

    /**
     * Normalizes ALL whitespace (blank lines) in a single consistent step
     */
    private normalizeWhitespace(): void
    {
        const beforeCount = this.block.getStatements().length;
        const normalizer = new WhitespaceNormalizer();
        const normalized = normalizer.normalize(this.block.getStatements());
        this.block.setStatements(normalized);
        const afterCount = normalized.length;
        const diff = afterCount - beforeCount;
        if (diff !== 0)
        {
            logToOutputChannel(`    Normalized whitespace: ${beforeCount} -> ${afterCount} (${diff > 0 ? '+' : ''}${diff})`);
        }
        else
        {
            logToOutputChannel('    Whitespace already normalized');
        }
    }

    /**
     * Normalizes leading whitespace (adds blank line before usings if there's leading content)
     */
    private normalizeLeadingWhitespace(): void
    {
        const leadingContent = this.block.getLeadingContent();

        if (leadingContent.length > 0)
        {
            // If there's leading content, ensure we have a blank line before the first using
            const statements = this.block.getStatements();

            // Check if first statement is already a blank line
            if (statements.length > 0 && !statements[0].isBlankLine)
            {
                this.block.setStatements([UsingStatement.blankLine(), ...statements]);
                logToOutputChannel('    Added blank line after leading content');
            }
            else
            {
                logToOutputChannel('    Leading blank line already present');
            }
        }
        else
        {
            logToOutputChannel('    No leading content, skipping');
        }
    }
}
