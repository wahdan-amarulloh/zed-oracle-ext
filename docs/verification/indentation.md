# Manual verification: indentation

Recorded after testing the dev extension in Zed with the block below typed line
by line. Indentation is 4 spaces per level (Zed default; `config.toml` sets no
`tab_size`).

## Block typed

```sql
CREATE OR REPLACE PROCEDURE p_demo IS
    v_x NUMBER;
BEGIN
    IF v_x > 0 THEN
        FOR i IN 1 .. 3 LOOP
            v_x := v_x + i;
        END LOOP;
    ELSIF v_x = 0 THEN
        CASE v_x
        WHEN 0 THEN
            NULL;
        END CASE;
    ELSE
        RAISE_APPLICATION_ERROR(-20001, 'neg');
    END IF;
EXCEPTION
WHEN ZERO_DIVIDE THEN
    NULL;
WHEN OTHERS THEN
    RAISE;
END p_demo;
```

## Result

Every line landed at the column shown above, with no manual re-indenting:

| Line | Accepted behaviour |
| --- | --- |
| `... p_demo IS` | Enter indents the declaration section one level |
| `BEGIN` | outdents to column 0, aligned with the unit header |
| `IF ... THEN` / `END IF;` | `END IF` aligns with its `IF` (column 4), not one level under it |
| `FOR ... LOOP` / `END LOOP;` | loop body indented, `END LOOP` aligned with `FOR` |
| `ELSIF`, `ELSE` | outdent to the `IF` column, then their body indents one level |
| `CASE v_x` / `END CASE;` | `END CASE` aligns with `CASE` |
| `EXCEPTION` | outdents to column 0, aligned with `BEGIN` |
| `WHEN ... THEN` | outdents to align with `EXCEPTION`, handlers indent one level |
| `END p_demo;` | outdents to column 0 |

Also checked: pressing Enter twice after `    IF v_x > 0 THEN` leaves the cursor
at column 8; a single-line `CASE WHEN v_x = 1 THEN 2 ELSE 3 END;` does not indent
the following line.

## Known quirk

`WHEN` aligns flush with `EXCEPTION` (column 0). A house style that indents
`WHEN` by one level would need a different `decrease_indent_pattern`.
