import * as assert from 'assert';
import * as vs from 'vscode';
import { UsingBlockExtractor } from '../../services/UsingBlockExtractor';
import { UsingBlockProcessor } from '../../processors/UsingBlockProcessor';
import { FormatOptions } from '../../domain/FormatOptions';
import { IDiagnosticProvider } from '../../interfaces/IDiagnosticProvider';

class MockDiagnosticProvider implements IDiagnosticProvider
{
    constructor(private diagnostics: vs.Diagnostic[]) {}

    getUnusedUsingDiagnostics(): vs.Diagnostic[]
    {
        return this.diagnostics;
    }
}

suite('Comment Sticking - Visual Studio Behavior', () =>
{
    const extractor = new UsingBlockExtractor();

    function processSourceCode(
        sourceCode: string,
        eol: string,
        config: FormatOptions,
        diagnostics: vs.Diagnostic[],
    ): string
    {
        const provider = new MockDiagnosticProvider(diagnostics);

        const blocks = extractor.extract(sourceCode, eol);

        if (blocks.size === 0)
        {
            return sourceCode;
        }

        for (const block of blocks.values())
        {
            const processor = new UsingBlockProcessor(block, config, provider);
            processor.process();
        }

        return extractor.replace(sourceCode, eol, blocks);
    }

    test('should keep comment with its using when sorting', () =>
    {
        const input = [
            'using System;',
            '// This is a special third-party logging library',
            'using Serilog;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // Find the Serilog using
        const serilogIndex = lines.findIndex(l => l.includes('Serilog'));
        assert.ok(serilogIndex > 0, 'Should find Serilog using');

        // The line before Serilog should be the comment
        assert.ok(
            lines[serilogIndex - 1].includes('special third-party logging library'),
            'Comment should be directly before Serilog using',
        );

        // Verify sorting happened (System should be first)
        const systemIndex = lines.findIndex(l => l.includes('using System'));
        assert.ok(systemIndex >= 0 && systemIndex < serilogIndex, 'System should come before Serilog');
    });

    test('should keep multiple comments with their using', () =>
    {
        const input = [
            'using System;',
            '// This logging library requires special configuration',
            '// See: https://serilog.net',
            'using Serilog;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // Find the Serilog using
        const serilogIndex = lines.findIndex(l => l.includes('Serilog'));
        assert.ok(serilogIndex > 1, 'Should find Serilog using');

        // Both comment lines should be before Serilog
        assert.ok(
            lines[serilogIndex - 2].includes('requires special configuration'),
            'First comment should be 2 lines before Serilog',
        );
        assert.ok(
            lines[serilogIndex - 1].includes('https://serilog.net'),
            'Second comment should be directly before Serilog',
        );
    });

    test('should work with System-first sorting', () =>
    {
        const input = [
            '// Microsoft MVC framework',
            'using Microsoft.AspNetCore.Mvc;',
            '// System namespace',
            'using System;',
            '// Third party library',
            'using Newtonsoft.Json;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // System should be first with its comment somewhere before it
        const systemIndex = lines.findIndex(l => l.includes('using System'));
        assert.ok(systemIndex > 0);
        // Find the comment for System - it should be within a few lines before
        const systemCommentIndex = lines.slice(0, systemIndex).findIndex(l => l.includes('System namespace'));
        assert.ok(systemCommentIndex >= 0, 'System comment should exist before System using');
        assert.ok(systemCommentIndex < systemIndex, 'System comment should be before System using');

        // Microsoft should be after System with its comment
        const microsoftIndex = lines.findIndex(l => l.includes('Microsoft.AspNetCore.Mvc'));
        assert.ok(microsoftIndex > systemIndex);
        const microsoftCommentIndex = lines.slice(0, microsoftIndex).findIndex(l => l.includes('Microsoft MVC framework'));
        assert.ok(microsoftCommentIndex >= 0, 'Microsoft comment should exist before Microsoft using');
        assert.ok(microsoftCommentIndex < microsoftIndex, 'Microsoft comment should be before Microsoft using');

        // Newtonsoft should be last with its comment
        const newtonsoftIndex = lines.findIndex(l => l.includes('Newtonsoft.Json'));
        assert.ok(newtonsoftIndex > microsoftIndex);
        const newtonsoftCommentIndex = lines.slice(0, newtonsoftIndex).findIndex(l => l.includes('Third party library'));
        assert.ok(newtonsoftCommentIndex >= 0, 'Newtonsoft comment should exist before Newtonsoft using');
        assert.ok(newtonsoftCommentIndex < newtonsoftIndex, 'Newtonsoft comment should be before Newtonsoft using');
    });

    test('should work with group splitting enabled', () =>
    {
        const input = [
            '// System namespace',
            'using System;',
            '// Microsoft namespace',
            'using Microsoft.Extensions.Logging;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', true, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // System should be first with its comment somewhere before it
        const systemIndex = lines.findIndex(l => l.includes('using System'));
        assert.ok(systemIndex > 0);
        const systemCommentIndex = lines.slice(0, systemIndex).findIndex(l => l.includes('System namespace'));
        assert.ok(systemCommentIndex >= 0, 'System comment should exist');
        assert.ok(systemCommentIndex < systemIndex, 'System comment should be before System using');

        // There should be a blank line between System group and Microsoft group
        const microsoftIndex = lines.findIndex(l => l.includes('Microsoft.Extensions.Logging'));
        assert.ok(microsoftIndex > systemIndex + 1);

        // Check for at least one blank line between System and Microsoft comment
        const linesBetween = lines.slice(systemIndex + 1, microsoftIndex);
        const hasBlankLine = linesBetween.some(l => l.trim() === '');
        assert.ok(hasBlankLine, 'Should have blank line between groups');

        // Microsoft should have its comment before it
        const microsoftCommentIndex = lines.slice(0, microsoftIndex).findIndex(l => l.includes('Microsoft namespace'));
        assert.ok(microsoftCommentIndex >= 0, 'Microsoft comment should exist');
        assert.ok(microsoftCommentIndex < microsoftIndex, 'Microsoft comment should be before Microsoft using');
    });

    test('should preserve behavior when run multiple times (idempotent)', () =>
    {
        const input = [
            'using System;',
            '// Special library',
            'using Serilog;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);

        const result1 = processSourceCode(input, '\n', config, []);
        const result2 = processSourceCode(result1, '\n', config, []);
        const result3 = processSourceCode(result2, '\n', config, []);

        assert.strictEqual(result1, result2, 'Second run should not modify output');
        assert.strictEqual(result2, result3, 'Third run should not modify output');

        // Verify the comment is still with Serilog
        const lines = result3.split('\n');
        const serilogIndex = lines.findIndex(l => l.includes('Serilog'));
        assert.ok(lines[serilogIndex - 1].includes('Special library'));
    });

    test('should handle comments with aliases', () =>
    {
        const input = [
            'using System;',
            '// Alias for readability',
            'using ILogger = Serilog.ILogger;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // Find the alias
        const aliasIndex = lines.findIndex(l => l.includes('ILogger = Serilog.ILogger'));
        assert.ok(aliasIndex > 0);

        // Comment should be before alias
        assert.ok(lines[aliasIndex - 1].includes('Alias for readability'));
    });

    test('should not attach comments separated by blank lines or preprocessor directives', () =>
    {
        const input = [
            '// Orphaned comment',
            '#if DEBUG',
            'using System.Diagnostics;',
            '#endif',
            'using System;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // The orphaned comment should be at the beginning
        assert.ok(lines[0].includes('Orphaned comment'));

        // System.Diagnostics should not have that comment
        const diagnosticsIndex = lines.findIndex(l => l.includes('System.Diagnostics'));
        assert.ok(diagnosticsIndex > 0);
        assert.ok(!lines[diagnosticsIndex - 1].includes('Orphaned comment'));
    });

    test('should distinguish file-level comments from attached comments', () =>
    {
        const input = [
            '// Barrr',
            '',
            '// Goo-goo',
            'using Allocate.Apps.Retail.Api.App;',
            '// goo',
            'using Allocate.Apps.Retail.Api.Salesforce.Models;',
            'using System;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // "// Barrr" should be at the top as a file-level comment
        assert.ok(lines[0].includes('Barrr'), 'File-level comment should be at the top');

        // There should be a blank line after file-level comments
        assert.strictEqual(lines[1].trim(), '', 'Should have blank line after file-level comment');

        // After sorting, System should be first
        const systemIndex = lines.findIndex(l => l.includes('using System'));
        assert.ok(systemIndex > 0, 'System using should exist');

        // Find the Allocate.Apps.Retail.Api.App using
        const appIndex = lines.findIndex(l => l.includes('using Allocate.Apps.Retail.Api.App'));
        assert.ok(appIndex > 0, 'App using should exist');

        // "// Goo-goo" should be directly before the App using
        assert.ok(lines[appIndex - 1].includes('Goo-goo'),
            'Adjacent comment should stick to its using after sorting');

        // Find the Allocate.Apps.Retail.Api.Salesforce.Models using
        const salesforceIndex = lines.findIndex(l => l.includes('using Allocate.Apps.Retail.Api.Salesforce.Models'));
        assert.ok(salesforceIndex > 0, 'Salesforce using should exist');

        // "// goo" should be directly before the Salesforce using
        assert.ok(lines[salesforceIndex - 1].includes('// goo'),
            'Adjacent comment should stick to its using after sorting');
    });

    test('should handle block comments attached to usings', () =>
    {
        const input = [
            '/* File header comment */',
            '',
            '/* This is about System */',
            'using System;',
            '/* Multi-line block comment',
            '   about Newtonsoft */',
            'using Newtonsoft.Json;',
            '',
            'namespace MyApp;',
        ].join('\n');

        const config = new FormatOptions('System', false, false, false);
        const result = processSourceCode(input, '\n', config, []);

        const lines = result.split('\n');

        // File header block comment should be at the top
        assert.ok(lines[0].includes('File header comment'), 'File-level block comment should be at the top');

        // Blank line after file header
        assert.strictEqual(lines[1].trim(), '', 'Should have blank line after file-level comment');

        // Find System using
        const systemIndex = lines.findIndex(l => l.includes('using System'));
        assert.ok(systemIndex > 0, 'System using should exist');

        // Block comment about System should be directly before it
        assert.ok(lines[systemIndex - 1].includes('This is about System'),
            'Block comment should stick to its using');

        // Find Newtonsoft using
        const newtonsoftIndex = lines.findIndex(l => l.includes('using Newtonsoft'));
        assert.ok(newtonsoftIndex > 0, 'Newtonsoft using should exist');

        // Multi-line block comment should be before Newtonsoft
        // The comment spans 2 lines, so check the line 2 lines before
        assert.ok(lines[newtonsoftIndex - 2].includes('Multi-line block comment'),
            'Multi-line block comment should stick to its using');
        assert.ok(lines[newtonsoftIndex - 1].includes('about Newtonsoft'),
            'Second line of block comment should be present');
    });
});
