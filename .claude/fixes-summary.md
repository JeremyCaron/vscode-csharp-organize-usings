# Bug Fixes Summary

## Overview

Fixed two critical bugs in the VSCode C# Organize Usings extension related to preprocessor directive handling and whitespace formatting.

## Bug 1: `processUsingsInPreprocessorDirectives` Not Working

### Problem
When users enabled `processUsingsInPreprocessorDirectives=true` in their settings, unused usings inside preprocessor blocks (`#if`/`#else`/`#endif`) were NOT being removed, even though the language server reported them as unused.

### Root Cause
The `UsingBlock.parseStatements()` method was filtering out all blank lines during parsing:

```typescript
// OLD (BUGGY)
private parseStatements(lines: string[]): UsingStatement[] {
    return lines
        .filter(line => line.trim().length > 0)  // ← Removed blank lines!
        .map(line => UsingStatement.parse(line));
}
```

This caused a critical mismatch:
- **Diagnostics** reported line numbers from the original file (including blank lines)
- **Statement array** only contained non-blank lines
- When mapping diagnostic line 9 to statement index 9, the index was out of bounds

For example:
- File line 9: `using System.Configuration.Assemblies;` (with blank lines before it)
- Statement array only had 7 items (blanks filtered out)
- Trying to access `statements[9]` → out of bounds → nothing removed

### Solution
Keep blank lines in the statements array to maintain accurate line number mapping:

```typescript
// NEW (FIXED)
private parseStatements(lines: string[]): UsingStatement[] {
    // Don't filter out blank lines! We need to preserve them for accurate line number mapping
    // when removing unused usings based on diagnostic line numbers.
    return lines.map(line => UsingStatement.parse(line));
}
```

### Files Changed
- `src/domain/UsingBlock.ts` - Preserve blank lines
- `src/test/domain/UsingBlock.test.ts` - Update test expectations

---

## Bug 2: Poor Whitespace Formatting Around Preprocessor Blocks

### Problem
The extension was removing blank lines around and inside preprocessor directive blocks, making the code less readable:

**Before (well-formatted input):**
```csharp
using System.Collections;
using System.Runtime.CompilerServices;

#if UNITY_ANDROID

using Microsoft.CodeAnalysis.CSharp;

#else

using System.Configuration.Assemblies;

#endif

namespace ConsoleAppFramework;
```

**After running extension (degraded):**
```csharp
using System.Collections;
using System.Runtime.CompilerServices;
#if UNITY_ANDROID
using Microsoft.CodeAnalysis.CSharp;
#else
using System.Configuration.Assemblies;
#endif

namespace ConsoleAppFramework;
```

### Root Cause
Multiple processors were adding/removing blank lines inconsistently:
- `UsingBlockProcessor.filterEmptyLines()` removed ALL blanks
- `PreprocessorDirectiveHandler.recombine()` tried to add blanks
- `UsingGroupSplitter` added blanks between groups
- `UsingBlock.toLines()` added trailing blanks

This scattered logic made it impossible to:
1. Reason about where blanks would appear
2. Maintain idempotent formatting (running twice produced different output)
3. Debug whitespace issues

### Solution
Centralized ALL blank line handling into a single `WhitespaceNormalizer` class that applies consistent rules at the end of the processing pipeline.

**New Architecture:**
```typescript
public process(): UsingBlock {
    this.removeUnused();
    this.filterEmptyLines();      // Remove ALL blanks
    this.sortStatements();
    this.splitIntoGroups();
    this.normalizeWhitespace();   // Add ALL blanks in ONE place ← NEW!
    this.normalizeLeadingWhitespace();
    return this.block;
}
```

**Whitespace Rules (applied consistently):**
1. Blank line after leading comments (before first using)
2. Blank lines between namespace groups (from `UsingGroupSplitter`)
3. **Blank line BEFORE preprocessor blocks** (separates from regular usings)
4. **Blank line AFTER opening directives** (`#if`, `#else`, `#elif`)
5. **Blank line BEFORE closing directives** (`#endif`, `#endregion`)
6. **Blank line AFTER preprocessor blocks**

