-- Corpus: every exception shape - named, PRAGMA, RAISE, user-defined and nested
CREATE OR REPLACE PROCEDURE exception_zoo AS
    e_custom EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_custom, -20999);
    v_state VARCHAR2(200);
BEGIN
    BEGIN
        RAISE e_custom;
    EXCEPTION
        WHEN e_custom THEN
            v_state := 'custom';
    END;

    BEGIN
        SELECT 1 / 0 INTO v_state FROM dual;
    EXCEPTION
        WHEN ZERO_DIVIDE THEN
            v_state := 'div0';
        WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
            v_state := 'cardinality';
        WHEN VALUE_ERROR THEN
            v_state := 'value';
        WHEN OTHERS THEN
            v_state := SQLCODE || ': ' || SQLERRM;
            RAISE;
    END;

    RAISE_APPLICATION_ERROR(-20010, 'fatal: ' || v_state);
END exception_zoo;
/
