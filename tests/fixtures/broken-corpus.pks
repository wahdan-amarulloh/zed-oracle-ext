CREATE OR REPLACE PROCEDURE broken_corpus IS
BEGIN
    this is not plsql @@@ ;;;  -- deliberately unparsable
END broken_corpus;
/
