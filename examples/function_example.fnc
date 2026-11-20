CREATE OR REPLACE FUNCTION calc_bonus (
    p_salary IN NUMBER
) RETURN NUMBER IS
    v_bonus NUMBER;
BEGIN
    v_bonus := p_salary * 0.1;
    RETURN v_bonus;
END calc_bonus;
