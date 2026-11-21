-- Corpus: package specification
CREATE OR REPLACE PACKAGE hr_pkg AS
    -- Public constants
    c_max_salary CONSTANT NUMBER := 250000;

    PROCEDURE hire(p_name IN VARCHAR2, p_salary IN NUMBER DEFAULT 0);
    FUNCTION annual_salary(p_employee_id IN NUMBER) RETURN NUMBER;

    TYPE ref_cursor IS REF CURSOR;
    FUNCTION all_employees RETURN ref_cursor;

    valid_department BOOLEAN := FALSE;
END hr_pkg;
/
