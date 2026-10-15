AGENT TODO — COMPLETE ARABIC EXAM WEBSITE REWORK

1. OBJECTIVE

Rework the existing English examination website into a fully functional Arabic examination website.

This is a complete adaptation of the existing project, not simply a translation of English labels into Arabic.

The previous examination experience already established important functionality, including a timed exam, tab-switching penalties, automatic grading, answer saving, attempt restrictions, and an examiner-friendly results export.

Inspect the existing implementation and preserve useful functionality while adapting it to the Arabic examination's actual requirements.

The finished website must:

- Use Arabic throughout the student-facing interface.
- Render Arabic text correctly from right to left.
- Preserve and restore Arabic تشكيل where required.
- Use the actual Arabic examination source material.
- Recover the correct answers from the PDF's green corrections.
- Contain exactly 51 standard examination questions.
- Include two additional surprise questions that must not be disclosed in advance.
- Include a separate التعبير/المقالي writing task.
- Preserve reliable automatic grading and manual writing assessment.
- Implement the new inactivity-warning system.
- Retain the single-entry-point server architecture.
- Work correctly on Android phones and tablets.

Do not stop after writing a plan. Inspect the repository, make the required changes, run the application, test the implementation, and report any limitations honestly.

---

2. FIRST: INSPECT THE EXISTING PROJECT

Before modifying anything, inspect the repository's structure and current implementation.

The reference folder is:

https://github.com/ilynl7/English-Exam-U1-U2/tree/main/reference

It contains two source files:

1. A PDF containing the examination material and green-marked corrections.
2. A Markdown file containing OCR-extracted content.

The Markdown text may contain recognition errors, incorrect wording, missing punctuation, missing تشكيل, and incomplete answer information.

Do not assume that the Markdown file is authoritative.

Inspect the existing application

Identify:

- The current startup entry point, expected to be "server.js" or an equivalent existing server entry point.
- The existing frontend architecture.
- The timer implementation.
- The tab-switching penalty implementation.
- The grading system.
- The bonus and streak systems.
- The attempt restriction system.
- The persistence and answer-export mechanisms.
- Existing APIs and storage.
- The actual Node.js and hosting requirements.
- Existing English-specific interface elements and examination assumptions.

Preserve useful components instead of unnecessarily rebuilding working functionality.

However, do not retain English-specific behavior that conflicts with the Arabic examination.

Required result

Produce a short internal implementation plan based on the actual project, then continue implementing it without waiting for approval.

Do not invent repository filenames or claim to have examined files that are inaccessible.

---

3. SOURCE MATERIAL RECONSTRUCTION — HIGHEST PRIORITY

The two reference files must be reconciled before generating the final examination.

A. Treat the PDF as the primary visual reference

The PDF contains green-marked corrections representing the supplied correct answers.

Inspect the PDF visually, page by page.

If necessary, render the PDF pages as images and inspect the colors and text directly. Text extraction alone is insufficient because it may discard the green formatting that identifies corrections.

For every question:

- Identify its actual wording.
- Recover its answer choices where applicable.
- Identify the correct answer from the green correction.
- Record the PDF page and question number.
- Compare the question against the Markdown version.
- Record any discrepancies.

Do not assume that extracted PDF text preserves the original formatting.

Do not interpret arbitrary green text as a correct answer without checking its context.

B. Correct the OCR Markdown

Use the Markdown file as a searchable transcription and supplementary reference.

Correct:

- Misrecognized Arabic letters.
- Missing or misplaced hamzas.
- Incorrect taa marbuta and haa characters.
- Incorrect alif maqsurah and ya characters.
- Broken words and spacing.
- Missing or incorrect punctuation.
- Lost quotation marks and brackets.
- Incorrect question numbers.
- Duplicated or incomplete text.
- Missing answer choices.
- Incorrectly recognized names and literary references.
- Missing تشكيل.

Preserve the original meaning and educational objective.

Do not silently change a question simply because its OCR text looks unusual. First determine whether the apparent error exists in the transcription or in the original source.

C. Build an answer and source ledger

Create a structured internal source ledger for all recovered questions.

For each question, record:

