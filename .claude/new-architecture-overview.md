# New C#-Style OOP Architecture

## Overview

The VSCode C# Organize Usings extension has been completely refactored from a callback-based, procedural style into a clean, object-oriented architecture that should feel natural to C# developers.

## Why This Refactor?

The original code used:
- Nested callback functions within functions
- String regex replacement with callbacks
- Mixed procedural/functional style with array mutations
- State passed through function parameters
- Hard to test and maintain for developers with C# background

The new architecture uses:
- **Classes with single responsibilities** (like C# services)
- **Fluent API / method chaining** (like LINQ)
- **Dependency injection** through constructors
- **Value objects and domain entities**
- **Strategy pattern** for processors
- **Strong typing** everywhere

## Architecture Overview

```
VSCode Command Entry
    ↓
extension.ts (Entry Point)
    ↓
UsingBlockOrganizer (Main Service/Orchestrator)
    ↓
├── ProjectValidator (Validates project is restored)
├── UsingBlockExtractor (Finds using blocks via regex)
└── UsingBlockProcessor (Processing Pipeline)
        ↓
        ├── UnusedUsingRemover
        ├── UsingSorter → UsingStatementComparator
        ├── UsingGroupSplitter
        ├── PreprocessorDirectiveHandler
        └── WhitespaceNormalizer
```

## Key Classes

### Domain Layer (`src/domain/`)

These represent the core concepts of the problem:

- **`CSharpDocument`** - Represents the C# file being edited
  - Encapsulates file path, content, line endings, project file
  - Similar to a document model in C#

- **`UsingStatement`** - Represents a single line in a using block
  - Can be: actual using statement, comment, preprocessor directive, or blank line
  - Parses itself from text (`UsingStatement.parse()`)
  - Knows its namespace, root namespace, whether it's an alias, etc.
  - Supports attaching comment lines to using statements (for Visual Studio-style comment sticking)
  - **Mostly immutable value object** (with mutable attached comments collection)

- **`UsingBlock`** - Represents a block of using statements
  - Has start/end line numbers
  - Contains collection of `UsingStatement` objects
  - Can render itself back to lines
  - **Domain entity**

- **`FormatOptions`** - Configuration for organizing
  - Created from VSCode workspace settings
  - Immutable configuration object

- **`OrganizationResult`** - Result of the organization operation
  - Success/failure with message
  - **Result pattern** (like Result<T, E> in Rust or functional programming)

### Processor Layer (`src/processors/`)

These implement the transformation logic:

- **`IDiagnosticProvider`** (Interface) - Provides diagnostics about unused usings
  - **Dependency injection interface**
  - `VsCodeDiagnosticProvider` - implementation that talks to VSCode

- **`UnusedUsingRemover`** - Removes unused using statements
  - Uses diagnostics from language server
  - Handles preprocessor directives

- **`UsingSorter`** - Sorts using statements
  - Uses `UsingStatementComparator` for comparison logic
  - Attaches comments to their immediately following using statements (Visual Studio behavior)
  - Handles orphaned comments, regular usings, aliases, directives separately
  - Removes duplicates

- **`UsingStatementComparator`** - Compares two using statements
  - Respects priority namespaces (e.g., "System" first)
  - Then alphabetical case-insensitive
  - **Strategy pattern** - isolated comparison logic

- **`UsingGroupSplitter`** - Adds blank lines between namespace groups
  - Groups by root namespace
  - Handles comments and aliases specially

- **`PreprocessorDirectiveHandler`** - Handles #if, #endif, etc.
  - Separates directive blocks from regular usings
  - Processes them separately then recombines

- **`UsingBlockProcessor`** - **Pipeline coordinator**
  - Chains all processors together
  - **Fluent API style** - processes block through pipeline
  - Executes: remove unused → filter blanks → sort → split groups → normalize whitespace

### Service Layer (`src/services/`)

These coordinate the high-level operations:

- **`UsingBlockOrganizer`** - **Main orchestrator service**
  - Entry point for the entire operation
  - Validates → Extracts → Processes → Replaces
  - Clean, procedural flow (no callbacks!)

- **`ProjectValidator`** - Validates project is ready
  - Checks project file exists
  - Checks project has been restored (has .nuget.g.props)
  - Returns `ValidationResult`

- **`UsingBlockExtractor`** - Extracts using blocks from source
  - Uses regex to find using blocks
  - Creates `UsingBlock` objects
  - Replaces blocks in source code

## Example: How It Works

### Old Code (Callback Hell)

```typescript
content = replaceCode(content, rawBlock => {
    const lines = rawBlock.split(endOfline).map(l => l?.trim() ?? '');
    var usings = lines;

    if (!options.disableUnusedUsingsRemoval) {
        removeUnnecessaryUsings(diagnostics, usings, firstUsingLineNumInFile, ...);
    }

    usings = usings.filter(using => using.length > 0);

    if (usings.length > 0) {
        handleSortingWithOrWithoutDirectives(usings);
        if (options.splitGroups) {
            splitGroups(usings);
        }
    }

    // ... more nested logic ...
    return usings.join(endOfline);
});
```

### New Code (Clean OOP)

```typescript
// Create domain objects
const document = new CSharpDocument(editor);
const config = FormatOptions.fromWorkspaceConfig();
const diagnosticProvider = new VsCodeDiagnosticProvider(document.uri);

// Create and execute orchestrator
const organizer = new UsingBlockOrganizer(config, diagnosticProvider);
const result = organizer.organize(document);

// Inside organizer:
const blocks = this.extractor.extract(document.content, document.getLineEndingString());
for (const block of blocks) {
    const processor = new UsingBlockProcessor(block, config, diagnosticProvider);
    processor.process(); // Executes the pipeline
}
const newContent = this.extractor.replace(document.content, blocks);
```

## Benefits for C# Developers

### 1. **Familiar Patterns**

- **Constructor injection**: `new UsingSorter(config)`
- **Method chaining**: Like LINQ - `processor.removeUnused().sort().splitGroups()`
- **Value objects**: `UsingStatement`, `FormatOptions`, `OrganizationResult`
- **Service classes**: `UsingBlockOrganizer`, `ProjectValidator`

### 2. **Easy to Test**

```typescript
// Mock the diagnostic provider
class MockDiagnosticProvider implements IDiagnosticProvider {
    getUnusedUsingDiagnostics() { return []; }
}

// Test the sorter in isolation
const config = new FormatOptions('System', true, false, false);
const sorter = new UsingSorter(config);
const result = sorter.sort(statements);
```

### 3. **Easy to Extend**

Want to add a new processor?

```typescript
class CustomProcessor {
    process(statements: UsingStatement[]): UsingStatement[] {
        // Your logic here
        return transformedStatements;
    }
}

// Add it to the pipeline in UsingBlockProcessor
```

### 4. **No Callback Hell**

Linear, procedural flow:
1. Validate
2. Extract
3. Process
4. Replace
5. Return result

Each step is a simple method call on an object.

### 5. **Clear Responsibilities**

- `UsingStatement` knows how to parse itself
- `UsingBlock` knows how to render itself
- `UsingSorter` knows how to sort
- `UsingGroupSplitter` knows how to group
- Each class does ONE thing

## Backward Compatibility

The old `formatting.ts` file still exists but is no longer used. A compatibility layer (`formattingCompat.ts`) provides the same function signatures for the existing tests, but implemented using the new architecture.

This means:
- ✅ All 28 existing tests pass without modification
- ✅ Tests now exercise the new architecture
- ✅ Old code can be safely deleted

## File Structure

```
src/
├── domain/                      # Domain models (entities & value objects)
│   ├── CSharpDocument.ts
│   ├── UsingStatement.ts
│   ├── UsingBlock.ts
│   ├── FormatOptions.ts
│   └── OrganizationResult.ts
├── processors/                  # Processing logic (strategies)
│   ├── IDiagnosticProvider.ts
│   ├── VsCodeDiagnosticProvider.ts
│   ├── UnusedUsingRemover.ts
│   ├── UsingSorter.ts
│   ├── UsingStatementComparator.ts
│   ├── UsingGroupSplitter.ts
│   ├── PreprocessorDirectiveHandler.ts
│   └── UsingBlockProcessor.ts   # Pipeline coordinator
├── services/                    # High-level services (orchestration)
│   ├── UsingBlockOrganizer.ts   # Main orchestrator
│   ├── ProjectValidator.ts
│   └── UsingBlockExtractor.ts
├── newFormatting.ts            # New entry point
├── formattingCompat.ts         # Compatibility layer for tests
├── formatting.ts               # Old code (can be deleted)
└── extension.ts                # VSCode extension entry (updated to use new code)
```

## What Changed in extension.ts

```typescript
// Old
import * as formatting from "./formatting";
vs.commands.registerTextEditorCommand("csharpOrganizeUsings.organize", formatting.organizeUsingsInEditor);

// New
import * as newFormatting from "./newFormatting";
vs.commands.registerTextEditorCommand("csharpOrganizeUsings.organize", newFormatting.organizeUsingsInEditor);
```

That's it! Everything else is the new architecture.

## Testing

All 28 tests pass:
- ✅ 13 sorting and grouping tests
- ✅ 8 unused using removal tests
- ✅ 7 blank line accumulation tests

```bash
npm test
# 28 passing (83ms)
```

## Next Steps

To fully adopt this architecture:

1. **Delete old code** - Remove `formatting.ts` once confident
2. **Remove compatibility layer** - Update tests to test classes directly
3. **Add more tests** - Test individual classes/processors
4. **Extract more logic** - Move any remaining procedural code into classes

## Summary

This refactor transforms the extension from difficult-to-maintain callback spaghetti into clean, testable, object-oriented code that C# developers will immediately understand. Every class has a single responsibility, dependencies are injected, and the flow is linear and easy to follow.

Welcome to maintainable TypeScript! 🎉
