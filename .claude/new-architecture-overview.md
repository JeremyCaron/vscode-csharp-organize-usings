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
    - Factory method: `CSharpDocument.fromTextEditor(editor)`
    - Similar to a document model in C#

- **`UsingStatement`** - Represents a single line in a using block
    - Can be: actual using statement, comment, preprocessor directive, or blank line
    - Parses itself from text (`UsingStatement.parse()`)
    - Knows its namespace, root namespace, whether it's an alias, etc.
    - Supports attaching comment lines to using statements (for Visual Studio-style comment sticking)
    - Supports modern C# features: `global using`, `using static`, file-scoped namespaces
    - **Mostly immutable value object** (with mutable attached comments collection)

- **`UsingBlock`** - Represents a block of using statements
    - Has start/end line numbers
    - Contains collection of `UsingStatement` objects
    - Can render itself back to lines
    - Supports leading content (comments/whitespace before usings)
    - **Domain entity**

- **`FormatOptions`** - Configuration for organizing
    - Created from VSCode workspace settings via `FormatOptions.fromWorkspaceConfig()`
    - Immutable configuration object

- **`OrganizationResult`** - Result of the organization operation
    - Success/failure with message
    - Tracks whether changes were made via `hasChanges()`
    - **Result pattern** (like Result<T, E> in Rust or functional programming)

### Processor Layer (`src/processors/`)

These implement the transformation logic:

- **`UnusedUsingRemover`** - Removes unused using statements
    - Uses diagnostics from language server via `IDiagnosticProvider`
    - Handles preprocessor directives correctly
    - Preserves line number mapping for accurate diagnostic matching

- **`UsingSorter`** - Sorts using statements
    - Uses `UsingStatementComparator` for comparison logic
    - **Implements Visual Studio comment sticking behavior**
    - Attaches comments to their immediately following using statements
    - Handles orphaned comments, regular usings, aliases, directives separately
    - Removes duplicates while preserving comments

- **`UsingStatementComparator`** - Compares two using statements
    - Respects priority namespaces (e.g., "System" first)
    - Then alphabetical case-insensitive
    - **Strategy pattern** - isolated comparison logic

- **`UsingGroupSplitter`** - Adds blank lines between namespace groups
    - Groups by root namespace
    - Handles comments and aliases specially
    - Respects attached comments when grouping

- **`PreprocessorDirectiveHandler`** - Handles #if, #endif, etc.
    - Separates directive blocks from regular usings
    - Processes them separately then recombines
    - Ensures proper whitespace around directives

- **`WhitespaceNormalizer`** - Normalizes whitespace and blank lines
    - Removes leading/trailing blank lines from using blocks
    - Collapses consecutive blank lines
    - Handles edge cases like all-blank or all-comment blocks
    - **Extracted into separate class for single responsibility**

- **`UsingBlockProcessor`** - **Pipeline coordinator**
    - Chains all processors together
    - **Fluent API style** - processes block through pipeline
    - Executes: remove unused → filter blanks → sort → split groups → normalize whitespace

### Service Layer (`src/services/`)

These coordinate the high-level operations:

- **`UsingBlockOrganizer`** - **Main orchestrator service**
    - Entry point for the entire operation
    - Extracts → Processes → Replaces
    - Clean, procedural flow (no callbacks!)
    - Returns `OrganizationResult` with success/failure status

- **`UsingBlockExtractor`** - Extracts using blocks from source
    - **Uses line-by-line state machine parser** (no regex - avoids catastrophic backtracking)
    - Supports file-scoped namespaces and modern C# syntax
    - Creates `UsingBlock` objects with proper line mapping
    - Replaces blocks in source code while preserving structure
    - **Guaranteed O(n) performance** regardless of file content

### VSCode Integration Layer (`src/vscode/`)

Adapters for VSCode APIs:

- **`VsCodeDiagnosticProvider`** - Implements `IDiagnosticProvider`
    - Talks to VSCode diagnostic API
    - Filters for C# language server unused using diagnostics
    - **Adapter pattern** - isolates VSCode dependency