- Stable question ID.
- Original question number, if available.
- Exact reconstructed Arabic text.
- Question type.
- Options, if applicable.
- Correct answer.
- Assigned marks.
- PDF page reference.
- Corresponding Markdown excerpt.
- Whether the text was copied, corrected, or rephrased.
- Whether any external reference was required.
- Any remaining uncertainty.

The ledger must distinguish between an answer explicitly marked green in the PDF and an answer independently inferred or verified elsewhere.

Do not claim that an answer was officially marked green unless that is what the source actually shows.

D. Resolve conflicting answers

When the PDF and Markdown disagree:

1. Reinspect the relevant PDF page.
2. Check whether the OCR introduced the discrepancy.
3. Check the surrounding question and choices.
4. Research the original source when necessary.
5. Record the resolution in the source ledger.

If the intended answer cannot be verified confidently, flag the question for manual review instead of inventing an answer key.

The goal is to create a verified Arabic examination, not merely to convert the OCR file into JSON.

---

4. ARABIC TASHKEEL RESTORATION

This is a central requirement.

The previous OCR process failed to preserve the required Arabic vowel marks, so restoring the text accurately is part of the examination reconstruction itself.

A. Identify where tashkeel is required

Prioritize:

- النصوص.
- الشعر والأبيات الشعرية.
- الشواهد الأدبية.
- الاقتباسات المقررة.
- الكلمات التي يسأل السؤال عن ضبطها.
- الكلمات التي يعتمد تفسيرها أو معناها على التشكيل.
- Other passages that visibly contain tashkeel in the original PDF.

Do not automatically assume that every piece of ordinary Arabic prose must be completely vowelized if the original examination does not require it.

Preserve the level of tashkeel appropriate to each original passage and question.

B. Restore the original wording

For each passage with missing tashkeel:

1. Read the original PDF visually.
2. Search for the exact passage online when necessary.
3. Identify its author, textbook, literary work, or original source when possible.
4. Compare the recovered wording against the examination.
5. Restore the missing tashkeel using the verified source.
6. Check the result against the intended meaning and grammatical context.

Prefer authoritative textbook editions, original literary sources, reputable Arabic references, and the original document over random reposts.

Use the actual passage rather than a similarly worded passage found online.

C. Do not fabricate diacritics

Arabic vocalization is context-sensitive.

Do not add tashkeel based solely on a language model's guess when the original wording or intended grammatical reading is uncertain.

If the exact source cannot be located:

- Use the original PDF as far as it remains legible.
- Analyze the grammatical and literary context.
- Record the reconstruction in the source ledger.
- Mark genuinely ambiguous cases for manual review.

Do not present uncertain vocalization as verified source text.

D. Prevent rendering defects

Test Arabic characters and tashkeel in the actual website.

Ensure:

- Fatha, damma, kasra, sukun, shadda, tanween, and other required marks display properly.
- Diacritics are not clipped vertically.
- Marks remain attached to their intended characters.
- Line wrapping does not damage the reading experience.
- Arabic shaping and joining remain correct.
- Text selection and copying preserve the actual Unicode characters.
- No script silently strips tashkeel from the question data.
- No OCR correction accidentally removes meaningful diacritics.

Allow sufficient line height for fully vocalized Arabic passages.

Use a suitable Arabic typeface, such as Noto Naskh Arabic, Amiri, or another compatible Arabic font that supports the required glyphs.

Prefer a locally available or bundled font when practical so that examination text does not depend unnecessarily on an external font service.

---

5. EXAM CONTENT AND EXACT QUESTION COUNTS

The final examination must contain:

- Exactly 51 standard examination questions.
- Exactly 2 additional surprise questions.
- One separate التعبير/المقالي writing task.

The two surprise questions are part of the examination experience but are additional to the 51 standard questions.

Do not mention their existence anywhere before the student encounters them.

This includes the welcome screen, rules, instructions, question previews, section descriptions, and pre-exam notifications.

Do not label them as joke questions or bonus questions in the student-facing interface.

They should appear as ordinary examination questions when encountered.

The 51 standard questions

Select and reconstruct the 51 standard questions using the Arabic source material.