### Files Changed
- `src/processors/WhitespaceNormalizer.ts` - **NEW** - Single source of truth for whitespace
- `src/processors/UsingBlockProcessor.ts` - Add `normalizeWhitespace()` step
- `src/processors/PreprocessorDirectiveHandler.ts` - Remove whitespace logic, keep only separation
- `src/test/processors/WhitespaceNormalizer.test.ts` - **NEW** - Comprehensive test coverage (30+ tests)

---

## Test Coverage

### New Tests
- **30+ unit tests** for `WhitespaceNormalizer` covering:
  - Comments with leading content
  - Preprocessor blocks (`#if`, `#else`, `#elif`, `#endif`, `#region`, `#endregion`)
  - Nested preprocessor blocks
  - Edge cases (empty input, only comments, only directives)
  - Idempotency
  - Interaction with grouped usings
  - Complex real-world scenarios

### Existing Tests
- ✅ All 135 tests pass
- ✅ Kitchen sink test (all features combined)
- ✅ End-to-end integration tests
- ✅ Idempotency tests
- ✅ Preprocessor directive tests
- ✅ Unused using removal tests

---

## Impact

### Before Fixes
❌ Unused usings in preprocessor blocks not removed
❌ Blank lines lost around preprocessor blocks
❌ Non-idempotent formatting (multiple runs produced different output)
❌ Hard to debug whitespace issues
❌ Scattered whitespace logic across multiple files

### After Fixes
✅ `processUsingsInPreprocessorDirectives=true` works correctly
✅ Clean, readable formatting with proper whitespace
✅ Fully idempotent (running multiple times produces identical output)
✅ Easy to understand and debug (single source of truth for whitespace)
✅ Comprehensive test coverage
✅ All existing tests pass

---

## Technical Debt Addressed

### Centralized Whitespace Logic
The new architecture follows the Single Responsibility Principle - the `WhitespaceNormalizer` is the ONLY place that adds blank lines. This makes the code:
- **Easier to understand** - All whitespace rules in one place
- **Easier to test** - Test whitespace logic in isolation
- **Easier to modify** - Change whitespace behavior in one place
- **More reliable** - Consistent, predictable formatting

### Improved Maintainability
The new code is much more maintainable for C# developers:
- Clear separation of concerns
- Well-documented single-responsibility classes
- Comprehensive test coverage
- Easy to reason about the processing pipeline

---

## Example Output

**Input (messy):**
```csharp
using System.Collections;
using System.Runtime.CompilerServices;
#if UNITY_ANDROID
using Microsoft.CodeAnalysis.CSharp;
#else
using System.Configuration.Assemblies;
#endif
namespace ConsoleAppFramework;
```

**Output (clean, idempotent):**
```csharp
using System.Collections;
using System.Runtime.CompilerServices;

#if UNITY_ANDROID

using Microsoft.CodeAnalysis.CSharp;

#else

using System.Configuration.Assemblies;

#endif

namespace ConsoleAppFramework;
```

---

## Commit Message

```
fix: preprocessor directive handling and whitespace formatting

Fixed two critical bugs:

1. processUsingsInPreprocessorDirectives not working
   - Root cause: Blank lines filtered during parsing caused line number mismatch
   - Fix: Preserve blank lines in statement array for accurate diagnostic mapping
   - Impact: Unused usings in preprocessor blocks now correctly removed

2. Poor whitespace formatting around preprocessor blocks
   - Root cause: Scattered whitespace logic across multiple processors
   - Fix: Centralized all blank line handling in WhitespaceNormalizer
   - Impact: Clean, readable, idempotent formatting

Changes:
- UsingBlock: Preserve blank lines for line number mapping
- WhitespaceNormalizer: NEW - Single source of truth for whitespace
- PreprocessorDirectiveHandler: Simplified, removed whitespace logic
- UsingBlockProcessor: Added normalizeWhitespace() step
- Tests: 30+ new unit tests, all 135 tests passing

Closes #XX (if applicable)
```
