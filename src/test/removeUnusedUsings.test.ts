import * as assert from 'assert';
import { removeUnnecessaryUsings } from '../formatting';
import * as vs from 'vscode';

suite('removeUnnecessaryUsings', () => {

    test('should remove unused usings based on single-line Diagnostics', () => {
        const input = [
            'using System;',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(8, 0), new vs.Position(8, 1))
            }
        ];

        const expected = [
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('should remove unused usings on multiple lines from a single Diagnostic range', () => {
        const input = [
            'using System;',
            'using System.Collections;',
            'using System.Buffers;',
            'using System.Runtime.CompilerServices;',
            'using System.CodeDom;',
            '',
            'using Microsoft.CodeAnalysis;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(0, 0), new vs.Position(0, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(2, 0), new vs.Position(2, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(6, 1))
            }
        ];

        const expected = [
            'using System.Collections;',
            'using System.Runtime.CompilerServices;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('should remove unused usings correctly regardless of proceeding content', () => {
        const input = [
            '// test comment',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(8, 0), new vs.Position(8, 1))
            }
        ];

        const expected = [
            '// test comment',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('should remove unused usings correctly regardless of proceeding empty lines', () => {
        const input = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(8, 0), new vs.Position(8, 1))
            }
        ];

        const expected = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Database.Services;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('should remove unused usings correctly regardless of macros if all macro content is used', () => {
        const input = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            '#if UNITY_ANDROID',
            'using AwesomeCompany.Common.Database.Android.Services;',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(10, 0), new vs.Position(10, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(12, 0), new vs.Position(12, 1))
            }
        ];

        const expected = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            '#if UNITY_ANDROID',
            'using AwesomeCompany.Common.Database.Android.Services;',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('should remove unused usings within preprocessing directives if processing those is enabled', () => {
        const input = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            '#if UNITY_ANDROID',
            'using AwesomeCompany.Common.Database.Android.Services;',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(10, 0), new vs.Position(10, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(12, 0), new vs.Position(12, 1))
            }
        ];

        const expected = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            '#if UNITY_ANDROID',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0, true);
        assert.deepEqual(input, expected);
    });

    test('should not remove unused usings within preprocessing directives if processing those is not enabled', () => {
        const input = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            'using AwesomeCompany.Common.Constants;',
            '#if UNITY_ANDROID',
            'using AwesomeCompany.Common.Database.Android.Services;',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.Users.ServiceClient;',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            'using AutoMapper;',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(6, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(10, 0), new vs.Position(10, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(12, 0), new vs.Position(12, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(15, 0), new vs.Position(15, 1))
            },
        ];

        const expected = [
            '',
            '',
            'using AwesomeCompany.Common.Authorization.Enums;',
            'using AwesomeCompany.Common.Comparison;',
            '#if UNITY_ANDROID',
            'using AwesomeCompany.Common.Database.Android.Services;',
            '#else',
            'using AwesomeCompany.Common.Database.Services;',
            '#endif',
            'using AwesomeCompany.FooBar.Contracts.RequestModels;',
            'using AwesomeCompany.FooBar.Contracts.ResponseModels.Teasers;',
            '',
            '',
            'using Microsoft.AspNetCore.Authorization;',
            'using Microsoft.AspNetCore.Mvc;',
            '',
            'using Foo = Serilog.Foo;',
            'using ILogger = Serilog.ILogger;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });

    test('another complicated case where everything should work right but currently does not', () => {
        const input = [
            '',
            '',
            '',
            '',
            'using System;',
            'using System.Collections;',
            'using System.CodeDom;',
            'using Microsoft.Win32;',
            '#if UNITY_ANDROID',
            'using Microsoft.CodeAnalysis.CSharp;',
            '#else',
            'using System.Configuration.Assemblies;',
            '#endif',
            'using System.Runtime.CompilerServices;',
            'using System.Configuration;',
            '',
            'using Microsoft.CodeAnalysis;',
            'using Microsoft.Win32.SafeHandles;',
            'namespace ConsoleAppFramework;'
        ];

        const diagnostics: vs.Diagnostic[] = [
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(4, 0), new vs.Position(4, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(6, 0), new vs.Position(7, 1))
            },
            {
                code: {value: 'IDE0005', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(9, 0), new vs.Position(9, 1))
            },
            {
                code: 'CS8019',
                source: 'csharp',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(11, 0), new vs.Position(11, 1))
            },
            {
                code: {value: 'CS8019', target: vs.Uri.parse("null")},
                source: 'roslyn',
                message: 'Using directive is unnecessary.',
                severity: vs.DiagnosticSeverity.Warning,
                range: new vs.Range(new vs.Position(14, 0), new vs.Position(17, 1))
            }
        ];

        const expected = [
            '',
            '',
            '',
            '',
            'using System.Collections;',
            '#if UNITY_ANDROID',
            'using Microsoft.CodeAnalysis.CSharp;',
            '#else',
            'using System.Configuration.Assemblies;',
            '#endif',
            'using System.Runtime.CompilerServices;',
            'namespace ConsoleAppFramework;'
        ];

        removeUnnecessaryUsings(diagnostics, input, 0);
        assert.deepEqual(input, expected);
    });
});
