-- Corpus: explicit cursor, parameterised cursor, WHILE loop and FOR loop
CREATE OR REPLACE PROCEDURE reconcile_departments AS
    CURSOR c_dept IS
        SELECT department_id, name FROM departments WHERE active = 1;

    CURSOR c_emp (p_dept_id NUMBER, p_min_salary NUMBER) IS
        SELECT employee_id, salary
          FROM employees
         WHERE department_id = p_dept_id
           AND salary >= p_min_salary;

    v_dept      c_dept%ROWTYPE;
    v_employee  c_emp%ROWTYPE;
    v_remaining PLS_INTEGER := 3;
BEGIN
    OPEN c_dept;
    LOOP
        FETCH c_dept INTO v_dept;
        EXIT WHEN c_dept%NOTFOUND;

        OPEN c_emp (v_dept.department_id, 1000);
        FETCH c_emp INTO v_employee;
        CLOSE c_emp;
    END LOOP;
    CLOSE c_dept;

    WHILE v_remaining > 0 LOOP
        v_remaining := v_remaining - 1;
        CONTINUE WHEN v_remaining = 2;
    END LOOP;

    FOR i IN 1 .. 3 LOOP
        FOR rec IN (SELECT 1 AS one FROM dual) LOOP
            NULL;
        END LOOP;
    END LOOP;
END reconcile_departments;
/
