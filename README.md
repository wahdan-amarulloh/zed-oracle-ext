# Oracle PL/SQL for Zed

Extension Zed yang menambahkan bahasa `PL/SQL` — grammar Tree-sitter
([`njank/tree-sitter-plsql`](https://github.com/njank/tree-sitter-plsql), MIT) plus
syntax highlighting.

Status: MVP awal (grammar + highlights minimal).

## Instalasi (dev extension)

1. Zed → command palette → `zed: install dev extension` → pilih direktori repo ini.
2. Buka file `.pls .pks .pkb .prc .fnc .trg .typ` — status bar harus menampilkan `PL/SQL`.

File `.sql` polos tetap memakai bahasa `SQL` bawaan Zed; `.sql` yang baris pertamanya
berupa `CREATE [OR REPLACE] PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE` dibuka sebagai
`PL/SQL`.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