Use the question types actually present in the source examination.

Do not carry over the old English examination's vocabulary and grammar categories merely because they existed in the previous website.

Identify the real Arabic examination structure from the PDF and Markdown.

Where supported by the source material, this may involve:

- فهم المقروء.
- النصوص الأدبية.
- الشعر والشواهد.
- النحو.
- الصرف.
- البلاغة.
- الإملاء.
- المعاني والمفردات.
- الأسئلة المقالية.
- Other question types actually found in the source.

These are examples of possible categories, not instructions to invent categories absent from the source.

Preserve the intended difficulty and educational objectives of the original questions.

If rephrasing is necessary, do not change the tested skill.

Stable question identifiers

Give the standard questions stable IDs such as "Q01" through "Q51".

Give the two surprise questions separate internal identifiers, such as "J01" and "J02".

Give the writing task its own identifier.

Preserve the precise wording, choices, and scoring data used in the student's examination so that submissions remain gradeable even if the question bank changes later.

Question-bank acceptance checks

Before delivering the examination, verify:

- Exactly 51 standard questions exist.
- Exactly two surprise questions exist.
- The essay prompt is present separately.
- Every required source question type is represented appropriately.
- Every objective question has a verified answer key.
- No question is accidentally duplicated.
- No question has missing choices or invalid answer references.
- Tashkeel is preserved where required.
- The final marks distribution is internally consistent.

Do not pad the examination with unrelated questions merely to reach the required count.

---

6. SURPRISE QUESTION J01

Use this question exactly as supplied:

Question:
خسرتي كيرو كم قيم هالاسبوع؟

Choices:

- 1
- 2
- 3
- 3+

Correct answer: "2"

Preserve the wording and answer choices. This is an intentional inside-joke question, not a question that should be formally rewritten into textbook Arabic.

The correct answer must be encoded in the answer key and used by the grading system.

Do not disclose it before submission.

---

7. SURPRISE QUESTION J02 — STU

Use this question exactly as supplied:

Question:
البطل ستو كم يحصل صحه من السوبر حقته؟

Create four answer choices:

- 400
- 490
- 560
- 700

Correct answer: "560"

The reference is Stu's Gaso-Heal Star Power at Power Level 11.

Use the current official Brawl Stars balance information to verify the value rather than relying on an old screenshot or outdated wiki entry.

Important factual clarification for the internal answer key: Stu's base Super does not itself restore health. Gaso-Heal is the Star Power that restores health when Stu uses his Super. The official February 2026 patch notes increased this healing from 544 to 560 per Super use.

Keep the supplied joke wording unchanged in the student interface, but record the Gaso-Heal and Power Level 11 assumption internally to avoid an inaccurate explanation.

Do not disclose this question, its choices, or its answer in the instructions or welcome screen.

Use the same grading and result-review behavior as for the other objective questions.

Reference:
Supercell's official February 2026 release notes and the official announcement of Stu's second Star Power.

---

8. SCORING AND BONUS QUESTIONS

Inspect the current scoring system and the marks provided by the Arabic source examination.

Unless the Arabic examination materials specify a different required total, preserve the existing official maximum of 120 marks.

The 51 standard questions and the separate essay task must fit into a clearly defined, verified scoring blueprint totaling exactly 120 marks.

The two surprise questions are additional bonus questions.

Keep their scoring separate from the official examination score so that the base grade cannot accidentally exceed 120.

Display the official score and any bonus result separately.

The student-facing interface must not disclose the existence of the additional questions before they appear.

Do not reveal correct answers during the examination.

After submission, the answer review may display the correct answers for objectively graded questions, including the two surprise questions.

Prevent duplicate bonus awards after reloads, repeated submissions, or navigation between sections.

If an existing random-bonus or streak system is retained, ensure it cannot corrupt the official score or award the same bonus repeatedly.

---

9. THE ARABIC ESSAY / التعبير / المقالي

The writing task must be based on the Arabic source material and its intended educational level.

Do not reuse the English paragraph-writing prompt.

Implement an Arabic writing area suitable for composing a complete answer.

Requirements:

