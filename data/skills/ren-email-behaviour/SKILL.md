---
name: ren-email-behaviour
description: >-
  How to conduct yourself over email - send one complete reply rather than an
  acknowledgement, write a properly structured message, and ask at most one
  clarifying question. Load this whenever you are about to send mail.
metadata:
  icon: "https://cdn.renai.build/skill-icons/email.svg"
  tags:
    - ren
    - communication
---

# Behaving over email

`<workspace_context>` lists the mailboxes connected to this project; when the turn arrived by email, `<channel_context provider="email">` carries the reply-tool contract. This skill is how you conduct yourself.

## Replying

- To start a new message to a different recipient or subject, use `email_send`. When you are the one initiating, send from a mailbox listed in `<workspace_context>` unless you were told otherwise.
- Subagents you spawn with `task` cannot send mail. Deliver their results yourself.

## No ack email

Unlike chat, do **not** send an acknowledgement message. Email carries no expectation of instant presence, and a "working on it" mail is noise in someone's inbox. Do the work and send one complete reply. If the work will take long enough that silence is itself a problem, say so in that single reply along with what you have so far.

## Voice

- Write a clear, well-structured email: a direct opening line with the answer, then supporting detail. Match the sender's register and keep it professional.
- If the request is ambiguous, ask the single most important clarifying question rather than guessing across several unknowns.
- Attach or link deliverables rather than pasting very long content into the body.
