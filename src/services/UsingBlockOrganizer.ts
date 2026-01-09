import { CSharpDocument } from '../domain/CSharpDocument';
import { FormatOptions } from '../domain/FormatOptions';
import { OrganizationResult } from '../domain/OrganizationResult';
import { IDiagnosticProvider } from '../processors/IDiagnosticProvider';
import { UsingBlockExtractor } from './UsingBlockExtractor';
import { UsingBlockProcessor } from '../processors/UsingBlockProcessor';
import { ProjectValidator } from './ProjectValidator';
import { logToOutputChannel } from '../logger';

/**
 * Main service class that orchestrates the organization of using statements.
 * This is the entry point for the entire refactored architecture.
 */
export class UsingBlockOrganizer {
    private readonly config: FormatOptions;
    private readonly diagnosticProvider: IDiagnosticProvider;
    private readonly validator: ProjectValidator;
    private readonly extractor: UsingBlockExtractor;

    constructor(config: FormatOptions, diagnosticProvider: IDiagnosticProvider) {
        this.config = config;
        this.diagnosticProvider = diagnosticProvider;
        this.validator = new ProjectValidator();
        this.extractor = new UsingBlockExtractor();
    }

    /**
     * Organizes using statements in the given document.
     * This is the main public method that coordinates the entire operation.
     */
    public organize(document: CSharpDocument): OrganizationResult {
        logToOutputChannel('`Organize C# Usings` command executed');

        // Step 1: Validate the document and project
        const validation = this.validator.validate(document);
        if (!validation.isValid) {
            return OrganizationResult.error(validation.message);
        }

        // Step 2: Extract using blocks from the document
        const blocks = this.extractor.extract(document.content, document.getLineEndingString());

        if (blocks.size === 0) {
            return OrganizationResult.noChange();
        }

        // Step 3: Process each block
        for (const [originalText, block] of blocks) {
            const processor = new UsingBlockProcessor(block, this.config, this.diagnosticProvider);
            processor.process();
        }

        // Step 4: Replace blocks in the source code
        const newContent = this.extractor.replace(document.content, document.getLineEndingString(), blocks);

        // Step 5: Return result (empty string if no changes)
        if (newContent === document.content) {
            return OrganizationResult.noChange();
        }

        return OrganizationResult.success(newContent);
    }
}
