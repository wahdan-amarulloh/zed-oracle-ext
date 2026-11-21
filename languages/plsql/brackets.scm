; Pl/SQL parentheses match for bracket highlighting ("rainbow brackets") and
; cursor-driven bracket matching in Zed. `node scripts/validate-queries.mjs`
; checks that both node names exist in the pinned grammar.

("(" @open
 ")" @close)
