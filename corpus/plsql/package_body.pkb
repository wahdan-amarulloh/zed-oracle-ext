-- Corpus: package body with cursor loop, nested blocks and exception handler
CREATE OR REPLACE PACKAGE BODY hr_pkg AS

    g_batch_size NUMBER := 500;

    PROCEDURE hire(p_name IN VARCHAR2, p_salary IN NUMBER DEFAULT 0) IS
    BEGIN
        INSERT INTO employees (name, salary, hired_at)
        VALUES (p_name, p_salary, SYSDATE);
        COMMIT;
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            ROLLBACK;
            RAISE_APPLICATION_ERROR(-20001, 'employee already exists');
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END hire;

    FUNCTION annual_salary(p_employee_id IN NUMBER) RETURN NUMBER IS
        v_monthly employees.salary%TYPE;
    BEGIN
        SELECT salary INTO v_monthly
          FROM employees
         WHERE employee_id = p_employee_id;

        IF v_monthly IS NULL THEN
            RETURN 0;
        ELSIF v_monthly > c_max_salary THEN
            RETURN v_monthly;
        ELSE
            RETURN v_monthly * 12;
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END annual_salary;

    FUNCTION all_employees RETURN ref_cursor IS
        v_cursor ref_cursor;
        v_count  PLS_INTEGER := 0;
    BEGIN
        OPEN v_cursor FOR
            SELECT employee_id, name FROM employees ORDER BY name;

        LOOP
            v_count := v_count + 1;
            EXIT WHEN v_count > g_batch_size;
        END LOOP;

        CLOSE v_cursor;
        RETURN v_cursor;
    END all_employees;

END hr_pkg;
/
