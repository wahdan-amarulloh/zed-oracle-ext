-- Sample package specification
CREATE OR REPLACE PACKAGE emp_admin AS
    -- Raise salary for an employee
    PROCEDURE raise_salary(emp_id NUMBER, amount NUMBER);

    FUNCTION get_status(emp_id NUMBER) RETURN VARCHAR2;

    valid_employee BOOLEAN := FALSE;
END emp_admin;
