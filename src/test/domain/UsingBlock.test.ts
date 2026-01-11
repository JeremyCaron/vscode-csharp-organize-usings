import * as assert from 'assert';
import { UsingBlock } from '../../domain/UsingBlock';
import { UsingStatement } from '../../domain/UsingStatement';

suite('UsingBlock', () => {
    test('should create block with statements', () => {
        const rawContent = [
            'using System;',
            'using Microsoft.AspNetCore.Mvc;'
        ];

        const block = new UsingBlock(0, 1, rawContent);

        assert.strictEqual(block.startLine, 0);
        assert.strictEqual(block.endLine, 1);
        assert.strictEqual(block.getStatements().length, 2);
        assert.strictEqual(block.getActualUsingCount(), 2);
    });

    test('should preserve blank lines in statements for line number mapping', () => {
        const rawContent = [
            'using System;',
            '',
            'using Microsoft.AspNetCore.Mvc;'
        ];

        const block = new UsingBlock(0, 2, rawContent);

        // Blank lines should be preserved to maintain accurate line number mapping for diagnostics
        assert.strictEqual(block.getStatements().length, 3);
        assert.strictEqual(block.getActualUsingCount(), 2);

        // Verify the blank line is marked as such
        const statements = block.getStatements();
        assert.ok(statements[1].isBlankLine);
    });

    test('should handle leading content (comments)', () => {
        const rawContent = [
            'using System;',
            'using Microsoft.AspNetCore.Mvc;'
        ];

        const leadingContent = [
            '// This is a header comment',
            '// Another comment line'
        ];

        const block = new UsingBlock(2, 3, rawContent, leadingContent);

        assert.strictEqual(block.getLeadingContent().length, 2);
        assert.strictEqual(block.getStatements().length, 2);
    });

    test('should convert block back to lines with trailing blank lines', () => {
        const rawContent = [
            'using System;',
            'using Microsoft.AspNetCore.Mvc;'
        ];

        const block = new UsingBlock(0, 1, rawContent);

        const lines = block.toLines();

        // Should have 2 usings + 2 trailing blank lines
        assert.strictEqual(lines.length, 4);
        assert.strictEqual(lines[0], 'using System;');
        assert.strictEqual(lines[1], 'using Microsoft.AspNetCore.Mvc;');
        assert.strictEqual(lines[2], '');
        assert.strictEqual(lines[3], '');
    });

    test('should include leading content in toLines output', () => {
        const rawContent = [
            'using System;'
        ];

        const leadingContent = [
            '// Comment'
        ];

        const block = new UsingBlock(1, 1, rawContent, leadingContent);

        const lines = block.toLines();

        assert.strictEqual(lines[0], '// Comment');
        assert.strictEqual(lines[1], 'using System;');
        assert.strictEqual(lines[2], '');
        assert.strictEqual(lines[3], '');
    });

    test('should handle empty block gracefully', () => {
        const block = new UsingBlock(0, 0, []);

        assert.strictEqual(block.getStatements().length, 0);
        assert.strictEqual(block.getActualUsingCount(), 0);

        // Empty block should not add trailing blank lines
        const lines = block.toLines();
        assert.strictEqual(lines.length, 0);
    });

    test('should handle comments in statements', () => {
        const rawContent = [
            '// Comment about System',
            'using System;',
            'using Microsoft.AspNetCore.Mvc;'
        ];

        const block = new UsingBlock(0, 2, rawContent);

        // Comments should be preserved in statements
        const statements = block.getStatements();
        assert.ok(statements.some(s => s.isComment));

        // But getActualUsingCount should only count actual usings
        assert.strictEqual(block.getActualUsingCount(), 2);
    });

    test('should allow updating statements', () => {
        const rawContent = [
            'using Microsoft.AspNetCore.Mvc;',
            'using System;'
        ];

        const block = new UsingBlock(0, 1, rawContent);

        // Sort the statements
        const statements = Array.from(block.getStatements()).sort((a, b) =>
            a.namespace.localeCompare(b.namespace)
        );

        block.setStatements(statements);

        const lines = block.toLines();
        assert.ok(lines[0].includes('Microsoft'));
        assert.ok(lines[1].includes('System'));
    });

    test('should handle preprocessor directives', () => {
        const rawContent = [
            '#if DEBUG',
            'using System.Diagnostics;',
            '#endif',
            'using System;'
        ];

        const block = new UsingBlock(0, 3, rawContent);

        const statements = block.getStatements();

        // Should have all lines as statements
        assert.ok(statements.some(s => s.isPreprocessorDirective));

        // Only count actual usings
        assert.strictEqual(block.getActualUsingCount(), 2);
    });
});
