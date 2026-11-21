; PL/SQL syntax highlighting for Zed.
;
; Every node name below is validated against the pinned grammar by
; `node scripts/validate-queries.mjs` (see README).
;
; Order matters: Zed applies later patterns over earlier ones for the same
; text range, so the general captures come first and the specific ones last.

; ---------------------------------------------------------------------------
; Comments
; ---------------------------------------------------------------------------

(comment_sl) @comment
(comment_ml) @comment

; ---------------------------------------------------------------------------
; Strings and numbers
; ---------------------------------------------------------------------------

(literal_string) @string

(number) @number
(float) @number

; ---------------------------------------------------------------------------
; Operators
; ---------------------------------------------------------------------------

[
  ":="
  "=>"
  "="
  "!="
  "<>"
  "^="
  "~="
  "<"
  "<="
  ">"
  ">="
  "+"
  "-"
  "*"
  "/"
  "**"
  "%"
  "||"
  ".."
] @operator

; ---------------------------------------------------------------------------
; Punctuation
; ---------------------------------------------------------------------------

[
  "("
  ")"
] @punctuation.bracket

[
  ","
  ";"
  "."
  "<<"
  ">>"
  ":"
] @punctuation.delimiter

; ---------------------------------------------------------------------------
; Identifiers (generic; refined below)
; ---------------------------------------------------------------------------

(identifier) @variable
(label (identifier) @label)

; Composite references: `pkg.thing`, `rec.field`
(referenced_element ref_name_parent: (identifier) @variable)
(referenced_element ref_name: (identifier) @variable)
(referenced_element
  ref_name_parent: (identifier)
  ref_name: (identifier) @property)

; Trigger correlation names: `:new.salary`, `:old.salary`
(correlation_variable
  (kw_new) @keyword
  field_name: (identifier) @property)
(correlation_variable
  (kw_old) @keyword
  field_name: (identifier) @property)

; Host (bind) variables: `:name`
(host_variable (identifier) @variable.special)

; ---------------------------------------------------------------------------
; Built-in types
; ---------------------------------------------------------------------------

[
  (kw_varchar2) (kw_varchar) (kw_nvarchar2) (kw_char) (kw_character) (kw_nchar)
  (kw_national)
  (kw_number) (kw_numeric) (kw_decimal) (kw_int) (kw_integer) (kw_smallint)
  (kw_binary_integer) (kw_natural) (kw_binary_double) (kw_binary_float)
  (kw_float) (kw_real) (kw_double) (kw_precision) (kw_long) (kw_raw)
  (kw_rowid) (kw_urowid) (kw_clob) (kw_nclob) (kw_blob) (kw_bfile)
  (kw_boolean) (kw_date) (kw_timestamp) (kw_interval) (kw_string)
  (kw_anydata) (kw_anydataset) (kw_anytype) (kw_xmltype) (kw_uritype)
  (kw_sdo_geometry) (kw_sdo_georaster) (kw_sdo_topo_geometry)
  (kw_json_object_t) (kw_json_array_t) (kw_json_element_t) (kw_json_scalar_t)
  (kw_byte)
] @type.builtin

