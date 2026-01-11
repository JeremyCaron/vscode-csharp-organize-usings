import { UsingBlock } from '../domain/UsingBlock';
import { UsingStatement } from '../domain/UsingStatement';
import { FormatOptions } from '../domain/FormatOptions';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import { UnusedUsingRemover } from './UnusedUsingRemover';
import { UsingSorter } from './UsingSorter';
import { UsingGroupSplitter } from './UsingGroupSplitter';
import { PreprocessorDirectiveHandler } from './PreprocessorDirectiveHandler';
import { WhitespaceNormalizer } from './WhitespaceNormalizer';

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
        this.removeUnused();
        this.filterEmptyLines();
        this.sortStatements();
        this.splitIntoGroups();
        this.normalizeWhitespace();  // Single place where ALL blank lines are added
        this.normalizeLeadingWhitespace();
        return this.block;
    }

    /**
     * Removes unused using statements
     */
    private removeUnused(): void
    {
        const remover = new UnusedUsingRemover(this.diagnosticProvider, this.config);
        const filtered = remover.remove(this.block);
        this.block.setStatements(filtered);
    }

    /**
     * Filters out all blank lines - they'll be added back strategically later
     */
    private filterEmptyLines(): void
    {
        const statements = this.block.getStatements();
        const filtered = statements.filter(s => !s.isBlankLine);
        this.block.setStatements(Array.from(filtered));
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
            this.sortWithDirectives(directiveHandler);
        }
        else
        {
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
            return;
        }

        const statements = this.block.getStatements();
        if (statements.length === 0)
        {
            return;
        }

        const grouper = new UsingGroupSplitter();
        const grouped = grouper.split(statements);
        this.block.setStatements(grouped);
    }

    /**
     * Normalizes ALL whitespace (blank lines) in a single consistent step
     */
    private normalizeWhitespace(): void
    {
        const normalizer = new WhitespaceNormalizer();
        const normalized = normalizer.normalize(this.block.getStatements());
        this.block.setStatements(normalized);
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
            }
        }
    }
}
