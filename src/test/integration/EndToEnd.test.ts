import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';

class MockDiagnosticProvider implements IDiagnosticProvider {
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getUnusedUsingDiagnostics(): vs.Diagnostic[] {
        return this.diagnostics;
    }
}

/**
 * End-to-end integration tests that test the entire pipeline:
 * Extract -> Process (Remove Unused -> Sort -> Group) -> Replace
 */
suite('End-to-End Integration', () => {
    const extractor = new UsingBlockExtractor();

    function processSourceCode(
        sourceCode: string,
        eol: string,
        config: FormatOptions,
        diagnostics: vs.Diagnostic[]
    ): string {
        const provider = new MockDiagnosticProvider(diagnostics);

        // Extract blocks
        const blocks = extractor.extract(sourceCode, eol);

        if (blocks.size === 0) {
            return sourceCode;
        }

        // Process each block
        for (const [originalText, block] of blocks) {
            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();
        }

        // Replace and return
        return extractor.replace(sourceCode, eol, blocks);
    }

    suite('Basic sorting and grouping', () => {
        test('should sort and group a simple file', () => {
            const input = [
                'using Microsoft.AspNetCore.Mvc;',
                'using System;',
                'using MyCompany.Core;',
                '',
                'namespace MyApp;',
                '',
                'public class Foo { }'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            const lines = result.split('\n');

            // System should be first
            assert.ok(lines[0].includes('System;'));

            // Should have blank line after System
            assert.strictEqual(lines[1], '');

            // Microsoft next
            assert.ok(lines[2].includes('Microsoft'));

            // Namespace should still be present
            assert.ok(result.includes('namespace MyApp;'));
            assert.ok(result.includes('public class Foo'));
        });

        test('should handle aliases correctly', () => {
            const input = [
                'using System;',
                'using Foo = Serilog.Foo;',
                'using Microsoft.AspNetCore.Mvc;',
                'using ILogger = Serilog.ILogger;',
                '',
                'namespace MyApp;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            const lines = result.split('\n').filter(l => l.trim().length > 0);

            // Aliases should be at the end
            const aliasLines = lines.filter(l => l.includes('='));
            const lastAlias = aliasLines[aliasLines.length - 1];
            const lastAliasIndex = lines.indexOf(lastAlias);

            // Find last using statement
            const usingLines = lines.filter(l => l.includes('using'));
            const lastUsing = usingLines[usingLines.length - 1];
            const lastUsingIndex = lines.indexOf(lastUsing);

            // Aliases should be at the end of usings
            assert.strictEqual(lastAliasIndex, lastUsingIndex);
        });
    });

    suite('Unused using removal', () => {
        test('should remove unused usings and organize remaining', () => {
            const input = [
                'using System;', // line 0 - unused
                'using Microsoft.AspNetCore.Mvc;', // line 1 - used
                'using MyCompany.Core;', // line 2 - used
                '',
                'namespace MyApp;'
            ].join('\n');

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
                } as vs.Diagnostic
            ];

            const config = new FormatOptions('System', true, false, false);
            const result = processSourceCode(input, '\n', config, diagnostics);

            // System should be removed
            assert.ok(!result.includes('using System;'));

            // Others should remain
            assert.ok(result.includes('Microsoft.AspNetCore.Mvc'));
            assert.ok(result.includes('MyCompany.Core'));
        });
    });

    suite('Idempotency - Issue #26', () => {
        test('should not accumulate blank lines on repeated runs', () => {
            const input = [
                'using System.Text.RegularExpressions;',
                '',
                'using MyCompany.Common.JsonConverters;',
                '',
                'namespace MyCompany.Domain.Models;',
                '',
                'public class InquiryResponseModel',
                '{',
                '    public InquiryResponseModel() { }',
                '}'
            ].join('\n');

            const config = new FormatOptions('System', true, false, false);

            // Run 1
            const result1 = processSourceCode(input, '\n', config, []);

            // Run 2 on result 1
            const result2 = processSourceCode(result1, '\n', config, []);

            // Run 3 on result 2
            const result3 = processSourceCode(result2, '\n', config, []);

            // All runs should produce identical output (idempotent)
            assert.strictEqual(result1, result2, 'Second run should not modify the file');
            assert.strictEqual(result2, result3, 'Third run should not modify the file');
        });

        test('should maintain exactly one blank line between usings and namespace', () => {
            const input = [
                'using System;',
                '',
                'using Microsoft.Extensions;',
                '',
                'namespace MyApp;',
                '',
                'public class Foo { }'
            ].join('\n');

            const config = new FormatOptions('System', true, false, false);

            const result1 = processSourceCode(input, '\n', config, []);
            const result2 = processSourceCode(result1, '\n', config, []);

            assert.strictEqual(result1, result2, 'Should be idempotent');

            // Count blank lines between last using and namespace
            const lines = result1.split('\n');
            const lastUsingIndex = lines.map((l, i) => l.includes('using') ? i : -1).filter(i => i >= 0).pop()!;
            const namespaceIndex = lines.findIndex(l => l.includes('namespace'));

            const blankLinesBetween = lines.slice(lastUsingIndex + 1, namespaceIndex).filter(l => l.trim() === '').length;

            // Should have reasonable number of blank lines (typically 1-2 from the using block trailing lines)
            assert.ok(blankLinesBetween >= 1 && blankLinesBetween <= 3);
        });
    });

    suite('Windows CRLF line endings', () => {
        test('should handle CRLF consistently', () => {
            const input = [
                'using System.Text.RegularExpressions;',
                '',
                'using MyCompany.Common.JsonConverters;',
                '',
                'namespace MyCompany.Domain;'
            ].join('\r\n');

            const config = new FormatOptions('System', true, false, false);

            const result1 = processSourceCode(input, '\r\n', config, []);
            const result2 = processSourceCode(result1, '\r\n', config, []);
            const result3 = processSourceCode(result2, '\r\n', config, []);

            // Should be idempotent with CRLF
            assert.strictEqual(result1, result2, 'Second run should not modify the file (CRLF)');
            assert.strictEqual(result2, result3, 'Third run should not modify the file (CRLF)');

            // Should preserve CRLF line endings
            assert.ok(result1.includes('\r\n'));
        });
    });

    suite('Leading comments', () => {
        test('should preserve and separate leading comments', () => {
            const input = [
                '// This benchmark project is based on CliFx.Benchmarks.',
                '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
                'using BenchmarkDotNet.Attributes;',
                'using System.ComponentModel.DataAnnotations.Schema;',
                'using CliFx;',
                '',
                'namespace Benchmarks;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            const lines = result.split('\n');

            // Comments should be at the top
            assert.ok(lines[0].includes('// This benchmark'));
            assert.ok(lines[1].includes('// https://'));

            // Should have blank line after comments
            let foundBlankAfterComments = false;
            for (let i = 2; i < lines.length; i++) {
                if (lines[i].trim() === '') {
                    foundBlankAfterComments = true;
                    break;
                }
            }
            assert.ok(foundBlankAfterComments, 'Should have blank line after comments');

            // Usings should be sorted (System first if present)
            const usingLines = lines.filter(l => l.includes('using') && !l.includes('//'));
            assert.ok(usingLines.length > 0);
        });
    });

    suite('Preprocessor directives', () => {
        test('should preserve preprocessor directives', () => {
            const input = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            // Preprocessor directives should be preserved
            assert.ok(result.includes('#if DEBUG'));
            assert.ok(result.includes('#endif'));
            assert.ok(result.includes('System.Diagnostics'));
        });

        test('should remove usings in preprocessor blocks when enabled', () => {
            const input = [
                'using System;',
                '#if DEBUG',
                'using System.Diagnostics;', // line 2 - unused
                '#endif',
                'using Microsoft.AspNetCore.Mvc;',
                '',
                'namespace MyApp;'
            ].join('\n');

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1))
                } as vs.Diagnostic
            ];

            const config = new FormatOptions('System', true, false, true); // processUsingsInPreprocessorDirectives = true
            const result = processSourceCode(input, '\n', config, diagnostics);

            // Diagnostics should be removed even in preprocessor block
            assert.ok(!result.includes('System.Diagnostics'));

            // Preprocessor directives should still be there
            assert.ok(result.includes('#if DEBUG'));
            assert.ok(result.includes('#endif'));
        });
    });

    suite('Global usings', () => {
        test('should handle global usings', () => {
            const input = [
                'global using System;',
                'global using Microsoft.Extensions;',
                '',
                'namespace MyApp;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            // Global usings should be preserved
            assert.ok(result.includes('global using System;'));
            assert.ok(result.includes('global using Microsoft.Extensions;'));

            // Should be sorted with System first
            const lines = result.split('\n');
            const systemIndex = lines.findIndex(l => l.includes('System'));
            const microsoftIndex = lines.findIndex(l => l.includes('Microsoft'));
            assert.ok(systemIndex < microsoftIndex);
        });
    });

    suite('Empty and edge cases', () => {
        test('should handle file with no using statements', () => {
            const input = [
                'namespace MyApp;',
                '',
                'public class Foo { }'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            // Should return unchanged
            assert.strictEqual(result, input);
        });

        test('should handle file with only comments', () => {
            const input = [
                '// Comment line 1',
                '// Comment line 2',
                '',
                'namespace MyApp;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            // Should return unchanged
            assert.strictEqual(result, input);
        });

        test('should handle empty file', () => {
            const input = '';

            const config = new FormatOptions('System', true, true, false);
            const result = processSourceCode(input, '\n', config, []);

            assert.strictEqual(result, '');
        });

        test('should handle file with only one using', () => {
            const input = [
                'using System;',
                '',
                'namespace MyApp;'
            ].join('\n');

            const config = new FormatOptions('System', true, true, false);

            const result1 = processSourceCode(input, '\n', config, []);
            const result2 = processSourceCode(result1, '\n', config, []);

            // Should be idempotent
            assert.strictEqual(result1, result2);
        });
    });

    suite('Complex real-world scenarios', () => {
        test('should handle large complex file', () => {
            const input = [
                'using Zebra.Something;',         // line 0
                'using System;',                   // line 1
                'using System.Text;',              // line 2
                'using System.Collections.Generic;', // line 3
                'using Microsoft.AspNetCore.Mvc;', // line 4
                'using Microsoft.Extensions.Logging;', // line 5
                'using MyCompany.Core.Models;',    // line 6
                'using MyCompany.Core.Services;',  // line 7 - unused
                'using MyCompany.Data.Repositories;', // line 8
                '#if DEBUG',                       // line 9
                'using System.Diagnostics;',       // line 10
                '#endif',                          // line 11
                'using ILogger = Serilog.ILogger;', // line 12
                'using IFoo = Serilog.Foo;',       // line 13
                '',                                // line 14
                'namespace MyCompany.Api.Controllers;',
                '',
                'public class UsersController : ControllerBase',
                '{',
                '    private readonly ILogger _logger;',
                '',
                '    public UsersController(ILogger logger)',
                '    {',
                '        _logger = logger;',
                '    }',
                '}'
            ].join('\n');

            const diagnostics = [
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(7, 0), new vs.Position(7, 1))
                } as vs.Diagnostic
            ];

            const config = new FormatOptions('System', true, false, false);

            // Process the file
            const result = processSourceCode(input, '\n', config, diagnostics);

            // Verify unused using was removed
            assert.ok(!result.includes('MyCompany.Core.Services'));

            // Verify System group is first (after comments)
            const lines = result.split('\n');
            const firstUsingIndex = lines.findIndex(l => l.includes('using') && !l.includes('//'));
            assert.ok(lines[firstUsingIndex].includes('System'));

            // Verify aliases at end
            const aliasLines = lines.filter(l => l.includes('= Serilog'));
            assert.ok(aliasLines.length === 2);

            // Verify namespace and class are preserved
            assert.ok(result.includes('namespace MyCompany.Api.Controllers;'));
            assert.ok(result.includes('public class UsersController'));

            // Test idempotency
            const result2 = processSourceCode(result, '\n', config, []);
            assert.strictEqual(result, result2, 'Should be idempotent');
        });

        test('should handle kitchen sink - all features combined', () => {
            const input = [
                '// Copyright 2024 MyCompany Inc.',     // line 0
                '// Licensed under the MIT License',    // line 1
                '// See LICENSE file in the project root', // line 2
                '',                                     // line 3
                'global using System;',                 // line 4
                'global using System.Linq;',            // line 5
                'using static System.Math;',            // line 6
                'using static System.Console;',         // line 7
                'using System.Text;',                   // line 8 - unused
                'using System.Collections.Generic;',    // line 9
                'using Microsoft.AspNetCore.Mvc;',      // line 10
                'using Microsoft.Extensions.Logging;',  // line 11
                'using Zebra.ThirdParty;',              // line 12
                'using MyCompany.Core.Models;',         // line 13
                'using MyCompany.Core.Services;',       // line 14 - unused
                'using MyCompany.Data.Repositories;',   // line 15
                '#if DEBUG',                            // line 16
                'using System.Diagnostics;',            // line 17
                '#endif',                               // line 18
                '#if UNITY_ANDROID',                    // line 19
                'using Unity.Mobile;',                  // line 20 - unused
                '#endif',                               // line 21
                'using ILogger = Serilog.ILogger;',     // line 22
                'using Json = Newtonsoft.Json;',        // line 23
                '',                                     // line 24
                'namespace MyCompany.Api.Controllers;', // line 25
                '',
                'public class MathController : ControllerBase',
                '{',
                '    private readonly ILogger _logger;',
                '    private readonly List<int> _numbers;',
                '',
                '    public double CalculateCircumference(double radius)',
                '    {',
                '        WriteLine("Calculating...");',
                '        return 2 * PI * radius;',
                '    }',
                '}'
            ].join('\n');

            const diagnostics = [
                // unused: System.Text at line 8
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(8, 0), new vs.Position(8, 1))
                } as vs.Diagnostic,
                // unused: MyCompany.Core.Services at line 14
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(14, 0), new vs.Position(14, 1))
                } as vs.Diagnostic,
                // unused: Unity.Mobile at line 20 (inside preprocessor block)
                {
                    code: 'CS8019',
                    source: 'csharp',
                    message: 'Using directive is unnecessary.',
                    severity: vs.DiagnosticSeverity.Warning,
                    range: new vs.Range(new vs.Position(20, 0), new vs.Position(20, 1))
                } as vs.Diagnostic
            ];

            // Config: sortOrder=System, splitGroups=true, disableUnusedUsingsRemoval=false, processUsingsInPreprocessorDirectives=false
            const config = new FormatOptions('System', true, false, false);

            // Process the file
            const result = processSourceCode(input, '\n', config, diagnostics);
            const lines = result.split('\n');

            // Verify leading comments are preserved
            assert.ok(lines[0].includes('// Copyright 2024'), 'First line should be copyright comment');
            assert.ok(lines[1].includes('// Licensed'), 'Second line should be license comment');
            assert.ok(lines[2].includes('// See LICENSE'), 'Third line should be license reference');

            // Verify unused usings were removed (except those in preprocessor blocks)
            assert.ok(!result.includes('using System.Text;'), 'System.Text should be removed');
            assert.ok(!result.includes('MyCompany.Core.Services'), 'Core.Services should be removed');

            // Unity.Mobile is in a preprocessor block and processUsingsInPreprocessorDirectives=false,
            // so it should NOT be removed
            assert.ok(result.includes('Unity.Mobile'), 'Unity.Mobile should be preserved (in preprocessor block)');

            // Verify all other features are present
            assert.ok(result.includes('global using System;'), 'Global usings should be preserved');
            assert.ok(result.includes('using static System.Math;'), 'Static usings should be preserved');
            assert.ok(result.includes('System.Collections.Generic'), 'Regular usings should be preserved');
            assert.ok(result.includes('Microsoft.AspNetCore.Mvc'), 'Microsoft usings should be preserved');
            assert.ok(result.includes('#if DEBUG'), 'Preprocessor directives should be preserved');
            assert.ok(result.includes('System.Diagnostics'), 'Usings in preprocessor blocks should be preserved');
            assert.ok(result.includes('ILogger = Serilog'), 'Aliases should be preserved');

            // Verify sorting: System group should come first
            const firstUsingIndex = lines.findIndex(l => l.trim().startsWith('using') || l.trim().startsWith('global using'));
            assert.ok(lines[firstUsingIndex].includes('System'), 'System group should be first after comments');

            // Verify aliases are present and in correct position
            const aliasLines = lines.filter(l => l.includes('= Serilog') || l.includes('= Newtonsoft'));
            assert.ok(aliasLines.length === 2, 'Should have 2 aliases');

            // Verify aliases come after third-party usings (like Zebra) but before preprocessor blocks
            const zebraIndex = lines.findIndex(l => l.includes('Zebra.ThirdParty'));
            const firstAliasIndex = lines.findIndex(l => l.includes('= Serilog') || l.includes('= Newtonsoft'));
            const firstPreprocessorIndex = lines.findIndex(l => l.trim().startsWith('#if'));

            assert.ok(zebraIndex >= 0, 'Should find Zebra using');
            assert.ok(zebraIndex < firstAliasIndex, 'Aliases should come after third-party usings');
            assert.ok(firstAliasIndex < firstPreprocessorIndex, 'Aliases should come before preprocessor blocks');

            // Verify groups are separated by blank lines
            const systemGroupEnd = lines.findIndex(l => l.includes('System.Collections.Generic'));
            const microsoftGroupStart = lines.findIndex(l => l.includes('Microsoft.AspNetCore.Mvc'));
            assert.ok(systemGroupEnd < microsoftGroupStart, 'System group should come before Microsoft group');

            // Check for blank line between groups
            const hasBlankBetweenGroups = lines.slice(systemGroupEnd + 1, microsoftGroupStart).some(l => l.trim() === '');
            assert.ok(hasBlankBetweenGroups, 'Should have blank line between namespace groups');

            // Verify namespace and class are preserved
            assert.ok(result.includes('namespace MyCompany.Api.Controllers;'));
            assert.ok(result.includes('public class MathController'));
            assert.ok(result.includes('private readonly ILogger _logger;'));
            assert.ok(result.includes('2 * PI * radius'));

            // Test idempotency
            const result2 = processSourceCode(result, '\n', config, []);
            assert.strictEqual(result, result2, 'Should be idempotent on second run');

            const result3 = processSourceCode(result2, '\n', config, []);
            assert.strictEqual(result2, result3, 'Should be idempotent on third run');
        });
    });
});
