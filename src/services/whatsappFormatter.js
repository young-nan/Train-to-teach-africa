/**
 * src/services/whatsappFormatter.js
 *
 * Generates the nightly WhatsApp message body for a parent.
 *
 * Design constraints:
 *   - WhatsApp message templates (HSM) are pre-approved by Meta. We can't
 *     send arbitrary text outside a 24-hour conversation window; we MUST
 *     use a template with named variables.
 *   - Templates support: {{1}}, {{2}}, ... numbered placeholders. Plain text
 *     with limited markdown (*bold*, _italic_, ~strike~, `code`).
 *   - Single message max 1024 chars (template body), but practical limit
 *     much lower — parents won't read past a few lines on a 5" phone.
 *   - One link allowed (the "Read full lesson" deep link to the app).
 *
 * The function below produces:
 *   1. variables: array of strings for the template placeholders
 *   2. preview: a string showing what the parent will see (for the
 *      admin/dev UI; this is NOT sent to WhatsApp)
 *
 * We DON'T send from this module. The actual API call happens in the
 * Edge Function `send-whatsapp` (TODO: not yet built).
 */

/**
 * Build the variables for the nightly_lesson_v1 template.
 *
 * Template (approved by Meta, registered in their Business Manager):
 *
 *   Hi {{1}} 👋
 *
 *   Tonight's 5-minute activity for {{2}}:
 *
 *   *{{3}}*
 *   {{4}}
 *
 *   Ask at dinner:
 *   {{5}}
 *
 *   Open lesson: {{6}}
 *
 * (Note: Meta strips most emoji from approved templates. The 👋 here
 * is from an pre-approved set Meta permits — verify per region.)
 */
export function formatNightlyLesson({ parentName, childName, lesson, lessonUrl }) {
  if (!lesson?.layers) {
    throw new Error('Lesson is missing parent layers — cannot format for WhatsApp.');
  }

  const parentFirstName = (parentName ?? 'there').split(/\s+/)[0];
  const childFirstName = (childName ?? 'your child').split(/\s+/)[0];

  // Trim each variable to keep the total message under WhatsApp's practical limit
  const activityTitle = truncate(lesson.title ?? 'Tonight\'s activity', 60);
  const activityBody = truncate(lesson.layers.parentKitchenActivity ?? '', 260);
  // Just the first dinner question — keep WhatsApp message short
  const firstQuestion = lesson.layers.parentDinnerQuestions?.[0]
    ? truncate(lesson.layers.parentDinnerQuestions[0], 120)
    : 'What did you learn today?';

  const variables = [
    parentFirstName,    // {{1}}
    childFirstName,     // {{2}}
    activityTitle,      // {{3}}
    activityBody,       // {{4}}
    firstQuestion,      // {{5}}
    lessonUrl,          // {{6}}
  ];

  // Build a preview string (for admin debug / parent's own dashboard "what
  // they'll see tonight"). This mirrors how WhatsApp renders the template.
  const preview = [
    `Hi ${parentFirstName} 👋`,
    ``,
    `Tonight's 5-minute activity for ${childFirstName}:`,
    ``,
    `*${activityTitle}*`,
    activityBody,
    ``,
    `Ask at dinner:`,
    firstQuestion,
    ``,
    `Open lesson: ${lessonUrl}`,
  ].join('\n');

  return {
    templateName: 'nightly_lesson_v1',
    languageCode: 'en',
    variables,
    preview,
    estimatedLength: preview.length,
  };
}

/**
 * Build the opt-in confirmation message body, sent right after a parent
 * subscribes for the first time. This goes inside the 24-hour conversation
 * window once they reply, but we still use a template for the first message.
 */
export function formatOptInConfirmation({ parentName, validUntil }) {
  const parentFirstName = (parentName ?? 'there').split(/\s+/)[0];
  const validUntilStr = formatDate(validUntil);

  return {
    templateName: 'subscription_confirmed_v1',
    languageCode: 'en',
    variables: [parentFirstName, validUntilStr],
    preview: [
      `Hi ${parentFirstName}, your TTA subscription is active 🎉`,
      ``,
      `You'll get one short lesson activity here each evening,`,
      `valid until ${validUntilStr}.`,
      ``,
      `Reply STOP at any time to pause.`,
    ].join('\n'),
  };
}

function truncate(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  // Try to break on word boundary
  const cut = s.lastIndexOf(' ', n - 1);
  return s.slice(0, cut > 0 ? cut : n - 1) + '…';
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}
