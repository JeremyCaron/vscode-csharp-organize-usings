import { CSharpDocument } from '../domain/CSharpDocument';
import { FormatOptions } from '../domain/FormatOptions';
import { OrganizationResult } from '../domain/OrganizationResult';
import { IDiagnosticProvider } from '../interfaces/IDiagnosticProvider';
import { UsingBlockExtractor } from './UsingBlockExtractor';
import { UsingBlockProcessor } from '../processors/UsingBlockProcessor';
import { logToOutputChannel } from '../logging/logger';

/**
 * Main service class that orchestrates the organization of using statements.
 * This is the entry point for the entire refactored architecture.
 */
export class UsingBlockOrganizer
{
    private readonly config: FormatOptions;
    private readonly diagnosticProvider: IDiagnosticProvider;
    private readonly extractor: UsingBlockExtractor;

    constructor(config: FormatOptions, diagnosticProvider: IDiagnosticProvider)
    {
        this.config = config;
        this.diagnosticProvider = diagnosticProvider;
        this.extractor = new UsingBlockExtractor();
    }

    /**
     * Organizes using statements in the given document.
     * This is the main public method that coordinates the entire operation.
     */
    public organize(document: CSharpDocument): OrganizationResult
    {
        logToOutputChannel('`Organize C# Usings` command executed');

        // Step 1: Extract using blocks from the document (needed for validation)
        const blocks = this.extractor.extract(document.content, document.getLineEndingString());

        logToOutputChannel(`Extracted ${blocks.size} using block(s) from document`);

        if (blocks.size === 0)
        {
            logToOutputChannel('No using blocks found, no changes made');
            return OrganizationResult.noChange();
        }

        // Count total usings for diagnostic reliability check
        const totalUsingsInDocument = Array.from(blocks.values())
            .reduce((sum, block) => sum + block.getActualUsingCount(), 0);
        logToOutputChannel(`Total using statements in document: ${totalUsingsInDocument}`);

        // Step 2: Process each block
        let blockIndex = 0;
        for (const block of blocks.values())
        {
            blockIndex++;
            logToOutputChannel(`\n=== PROCESSING USING BLOCK ${blockIndex} of ${blocks.size} ===`);
            logToOutputChannel(`Block location: lines ${block.startLine}-${block.endLine}`);
            logToOutputChannel(`Block has ${block.getStatements().length} statement(s)`);

            const processor = new UsingBlockProcessor(block, this.config, this.diagnosticProvider);
            processor.process();

            logToOutputChannel(`After processing: ${block.getStatements().length} statement(s)`);
            logToOutputChannel(`=== END PROCESSING BLOCK ${blockIndex} ===\n`);
        }

        // Step 3: Replace blocks in the source code
        const newContent = this.extractor.replace(document.content, document.getLineEndingString(), blocks);

        // Step 4: Return result (empty string if no changes)
        if (newContent === document.content)
        {
            logToOutputChannel('No changes were made to the document');
            return OrganizationResult.noChange();
        }

        logToOutputChannel('Successfully organized using statements');
        return OrganizationResult.success(newContent);
    }
}
