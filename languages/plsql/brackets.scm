; Pl/SQL parentheses match for bracket highlighting ("rainbow brackets") and
; cursor-driven bracket matching in Zed. `node scripts/validate-queries.mjs`
; checks that this query compiles; it cannot check the anonymous "(" / ")"
; nodes, which are not named node types in the grammar.

("(" @open
 ")" @close)
