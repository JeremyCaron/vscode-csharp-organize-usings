import * as assert from 'assert';
import { sortUsings, splitGroups, USING_REGEX } from '../formatting';
import { IFormatOptions } from '../interfaces/IFormatOptions';

suite('Usings Tests', () => 
{
    const options: IFormatOptions =
    {
        sortOrder: 'System',
        splitGroups: true,
        disableUnusedUsingsRemoval: true,
        processUsingsInPreprocessorDirectives: false
    };

    test('regex captures blocks it should and excludes those it should not', () => {
        const input = [
            'using System;',
            '// blah blah blah using this other thing...',
            'using ILogger = Serilog.ILogger;',
            'using (Foo xyz = new())',
            'using Foo xyz = new();',
        ].join('\n');
    
        const expected = [
            'using System;',
            '// blah blah blah using this other thing...',
            'using ILogger = Serilog.ILogger;',
            ''
        ];

        // Use matchAll to find all matches
        const matches = Array.from(input.matchAll(USING_REGEX));

        // Validate each match's lines array
        matches.forEach((match, index) => {
            const rawBlock = match[0]; // The matched block
            const lines = rawBlock.split('\n').map(l => l?.trim() ?? ''); // Process lines
            assert.deepEqual(lines, expected, `Lines for match ${index} do not match expected content.`);
        });

        // Confirm the total number of matches
        assert.strictEqual(matches.length, 1, 'Number of matches does not match expected count.');
    });
    

    test('sortUsings should correctly sort using statements', () =>
    {
        const input = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using Foo = Serilog.Foo;',
            'using AwesomeCompany.Common.Comparison;',
            'using ILogger = Serilog.ILogger;',
            'using Microsoft.AspNetCore.Mvc;',
        ];

        const expected = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using Microsoft.AspNetCore.Mvc;',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;',
        ];

        sortUsings(input, options);
        assert.deepEqual(input, expected);
    });

    test('sortUsings should remove duplicates', () =>
    {
        const input = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using Foo = Serilog.Foo;',
            'using AwesomeCompany.Common.Comparison;',
            'using ILogger = Serilog.ILogger;',
            'using Microsoft.AspNetCore.Mvc;',
            'using ILogger = Serilog.ILogger;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using System;',
        ];

        const expected = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using Microsoft.AspNetCore.Mvc;',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;',
        ];

        sortUsings(input, options);
        assert.deepEqual(input, expected);
    });

    test('splitGroups should correctly split using statements', () =>
    {        
        const input = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.Venture.Contracts.RequestModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels.Teasers;',
            'using AutoMapper;',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const expected = [
            'using System;',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.Venture.Contracts.RequestModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        splitGroups(input);
        assert.deepEqual(input, expected);
    });

    test('splitGroups should correctly split using statements with comments at front', () =>
    {        
        const input = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            'using CliFx;',
            'using Cocona.Benchmark.External.Commands;',
            'using CommandLine;',
            'using ConsoleAppFramework;',
            'using PowerArgs;',
            'using Spectre.Console.Cli;',
            'using System.ComponentModel.DataAnnotations.Schema;',
            'using BenchmarkDotNet.Columns;'
        ];

        const expected = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            '',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            '',
            'using CliFx;',
            '',
            'using Cocona.Benchmark.External.Commands;',
            '',
            'using CommandLine;',
            '',
            'using ConsoleAppFramework;',
            '',
            'using PowerArgs;',
            '',
            'using Spectre.Console.Cli;',
            '',
            'using System.ComponentModel.DataAnnotations.Schema;',
            '',
            'using BenchmarkDotNet.Columns;'
        ];
        // sortUsings(input, options);
        splitGroups(input);
        assert.deepEqual(input, expected);
    });

    test('sortUsings can handle using statements with comments at front', () =>
    {
        // Usings should not be moved ahead of the comments.
        const input = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            'using CliFx;',
            'using Cocona.Benchmark.External.Commands;',
            'using CommandLine;',
            'using ConsoleAppFramework;',
            'using PowerArgs;',
            'using Spectre.Console.Cli;',
            'using System.ComponentModel.DataAnnotations.Schema;',
            'using BenchmarkDotNet.Columns;'
        ];

        const expected = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            'using System.ComponentModel.DataAnnotations.Schema;',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Columns;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            'using CliFx;',
            'using Cocona.Benchmark.External.Commands;',
            'using CommandLine;',
            'using ConsoleAppFramework;',
            'using PowerArgs;',
            'using Spectre.Console.Cli;'
        ];
        sortUsings(input, options);
        assert.deepEqual(input, expected);
    });

    test('sortUsings and splitGroups should correctly format using statements with comments at front', () =>
    {        
        const input = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            'using CliFx;',
            'using Cocona.Benchmark.External.Commands;',
            'using CommandLine;',
            'using ConsoleAppFramework;',
            'using PowerArgs;',
            'using Spectre.Console.Cli;',
            'using System.ComponentModel.DataAnnotations.Schema;',
            'using BenchmarkDotNet.Columns;'
        ];

        const expected = [
            '// This benchmark project is based on CliFx.Benchmarks.',
            '// https://github.com/Tyrrrz/CliFx/tree/master/CliFx.Benchmarks/',
            '',
            'using System.ComponentModel.DataAnnotations.Schema;',
            '',
            'using BenchmarkDotNet.Attributes;',
            'using BenchmarkDotNet.Columns;',
            'using BenchmarkDotNet.Engines;',
            'using BenchmarkDotNet.Order;',
            '',
            'using CliFx;',
            '',
            'using Cocona.Benchmark.External.Commands;',
            '',
            'using CommandLine;',
            '',
            'using ConsoleAppFramework;',
            '',
            'using PowerArgs;',
            '',
            'using Spectre.Console.Cli;'
        ];
        sortUsings(input, options);
        splitGroups(input);
        assert.deepEqual(input, expected);
    });

    test('sortUsings should handle empty input', () => 
    {
        const input: string[] = [];
        sortUsings(input, options);
        assert.deepEqual(input, []);
    });

    test('sortUsings should handle single using statement', () => 
    {
        const input = ['using System;'];
        sortUsings(input, options);
        assert.deepEqual(input, ['using System;']);
    });

    test('sortUsings should handle duplicate using statements', () =>
    {        
        const input = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using System;',
            'using AwesomeCompany.Common.Comparison;',
        ];

        const expected = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
        ];

        sortUsings(input, options);
        assert.deepEqual(input, expected);
    });

    test('splitGroups should handle empty input', () => 
    {
        const input: string[] = [];
        splitGroups(input);
        assert.deepEqual(input, []);
    });

    test('splitGroups should handle single using statement', () => 
    {
        const input = ['using System;'];
        splitGroups(input);
        assert.deepEqual(input, ['using System;']);
    });

    test('splitGroups should handle no groups', () => 
    {
        const input = [
            'using Foo;',
            'using Bar;',
            'using Baz;',
        ];

        splitGroups(input);

        assert.deepEqual(input, [
            'using Foo;',
            '',
            'using Bar;',
            '',
            'using Baz;',
        ]);
    });

    test('splitGroups should handle multiple groups', () =>
    {
        const input = [
            'using System;',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AutoMapper;',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;',
            'using AwesomeCompany.Venture.Contracts.RequestModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels.Teasers;',
        ];

        const expected = [
            'using System;',
            '',
            'using AutoMapper;',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Venture.Contracts.RequestModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels;',
            'using AwesomeCompany.Venture.Contracts.ResponseModels.Teasers;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;',
        ];

        sortUsings(input, options);
        splitGroups(input);
        assert.deepEqual(input, expected);
    });
});
