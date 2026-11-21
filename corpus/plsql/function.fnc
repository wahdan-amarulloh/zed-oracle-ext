-- Corpus: function with local record type, CASE expression and DETERMINISTIC
CREATE OR REPLACE FUNCTION grade_for (
    p_score IN NUMBER
) RETURN VARCHAR2
    DETERMINISTIC
IS
    TYPE t_band IS RECORD (
        low  NUMBER,
        high NUMBER,
        name VARCHAR2(2)
    );
    v_band t_band;
BEGIN
    v_band.low  := 0;
    v_band.high := 100;

    CASE
        WHEN p_score >= 90 THEN
            RETURN 'A';
        WHEN p_score >= 80 THEN
            RETURN 'B';
        WHEN p_score >= 70 THEN
            RETURN 'C';
        ELSE
            RETURN 'F';
    END CASE;
END grade_for;
/
