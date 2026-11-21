CREATE OR REPLACE PROCEDURE migrate_data IS
    /* Marker file: first line makes Zed open this
       .sql file as PL/SQL instead of built-in SQL */
    v_count PLS_INTEGER := 0;
BEGIN
    FOR rec IN (SELECT id FROM staging) LOOP
        v_count := v_count + 1;
        IF v_count > 100 THEN
            EXIT;
        END IF;
    END LOOP;
END migrate_data;
