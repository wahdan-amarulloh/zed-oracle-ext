CREATE OR REPLACE PACKAGE BODY emp_admin AS
    PROCEDURE raise_salary(emp_id NUMBER, amount NUMBER) IS
    BEGIN
        UPDATE employees
           SET salary = salary + amount
         WHERE employee_id = emp_id;

        /* Block comment: log the change
           across multiple lines */
        INSERT INTO audit_log (emp_id, changed)
        VALUES (emp_id, SYSDATE);
    END raise_salary;

    FUNCTION get_status(emp_id NUMBER) RETURN VARCHAR2 IS
        v_status VARCHAR2(20);
    BEGIN
        SELECT status INTO v_status
          FROM employees
         WHERE employee_id = emp_id;

        IF v_status IS NULL THEN
            RETURN 'UNKNOWN';
        ELSIF v_status = 'ACTIVE' THEN
            RETURN 'OK';
        ELSE
            RETURN 'INACTIVE';
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN 'NOT_FOUND';
        WHEN OTHERS THEN
            RAISE;
    END get_status;
END emp_admin;
