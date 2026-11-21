# Oracle PL/SQL for Zed

A [Zed](https://zed.dev) extension that adds `PL/SQL` language support: a Tree-sitter
grammar ([`njank/tree-sitter-plsql`](https://github.com/njank/tree-sitter-plsql), MIT),
syntax highlighting, bracket auto-closing, and comment toggling.

Status: early MVP (grammar + minimal highlights).

## Installation (dev extension)

1. In Zed, open the command palette and run `zed: install dev extension`, then select this repository's directory.
2. Open a file with one of these extensions: `.pls`, `.pks`, `.pkb`, `.prc`, `.fnc`, `.trg`, `.typ`. The status bar should show `PL/SQL`.

## Limitations

- Files with the `.sql` extension keep opening as SQL (Zed's SQL support). To open them
  as PL/SQL, use the language selector in the status bar or Zed's `file_types` setting.
- Files with no extension are detected as PL/SQL when their first line starts with
  `CREATE [OR REPLACE] PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE`. Files whose extension is
  already claimed by another language (e.g. `.sql`, `.txt`) keep that language.
- No language server: no completion, diagnostics, go-to-definition, or formatting.

## License

MIT. See [LICENSE](LICENSE).
