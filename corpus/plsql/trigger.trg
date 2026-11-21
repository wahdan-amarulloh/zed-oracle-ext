-- Corpus: trigger with WHEN clause, :new/:old and nested exception block
CREATE OR REPLACE TRIGGER trg_salary_audit
    BEFORE UPDATE OF salary ON employees
    FOR EACH ROW
    WHEN (new.salary > old.salary)
DECLARE
    v_delta NUMBER;
BEGIN
    v_delta := :new.salary - :old.salary;

    BEGIN
        INSERT INTO salary_audit (employee_id, old_value, new_value, changed_at)
        VALUES (:new.employee_id, :old.salary, :new.salary, SYSDATE);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE_APPLICATION_ERROR(-20002, 'audit insert failed: ' || SQLERRM);
    END;
END trg_salary_audit;
/
