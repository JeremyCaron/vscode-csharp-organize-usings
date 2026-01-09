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
- Calls `organizeUsingsInEditor()` in `formatting.ts`

### 2. Format On Save
- VSCode's format-on-save triggers the CodeActionProvider
- User can enable `editor.formatOnSave` to automatically organize usings

## Core Processing Flow

### Step 1: Entry (`organizeUsingsInEditor`)
**File**: `formatting.ts:13-35`

1. Gets configuration options (sort order, split groups, etc.)
2. Calls `processEditorContent()`
3. If result is returned, replaces entire document content

### Step 2: Validation (`processEditorContent`)
**File**: `formatting.ts:37-60`

1. Extracts document text and line ending style (`\n` vs `\r\n`)
2. Finds parent `.csproj` file by traversing up directory tree
3. Verifies project has been restored (checks for `.csproj.nuget.g.props` in `obj/` folder)
4. Gets C# diagnostics from VSCode (for unused using detection)
5. Calls `processSourceCode()` with the source text

### Step 3: Find and Replace Using Blocks (`processSourceCode`)
**File**: `formatting.ts:62-216`

This is the core processing function. It uses a regex to find using statement blocks and processes each one.

#### The Using Regex (`USING_REGEX`)
**File**: `formatting.ts:10`

See src/regex-explanation.x for what this does and captures.

#### Processing Each Match

For each captured using block, the regex match is passed to a callback that:

1. **Splits and trims** (`line 73`)
   - Splits by line ending (`\n` or `\r\n`)
   - Trims whitespace from each line
   - Result: Array of strings, one per line

2. **Removes unused usings** (`lines 82-85`)
   - Uses `removeUnnecessaryUsings()` to filter out usings marked by C# compiler
   - Diagnostics come from VSCode's language server (OmniSharp or Roslyn)
   - Looks for diagnostic codes: `CS8019` (OmniSharp) or `IDE0005` (Roslyn)
   - Can optionally skip usings within `#if` blocks

3. **Filters empty lines** (`line 87`)
   - `usings = usings.filter(using => using.length > 0)`
   - Removes all blank lines captured by the regex
   - This is critical: we start with a clean slate before sorting/grouping

4. **Sorts usings** (`lines 93-94`)
   - Calls `handleSortingWithOrWithoutDirectives()`
   - If no preprocessor directives: calls `sortUsings()` directly
   - If preprocessor directives exist: separates them, sorts the non-directive usings, then recombines

5. **Splits into groups** (`lines 96-100`)
   - If `splitGroups` option is enabled: calls `splitGroups()`
   - This adds blank lines between different root namespaces

6. **Handles leading comments** (`lines 176-186`)
   - If there's content before the first using (comments, blank lines)
   - Preserves up to 1 blank line before the usings

7. **Adds trailing blank line** (`lines 189-192`)
   - **THE CRITICAL FIX FOR THE BUG:**
   - Previously added 2 empty strings which caused accumulation
   - **Now adds exactly 1 empty string**
   - This creates exactly 1 newline after the last using

8. **Joins and returns** (`line 194`)
   - Joins the array with the line ending character
   - Returns the formatted string
   - This replaces the original using block in the source code

### Step 4: Sort Usings (`sortUsings`)
**File**: `formatting.ts:286-361`

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

### Step 5: Split into Groups (`splitGroups`)
**File**: `formatting.ts:363-400`

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

**File**: `formatting.ts:472-482`

| Option | Default | Description |
|--------|---------|-------------|
| `sortOrder` | `"System"` | Space-separated list of namespace prefixes to prioritize |
| `splitGroups` | `true` | Whether to add blank lines between different root namespaces |
| `disableUnusedUsingsRemoval` | `false` | Skip removing unused usings |
| `processUsingsInPreprocessorDirectives` | `false` | Whether to remove unused usings inside `#if` blocks |

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

## Edge Cases Handled

1. **Preprocessor directives** (`#if`, `#else`, `#endif`)
   - Preserved and can be excluded from unused using removal
   - Sorted separately from normal usings

2. **Comments before usings**
   - Preserved at the top
   - Blank line added between comments and first using

3. **Leading blank lines**
   - Up to 1 preserved if there's content before usings

4. **Empty using blocks**
   - If all usings are removed, no blank lines added

5. **Alias usings**
   - Kept at the end after all normal usings
   - Not split into groups

6. **Project not restored**
   - Extension blocks execution with error message
   - Prevents wiping out all usings due to missing diagnostics

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

1. **Regex is global** (`/g` flag)
   - Processes all using blocks in one pass
   - Efficient for files with multiple using blocks (e.g., file-scoped namespaces)

2. **In-place array modification**
   - Most functions modify the `usings` array directly
   - Avoids unnecessary copying

3. **Diagnostic filtering**
   - Diagnostics from entire file are passed in
   - Filtered by line number offset to match using block

## Testing Strategy

The test suite covers:

1. **Sorting:** Alphabetical, namespace priority, duplicates, aliases
2. **Grouping:** Multiple namespaces, comments, edge cases
3. **Unused removal:** Single/multi-line diagnostics, preprocessor handling
4. **Bug reproduction:** Blank line accumulation across multiple formats

Tests use exported functions (`sortUsings`, `splitGroups`, `removeUnnecessaryUsings`) for unit testing, and `processSourceCode` for integration testing.
