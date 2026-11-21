-- line comment
/* block
   comment */
CREATE OR REPLACE PROCEDURE probe_all (
    p_id   IN     PLS_INTEGER,
    p_name IN OUT VARCHAR2
) AS
    c_limit CONSTANT NUMBER := 1000;
    v_rate  NUMBER := 3.5;
    v_flag  BOOLEAN := TRUE;
    v_note  CLOB;
    v_blob  BLOB;
    v_ts    TIMESTAMP;
BEGIN
    IF p_id > c_limit THEN
        v_rate := (p_id - 1) / 2 * 3.5;
    ELSIF p_id = 0 THEN
        NULL;
    END IF;
    IF v_rate <> 0 AND v_rate >= 1 THEN
        v_note := 'concat ' || v_rate || ' tail';
    END IF;
    CASE p_id
        WHEN 1 THEN v_note := 'one';
        ELSE v_note := 'other';
    END CASE;
    LOOP
        EXIT WHEN v_flag;
    END LOOP;
    FOR i IN 1 .. 3 LOOP
        CONTINUE;
    END LOOP;
    SELECT COUNT(*) INTO v_rate FROM dual;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20001, 'boom');
END probe_all;
/
