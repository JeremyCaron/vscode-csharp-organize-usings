import { UsingStaticPlacement } from '../domain/FormatOptions';

export interface IFormatOptions
{
    processUsingsInPreprocessorDirectives: boolean;
    disableUnusedUsingsRemoval: boolean;
    sortOrder: string;
    splitGroups: boolean;
    usingStaticPlacement: UsingStaticPlacement;
}