; `PLS_INTEGER` and friends are not dedicated nodes: the grammar parses them as
; identifiers inside a datatype, so match on the text.
(
  (datatype (referenced_element ref_name: (identifier) @type.builtin))
  (#match? @type.builtin "(?i)^(pls_integer|sys_refcursor|xmltype|rowtype)$")
)

; ---------------------------------------------------------------------------
; Literals
; ---------------------------------------------------------------------------

[
  (kw_true) (kw_false)
] @boolean

(kw_null) @constant.builtin

; Predefined exceptions and predefined constants. The grammar parses these as
; plain identifiers, so match their names.
(
  (identifier) @constant.builtin
  (#match? @constant.builtin "(?i)^(sqlcode|sqlerrm|zero_divide|no_data_found|too_many_rows|value_error|dup_val_on_index|invalid_number|invalid_cursor|program_error|storage_error|case_not_found|collection_is_null|access_into_null|subscript_beyond_count|subscript_outside_limit|self_is_null|login_denied|not_logged_on|timeout_on_resource|rowtype_mismatch|sys_invalid_rowid|sysdate|systimestamp|sys_guid)$")
)

; ---------------------------------------------------------------------------
; Built-in functions and subprograms
; ---------------------------------------------------------------------------

[
  (kw_count) (kw_sum) (kw_avg) (kw_min) (kw_max) (kw_listagg)
  (kw_dense_rank) (kw_rank) (kw_row_number)
  (kw_mod) (kw_trim) (kw_extract) (kw_cast) (kw_convert) (kw_treat)
  (kw_xmlelement) (kw_xmlagg) (kw_xmlforest) (kw_xmlattributes) (kw_xmltable)
  (kw_raise_application_error)
] @function.builtin

; User subprogram calls
(ref_call (referenced_element ref_name: (identifier) @function))
(ref_call (referenced_element ref_name_parent: (identifier) @function))

; ---------------------------------------------------------------------------
; Subprogram and type names
; ---------------------------------------------------------------------------

(create_procedure prc_name: (identifier) @function)
(create_function fnc_name: (identifier) @function)
(procedure_definition prc_name: (identifier) @function)
(function_definition fnc_name: (identifier) @function)
(procedure_declaration prc_name: (identifier) @function)
(function_declaration fnc_name: (identifier) @function)

(create_package package_name: (identifier) @type)
(create_package_body package_name: (identifier) @type)
(create_type_body type_name: (identifier) @type)

(type_definition_collection type_collection_name: (identifier) @type)
(type_definition_record type_rec_name: (identifier) @type)
(type_definition_ref_cursor ref_cursor_name: (identifier) @type)
(type_definition_sub subtype_name: (identifier) @type)

; ---------------------------------------------------------------------------
; Keywords — block structure
; ---------------------------------------------------------------------------

[
  (kw_declare) (kw_begin) (kw_end) (kw_if) (kw_then) (kw_elsif) (kw_else)
  (kw_case) (kw_when) (kw_loop) (kw_while) (kw_for) (kw_forall) (kw_exit)
  (kw_continue) (kw_return) (kw_raise) (kw_goto) (kw_others)
] @keyword

; ---------------------------------------------------------------------------
; Keywords — declarations and subprograms
; ---------------------------------------------------------------------------

[
  (kw_procedure) (kw_function) (kw_package) (kw_body) (kw_specification)
  (kw_trigger) (kw_type) (kw_subtype) (kw_cursor) (kw_record) (kw_object)
  (kw_constant) (kw_default) (kw_is) (kw_as) (kw_pragma)
  (kw_autonomous_transaction) (kw_language) (kw_deterministic)
  (kw_result_cache) (kw_pipelined) (kw_parallel_enable) (kw_authid)
  (kw_exception_init) (kw_exception) (kw_exceptions)
  (kw_member) (kw_constructor) (kw_static) (kw_map) (kw_order) (kw_self)
  (kw_instantiable) (kw_final) (kw_overriding) (kw_substitutable)
  (kw_under) (kw_object) (kw_in) (kw_out) (kw_nocopy) (kw_ref)
] @keyword

; ---------------------------------------------------------------------------
; Keywords — SQL and DML
; ---------------------------------------------------------------------------

[
  (kw_select) (kw_from) (kw_where) (kw_insert) (kw_update) (kw_delete)
  (kw_merge) (kw_into) (kw_values) (kw_set) (kw_and) (kw_or) (kw_not)
  (kw_like) (kw_between) (kw_exists) (kw_distinct) (kw_all) (kw_any)
  (kw_union) (kw_intersect) (kw_minus) (kw_order) (kw_group) (kw_having)
  (kw_by) (kw_using) (kw_bulk) (kw_collect) (kw_returning)
  (kw_open) (kw_close) (kw_fetch) (kw_with) (kw_table) (kw_lock)
  (kw_join) (kw_inner) (kw_outer) (kw_left) (kw_right) (kw_full) (kw_cross)
  (kw_on) (kw_of) (kw_current) (kw_prior) (kw_connect) (kw_start)
  (kw_connect_by_root) (kw_siblings) (kw_level) (kw_rowid) (kw_nulls)
  (kw_first) (kw_last) (kw_asc) (kw_desc) (kw_limit) (kw_offset)
  (kw_rows) (kw_row) (kw_only) (kw_next) (kw_percent) (kw_ties)
  (kw_partition) (kw_over) (kw_range) (kw_unbounded) (kw_preceding)
  (kw_following) (kw_reverse) (kw_case)
] @keyword

; ---------------------------------------------------------------------------
; Keywords — transactions, DDL, privileges
; ---------------------------------------------------------------------------

[
  (kw_commit) (kw_rollback) (kw_savepoint) (kw_grant) (kw_revoke)
  (kw_execute) (kw_immediate) (kw_create) (kw_replace) (kw_drop)
  (kw_alter) (kw_truncate) (kw_rename) (kw_comment) (kw_analyze)
] @keyword

; ---------------------------------------------------------------------------
; Keywords — remaining grammar keywords
;
; The grammar exposes one node per keyword; this catch-all keeps every one of
; them styled as a keyword instead of falling through to @variable.
; ---------------------------------------------------------------------------

[
  (kw_access) (kw_accessible) (kw_add) (kw_after)
  (kw_agent) (kw_aggregate) (kw_allow) (kw_analytic)
  (kw_apply) (kw_array) (kw_associate) (kw_asterisk)
  (kw_at) (kw_attribute) (kw_audit) (kw_badfile)
  (kw_batch) (kw_before) (kw_block) (kw_both)
  (kw_breadth) (kw_bulk_exceptions) (kw_bulk_rowcount) (kw_cache)
  (kw_cascade) (kw_charsetfrom) (kw_charsetid) (kw_check)
  (kw_clone) (kw_collation) (kw_columns) (kw_commtted)
  (kw_compile) (kw_compound) (kw_constraint) (kw_container)
  (kw_containers) (kw_context) (kw_crossedition) (kw_current_user)
  (kw_cycle) (kw_data) (kw_database) (kw_day)
  (kw_db_role_change) (kw_ddl) (kw_debug) (kw_definer)
  (kw_deleting) (kw_depth) (kw_directory) (kw_disable)
  (kw_disallow) (kw_disassociate) (kw_discardfile) (kw_dup_val_on_index)
  (kw_duration) (kw_each) (kw_editionable) (kw_element)
  (kw_empty) (kw_enable) (kw_error) (kw_errors)
  (kw_escape) (kw_evalname) (kw_except) (kw_extend)
  (kw_external) (kw_fact) (kw_filter) (kw_following)
  (kw_follows) (kw_forall) (kw_force) (kw_foreign)
  (kw_format) (kw_forward) (kw_function) (kw_hierarchies)
  (kw_hour) (kw_immutable) (kw_including) (kw_increment)
  (kw_index) (kw_indicator) (kw_indices) (kw_inline)
  (kw_inserting) (kw_instantiable) (kw_instead) (kw_invalidate)
  (kw_isolation) (kw_java) (kw_keep) (kw_key)
  (kw_last) (kw_lateral) (kw_lax) (kw_leading)
  (kw_length) (kw_library) (kw_local) (kw_location)
  (kw_locked) (kw_log) (kw_logfile) (kw_logging)
  (kw_logoff) (kw_logon) (kw_matched) (kw_maxlen)
  (kw_maxvalue) (kw_measure) (kw_measures) (kw_metadata)
  (kw_minute) (kw_minvalue) (kw_mode) (kw_modify)
  (kw_month) (kw_multiset) (kw_mutable) (kw_name)
  (kw_nested) (kw_noaudit) (kw_nocache) (kw_nocycle)
  (kw_nologging) (kw_none) (kw_noneditionable) (kw_noorder)
  (kw_nowait) (kw_oid) (kw_option) (kw_ordinality)
  (kw_overflow) (kw_pairs) (kw_parameters) (kw_parent)
  (kw_passing) (kw_path) (kw_persistable) (kw_pipe)
  (kw_pluggable) (kw_precedes) (kw_primary) (kw_read)
  (kw_reference) (kw_references) (kw_referencing) (kw_reject)
  (kw_relies_on) (kw_repeat) (kw_reset) (kw_result)
  (kw_reuse) (kw_sample) (kw_save) (kw_scalars)
  (kw_schema) (kw_search) (kw_second) (kw_seed)
  (kw_segment) (kw_sequence) (kw_serializable) (kw_servererror)
  (kw_settings) (kw_shards) (kw_shutdown) (kw_skip)
  (kw_startup) (kw_statement) (kw_statistics) (kw_strict)
  (kw_struct) (kw_subpartition) (kw_suspend) (kw_sys)
  (kw_tablespace) (kw_tdo) (kw_time) (kw_to)
  (kw_trailing) (kw_transaction) (kw_unlimited) (kw_unplug)
  (kw_updating) (kw_use) (kw_using_nls_comp) (kw_validate)
  (kw_value) (kw_varray) (kw_varying) (kw_view)
  (kw_wait) (kw_within) (kw_without) (kw_work)
  (kw_write) (kw_year) (kw_zone)
] @keyword

; ---------------------------------------------------------------------------
; Parameters (refined after @variable so they can win)
; ---------------------------------------------------------------------------

(parameter_declaration_element
  (identifier) @variable.parameter @variable)

(parameter_name
  (identifier) @variable.parameter @variable)

; Pseudocolumns and cursor attributes stay keywords: SQL%ROWCOUNT, c%ISOPEN
[
  (kw_sql) (kw_rowcount) (kw_isopen) (kw_found) (kw_notfound) (kw_percent)
] @keyword
