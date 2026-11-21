-- Corpus: standalone procedure with IN/OUT/IN OUT parameters and a loop
CREATE OR REPLACE PROCEDURE adjust_salaries (
    p_department_id IN     NUMBER,
    p_percent       IN     NUMBER DEFAULT 5,
    p_updated       OUT    PLS_INTEGER,
    p_message       IN OUT VARCHAR2
) AS
    v_rowcount PLS_INTEGER := 0;
    CURSOR c_employees IS
        SELECT employee_id
          FROM employees
         WHERE department_id = p_department_id
           FOR UPDATE;
BEGIN
    FOR rec IN c_employees LOOP
        UPDATE employees
           SET salary = salary * (1 + p_percent / 100)
         WHERE CURRENT OF c_employees;
        v_rowcount := v_rowcount + 1;
    END LOOP;

    p_updated := v_rowcount;
    p_message := 'adjusted ' || v_rowcount || ' rows';
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_updated := -1;
        RAISE;
END adjust_salaries;
/