- Right-to-left input.
- Proper Arabic text shaping.
- Appropriate paragraph direction.
- Support for Arabic punctuation.
- Support for line breaks and multiple paragraphs.
- Preservation of the student's exact submitted Unicode text.
- Reliable autosaving.
- No loss of tashkeel or meaningful character sequences.
- No English-specific assumptions about essay formatting.

Use an Arabic grading rubric appropriate to the actual task.

Where suitable, the rubric may include:

- تحقيق المطلوب ووضوح الفكرة.
- صحة اللغة والتراكيب.
- النحو والصرف.
- الإملاء وعلامات الترقيم.
- ترتيب الأفكار وترابطها.
- الالتزام بنوع التعبير المطلوب.

Adapt these criteria to the actual source question rather than imposing irrelevant criteria.

Keep the essay's marks within the approved 120-mark blueprint.

The objective score must be calculated automatically upon submission, but the essay should remain pending until manually graded.

Do not present an unverified automated essay grade as the definitive final result.

---

10. COMPLETE ARABIC RTL REDESIGN

Changing the text to Arabic is not sufficient. The user interface must be redesigned to work correctly in Arabic.

Set the document language appropriately and implement a consistent right-to-left layout.

Layout and text direction

Use appropriate RTL direction for:

- Navigation.
- Headers.
- Instructions.
- Arabic questions.
- Answer choices.
- Results.
- Notifications.
- Forms.
- Essay input.

Use explicit left-to-right direction where needed for values that should remain LTR, including technical identifiers and numeric values whose ordering must remain unambiguous.

Do not manually reverse Arabic strings or rely on visually rearranging characters.

Use the browser's proper bidirectional text support.

Test Arabic punctuation, brackets, quotation marks, and mixed Arabic/number content.

Fonts and readability

Use a readable Arabic font and allow enough vertical space for diacritics.

Avoid clipping at the top or bottom of lines.

Make the text comfortable to read on Android phones and tablets.

Use appropriate line spacing, paragraph spacing, font sizes, and responsive widths.

Long Arabic passages must wrap naturally without horizontal scrolling.

Form controls

Make sure:

- Radio buttons and checkboxes align correctly with Arabic labels.
- Choice order remains predictable.
- Buttons and navigation flow RTL consistently.
- Arabic placeholders and validation errors are correctly aligned.
- The on-screen Arabic keyboard does not hide the important controls.
- The essay textarea preserves the correct direction while typing.
- Mixed Arabic text and digits remain readable.

Student-facing language

Audit every visible string.

Remove remaining English-specific text, including:

- English exam titles.
- English section labels.
- English-only instructions.
- Old English grading descriptions.
- Untranslated warning messages.
- English-specific result explanations.

Retain English only when it is part of a source question, a proper name, a technical term, or another intentional exception.

---

11. TIMER — PRESERVE EXISTING BEHAVIOR

Inspect the existing timer before modifying it.

Retain the following existing behavior unless the Arabic source examination requires a documented adjustment:

- Normal examination duration: 60 minutes.
- Existing tab-switching penalty: exam time advances at 3× speed while the page is inactive.
- Absolute real-time deadline: 90 minutes.
- Automatic submission when the examination time expires.
- Recovery of an incomplete attempt after an accidental reload, where supported.

The timer must not reset when the student switches sections.

The timer must not restart if the page is refreshed.

Track elapsed time consistently and avoid repeatedly multiplying the entire remaining countdown every time a visibility event occurs.

Preserve the intended 90-minute hard deadline even when other penalties are applied.

If the Arabic examination's content and writing requirements make the current duration unsuitable, inspect the source exam's expected duration and report a justified recommendation. Do not silently remove the existing time limits.

---

12. NEW FEATURE — INACTIVITY WARNINGS

Implement the new inactivity-warning system exactly and consistently.

Required rules

1. If the student produces no meaningful interaction for 30 seconds, show an inactivity warning in Arabic.

2. Each additional 30-second interval without interaction produces another warning.

3. Warnings accumulate across separate inactivity periods.

4. Whenever the accumulated warning count reaches two, subtract exactly 60 seconds from the remaining examination time.

