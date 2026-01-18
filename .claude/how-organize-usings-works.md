# How the C# Organize Usings Extension Works

This document explains the complete flow of how the VSCode C# Organize Usings extension processes C# source code.

## High-Level Architecture

The extension is a VSCode extension that organizes C# `using` statements by:

1. Removing unused/unnecessary usings (via C# compiler diagnostics)
2. Sorting usings alphabetically with configurable namespace priority
3. Splitting usings into groups by root namespace
4. Managing blank lines between groups and before the namespace declaration

## Entry Points

### 1. Command Execution (`extension.ts`)

- Registers command: `csharpOrganizeUsings.organize`
- Registers CodeActionProvider for "Organize Imports" quick fix
- Calls `organizeEditorUsings()` which uses the clean OOP architecture

### 2. Format On Save

- VSCode's format-on-save triggers the CodeActionProvider
- User can enable `editor.formatOnSave` to automatically organize usings

## Core Processing Flow

### Step 1: Entry (`organizeEditorUsings`)

**File**: `extension.ts`

1. Creates domain objects: `CSharpDocument`, `FormatOptions`, `VsCodeDiagnosticProvider`
2. Creates `UsingBlockOrganizer` and calls `organize()`
3. If successful and changes were made, replaces entire document content

### Step 2: Validation (`ProjectValidator`)

**File**: `services/ProjectValidator.ts`

1. Extracts document text and line ending style (`\n` vs `\r\n`)
2. Finds parent `.csproj` file by traversing up directory tree
3. Verifies project has been restored/compiled:
    - **For Unity projects**: Checks for compiled DLL in `Library/ScriptAssemblies/`
    - **For standard .NET projects**: Checks for `.csproj.nuget.g.props` in `obj/` folder
4. Gets C# diagnostics from VSCode (for unused using detection)
5. Proceeds to extract and process using blocks

### Step 3: Extract Using Blocks (`UsingBlockExtractor`)

**File**: `services/UsingBlockExtractor.ts`

This is the core extraction function. It uses a **line-by-line state machine parser** to find using statement blocks.

**Note:** Previous versions used a complex regex pattern, but this caused catastrophic backtracking on files with many comments. The current implementation guarantees O(n) performance.

#### How It Works

The parser walks through the file line by line, tracking state:
- Whether we're inside a using block
- Whether we're inside a block comment
- Whether we're inside a namespace declaration
- The leading content (comments/blank lines before usings)

For each captured using block, the processor performs these steps:

1. **Parse into UsingStatement objects**
    - Each line is parsed into a `UsingStatement` domain object
    - Knows whether it's a using, comment, preprocessor directive, or blank line
    - Extracts namespace, root namespace, whether it's an alias, etc.

2. **Remove unused usings** (`UnusedUsingRemover`)
    - Uses diagnostics from VSCode's language server (OmniSharp or Roslyn)
    - Looks for diagnostic codes: `CS8019` (OmniSharp) or `IDE0005` (Roslyn)
    - Handles multi-line diagnostics (diagnostics spanning multiple lines)
    - Detects CS0246 errors (namespace not found) and never removes those usings
    - Checks diagnostic reliability to avoid premature removal when language server is initializing
    - Can optionally skip usings within `#if` blocks (via `processUsingsInPreprocessorDirectives` setting)

3. **Filter blank lines** (`WhitespaceNormalizer`)
    - Removes leading and trailing blank lines
    - Collapses consecutive blank lines
    - This is critical: we start with a clean slate before sorting/grouping

4. **Sort usings** (`UsingSorter`)
    - Uses `UsingStatementComparator` for comparison logic
    - **Implements Visual Studio comment sticking behavior**
    - Distinguishes file-level comments (separated by blank line) from using-attached comments
    - Attaches adjacent comments to their immediately following using statements
    - Handles preprocessor directives by processing them separately
    - Supports modern C# features: `global using`, `using static`, and usings inside namespace blocks
    - Respects `usingStaticPlacement` configuration for positioning `using static` statements

5. **Split into groups** (`UsingGroupSplitter`)
    - If `splitGroups` option is enabled
    - Adds blank lines between different root namespaces
    - Respects attached comments when grouping

6. **Normalize whitespace** (`WhitespaceNormalizer`)
    - Ensures proper spacing throughout the block
    - Adds single trailing blank line (C# standard formatting)
    - Handles edge cases like empty blocks

7. **Render back to lines** (`UsingBlock.toLines()`)
    - Converts the processed `UsingStatement` objects back to text lines
    - Preserves leading content (file-level comments)
    - Returns the formatted lines ready to replace the original block

### Step 4: Sort Usings (`UsingSorter`)

**File**: `processors/UsingSorter.ts`

**Algorithm:**

1. Separates leading comments from using statements
2. Separates aliases from normal usings
3. Sorts both arrays using custom comparator:
    - Prioritizes namespaces from `sortOrder` config (default: "System" first)
    - Then alphabetically case-insensitive
    - Shorter namespaces before longer ones if otherwise equal
4. Removes duplicates
5. Recombines: `[comments, nonAliases, aliases]`

**Sort Order Example:**
With `sortOrder: "System"`:

```
using System;
using Microsoft.AspNetCore.Mvc;
using MyCompany.Common;
using Foo = Serilog.Foo;
using ILogger = Serilog.ILogger;
```

### Step 5: Split into Groups (`UsingGroupSplitter`)

**File**: `processors/UsingGroupSplitter.ts`

**Algorithm:**

1. Separates leading comments from using statements
2. Adds blank line after comments (if any)
3. Walks through usings **backwards** (from last to first)
4. Compares root namespace of current using to previous using
5. If root namespaces differ: inserts empty string at that position
6. Skips alias usings (they stay grouped together at end)

**Root namespace:** The first part before the first dot

- `using System.Text.Json;` → root namespace: `System`
- `using Microsoft.Extensions.Logging;` → root namespace: `Microsoft`
- `using MyCompany.Common;` → root namespace: `MyCompany`

**Example output:**

```csharp
using System;
using System.Text.Json;

using Microsoft.Extensions.Logging;

using MyCompany.Common;
using MyCompany.Database;

using Foo = Serilog.Foo;
```

## Configuration Options

**File**: `domain/FormatOptions.ts`

| Option                                  | Default    | Description                                                       |
| --------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `sortOrder`                             | `"System"` | Space-separated list of namespace prefixes to prioritize          |
| `splitGroups`                           | `true`     | Whether to add blank lines between different root namespaces      |
| `disableUnusedUsingsRemoval`            | `false`    | Skip removing unused usings                                       |
| `processUsingsInPreprocessorDirectives` | `false`    | Whether to remove unused usings inside `#if` blocks               |
| `usingStaticPlacement`                  | `"bottom"` | How to position `using static` statements: `bottom`, `groupedWithNamespace`, or `intermixed` |

## Diagnostic Detection

The extension relies on VSCode's C# language server (OmniSharp or Roslyn) to identify unused usings.

**OmniSharp format:**

```typescript
{
    code: 'CS8019',
    source: 'csharp'
}
```

**Roslyn format:**

```typescript
{
    code: { value: 'IDE0005' },
    source: 'roslyn'
}
// or
{
    code: { value: 'CS8019' },
    source: 'roslyn'
}
```

**CS0246 format (namespace not found - never remove):**

```typescript
{
    code: 'CS0246',  // or { value: 'CS0246' }
    source: 'csharp',
    message: 'The type or namespace name could not be found'
}
```

### Multi-line Diagnostics

The extension handles diagnostics that span multiple lines. When a diagnostic's `range.start.line` differs from `range.end.line`, all lines in that range are considered for removal, except those with CS0246 errors.

## Edge Cases Handled

1. **Modern C# syntax**
    - `global using` directives (C# 10+) - Recognized and preserved
    - `using static` directives - Positioned according to `usingStaticPlacement` setting
    - File-scoped namespaces - Properly handled
    - Usings inside `namespace { }` blocks - Correctly extracted and organized
    - `using var` declarations - Ignored (not touched by the extension)

2. **Preprocessor directives** (`#if`, `#else`, `#endif`, `#elif`)
    - Preserved and can be excluded from unused using removal
    - Multi-line diagnostics spanning preprocessor boundaries handled correctly
    - Sorted separately from normal usings

3. **Comments before usings**
    - File-level comments (separated by blank line) preserved at the top
    - Inline comments (adjacent to usings) stick to their using statement during sorting
    - Supports both `//` single-line and `/* */` block comments

4. **Leading blank lines**
    - Up to 1 preserved if there's content before usings

5. **Empty using blocks**
    - If all usings are removed, no blank lines added

6. **Alias usings**
    - Kept at the end after all normal usings
    - Not split into groups

7. **Multi-line diagnostics**
    - Diagnostics spanning multiple lines handled correctly
    - CS0246 errors (namespace not found) prevent removal even in multi-line diagnostics
    - Partial removal supported (e.g., remove line 2 and 3 but keep line 1 with CS0246)

8. **Diagnostic reliability**
    - Detects premature diagnostics when language server is still initializing
    - Won't remove all usings if diagnostics appear unreliable
    - Heuristic: If ALL usings marked unused and count > 3, likely premature

9. **Project not restored/compiled**
    - Extension blocks execution with error message
    - Prevents wiping out all usings due to missing or inaccurate diagnostics
    - Unity projects: Must be opened and compiled in Unity first
    - Standard .NET projects: Must run `dotnet restore` or build

## Key Data Structures

### Usings Array

The `usings` array is the central data structure, modified in-place throughout processing:

```typescript
string[]  // Each element is either:
          // - A using statement: "using System;"
          // - A comment: "// This is a comment"
          // - A preprocessor directive: "#if DEBUG"
          // - An empty string: "" (represents blank line)
```

### Diagnostic

VSCode diagnostic object identifying unused usings:

```typescript
{
    code: string | { value: string },
    source: string,
    range: vs.Range,  // Line numbers in file
    message: string,
    severity: vs.DiagnosticSeverity
}
```

## Performance Considerations

1. **Line-by-line parsing** (O(n) guaranteed)
    - No regex backtracking issues
    - Processes all using blocks in one pass
    - Efficient for files with multiple using blocks (e.g., file-scoped namespaces)

2. **Domain object caching**
    - `UsingStatement` objects are created once and reused
    - Sorting and grouping work with object references

3. **Diagnostic filtering**
    - Diagnostics from entire file are passed in
    - Filtered by line number offset to match using block

## Testing Strategy

The test suite covers:

1. **Domain layer:** `UsingStatement` parsing, `UsingBlock` rendering
2. **Processor layer:** Individual processor unit tests (`UsingSorter`, `UsingGroupSplitter`, etc.)
3. **Service layer:** `UsingBlockExtractor` regex and line mapping
4. **Integration:** Full pipeline tests in `UsingBlockProcessor`
5. **End-to-end:** Complete workflow scenarios

The clean OOP architecture makes each component independently testable with **216+ passing tests**.
