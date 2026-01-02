/^(?:(?:[\n]|[\r\n])*(?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|(?:\/\/.*(?:[\n]|[\r\n])*)*(?:using\s+(?!.*\s+=\s+)(?:\[.*?\]|\w+(?:\.\w+)*);|using\s+\w+\s*=\s*[\w.]+;))(?:[\n]|[\r\n])*)+/gm

Explanation:
1. /^.../gm

    ^: Ensures the regex matches from the start of a line.
    g: Global flag ensures the regex finds all matches, not just the first one.
    m: Multiline flag treats the input as multiple lines, allowing ^ and $ to match the start and end of each line.

2. (?:...)+

    (?:...): A non-capturing group. This groups the enclosed pattern without creating a capturing group, which avoids unnecessary backreferences.
    +: Matches one or more occurrences of the non-capturing group.

3. (?:[\n]|[\r\n])*

    (?:[\n]|[\r\n]): Matches a single newline character (\n) or a Windows-style newline (\r\n).
    *: Matches zero or more newlines. This allows optional blank lines at the start of the matched block.

4. (?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*)

    #(?:if|else|elif|endif): Matches preprocessor directives (#if, #else, #elif, #endif) at the start of a line.
        (?:if|else|elif|endif): A non-capturing group that matches one of the specified directives.
    .*: Matches the rest of the line after the directive (including any condition or comment).
    (?:[\n]|[\r\n])*: Matches zero or more newline characters, ensuring any blank lines following the directive are included.

5. (?:\/\/.*(?:[\n]|[\r\n])*)*

    \/\/.*: Matches single-line comments starting with // and everything following on the same line.
    (?:[\n]|[\r\n])*: Matches zero or more newline characters, allowing for blank lines after comments.
    *: Matches zero or more occurrences of comment lines (with optional blank lines between them).

6. (?:using\s+(?!.*\s+=\s+)(?:\[.*?\]|\w+(?:\.\w+)*);|using\s+\w+\s*=\s*[\w.]+;)

    (?:...|...): Matches either of the two specified patterns for using statements:
        using\s+(?!.*\s+=\s+)(?:\[.*?\]|\w+(?:\.\w+)*);
            using\s+: Matches the keyword using followed by one or more spaces.
            (?!.*\s+=\s+): Negative lookahead ensures the line does not contain an assignment (=).
            (?:\[.*?\]|\w+(?:\.\w+)*): Matches either:
                \[.*?\]: An attribute enclosed in square brackets (e.g., [SomeAttribute]).
                \w+(?:\.\w+)*: A namespace or class name (e.g., System.IO).
            ;: Matches the semicolon at the end of the statement.
        using\s+\w+\s*=\s*[\w.]+;
            using\s+: Matches the keyword using followed by one or more spaces.
            \w+\s*=\s*[\w.]+: Matches an alias assignment in the form alias = Namespace or alias = Namespace.Class.
            ;: Matches the semicolon at the end of the statement.
    |: Alternates between the two using statement patterns.

7. (?:[\n]|[\r\n])*

    Matches zero or more newlines following a using statement or block.

8. +

    Ensures the entire block repeats as a unit, allowing multiple contiguous matches for # directives, comments, and using statements.

Summary

This regex is designed to match blocks of using statements in C# files, including optional leading comments and preprocessor directives. It accounts for:

    Preprocessor directives (#if, #else, etc.).
    Comments (single-line //).
    Standard using statements, with or without attributes or namespaces.
    Alias using statements (using alias = ...).

Modifying Tips

    - Adding new directives: To include more preprocessor directives, extend the (?:if|else|elif|endif) group.
    - Handling additional comment types: Add new patterns for comment styles if needed.
    - Supporting new using patterns: Extend the (?:using\s+...) section with additional logic for matching.