5. After applying the one-minute penalty, reset the accumulated warning count to zero.

6. Continue applying the same rule throughout the examination.

7. A penalty must be applied only once per pair of warnings.

Example

Suppose the student receives one warning, interacts with the exam, and later receives another warning.

The accumulated warning count reaches two, so the system removes one minute from the remaining examination time and resets the warning counter.

The next warning starts a new accumulation cycle.

Interaction detection

Treat meaningful user activity as activity, including:

- Touch events.
- Pointer interaction.
- Mouse clicks.
- Keyboard input.
- Scrolling.
- Typing into a field.
- Writing or editing the essay.
- Other appropriate interaction events.

This is especially important for Arabic composition, where typing must continuously reset the inactivity timer.

Do not punish the student while she is actively typing simply because she is not touching other parts of the screen.

Count one warning per inactivity interval, not multiple warnings generated by repeated timer callbacks.

If the browser tab becomes inactive, let the existing tab-switching penalty handle that period. Do not unintentionally issue repeated inactivity warnings while the exam is hidden and inaccessible.

Reset the inactivity interval appropriately when the student returns to the exam.

Warning interface

Display a clear Arabic warning indicating that no interaction has been detected for 30 seconds.

The interface should make it obvious that the warning has been recorded.

Use a nonblocking notification or modal that does not freeze the countdown.

Do not use blocking browser dialogs that prevent reliable timer updates.

When the second warning triggers the penalty, display a separate, clear notification that one minute has been deducted.

Display the current remaining time accurately.

Ensure that the deduction cannot make the timer negative or cause duplicate timeout submissions.

If the penalty reduces the remaining examination time to zero, submit the examination immediately.

Validation

Test all of the following:

- A single 30-second inactivity period.
- Two consecutive inactivity-warning intervals.
- Two warnings separated by normal interaction.
- Multiple warning-and-penalty cycles.
- Typing into the essay field.
- Scrolling through long Arabic passages.
- Returning to the exam after a tab switch.
- Timer expiration during an inactivity penalty.
- Page reload during an incomplete attempt.

The implementation must behave deterministically.

---

13. ANSWER SAVING AND EXAMINER ACCESS

Preserve the existing answer-saving mechanisms and improve them where necessary.

During the examination

Autosave:

- Student responses.
- Current question.
- Current section.
- Start time.
- Remaining examination time.
- Inactivity-warning count.
- Applicable penalty state.
- Earned bonus state.

Saving should occur frequently enough to protect against accidental reloads.

Do not save only when the student moves to the next question.

Preserve the essay response in full.

After submission

Provide a complete submission record containing:

- Exam ID.
- Student name.
- Start time.
- Submission time.
- Submission reason.
- Question IDs.
- Exact question text used.
- Student responses.
- Correct answers for objective questions.
- Per-question marks.
- Section scores.
- Objective score.
- Essay response.
- Writing rubric.
- Writing-grading status.
- Inactivity warnings and penalties.
- Relevant timing information.
- Bonus records.
- Unanswered question count.

Export and persistence

Maintain a downloadable JSON export and a readable report where practical.

The export must contain all information necessary for later grading.

Ensure Arabic characters and tashkeel survive serialization and reopening without corruption.

If a server-side backend and durable storage are available, persist submitted examinations centrally.

If only browser storage is available, clearly explain that browser storage is not a permanent server-side backup.

Do not claim that a submission was delivered to the examiner unless the implementation actually guarantees that delivery.

---

14. ONE-ATTEMPT RESTRICTION

Inspect the existing attempt restriction logic.

Preserve the intended one-attempt policy.

Prefer server-side enforcement where supported, with appropriate storage for attempt records.

At minimum:

- Prevent restarting a completed attempt in the same browser profile.
- Allow recovery of an incomplete attempt without silently generating a new attempt.
- Prevent accidental duplicate submissions.
- Preserve completed submission records.
- Apply the attempt restriction consistently after timeout as well as normal submission.

Do not claim that localStorage alone guarantees one attempt per device or IP.

If device or IP restrictions exist on the server, test their actual behavior and document limitations.

