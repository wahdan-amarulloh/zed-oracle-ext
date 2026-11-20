CREATE OR REPLACE TRIGGER set_salary_audit
    BEFORE UPDATE OF salary ON employees
    FOR EACH ROW
BEGIN
    :new.updated_at := SYSDATE;
END set_salary_audit;
