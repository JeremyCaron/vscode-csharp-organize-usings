(?:^|\bnamespace\s+[\w.]+\s*\{\s*(?:[\n]|[\r\n])+)(?:(?:[\n]|[\r\n])*(?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|(?:\/\/.*(?:[\n]|[\r\n])*)*(?:(?:global\s+)?(?:using\s+static\s+|using\s+)(?!.*\s+\w+\s*=\s*new)(?:\[.*?\]|[\w.]+);|(?:global\s+)?using\s+\w+\s*=\s*[\w.]+;))(?:[\n]|[\r\n])*)+/gm

Explanation:
1. /.../ with gm flags

    g: Global flag ensures the regex finds all matches, not just the first one.
    m: Multiline flag treats the input as multiple lines, allowing ^ and $ to match the start and end of each line.

2. (?:^|\bnamespace\s+[\w.]+\s*\{\s*(?:[\n]|[\r\n])+)

    (?:...|...): Non-capturing group with alternation - matches either pattern
    ^: Matches the start of a line (for usings at file level)
    |: OR
    \bnamespace\s+[\w.]+\s*\{\s*(?:[\n]|[\r\n])+: Matches usings inside traditional namespace blocks
        \bnamespace: Word boundary + "namespace" keyword
        \s+: One or more whitespace characters
        [\w.]+: Namespace name (e.g., MyCompany.App)
        \s*: Optional whitespace
        \{: Opening brace of namespace block
        \s*: Optional whitespace
        (?:[\n]|[\r\n])+: One or more newlines after the opening brace

3. (?:...)+

    Outer non-capturing group that repeats one or more times
    Contains the using statement patterns

4. (?:[\n]|[\r\n])*

    (?:[\n]|[\r\n]): Matches a single newline character (\n) or a Windows-style newline (\r\n)
    *: Matches zero or more newlines, allowing optional blank lines

5. (?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*)

    #(?:if|else|elif|endif): Matches preprocessor directives (#if, #else, #elif, #endif)
    .*: Matches the rest of the line after the directive
    (?:[\n]|[\r\n])*: Matches zero or more newlines following the directive

6. (?:\/\/.*(?:[\n]|[\r\n])*)*

    \/\/.*: Matches single-line comments starting with // and everything following
    (?:[\n]|[\r\n])*: Matches zero or more newlines after comments
    *: Matches zero or more occurrences of comment lines

7. (?:(?:global\s+)?(?:using\s+static\s+|using\s+)(?!.*\s+\w+\s*=\s*new)(?:\[.*?\]|[\w.]+);|(?:global\s+)?using\s+\w+\s*=\s*[\w.]+;)

    This is the main using statement pattern with two alternatives:

    A. Regular using statements (with optional global and static modifiers):
       (?:global\s+)?(?:using\s+static\s+|using\s+)(?!.*\s+\w+\s*=\s*new)(?:\[.*?\]|[\w.]+);
        (?:global\s+)?: Optional "global" keyword followed by whitespace
        (?:using\s+static\s+|using\s+): Either "using static " or "using "
        (?!.*\s+\w+\s*=\s*new): Negative lookahead to exclude using declarations (using var x = new ...)
        (?:\[.*?\]|[\w.]+): Either an attribute in brackets OR a namespace/type name
        ;: Semicolon ending

    B. Alias using statements (with optional global modifier):
       (?:global\s+)?using\s+\w+\s*=\s*[\w.]+;
        (?:global\s+)?: Optional "global" keyword
        using\s+: "using" keyword
        \w+\s*=\s*: Alias name followed by equals sign
        [\w.]+: Target namespace/type
        ;: Semicolon ending

8. (?:[\n]|[\r\n])*

    Matches zero or more newlines following a using statement

Summary

This regex matches blocks of using statements in C# files, including:

    File-level using statements (starting from beginning of line)
    Using statements inside traditional namespace { } blocks
    Preprocessor directives (#if, #else, #elif, #endif)
    Single-line comments (//)
    Regular using statements: using System;
    Using static statements: using static System.Math;
    Global using statements: global using System;
    Combined modifiers: global using static System.Console;
    Alias using statements: using ILogger = Serilog.ILogger;
    Global alias statements: global using ILogger = Serilog.ILogger;

The regex explicitly excludes:
    Using declarations: using var x = new Thing(); or using (var x = new Thing())
    These are filtered out by the negative lookahead (?!.*\s+\w+\s*=\s*new)

Modifying Tips

    - Adding new directives: Extend the (?:if|else|elif|endif) group
    - Handling additional comment types: Add new patterns for comment styles
    - Supporting new using patterns: Extend the using statement section with additional logic
