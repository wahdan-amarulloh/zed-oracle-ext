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