### Interface Layer (`src/interfaces/`)

Contracts and abstractions:

- **`IDiagnosticProvider`** - Interface for diagnostic providers
    - Enables dependency injection and testing
    - Implemented by `VsCodeDiagnosticProvider` for production
    - Can be mocked for testing

- **`IFormatOptions`** - Interface for format configuration
    - Defines configuration contract
    - Implemented by `FormatOptions`

- **`IResult`** - Interface for result objects
    - Generic result pattern interface
    - Implemented by `OrganizationResult`

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
const document = CSharpDocument.fromTextEditor(editor);
const config = FormatOptions.fromWorkspaceConfig();
const diagnosticProvider = new VsCodeDiagnosticProvider(document.uri);

// Create and execute orchestrator
const organizer = new UsingBlockOrganizer(config, diagnosticProvider);
const result = organizer.organize(document);

// Handle the result
if (!result.success) {
    vs.window.showErrorMessage(result.message);
    return;
}

if (result.hasChanges()) {
    // Apply changes to editor
    edit.replace(fullRange, result.content);
}

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
    getUnusedUsingDiagnostics() {
        return [];
    }
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

1. Extract
2. Process
3. Replace
4. Return result

Each step is a simple method call on an object.

### 5. **Clear Responsibilities**

- `UsingStatement` knows how to parse itself
- `UsingBlock` knows how to render itself
- `UsingSorter` knows how to sort
- `UsingGroupSplitter` knows how to group
- Each class does ONE thing

## Migration Complete

The refactoring is complete and the old code has been removed:

- ✅ Old `formatting.ts` - **DELETED**
- ✅ Compatibility layer `formattingCompat.ts` - **DELETED**
- ✅ Old test files (sortAndGroup.test.ts, removeUnusedUsings.test.ts, blankLineAccumulation.test.ts) - **DELETED**
- ✅ New comprehensive test suite with 149 passing tests
- ✅ Direct integration in `extension.ts` (no compatibility layer needed)

## File Structure

```
src/
├── domain/                         # Domain models (entities & value objects)
│   ├── CSharpDocument.ts
│   ├── UsingStatement.ts
│   ├── UsingBlock.ts
│   ├── FormatOptions.ts
│   └── OrganizationResult.ts
├── processors/                     # Processing logic (strategies)
│   ├── UnusedUsingRemover.ts
│   ├── UsingSorter.ts
│   ├── UsingStatementComparator.ts
│   ├── UsingGroupSplitter.ts
│   ├── PreprocessorDirectiveHandler.ts
│   ├── WhitespaceNormalizer.ts    # NEW: Extracted whitespace logic
│   └── UsingBlockProcessor.ts      # Pipeline coordinator
├── services/                       # High-level services (orchestration)
│   ├── UsingBlockOrganizer.ts      # Main orchestrator
│   └── UsingBlockExtractor.ts
├── interfaces/                     # Contracts and abstractions
│   ├── IDiagnosticProvider.ts
│   ├── IFormatOptions.ts
│   └── IResult.ts
├── vscode/                         # VSCode API adapters
│   └── VsCodeDiagnosticProvider.ts
├── logging/                        # Logging utilities
│   └── logger.ts
├── test/                           # Comprehensive test suite
│   ├── domain/
│   │   ├── UsingStatement.test.ts
│   │   └── UsingBlock.test.ts
│   ├── processors/
│   │   ├── UnusedUsingRemover.test.ts
│   │   ├── UsingSorter.test.ts
│   │   ├── UsingGroupSplitter.test.ts
│   │   └── WhitespaceNormalizer.test.ts
│   ├── services/
│   │   └── UsingBlockExtractor.test.ts
│   └── integration/
│       ├── UsingBlockProcessor.test.ts
│       ├── EndToEnd.test.ts
│       └── CommentSticking.test.ts  # NEW: VS-style comment behavior
├── extension.ts                    # VSCode extension entry point
├── codeActionProvider.ts           # VSCode Code Action provider
└── utils.ts                        # Shared utilities
```

