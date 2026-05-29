---
name: typefully
description: "Create, schedule, and manage social media posts via Typefully. Use when asked to draft, schedule, post, or check tweets, posts, threads, or social media content for Twitter/X, LinkedIn, Threads, Bluesky, or Mastodon."
version: "0.0.1"
license: MIT
author: "Ren Labs"
source: "https://typefully.com/docs/api"
---

# Typefully

Create, schedule, and publish social media content across X, LinkedIn, Threads, Bluesky, and Mastodon via the [Typefully API](https://typefully.com/docs/api).

## Environment

| Variable | Required | Description |
|---|---|---|
| `TYPEFULLY_API_KEY` | yes | Typefully API key. Provided by the Ren vault — already in the environment when the skill runs. |

**CLI deps:** Node.js 18+ (built-in `fetch`). No other dependencies.

All script paths in this document (e.g., `./scripts/typefully.js`) are relative to the skill directory where this SKILL.md file is located. Resolve them based on where the skill is installed.

## Social Sets

The Typefully API uses "social set" for what users call an "account" — one social set bundles the connected platforms (X, LinkedIn, Threads, etc.) for one identity.

Every command that targets an account needs a `social_set_id`, passed positionally or via `--social-set-id`. There is no persisted default.

**Resolving the social set:**

1. If the user named one explicitly, use it.
2. If you resolved one earlier in this conversation, reuse it without asking.
3. Otherwise run `social-sets:list`. If exactly one result, use it. If multiple, ask the user which to use.

## Common Actions

| User says...                                   | Action                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| "Draft a tweet about X"                        | `drafts:create <social_set_id> --text "..."`                                                                                       |
| "Post this to LinkedIn"                        | `drafts:create <social_set_id> --platform linkedin --text "..."`                                                                   |
| "Mention a company on LinkedIn"                | `linkedin:organizations:resolve <social_set_id> --organization-url "<linkedin_url>"` then use returned `mention_text` in `drafts:create` |
| "Post to X and LinkedIn" (same content)        | `drafts:create <social_set_id> --platform x,linkedin --text "..."`                                                                 |
| "X thread + LinkedIn post" (different content) | Create one draft, then `drafts:update` to add platform (see [Publishing to Multiple Platforms](#publishing-to-multiple-platforms)) |
| "What's scheduled?"                            | `drafts:list <social_set_id> --status scheduled`                                                                                   |
| "Show my recent posts"                         | `drafts:list <social_set_id> --status published`                                                                                   |
| "Schedule this for tomorrow"                   | `drafts:create <social_set_id> ... --schedule "2026-05-14T09:00:00Z"`                                                              |
| "Post this now"                                | `drafts:create <social_set_id> ... --schedule now` or `drafts:publish <social_set_id> <draft_id>`                                  |
| "Add notes/ideas to the draft"                 | `drafts:create <social_set_id> ... --scratchpad "Your notes here"`                                                                 |
| "Check available tags"                         | `tags:list <social_set_id>`                                                                                                        |
| "Check my publishing quota"                    | `social-sets:get <social_set_id>` and inspect `publishing_quota`                                                                   |
| "Show my X post analytics for last week"       | `analytics:posts:list <social_set_id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD`                                               |
| "Show my X post analytics including replies"   | `analytics:posts:list <social_set_id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD --include-replies`                             |
| "Show my X follower growth"                    | `analytics:followers:get <social_set_id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD`                                            |
| "Show my queue for next week"                  | `queue:get <social_set_id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD`                                                          |
| "List comments on this draft"                  | `comments:list <draft_id> --social-set-id <id>`                                                                                    |
| "Comment on the phrase 'exciting news'"        | `comments:create <draft_id> --social-set-id <id> --post-index 0 --selected-text "exciting news" --text "..."`                      |
| "Reply to that comment thread"                 | `comments:reply <draft_id> <thread_id> --social-set-id <id> --text "..."`                                                          |
| "Resolve / delete a comment thread"            | `comments:resolve <draft_id> <thread_id> --social-set-id <id>` / `comments:delete <draft_id> <thread_id> --social-set-id <id>`     |
| "Get the draft without comment annotations"    | `drafts:get <social_set_id> <draft_id> --exclude-comment-markers`                                                                  |

## Workflow

1. Resolve a `social_set_id` (see [Social Sets](#social-sets) above).
2. Create the draft:

   ```bash
   ./scripts/typefully.js drafts:create <social_set_id> --text "Your post"
   ```

   If `--platform` is omitted, the first connected platform is auto-selected. For multi-platform posts see [Publishing to Multiple Platforms](#publishing-to-multiple-platforms) — always use a single draft, even when content differs per platform.

3. Schedule or publish as needed.

## Working with Tags

Tags help organize drafts within Typefully. **Always check existing tags before creating new ones**:

1. **List existing tags first**:

   ```bash
   ./scripts/typefully.js tags:list <social_set_id>
   ```

2. **Use existing tags when available** — pass them by slug on `drafts:create`:

   ```bash
   ./scripts/typefully.js drafts:create <social_set_id> --text "..." --tags existing-tag-name
   ```

3. **Only create new tags if needed**:

   ```bash
   ./scripts/typefully.js tags:create <social_set_id> --name "New Tag"
   ```

**Important**: Tags are scoped to each social set. A tag created for one social set won't appear in another.

## Publishing to Multiple Platforms

If a single draft needs to be created for different platforms, you need to make sure to create **a single draft** and not multiple drafts.

When the content is the same across platforms, create a single draft with multiple platforms:

```bash
# Specific platforms
./scripts/typefully.js drafts:create <social_set_id> --platform x,linkedin --text "Big announcement!"

# All connected platforms
./scripts/typefully.js drafts:create <social_set_id> --all --text "Posting everywhere!"
```

**IMPORTANT**: When content should be tailored (e.g., X thread with a LinkedIn post version), **still use a single draft** — create with one platform first, then update to add the other:

```bash
# 1. Create draft with the primary platform first
./scripts/typefully.js drafts:create <social_set_id> --platform linkedin --text "Excited to share our new feature..."
# Returns: { "id": "draft-123", ... }

# 2. Update the same draft to add another platform with different content
./scripts/typefully.js drafts:update <social_set_id> draft-123 --platform x --text "🧵 Thread time!

---

Here's what we shipped and why it matters..."
```

Never create multiple drafts unless the user explicitly wants separate drafts for each platform.

## LinkedIn Mentions

LinkedIn mentions are supported via text syntax inside post content:

```text
@[Company Name](urn:li:organization:123456)
```

Use the resolver command to convert a public LinkedIn organization URL into ready-to-paste mention syntax:

```bash
./scripts/typefully.js linkedin:organizations:resolve <social_set_id> --organization-url "https://www.linkedin.com/company/typefullycom/"
# Returns mention_text like: @[Typefully](urn:li:organization:86779668)
```

Then include that `mention_text` in your LinkedIn draft text:

```bash
./scripts/typefully.js drafts:create <social_set_id> --platform linkedin --text "Thanks @[Typefully](urn:li:organization:86779668) for the support."
```

## Comments on Drafts

Drafts can have comment threads anchored to a selected span or to a whole paragraph. `drafts:get` returns `posts[*].text` with inline `<typ:comment-thread>` anchors by default so agents can preserve those anchors during edits.

**Core rules for agents:**

1. **Preserve every comment anchor when patching draft text.** Span anchors wrap selected text; self-closing anchors at the start of a paragraph are live comments on the whole following paragraph, not empty/resolved comments. When rewriting, move each anchor to the most semantically equivalent span or paragraph. Do not silently strip or drop anchors.
2. **Do not resolve or delete comments without explicit user instruction.** After editing text that may address feedback, ask whether to resolve the specific thread(s). Never infer that "clean up", "tidy", or "looks addressed" means resolve/delete.
3. **Talk to users about comments, not marker syntax.** Describe anchors in plain English, such as "comment on the word 'constraint'" or "comment on the paragraph starting with ...". Only mention marker syntax when explaining marker-related API errors or when the user asks how anchors work.

Default edit flow for drafts with comments: get the draft with anchors enabled, rewrite while preserving/repositioning every anchor, patch with `drafts:update --text ...` without force flags, then ask whether to resolve any addressed comments. Use `comments:list <draft_id> --status all` when you need thread ids, comment bodies, authors, or resolved status.

Use `drafts:get --exclude-comment-markers` only for display, LLM context, export, or preview text that will not be patched back.

### Force Overwrite And Accepting Comments

`--force-overwrite-comments` is destructive: every unresolved thread whose anchor is missing from the submitted text is resolved server-side and stripped, including unrelated threads. Default: do not use it. If a PATCH fails because anchors do not match, fetch the draft with anchors, preserve every `<typ:comment-thread>` anchor, and patch again without force.

Only use `--force-overwrite-comments` when anchors truly cannot be preserved, such as a user-requested wholesale rewrite or an anchor with no reasonable new location. Before using it, run `comments:list <draft_id> --status unresolved`, tell the user which threads will be resolved and stripped (selected text + top comment), state that this cannot be undone via the API, and wait for an explicit "yes, proceed". Do not confirm and PATCH in the same turn.

When the user asks to accept/apply/address a comment, fetch without `--exclude-comment-markers`, identify the target thread, edit only that anchor's text (or the paragraph after a self-closing paragraph anchor), preserve every other anchor and unrelated text, then `drafts:update` without force flags. Ask before resolving the thread. If feedback is open-ended, propose wording or ask instead of inventing silently. For "accept all comments", batch only changes whose anchors can all be preserved.

| Command                                                                          | Purpose                                                                                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `comments:list <draft_id>`                                                       | List comment threads. Filters: `--platform`, `--status` (`unresolved` default / `resolved` / `all`), `--limit`, `--offset` |
| `comments:create <draft_id> --post-index <n> --selected-text "..." --text "..."` | Create a comment thread anchored on exact selected text. Optional: `--platform`, `--occurrence`                            |
| `comments:reply <draft_id> <thread_id> --text "..."`                             | Add a reply to a thread                                                                                                    |
| `comments:resolve <draft_id> <thread_id>`                                        | Resolve a thread, only after explicit user confirmation                                                                    |
| `comments:update <draft_id> <thread_id> <comment_id> --text "..."`               | Edit a comment's text; comment-author only                                                                                 |
| `comments:delete <draft_id> <thread_id> [comment_id]`                            | Delete a thread or one comment, only after explicit user instruction                                                       |

All `comments:*` commands require `--social-set-id <id>` (the draft's social set).

`comments:create` requires `selected_text` to exactly match the post text. If it repeats, pass zero-based `--occurrence`; for LinkedIn mentions, select the entire `@[Name](urn:li:...)` substring or stay outside it. Pass `--platform` only when the draft has multiple commentable platforms.

## Commands Reference

### User & Social Sets

| Command                                                                  | Description                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `me:get`                                                                 | Get authenticated user info                                                       |
| `social-sets:list`                                                       | List all social sets you can access                                               |
| `social-sets:get <social_set_id>`                                        | Get social set details including connected platforms and `publishing_quota`       |
| `linkedin:organizations:resolve <social_set_id> --organization-url <url>` | Resolve LinkedIn company/school URL into mention metadata (`mention_text`, `urn`) |

`social-sets:get` returns a `publishing_quota` object when available:

- `used` - published drafts already counted in the current quota window
- `remaining` - remaining publish slots, or `"unlimited"`
- `resets_at` - when the current quota window resets

Use it before publishing/scheduling when the user asks about remaining posting capacity or when a publish/schedule request fails with quota copy.

### Analytics

The public API currently supports **X analytics only**. The CLI defaults `--platform` to `x`, so you can usually omit it.

Replies are **excluded by default**. Add `--include-replies` to opt in.

Analytics responses return post-level metrics for the requested inclusive date range, including:

- `impressions`
- engagement totals and breakdowns like `likes`, `comments`, `shares`, `quotes`, `saves`, `profile_clicks`, and `link_clicks`

Follower analytics returns `current_followers_count` plus daily `data` points with `date` and `followers_count`. If you omit dates, the API returns the default recent range.

| Command                                                                                 | Description                                                                |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `analytics:posts:list <social_set_id> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` | List X posts with normalized analytics metrics for an inclusive date range |
| `analytics:posts:list ... --include-replies`                                            | Include X replies in the results (excluded by default)                     |
| `analytics:posts:list ... --limit 100 --offset 25`                                      | Paginate through results                                                   |
| `analytics:followers:get <social_set_id>`                                               | Get X follower counts for the API default date range                       |
| `analytics:followers:get ... --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>`         | Get X follower counts for an inclusive date range                          |

Snake-case aliases (`--start_date`, `--end_date`, `--include_replies`) are also accepted.

### Drafts

When updating a draft that has comments, preserve anchors from `drafts:get` in the text sent to `drafts:update`. `--exclude-comment-markers` is display-only. `--force-overwrite-comments` is a destructive last resort that requires explicit user confirmation; see [Comments on Drafts](#comments-on-drafts).

| Command                                                                | Description                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `drafts:list <social_set_id>`                                          | List drafts (add `--status scheduled` to filter, `--sort` to order)                                         |
| `drafts:get <social_set_id> <draft_id>`                                | Get a specific draft with full content                                                                      |
| `drafts:get ... --exclude-comment-markers`                             | Render `posts[*].text` without comment anchors (read-only / display use only)                               |
| `drafts:create <social_set_id> --text "..."`                           | Create a new draft (auto-selects platform)                                                                  |
| `drafts:create <social_set_id> --platform x --text "..."`              | Create a draft for specific platform(s)                                                                     |
| `drafts:create <social_set_id> --all --text "..."`                     | Create a draft for all connected platforms                                                                  |
| `drafts:create <social_set_id> --file <path>`                          | Create draft from file content                                                                              |
| `drafts:create ... --media <media_ids>`                                | Create draft with attached media                                                                            |
| `drafts:create ... --reply-to <url>`                                   | Reply to an existing X post                                                                                 |
| `drafts:create ... --community <id>`                                   | Post to an X community                                                                                      |
| `drafts:create ... --quote-post-url <url>`                             | Quote an existing X post URL                                                                                |
| `drafts:create ... --paid-partnership`                                 | Label X post(s) as paid partnership                                                                         |
| `drafts:create ... --made-with-ai`                                     | Label X post(s) as made with AI                                                                             |
| `drafts:create ... --share`                                            | Generate a public share URL for the draft                                                                   |
| `drafts:create ... --scratchpad "..."`                                 | Add internal notes/scratchpad to the draft                                                                  |
| `drafts:update <social_set_id> <draft_id> --text "..."`                | Update an existing draft                                                                                    |
| `drafts:update ... --quote-post-url <url>`                             | Update X post(s) in a draft to quote an existing post URL                                                   |
| `drafts:update ... --paid-partnership`                                 | Label existing or updated X post(s) as paid partnership                                                     |
| `drafts:update ... --made-with-ai`                                     | Label existing or updated X post(s) as made with AI                                                         |
| `drafts:update <social_set_id> <draft_id> --tags "tag1,tag2"`          | Update tags on an existing draft (content unchanged)                                                        |
| `drafts:update ... --share`                                            | Generate a public share URL for the draft                                                                   |
| `drafts:update ... --scratchpad "..."`                                 | Update internal notes/scratchpad                                                                            |
| `drafts:update <social_set_id> <draft_id> --append --text "..."`       | Append to existing thread                                                                                   |
| `drafts:update ... --exclude-comment-markers`                          | Render the response without comment anchors (display only; request validation still applies)                |
| `drafts:update ... --force-overwrite-comments`                         | Destructive last resort; auto-resolves missing-anchor threads and requires explicit user confirmation first |

### Scheduling & Publishing

| Command                                                            | Description                       |
| ------------------------------------------------------------------ | --------------------------------- |
| `drafts:delete <social_set_id> <draft_id>`                         | Delete a draft                    |
| `drafts:schedule <social_set_id> <draft_id> --time next-free-slot` | Schedule to next available slot   |
| `drafts:publish <social_set_id> <draft_id>`                        | Publish immediately               |

### Queue

The queue is a **social-set-specific timeline** made of:

- Queue slots generated from that social set's queue schedule
- Scheduled drafts/posts that belong to that same social set

Use `queue:get` when the user asks what is already scheduled (or free) for a given account in a date range.

| Command                                                                                    | Description                                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `queue:get <social_set_id> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>`              | Get the queue timeline for one social set: free queue slots plus scheduled drafts/posts in a date range |
| `queue:schedule:get <social_set_id>`                                                       | Get queue schedule rules                                                                                |
| `queue:schedule:put <social_set_id> --rules '[{"h":9,"m":30,"days":["mon","wed","fri"]}]'` | Replace queue schedule rules (full replacement)                                                         |

### Tags

| Command                                         | Description      |
| ----------------------------------------------- | ---------------- |
| `tags:list <social_set_id>`                     | List all tags    |
| `tags:create <social_set_id> --name "Tag Name"` | Create a new tag |

### Media

| Command                                    | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `media:upload <social_set_id> <file_path>` | Upload media, wait for processing, return ready media_id |
| `media:upload ... --no-wait`               | Upload and return immediately (use `media:status` to poll) |
| `media:upload ... --timeout <seconds>`     | Set custom timeout (default: 60)                         |
| `media:status <social_set_id> <media_id>`  | Check media upload status                                |

## Examples

### Create a tweet

```bash
./scripts/typefully.js drafts:create 123 --text "Hello, world!"
```

### Create a cross-platform post (specific platforms)

```bash
./scripts/typefully.js drafts:create 123 --platform x,linkedin,threads --text "Big announcement!"
```

### Resolve LinkedIn mention syntax from a company URL

```bash
./scripts/typefully.js linkedin:organizations:resolve 123 --organization-url "https://www.linkedin.com/company/typefullycom/"
```

### Create a LinkedIn draft with a mention

```bash
./scripts/typefully.js drafts:create 123 --platform linkedin --text "Thanks @[Typefully](urn:li:organization:86779668) for the support."
```

### Create a post on all connected platforms

```bash
./scripts/typefully.js drafts:create 123 --all --text "Posting everywhere!"
```

### Create and schedule for next slot

```bash
./scripts/typefully.js drafts:create 123 --text "Scheduled post" --schedule next-free-slot
```

### Create with tags

```bash
./scripts/typefully.js drafts:create 123 --text "Marketing post" --tags marketing,product
```

### List scheduled posts sorted by date

```bash
./scripts/typefully.js drafts:list 123 --status scheduled --sort scheduled_date
```

### Get queue view for a date range

```bash
./scripts/typefully.js queue:get 123 --start-date 2026-06-01 --end-date 2026-06-30
```

### Get X post analytics for a date range

```bash
./scripts/typefully.js analytics:posts:list 123 --start-date 2026-05-01 --end-date 2026-05-07
```

### Get X post analytics including replies

```bash
./scripts/typefully.js analytics:posts:list 123 --start-date 2026-05-01 --end-date 2026-05-07 --include-replies
```

### Get X followers analytics for a date range

```bash
./scripts/typefully.js analytics:followers:get 123 --start-date 2026-05-01 --end-date 2026-05-31
```

### Reply to a tweet

```bash
./scripts/typefully.js drafts:create 123 --platform x --text "Great thread!" --reply-to "https://x.com/user/status/123456"
```

### Post to an X community

```bash
./scripts/typefully.js drafts:create 123 --platform x --text "Community update" --community 1493446837214187523
```

### Create an X quote post

```bash
./scripts/typefully.js drafts:create 123 --platform x --text "My take on this" --quote-post-url "https://x.com/user/status/1234567890123456789"
```

### Create an X post with content disclosure labels

```bash
./scripts/typefully.js drafts:create 123 --platform x --text "Sponsored AI-assisted update" --paid-partnership --made-with-ai
```

### Create draft with share URL

```bash
./scripts/typefully.js drafts:create 123 --text "Check this out" --share
```

### Create draft with scratchpad notes

```bash
./scripts/typefully.js drafts:create 123 --text "Launching next week!" --scratchpad "Draft for product launch. Coordinate with marketing team before publishing."
```

### Upload media and create post with it

```bash
# Single command handles upload + polling - returns when ready
./scripts/typefully.js media:upload 123 ./image.jpg
# Returns: {"media_id": "abc-123-def", "status": "ready", "message": "Media uploaded and ready to use"}

# Create post with the media attached
./scripts/typefully.js drafts:create 123 --text "Check out this image!" --media abc-123-def
```

### Add media to an existing draft

```bash
./scripts/typefully.js media:upload 123 ./new-image.jpg  # Returns media_id: xyz
./scripts/typefully.js drafts:update 123 456 --text "Updated post with image" --media xyz
```

## Platform Names

Use these exact names for the `--platform` option:

- `x` - X (formerly Twitter)
- `linkedin` - LinkedIn
- `threads` - Threads
- `bluesky` - Bluesky
- `mastodon` - Mastodon

## Draft URLs

Typefully draft URLs contain the social set and draft IDs:

```
https://typefully.com/?a=<social_set_id>&d=<draft_id>
```

Example: `https://typefully.com/?a=12345&d=67890`

- `a=12345` → social_set_id
- `d=67890` → draft_id

## Draft Scratchpad

**When the user explicitly asks to add notes, ideas, or anything else in the draft scratchpad, use the `--scratchpad` flag — do NOT write to local files.**

The `--scratchpad` option attaches internal notes directly to the Typefully draft. These notes:

- Are visible in the Typefully UI alongside the draft
- Stay attached to the draft permanently
- Are private and never published to social media
- Are perfect for storing thread expansion ideas, research notes, context, etc.

```bash
# CORRECT: Notes attached to the draft in Typefully
./scripts/typefully.js drafts:create 123 --text "My post" --scratchpad "Ideas for expanding: 1) Add stats 2) Include quote"
```

## Automation Guidelines

When automating posts, especially on X, follow these rules to keep accounts in good standing:

- **No duplicate content** across multiple accounts
- **No unsolicited automated replies** — only reply when explicitly requested by the user
- **No trending manipulation** — don't mass-post about trending topics
- **No fake engagement** — don't automate likes, reposts, or follows
- **Respect rate limits** — the API has rate limits, don't spam requests
- **Drafts are private** — content stays private until published or explicitly shared

When in doubt, create drafts for user review rather than publishing directly.

**Publishing confirmation**: Unless the user explicitly asks to "publish now" or "post immediately", always confirm before publishing. Creating a draft is safe; publishing is irreversible and goes public instantly.

## Tips

- **Smart platform default**: If `--platform` is omitted, the first connected platform is auto-selected
- **All platforms**: Use `--all` to post to all connected platforms at once
- **Character limits**: X (280), LinkedIn (3000), Threads (500), Bluesky (300), Mastodon (500)
- **LinkedIn mentions**: Use `@[Name](urn:li:organization:ID)` in post text; resolve IDs via `linkedin:organizations:resolve`
- **Thread creation**: Use `---` on its own line to split into multiple posts (thread)
- **Scheduling**: Use `next-free-slot` to let Typefully pick the optimal time
- **Cross-posting**: List multiple platforms separated by commas: `--platform x,linkedin`
- **Draft titles**: Use `--title` for internal organization (not posted to social media)
- **Draft scratchpad**: Use `--scratchpad` to attach notes to the draft in Typefully (NOT local files) — perfect for thread ideas, research, context
- **X content disclosures**: Use `--paid-partnership` and/or `--made-with-ai` on `drafts:create` or `drafts:update`; these flags are X-only
- **Publishing quota**: Use `social-sets:get` and inspect `publishing_quota` to see remaining publish capacity and reset time
- **Read from file**: Use `--file ./post.txt` instead of `--text` to read content from a file
- **Sorting drafts**: Use `--sort` with values like `created_at`, `-created_at`, `scheduled_date`, etc.
