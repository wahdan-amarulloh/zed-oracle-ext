# Zed Oracle Extension

Extension Zed untuk developer PL/SQL (Oracle): menyediakan bahasa `PL/SQL` — grammar Tree-sitter, highlighting, outline, dan snippets — dengan struktur manifest yang siap menerima language server di fase berikutnya.

## Language

**PL/SQL**:
 Bahasa prosedural Oracle yang menjadi target extension; berbeda dari bahasa `SQL` bawaan Zed yang menangani file SQL generik.
_Avoid_: Oracle SQL, PL/pgSQL

**Syntax highlighting**:
 Pewarnaan token yang dihasilkan dari Tree-sitter queries (`highlights.scm`), tanpa kontribusi dari language server.
_Avoid_: semantic highlighting, coloring

**Language server**:
 Proses LSP eksternal yang diluncurkan extension melalui `language_server_command`; tidak termasuk dalam MVP.
_Avoid_: LSP server, code intelligence

**Query validator**:
 Skrip `scripts/validate-queries.mjs` yang mem-parse `corpus/plsql/` lalu memastikan setiap nama node di file `.scm` ada di `node-types.json` grammar yang dipin, dan bahwa `config.toml` memenuhi skema Zed.
_Avoid_: linter, linter query

**Corpus**:
 Kumpulan file PL/SQL contoh di `corpus/plsql/` yang menjadi bahan parse validator; harus mencakup package spec, package body, procedure, function, trigger, cursor/loop, dan exception handler.
_Avoid_: fixture, sample set
