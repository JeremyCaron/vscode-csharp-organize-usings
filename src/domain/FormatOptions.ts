import * as vs from 'vscode';
import { IFormatOptions } from '../interfaces/IFormatOptions';

/**
 * Configuration options for organizing usings
 */
export class FormatOptions implements IFormatOptions
{
    public readonly sortOrder: string;
    public readonly splitGroups: boolean;
    public readonly disableUnusedUsingsRemoval: boolean;
    public readonly processUsingsInPreprocessorDirectives: boolean;

    constructor(
        sortOrder: string,
        splitGroups: boolean,
        disableUnusedUsingsRemoval: boolean,
        processUsingsInPreprocessorDirectives: boolean,
    )
    {
        this.sortOrder = sortOrder;
        this.splitGroups = splitGroups;
        this.disableUnusedUsingsRemoval = disableUnusedUsingsRemoval;
        this.processUsingsInPreprocessorDirectives = processUsingsInPreprocessorDirectives;
    }

    /**
     * Creates FormatOptions from VSCode workspace configuration
     */
    public static fromWorkspaceConfig(): FormatOptions
    {
        const cfg = vs.workspace.getConfiguration('csharpOrganizeUsings');

        return new FormatOptions(
            cfg.get<string>('sortOrder', 'System'),
            cfg.get<boolean>('splitGroups', true),
            cfg.get<boolean>('disableUnusedUsingsRemoval', false),
            cfg.get<boolean>('processUsingsInPreprocessorDirectives', false),
        );
    }

    /**
     * Creates default FormatOptions for testing
     */
    public static default(): FormatOptions
    {
        return new FormatOptions('System', true, false, false);
    }
}
