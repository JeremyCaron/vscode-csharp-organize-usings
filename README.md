# C# Organize Usings for Visual Studio Code

This extension helps organize C# `using` statements and is meant to replicate the sorting and cleanup behavior you may be familiar with from Visual Studio. It is an actively-supported, forked version of the abandoned [CSharpFormatUsings](https://marketplace.visualstudio.com/items?itemName=gaoshan0621.csharp-format-usings) extension that offers bug fixes, new features, and compatibility with the OmniSharp, Roslyn, and C# Dev Kit Language Servers.

## Features

- Removes unnecessary `using` directives (enabled by default but can be disabled) and duplicates.
- Sorts `using` directives in alphabetical order and into groups by the first level of the namespace.
- Configurable ordering of namespaces, offering control of where the "System" & "Microsoft" namespaces sort for example.
- Supports modern C# features including `global using`, `using static`, and file-scoped namespaces.
- Intelligently handles comments - preserves file-level comments and keeps inline comments attached to their using statements during sorting.
- Can be triggered on save, via the right-click menu in the editor, or with the `Organize C# Usings` command in the Command Palette (can also be setup as a keyboard shortcut).
- Offers multiple configurable settings for formatting the `using` section (see "Extension Settings" below).

## Version History

- **2.0.1**: Fixes #31 where the extension would add an extra new line after xmldoc comments.
- **2.0.0**: Major architectural rewrite to move to an OO style, with significant improvements:
    - Lays a foundation for easier maintenance and faster iteration
    - Modern C# support: `global using`, `using static` (with configurable placement), file-scoped namespaces, usings inside `namespace { }` blocks
    - Smart diagnostic handling: CS0246 error detection (don't remove a using if the reference is missing, it may be in use)
    - Intelligent comment handling: Distinguishes file-level from using-attached comments
    - Performance: O(n) parser eliminates catastrophic backtracking, resolving execution hangs
    - Testing: Comprehensive test suite
    - New `usingStaticPlacement` configuration option, multiple bugfixes
    - Removed v1.1.0's guard against early / unbuilt execution - will revisit in future releases
- **1.2.1**: Fix issue with extra new lines after using statements in some C# files.
- **1.2.0**: Promote pre-release to full release.
- **1.1.0**: Basic support for preprocessing directives in using blocks (Issue [#21](https://github.com/JeremyCaron/vscode-csharp-organize-usings/issues/21)), reworked the regex that finds blocks of using statements to better handle empty lines and comments, changed the setting for removing unused usings to be a disable-focused one for easier overriding, retired support for the numEmptyLinesAfterUsings & numEmptyLinesBeforeUsings settings, and performed a slight refactoring around sorting and splitting.<br>
    - This is our first "pre-release" release, using the numbering scheme suggested [by Microsoft](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#advanced-usage) ("so, we recommend that extensions use `major.EVEN_NUMBER.patch` for release versions and `major.ODD_NUMBER.patch` for pre-release versions").<br>
    - **NOTE**: As of this version, the extension will no longer execute if the current project has not been built yet. The IDE cannot produce code analysis results without the project being built first, and running before that time would typically remove a bunch of usings that are still necessary for compilation. You will see a message in the `output` panel in vscode warning when execution is skipped for this reason.
- **1.0.6**: Fixed a bug that would prevent all unused usings from being removed on the first execution of the "Organize C# Usings" command. The line numbers returned by vs.languages.getDiagnostics were being misinterpreted. New unit tests around the removal of unused usings.
- **1.0.5**: Adds support for running natively on save, improved handling of duplicate removal during cleanup, an output panel channel for debug output, and various improvements in source code.
- **1.0.4**: Handles `IDE0005` diagnostics for unused usings from Roslyn, enabling compatibility with the C# extension when OmniSharp is disabled.
- **1.0.3**: Properly handles aliased `using` directives without breaking syntax such as `using [type] [variableName] = whatever`. Adds basic unit test coverage.
- **1.0.2**: Fixes editor jumpiness based on [Microsoft's recommendation](https://github.com/microsoft/vscode/issues/32058#issuecomment-322162175) to use `TextEditorEdit.delete/insert` instead of `replace`.
- **1.0.1**: Fixed editor jumpiness when running "Organize Usings" on files that require no changes.
- **1.0.0**: Correctly removes unused usings when **all** of a class's usings are unnecessary, and resolves issues caused by extra blank lines between namespace groups.

## Extension Settings

- `sortOrder`: Sets the order of namespaces. Values should be space-separated. "System" by default.
- `splitGroups`: Inserts a blank line between using blocks grouped by the first part of the namespace. Enabled by default.
- `disableUnusedUsingsRemoval`: Disables the removal of unused usings (enabled by default otherwise). Defaults to false.
- `processUsingsInPreprocessorDirectives`: When enabled, unused usings within preprocessing directives will be removed. Defaults to false.
- `usingStaticPlacement`: Controls how `using static` statements are positioned relative to regular using statements. Options:
    - `bottom` (default): Places all `using static` statements at the bottom, after all regular usings
    - `groupedWithNamespace`: Sorts `using static` statements within their namespace group, but after regular usings
    - `intermixed`: Sorts `using static` statements intermixed with regular usings alphabetically

## Execution "On Save"

To auto-organize on saving a C# file, add the following to your `settings.json` file:

`"[csharp]": {
    "editor.codeActionsOnSave": [
        "source.organizeImports"
    ]
}`

## Installation from Sources

1. Install node.js.
2. Run `npm install` from project folder.
3. Run `vsce package` from project folder. Please make sure `vsce` is installed: `npm install -g vsce`.
4. Install brand new packed \*.vsix bundle through vscode plugins menu option "Install from VSIX".

## History

Forked from [CSharpFormatUsings](https://marketplace.visualstudio.com/items?itemName=gaoshan0621.csharp-format-usings) (an abandoned extension that was last modified on Aug 22, 2020) in 2024, which was forked from [CSharpSortUsings](https://marketplace.visualstudio.com/items?itemName=jongrant.csharpsortusings), which was forked from [CSharpFixFormat](https://github.com/umutozel/vscode-csharpfixformat).
