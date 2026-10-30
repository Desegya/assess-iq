# Study reading and references

Lesson citations and the source list open a dedicated source reader, rather than expanding a small passage inside a list. The reader uses the full viewport on phones and a bounded panel on larger screens. Its header and close button stay visible while long text scrolls independently.

The default text size is 18px with 1.85 line spacing, a maximum reading width of 70 characters and high-contrast text. Learners can choose 16px, 18px or 21px. Paragraph breaks and original wording remain intact. The existing math renderer handles formula delimiters and leaves Unicode IPA unchanged. No AI rewrites source passages for this view.

The Cited passage view shows the exact stored passage used in the lesson. Where its document still exists, Full document text reads the uploaded document through the existing authenticated document endpoint. That endpoint separately checks access; receiving a source document ID is not an access grant. Original figures and page layout are not reconstructed in this text view. Missing files, empty text and failed requests have explicit states, and a failed full-text request does not prevent returning to the passage.

The native modal dialog supports Escape, keyboard focus containment and focus return to the original citation or source button. Background scrolling is locked while the reader is open. Controls have explicit accessible names and touch-sized targets.

Generated lessons now use the same reading typography. Original outlines, shared teacher notes and admin material previews use the reusable ReadingText component, with cramped nested height limits removed.

Run `npm run test:e2e:lessons --workspace=@assessiq/nightklass` for desktop/mobile checks covering citation opening, text size, formula/IPA display, long-note scrolling, closing/focus return, removed files and full-text failure states. API tests check that references retain their original document identity and that course authorization occurs before source lookup. No migration is needed for this change.