Do not gather unnecessary personal information.

---

15. SERVER ARCHITECTURE

Keep the existing project organized into multiple files with one clear application startup entry point.

The primary startup file should be "server.js", or the existing equivalent if the repository uses another entry point.

Do not attempt to put the whole website into a single HTML file.

The server should start the application and initialize its required components. Frontend files, exam data, grading logic, routes, and storage should remain appropriately separated.

Inspect the existing startup scripts and hosting configuration rather than assuming a particular environment.

Verify that the website starts through the intended entry point and serves all required files correctly.

Do not remove source references during cleanup.

Do not introduce unnecessary dependencies or a new framework merely for the redesign.

---

16. TESTING CHECKLIST

Do not consider the work complete until the strongest feasible tests have been run.

Source and Arabic content

- The PDF has been inspected visually.
- The green answer corrections have been identified and mapped.
- The Markdown OCR errors have been corrected where verifiable.
- The required tashkeel has been restored and reviewed.
- Question wording matches the source or has a documented, appropriate rephrasing.
- Ambiguous text has been flagged rather than fabricated.
- The answer key has been checked.
- The source ledger contains traceable references.

Question counts

- Exactly 51 standard questions exist.
- Exactly two surprise questions exist.
- The separate essay task exists.
- Both surprise questions match the requested wording.
- J01 has "2" as its correct answer.
- J02 has "560" as its correct answer under the stated Gaso-Heal, Power Level 11 assumption.
- The surprise questions are not disclosed in the rules or welcome screen.

Scoring

- The official examination total is exactly 120 marks unless the Arabic source specifies a different required total.
- The score distribution is documented and validated programmatically.
- Bonus points do not corrupt the official score.
- Objective answers are graded correctly.
- Unanswered questions are handled correctly.
- Essay marks remain pending until manual grading.
- Repeated submissions do not duplicate scores.

Arabic interface

- The entire interface is Arabic.
- RTL layout works on mobile.
- Arabic punctuation and mixed numbers render correctly.
- Tashkeel is not clipped.
- Arabic text remains correctly shaped.
- The essay can be written and saved in Arabic.
- The question navigator works.
- No horizontal overflow or overlapping controls occurs.

Timers and penalties

- The 60-minute timer works.
- The existing 3× tab-switching penalty works.
- The 90-minute real-time deadline works.
- One inactivity warning appears after 30 seconds.
- Every subsequent 30-second inactivity interval behaves correctly.
- Every second accumulated warning deducts exactly one minute.
- The warning count resets after the deduction.
- The inactivity counter resets after interaction.
- Typing does not cause false warnings.
- Reloading does not reset the examination clock.
- Timeout submission is not duplicated.

Persistence and deployment

- Answers survive accidental reloads where supported.
- Essay text is preserved completely.
- JSON export contains all required fields.
- Arabic Unicode survives export and reopening.
- Completed attempts cannot be restarted in the same browser profile.
- Server-side persistence works if configured.
- The application starts using the intended entry point.
- All required frontend files load successfully.

If browser testing is unavailable, perform the strongest feasible automated and manual checks and clearly report what remains unverified.

---

17. FINAL DELIVERY REPORT

When the work is finished, provide a short report containing:

1. Files created and modified.
2. The application's startup command.
3. The number of standard questions, surprise questions, and writing tasks.
4. The total marks and section breakdown.
5. What was reconstructed from the PDF and Markdown.
6. How the required tashkeel was restored and verified.
7. The treatment of conflicting or uncertain source answers.
8. The implemented timer and inactivity-warning behavior.
9. The answer-saving and examiner-export mechanisms.
10. The attempt restriction implementation.
11. Tests actually completed.
12. Remaining problems or unverified functionality.

Do not claim that every Arabic passage has been verified if some remain uncertain.

Do not claim that all tests pass unless they were actually performed.

Do not stop after producing a visually convincing frontend. The source reconstruction, answer key, scoring, timers, and saved submissions must work correctly.

FINAL PRIORITY: A reliable Arabic examination with accurate text, correct answers, proper تشكيل, and preserved submissions is more important than decorative animations or unnecessary features.
