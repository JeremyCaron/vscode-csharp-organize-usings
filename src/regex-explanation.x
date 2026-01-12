# OBSOLETE: This file is retained for historical reference only

This extension NO LONGER uses regular expressions for parsing C# files.

## Why the Change?

The original implementation used a complex regex pattern to extract using blocks from C# files.
However, this approach suffered from **catastrophic backtracking** when processing files with
many commented-out using statements (especially multi-line block comments).

The regex pattern `\/\*[\s\S]*?\*\/` for matching block comments could cause the extension to
hang indefinitely on certain input files, making the extension unusable.

## Current Implementation

The extension now uses a **line-by-line state machine parser** with guaranteed O(n) performance.

See [UsingBlockExtractor.ts](services/UsingBlockExtractor.ts) for the current implementation.

### Benefits of Line-by-Line Parser:

1. **No catastrophic backtracking** - Guaranteed linear time complexity
2. **More maintainable** - Clear state machine logic that's easy to understand
3. **Better edge case handling** - Correctly handles:
   - Single-line and multi-line block comments
   - Preprocessor directives (#if, #else, #elif, #endif, #region, #endregion)
   - Global usings and using static
   - Distinguishing using statements from using declarations/statements in code
   - Proper handling of leading content (file-level comments)
   - Capturing trailing blank lines for correct replacement behavior

## Historical Regex Pattern (OBSOLETE)

The original regex pattern that was replaced:

```regex
(?:^|\bnamespace\s+[\w.]+\s*\{\s*(?:[\n]|[\r\n])+)(?:(?:[\n]|[\r\n])*(?:#(?:if|else|elif|endif).*(?:[\n]|[\r\n])*|(?:\/\/.*(?:[\n]|[\r\n])*)*(?:(?:global\s+)?(?:using\s+static\s+|using\s+)(?!.*\s+\w+\s*=\s*new)(?:\[.*?\]|[\w.]+);|(?:global\s+)?using\s+\w+\s*=\s*[\w.]+;))(?:[\n]|[\r\n])*)+/gm
```

### What it tried to match:

- File-level using statements (starting from beginning of line)
- Using statements inside traditional namespace { } blocks
- Preprocessor directives (#if, #else, #elif, #endif)
- Single-line comments (//)
- Regular using statements: `using System;`
- Using static statements: `using static System.Math;`
- Global using statements: `global using System;`
- Combined modifiers: `global using static System.Console;`
- Alias using statements: `using ILogger = Serilog.ILogger;`

### Why it failed:

Complex nested quantifiers with backtracking on large files with comments caused the regex
engine to explore exponentially many paths, resulting in hangs.

## Related Issues

- Fixed catastrophic backtracking issue that caused extension to hang
- Improved performance on large files
- Better handling of edge cases

## For More Information

See the architecture documentation:
- [.claude/new-architecture-overview.md](.claude/new-architecture-overview.md) - Full system architecture
- [.claude/how-organize-usings-works.md](.claude/how-organize-usings-works.md) - How the extension processes files
