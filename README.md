# C# Organize Usings for Visual Studio Code

This extension helps organize C# using statements.  Updated with bug fixes for 2024.

## Features

* Sorts usings in alphabetical order and removes duplicates.
* Triggered via context menu or "Organize Usings" command.
* Removes unnecessary usings (enabled by default but can be disabled).
* Offers multiple configurable settings for formatting the usings section, see "Extension Settings" below.

## Version History

* (v1.0.4) Handle IDE0005 flavor of "unused usings" diagnostics from Roslyn to enable compatibility with the C# extension when OmniSharp is disabled.
* (v1.0.3) Properly handle aliased using directives, without breaking places that use "using [type] [variableName] = whatever" syntax.  Added some very basic unit testing coverage.
* (v1.0.2) Better fix for editor jumpiness per [Microsoft's recommendation](https://github.com/microsoft/vscode/issues/32058#issuecomment-322162175) to use TextEditorEdit.delete/insert instead of replace.
* (v1.0.1) Fixed editor jumpiness when running "Organize Usings" on a file that needs no changes.
* (v1.0.0) Now correctly removes unused usings when ALL of a classes usings are unnecessary & when there are extra blank lines between namespace groups (this was previously causing the wrong lines to be removed from the source file).

## Extension Settings

* `sortOrder`: Put namespaces in proper order. Values should be splitted with space. "System" by default.
* `splitGroups`: Insert blank line between using blocks grouped by first part of namespace. True by default.
* `removeUnnecessaryUsings`: Remove unnecessary usings if true. True by default.
* `numEmptyLinesAfterUsings`: The number of empty lines would be preserved between using statements and code block
* `numEmptyLinesBeforeUsings`: The maximum number of empty lines before using statements if there are characters, like comments, before usings.

## Installation of release version

Use instructions from marketplace: [C# Organize Usings](https://marketplace.visualstudio.com/items?itemName=jeremycaron.csharp-organize-usings)

## Installation from sources

1. Install node.js.
2. Run "npm install" from project folder.
3. Run "vsce package" from project folder. Please make sure `vsce` is installed: `npm install -g vsce`.
4. Install brand new packed *.vsix bundle through vscode plugins menu option "Install from VSIX".

## History

Forked from [CSharpFormatUsings](https://marketplace.visualstudio.com/items?itemName=gaoshan0621.csharp-format-usings) (an abandoned extension that was last modified on Aug 22, 2020) in 2024, which was forked from [CSharpSortUsings](https://marketplace.visualstudio.com/items?itemName=jongrant.csharpsortusings), which was forked from [CSharpFixFormat](https://github.com/umutozel/vscode-csharpfixformat).
