; Comments

(comment_sl) @comment
(comment_ml) @comment

; Strings

(literal_string) @string

; Numbers

(number) @number
(float) @number

; Builtin types

[
  (kw_varchar2) (kw_varchar) (kw_nvarchar2) (kw_char) (kw_character) (kw_nchar)
  (kw_number) (kw_numeric) (kw_decimal) (kw_int) (kw_integer) (kw_smallint)
  (kw_pls_integer) (kw_binary_integer) (kw_natural) (kw_binary_double)
  (kw_binary_float) (kw_float) (kw_real) (kw_double) (kw_long) (kw_raw) (kw_rowid)
  (kw_urowid) (kw_clob) (kw_nclob) (kw_blob) (kw_bfile) (kw_boolean) (kw_date)
  (kw_timestamp) (kw_interval) (kw_string) (kw_refcursor) (kw_anydata) (kw_anytype)
] @type.builtin

; Keywords — block structure

[
  (kw_declare) (kw_begin) (kw_end) (kw_if) (kw_then) (kw_elsif) (kw_else)
  (kw_case) (kw_when) (kw_loop) (kw_while) (kw_for) (kw_forall) (kw_exit) (kw_continue)
  (kw_return) (kw_exception) (kw_raise) (kw_goto) (kw_null) (kw_others)
] @keyword

; Keywords — declarations

[
  (kw_procedure) (kw_function) (kw_package) (kw_body) (kw_trigger) (kw_type)
  (kw_subtype) (kw_cursor) (kw_record) (kw_constant) (kw_default) (kw_is) (kw_as)
  (kw_pragma) (kw_autonomous_transaction) (kw_language) (kw_deterministic)
  (kw_result_cache) (kw_pipelined) (kw_parallel_enable) (kw_authid)
] @keyword

; Keywords — statements & operators

[
  (kw_select) (kw_from) (kw_where) (kw_insert) (kw_update) (kw_delete) (kw_merge)
  (kw_commit) (kw_rollback) (kw_savepoint) (kw_grant) (kw_revoke) (kw_execute)
  (kw_immediate) (kw_into) (kw_values) (kw_set) (kw_and) (kw_or) (kw_not) (kw_in)
  (kw_of) (kw_on) (kw_between) (kw_like) (kw_distinct) (kw_union) (kw_intersect)
  (kw_minus) (kw_order) (kw_group) (kw_having) (kw_by) (kw_using) (kw_bulk)
  (kw_collect) (kw_returning) (kw_create) (kw_or) (kw_replace) (kw_drop) (kw_alter)
  (kw_open) (kw_close) (kw_fetch) (kw_with) (kw_table) (kw_lock) (kw_wait)
] @keyword

; Identifiers

(identifier) @variable
(label) @label
