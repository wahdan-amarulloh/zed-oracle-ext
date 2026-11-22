# Manual verification: snippets

## How Zed loads extension snippets (verified from source and docs)

Verified against Zed upstream (`zed-industries/zed`, `main`) and the published docs.

| Question | Answer | Source |
| --- | --- | --- |
| Where does an extension declare snippets? | Root-level `snippets` key in `extension.toml`, a path or array of paths relative to `extension.toml` | `docs/src/extensions/snippets.md`; `crates/extension/src/extension_manifest.rs` (`pub snippets: Option<ExtensionSnippets>`) |
| Where do the files live? | Anywhere in the extension directory; convention is `snippets/` | `docs/src/extensions/developing-extensions.md` (directory layout) |
| What filename does Zed look up? | The file stem is the registry key. Zed does not rename files; the stem must equal the language's `snippet_scope_id()` | `crates/snippet_provider/src/registry.rs` (`file_stem_to_key`), `crates/snippet_provider/src/lib.rs` |
| What is `snippet_scope_id()` for `PL/SQL`? | `lsp_id()` = display name lowercased, then `/` and `\` removed → `PL/SQL` → `plsql` | `crates/language_core/src/language_name.rs` (`snippet_scope_id`, and its unit test `snippet_scope_id_strips_path_separators`) |
| Which name does the registry query? | `language.snippet_scope_id()` when offering completions | `crates/editor/src/completions.rs` |

Consequence: this extension registers `./snippets/plsql.json`, and the file stem
`plsql` is exactly what Zed derives from the display name `PL/SQL`. The display
name stays `PL/SQL`; only the filename drops the separator.

`tests/snippets.test.mjs` pins both halves of this: the manifest declares
`snippets` at root level (not inside `[grammars.plsql]`, which TOML would nest),
and the registered file stem equals `plsql`.

## Snippet set

13 structural snippets, each with a name, a `prefix`, and a `body` containing
tab stops:

`pkg-spec`, `pkg-body`, `proc`, `func`, `trg`, `cur`, `cur-loop`, `loop`,
`while`, `for-loop`, `if`, `case`, `exc`.

No DML (no `INSERT`/`UPDATE`/`DELETE`/`MERGE`) and no Oracle builtin-function
snippets. The test asserts both.

## Expansion check in Zed

Acceptance criterion #6 also asks that each snippet be expanded in Zed and the
result checked by hand.

**Result: passed.** Verified by installing the dev extension, opening a `.pkb`,
and typing each prefix.

| Prefix | Expands to | Tab stops |
| --- | --- | --- |
| `pkg-spec` | `CREATE OR REPLACE PACKAGE ... AS ... END ...;` | name shared between header and `END`, body placeholder, `$0` |
| `pkg-body` | `CREATE OR REPLACE PACKAGE BODY ... AS ... END ...;` | name shared, private declarations, nested procedure, `$0` |
| `proc` | `CREATE OR REPLACE PROCEDURE ... IS BEGIN ... EXCEPTION ... END ...;` | name shared, params, body, handler, `$0` |
| `func` | `CREATE OR REPLACE FUNCTION ... RETURN ... IS ... END ...;` | name shared, params, return type, body, handler, `$0` |
| `trg` | `CREATE OR REPLACE TRIGGER ... BEFORE INSERT ON ... FOR EACH ROW ...` | name shared, timing, event, table, body, `$0` |
| `cur` | `CURSOR ... IS SELECT ... FROM ... WHERE ...;` | cursor name, columns, table, predicate, `$0` |
| `cur-loop` | `FOR ... IN ... LOOP ... END LOOP;` | record, cursor, body, `$0` |
| `loop` | `LOOP ... EXIT WHEN ...; END LOOP;` | body, exit condition, `$0` |
| `while` | `WHILE ... LOOP ... END LOOP;` | condition, body, `$0` |
| `for-loop` | `FOR ... IN ... LOOP ... EXIT WHEN ...; END LOOP;` | index, range, body, exit condition, `$0` |
| `if` | `IF ... THEN ... ELSIF ... THEN ... ELSE ... END IF;` | condition, branches, `$0` |
| `case` | `CASE ... WHEN ... THEN ... ELSE ... END CASE;` | selector, arms, `$0` |
| `exc` | `EXCEPTION WHEN ... THEN ... WHEN OTHERS THEN ...` | exception name, handler body, re-raise, `$0` |

All 13 prefixes expanded, tab stops advanced in source order, and each block's
closing keyword was present. Kept here as the record of the manual gate.

