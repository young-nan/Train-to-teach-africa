# modules/learn/

**Reserved for Phase 3 of v1 (weeks 6–7 in the roadmap).**

This folder is empty on purpose. The lesson player lives here when it's
built — but building it now would be premature, because:

1. The role-adaptive engine that drives it (`src/hooks/useLessonView.js`)
   is already done and tested.
2. The lesson schema (`src/lib/schemas/lesson.js`) is already enforced.
3. The service layer (`src/services/lessonService.js`) already knows how
   to fetch and submit attempts.

So when Phase 3 begins, the *only* thing left is the reader UI itself.

## What will live here

```
modules/learn/
├── LearnApp.jsx              Route entry. Wraps in AppShell, owns sub-routes.
├── LessonLibrary.jsx         Browse-by-subject grid. Reads listLessonsForStudent().
├── LessonPlayer.jsx          The reader. The big one — see below.
├── components/
│   ├── ActivityRunner.jsx    Renders one activity at a time, advances on complete.
│   ├── AssessmentRunner.jsx  End-of-lesson questions. Submits via offline queue.
│   ├── ProgressDots.jsx      The "you are here" indicator.
│   └── CompletionCard.jsx    The "well done" screen post-assessment.
└── hooks/
    └── useLessonSession.js   Local session state (current activity index, answers).
```

## Why the player is the most expensive piece left

It's the one screen where 90% of a student's time is spent. Every other
screen in the platform sees a few seconds of attention; this one sees
thirty minutes. So:

- **Touch targets must be 48×48 px minimum.** Children, sticky fingers,
  cracked screens.
- **Every interactive element must work without precise gestures.** No
  drag-to-the-pixel, no long-press-and-hold. Tap, tap, tap.
- **The player must survive a tab close mid-lesson.** Session state goes
  to IndexedDB, restored on next open. No "do you want to start over?"
  dialogs.
- **Audio readback must be available** for every text block — many
  Primary 1–3 pupils read below grade level.
- **Network drops mid-activity must not lose progress.** Activity
  completions queue through the same `enqueue()` pipeline as attendance.

## Build order when Phase 3 starts

1. `LessonPlayer.jsx` skeleton wrapping `useLessonView` and routing to
   activity / assessment runners. ~200 LOC.
2. `ActivityRunner.jsx` for the four activity types in
   `LessonSchema` — interactive, video, reading, practice. ~250 LOC.
3. `AssessmentRunner.jsx` with the four question types — mcq,
   short_answer, numeric, true_false. ~300 LOC.
4. `LessonLibrary.jsx` — shelf view, filter by subject. ~150 LOC.
5. `LearnApp.jsx` — routes + AppShell glue. ~80 LOC.

Total: roughly 1,000 lines for a v1 player. Add 400 for parent + teacher
projections of the same player (they reuse the engine but display
different layers).

The reason this isn't built in the scaffold: deciding what an "activity"
*looks like* on screen is a design decision that benefits from real
content authors weighing in. Build the lesson schema first (done), get
30 lessons authored (next), *then* build the player against real
content. Building it against fixture data is how you end up with a
player that doesn't fit the lessons your educators actually write.
