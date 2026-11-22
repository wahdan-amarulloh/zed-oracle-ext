# Zed Oracle Extension

A Zed extension for PL/SQL (Oracle) developers: provides the `PL/SQL` language with a Tree-sitter grammar, highlighting, outline, and snippets, with a manifest structure ready to accept a language server in a later phase.

## Language

**PL/SQL**: Oracle's procedural language, the target of this extension; distinct from Zed's bundled `SQL` language, which handles generic SQL files.
_Avoid_: Oracle SQL, PL/pgSQL

**Syntax highlighting**: Token coloring produced from Tree-sitter queries (`highlights.scm`), with no contribution from a language server.
_Avoid_: semantic highlighting, coloring

**Language server**: An external LSP process launched by the extension via `language_server_command`; not part of the MVP.
_Avoid_: LSP server, code intelligence

**Query validator**: The script `scripts/validate-queries.mjs`, which parses `corpus/plsql/`, then verifies that every node name in the `.scm` files exists in the pinned grammar's `node-types.json`, and that `config.toml` satisfies Zed's schema.
_Avoid_: linter, query linter

**Corpus**: The set of sample PL/SQL files in `corpus/plsql/` that serve as parse input for the validator; must cover a package spec, package body, procedure, function, trigger, cursor/loop, and exception handler.
_Avoid_: fixture, sample set