## What Changed in extension.ts

```typescript
// Now directly implements the clean architecture
import { CSharpDocument } from './domain/CSharpDocument';
import { FormatOptions } from './domain/FormatOptions';
import { UsingBlockOrganizer } from './services/UsingBlockOrganizer';
import { VsCodeDiagnosticProvider } from './vscode/VsCodeDiagnosticProvider';

async function organizeEditorUsings(editor: vs.TextEditor, edit: vs.TextEditorEdit) {
    // Create domain objects
    const document = CSharpDocument.fromTextEditor(editor);
    const config = FormatOptions.fromWorkspaceConfig();
    const diagnosticProvider = new VsCodeDiagnosticProvider(document.uri);

    // Create and execute the organizer
    const organizer = new UsingBlockOrganizer(config, diagnosticProvider);
    const result = organizer.organize(document);

    // Handle the result
    if (!result.success) {
        vs.window.showErrorMessage(result.message);
        return;
    }

    if (result.hasChanges()) {
        edit.replace(fullRange, result.content);
    }
}
```

Clean, direct integration - no compatibility layers needed!

## Testing

Comprehensive test coverage with **149 passing tests**:

### Domain Tests

- ✅ UsingStatement parsing and comparison
- ✅ UsingBlock creation and rendering
- ✅ Modern C# syntax support (global using, using static, file-scoped namespaces)

### Processor Tests

- ✅ UnusedUsingRemover with preprocessor directives
- ✅ UsingSorter with comment sticking behavior
- ✅ UsingGroupSplitter with namespace grouping
- ✅ WhitespaceNormalizer edge cases

### Service Tests

- ✅ UsingBlockExtractor regex and line mapping

### Integration Tests

- ✅ UsingBlockProcessor full pipeline
- ✅ End-to-end scenarios
- ✅ Comment sticking behavior (Visual Studio compatibility)

```bash
npm test
# 149 passing (182ms)
```

## Recent Improvements (v2.0+)

1. ✅ **Line-by-Line Parser** - Replaced regex with state machine parser to fix catastrophic backtracking
2. ✅ **WhitespaceNormalizer Extracted** - Separated whitespace management into its own class
3. ✅ **Comment Sticking** - Implements Visual Studio-style comment attachment to using statements
4. ✅ **Modern C# Support** - Handles `global using`, `using static`, file-scoped namespaces
5. ✅ **C# Code Style** - Entire codebase formatted with C# conventions (braces, spacing)
6. ✅ **Old Code Deleted** - Removed 1,963 lines of legacy code
7. ✅ **Comprehensive Tests** - 149 tests covering all scenarios
8. ✅ **Direct Integration** - No compatibility layers, clean architecture throughout

## Summary

This architecture represents a **complete transformation** from callback-based procedural code to clean, maintainable, object-oriented TypeScript that C# developers will immediately understand.

### Key Achievements

- **Single Responsibility**: Every class does one thing well
- **Dependency Injection**: Clean constructor-based DI throughout
- **No Callbacks**: Linear, procedural flow that's easy to follow
- **Testable**: 149 comprehensive tests with isolated unit tests
- **Modern**: Supports latest C# features (global using, file-scoped namespaces)
- **Clean Code**: Following C# conventions even in TypeScript

### Architecture Principles Applied

- **Domain-Driven Design**: Rich domain models (UsingStatement, UsingBlock, CSharpDocument)
- **Strategy Pattern**: UsingStatementComparator, processors
- **Adapter Pattern**: VsCodeDiagnosticProvider isolates VSCode dependencies
- **Pipeline Pattern**: UsingBlockProcessor chains transformations
- **Result Pattern**: OrganizationResult for error handling
- **Factory Pattern**: Static factory methods on domain objects

The codebase is now **production-ready, maintainable, and extensible**. Adding new features is straightforward - just add a new processor to the pipeline or extend an existing domain model.

Welcome to maintainable TypeScript! 🎉
