CREATE OR REPLACE PROCEDURE hire_employee (
    p_name   IN VARCHAR2,
    p_salary IN NUMBER DEFAULT 0
) AS
BEGIN
    INSERT INTO employees (name, salary)
    VALUES (p_name, p_salary);
    COMMIT;
END hire_employee;
