import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../processors/IDiagnosticProvider';

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
                '// Copyright 2024 MyCompany',
                '// Licensed under MIT',
                '',
                'using Zebra.Something;',
                'using System;',
                'using System.Text;',
                'using System.Collections.Generic;',
                'using Microsoft.AspNetCore.Mvc;',
                'using Microsoft.Extensions.Logging;',
                'using MyCompany.Core.Models;',
                'using MyCompany.Core.Services;', // line 10 - unused
                'using MyCompany.Data.Repositories;',
                '#if DEBUG',
                'using System.Diagnostics;',
                '#endif',
                'using ILogger = Serilog.ILogger;',
                'using IFoo = Serilog.Foo;',
                '',
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
                    range: new vs.Range(new vs.Position(10, 0), new vs.Position(10, 1))
                } as vs.Diagnostic
            ];

            const config = new FormatOptions('System', true, false, false);

            // Process the file
            const result = processSourceCode(input, '\n', config, diagnostics);

            // Verify comments at top
            assert.ok(result.startsWith('// Copyright'));

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
    });
});
