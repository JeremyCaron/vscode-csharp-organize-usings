* v0.0.3
  * "Sort usings" command renamed to "Fix format".
  * "csharpfixformat.indentEnabled" option was added.
    > Indent all lines with respect of parentheses / braces and use "editor.tabSize" parameter. Enabled by default.
  * "csharpfixformat.emptyLinesInRowLimit" option was added.
    > Amount of empty lines in row, negative value for disable. By default 1 empty line allowed between expressions.
  * Sort usings should works correctly for multiple using expressions in line.
  * Sort usings should ignore commented expressions (if usings put at begining of each line inside multiline comment - they will be sorted).
  * Refactoring.
* v0.0.2
  * Debug logging removed.
  * Refactoring.
* v0.0.1
  * Init release.