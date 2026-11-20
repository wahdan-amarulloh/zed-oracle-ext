CREATE OR REPLACE TYPE address_typ AS OBJECT (
    street   VARCHAR2(100),
    city     VARCHAR2(50),
    zip_code VARCHAR2(10),

    MEMBER FUNCTION full_address RETURN VARCHAR2
);
