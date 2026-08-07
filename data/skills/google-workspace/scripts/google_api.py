#!/usr/bin/env python3
"""Google Workspace API CLI.

Reads a pre-issued OAuth access token from the MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN
environment variable, then calls Gmail / Calendar / Drive / Contacts / Sheets /
Docs via the Python google-api-python-client. The platform's vault is responsible
for issuing and refreshing the token; this script is stateless.

Usage:
  python google_api.py gmail search "is:unread" [--max 10]
  python google_api.py gmail get MESSAGE_ID
  python google_api.py gmail send --to user@example.com --subject "Hi" --body "Hello"
  python google_api.py gmail reply MESSAGE_ID --body "Thanks"
  python google_api.py calendar list [--start DATE] [--end DATE] [--calendar primary]
  python google_api.py calendar create --summary "Meeting" --start DATETIME --end DATETIME
  python google_api.py calendar delete EVENT_ID
  python google_api.py drive search "budget report" [--max 10]
  python google_api.py drive get FILE_ID
  python google_api.py drive upload /path/to/file.pdf [--name NAME] [--parent FOLDER_ID]
  python google_api.py drive download FILE_ID [--output PATH] [--export-mime MIME]
  python google_api.py drive create-folder NAME [--parent FOLDER_ID]
  python google_api.py drive share FILE_ID --email USER --role ROLE [--notify]
  python google_api.py drive share FILE_ID --type anyone --role reader
  python google_api.py drive delete FILE_ID [--permanent]
  python google_api.py contacts list [--max 20]
  python google_api.py sheets create --title "Title" [--sheet-name "Sheet1"]
  python google_api.py sheets get SHEET_ID RANGE
  python google_api.py sheets update SHEET_ID RANGE --values '[[...]]'
  python google_api.py sheets append SHEET_ID RANGE --values '[[...]]'
  python google_api.py docs create --title "Title" [--body "First paragraph..."]
  python google_api.py docs get DOC_ID
  python google_api.py docs append DOC_ID --text "More content"
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

ACCESS_TOKEN_ENV = "MCP_GOOGLE_WORKSPACE_ACCESS_TOKEN"


def get_credentials():
    """Build a google.oauth2.credentials.Credentials from the access token in env."""
    token = os.environ.get(ACCESS_TOKEN_ENV, "").strip()
    if not token:
        print(
            f"NOT_AUTHENTICATED: ${ACCESS_TOKEN_ENV} is unset.\n"
            "The platform vault is responsible for injecting the access token.",
            file=sys.stderr,
        )
        sys.exit(1)
    from google.oauth2.credentials import Credentials

    return Credentials(token=token)


def build_service(api, version):
    from googleapiclient.discovery import build

    return build(api, version, credentials=get_credentials())

def _headers_dict(msg: dict) -> dict[str, str]:
    return {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}


def _extract_message_body(msg: dict) -> str:
    body = ""
    payload = msg.get("payload", {})
    if payload.get("body", {}).get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    elif payload.get("parts"):
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                break
        if not body:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
                    body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                    break
    return body


def _extract_doc_text(doc: dict) -> str:
    text_parts = []
    for element in doc.get("body", {}).get("content", []):
        paragraph = element.get("paragraph", {})
        for pe in paragraph.get("elements", []):
            text_run = pe.get("textRun", {})
            if text_run.get("content"):
                text_parts.append(text_run["content"])
    return "".join(text_parts)


def _datetime_with_timezone(value: str) -> str:
    if not value:
        return value
    if "T" not in value:
        return value
    if value.endswith("Z"):
        return value
    tail = value[10:]
    if "+" in tail or "-" in tail:
        return value
    return value + "Z"






# =========================================================================
# Gmail
# =========================================================================


def gmail_search(args):
    service = build_service("gmail", "v1")
    results = service.users().messages().list(
        userId="me", q=args.query, maxResults=args.max
    ).execute()
    messages = results.get("messages", [])
    if not messages:
        print("No messages found.")
        return

    output = []
    for msg_meta in messages:
        msg = service.users().messages().get(
            userId="me", id=msg_meta["id"], format="metadata",
            metadataHeaders=["From", "To", "Subject", "Date"],
        ).execute()
        headers = _headers_dict(msg)
        output.append({
            "id": msg["id"],
            "threadId": msg["threadId"],
            "from": headers.get("From", ""),
            "to": headers.get("To", ""),
            "subject": headers.get("Subject", ""),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
            "labels": msg.get("labelIds", []),
        })
    print(json.dumps(output, indent=2, ensure_ascii=False))



def gmail_get(args):
    service = build_service("gmail", "v1")
    msg = service.users().messages().get(
        userId="me", id=args.message_id, format="full"
    ).execute()

    headers = _headers_dict(msg)
    result = {
        "id": msg["id"],
        "threadId": msg["threadId"],
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "subject": headers.get("Subject", ""),
        "date": headers.get("Date", ""),
        "labels": msg.get("labelIds", []),
        "body": _extract_message_body(msg),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))



def gmail_send(args):
    service = build_service("gmail", "v1")
    message = MIMEText(args.body, "html" if args.html else "plain")
    message["to"] = args.to
    message["subject"] = args.subject
    if args.cc:
        message["cc"] = args.cc
    if args.from_header:
        message["from"] = args.from_header

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    body = {"raw": raw}

    if args.thread_id:
        body["threadId"] = args.thread_id

    result = service.users().messages().send(userId="me", body=body).execute()
    print(json.dumps({"status": "sent", "id": result["id"], "threadId": result.get("threadId", "")}, indent=2))



def gmail_reply(args):
    service = build_service("gmail", "v1")
    original = service.users().messages().get(
        userId="me", id=args.message_id, format="metadata",
        metadataHeaders=["From", "Subject", "Message-ID"],
    ).execute()
    headers = _headers_dict(original)

    subject = headers.get("Subject", "")
    if not subject.startswith("Re:"):
        subject = f"Re: {subject}"

    message = MIMEText(args.body)
    message["to"] = headers.get("From", "")
    message["subject"] = subject
    if args.from_header:
        message["from"] = args.from_header
    if headers.get("Message-ID"):
        message["In-Reply-To"] = headers["Message-ID"]
        message["References"] = headers["Message-ID"]

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    body = {"raw": raw, "threadId": original["threadId"]}

    result = service.users().messages().send(userId="me", body=body).execute()
    print(json.dumps({"status": "sent", "id": result["id"], "threadId": result.get("threadId", "")}, indent=2))



def gmail_labels(args):
    service = build_service("gmail", "v1")
    results = service.users().labels().list(userId="me").execute()
    labels = [{"id": l["id"], "name": l["name"], "type": l.get("type", "")} for l in results.get("labels", [])]
    print(json.dumps(labels, indent=2))



def gmail_modify(args):
    body = {}
    if args.add_labels:
        body["addLabelIds"] = args.add_labels.split(",")
    if args.remove_labels:
        body["removeLabelIds"] = args.remove_labels.split(",")

    service = build_service("gmail", "v1")
    result = service.users().messages().modify(userId="me", id=args.message_id, body=body).execute()
    print(json.dumps({"id": result["id"], "labels": result.get("labelIds", [])}, indent=2))


# =========================================================================
# Calendar
# =========================================================================


def calendar_list(args):
    now = datetime.now(timezone.utc)
    time_min = _datetime_with_timezone(args.start or now.isoformat())
    time_max = _datetime_with_timezone(args.end or (now + timedelta(days=7)).isoformat())

    service = build_service("calendar", "v3")
    results = service.events().list(
        calendarId=args.calendar, timeMin=time_min, timeMax=time_max,
        maxResults=args.max, singleEvents=True, orderBy="startTime",
    ).execute()

    events = []
    for e in results.get("items", []):
        events.append({
            "id": e["id"],
            "summary": e.get("summary", "(no title)"),
            "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
            "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", "")),
            "location": e.get("location", ""),
            "description": e.get("description", ""),
            "status": e.get("status", ""),
            "htmlLink": e.get("htmlLink", ""),
        })
    print(json.dumps(events, indent=2, ensure_ascii=False))



def calendar_create(args):
    event = {
        "summary": args.summary,
        "start": {"dateTime": args.start},
        "end": {"dateTime": args.end},
    }
    if args.location:
        event["location"] = args.location
    if args.description:
        event["description"] = args.description
    if args.attendees:
        event["attendees"] = [{"email": e.strip()} for e in args.attendees.split(",") if e.strip()]

    service = build_service("calendar", "v3")
    result = service.events().insert(calendarId=args.calendar, body=event).execute()
    print(json.dumps({
        "status": "created",
        "id": result["id"],
        "summary": result.get("summary", ""),
        "htmlLink": result.get("htmlLink", ""),
    }, indent=2))



def calendar_delete(args):
    service = build_service("calendar", "v3")
    service.events().delete(calendarId=args.calendar, eventId=args.event_id).execute()
    print(json.dumps({"status": "deleted", "eventId": args.event_id}))


# =========================================================================
# Drive
# =========================================================================


def drive_search(args):
    query = args.query if args.raw_query else f"fullText contains '{args.query}'"
    service = build_service("drive", "v3")
    results = service.files().list(
        q=query, pageSize=args.max, fields="files(id, name, mimeType, modifiedTime, webViewLink)",
    ).execute()
    files = results.get("files", [])
    print(json.dumps(files, indent=2, ensure_ascii=False))



def drive_get(args):
    service = build_service("drive", "v3")
    file = service.files().get(
        fileId=args.file_id,
        fields="id, name, mimeType, modifiedTime, size, webViewLink, parents, owners",
    ).execute()
    print(json.dumps(file, indent=2, ensure_ascii=False))



def drive_upload(args):
    file_path = args.file_path
    file_name = args.name or os.path.basename(file_path)
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"

    from googleapiclient.http import MediaFileUpload

    metadata = {"name": file_name}
    if args.parent:
        metadata["parents"] = [args.parent]

    service = build_service("drive", "v3")
    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
    file = service.files().create(
        body=metadata, media_body=media,
        fields="id, name, mimeType, webViewLink",
    ).execute()
    print(json.dumps({
        "status": "uploaded",
        "id": file["id"],
        "name": file["name"],
        "mimeType": file["mimeType"],
        "webViewLink": file.get("webViewLink", ""),
    }, indent=2))



# Google-native MIME types are not directly downloadable; the API exports them.
# Default export is the most useful format for the type. Pass --export-mime to override.
GOOGLE_NATIVE_MIMES = {
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
}

DEFAULT_EXPORT_MIMES = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "image/png",
}


def drive_download(args):
    from googleapiclient.http import MediaIoBaseDownload

    service = build_service("drive", "v3")
    file_meta = service.files().get(
        fileId=args.file_id, fields="id, name, mimeType",
    ).execute()
    file_name = file_meta.get("name", "download")
    mime_type = file_meta.get("mimeType", "")

    output_path = args.output or os.path.basename(file_name)

    if mime_type in GOOGLE_NATIVE_MIMES:
        export_mime = args.export_mime or DEFAULT_EXPORT_MIMES.get(mime_type, "application/pdf")
        request = service.files().export_media(fileId=args.file_id, mimeType=export_mime)
    else:
        request = service.files().get_media(fileId=args.file_id)

    with open(output_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

    print(json.dumps({
        "status": "downloaded",
        "id": file_meta["id"],
        "name": file_name,
        "path": os.path.abspath(output_path),
        "mimeType": mime_type,
    }, indent=2))



def drive_create_folder(args):
    service = build_service("drive", "v3")
    metadata = {
        "name": args.name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if args.parent:
        metadata["parents"] = [args.parent]

    file = service.files().create(body=metadata, fields="id, name, webViewLink").execute()
    print(json.dumps({
        "status": "created",
        "id": file["id"],
        "name": file["name"],
        "webViewLink": file.get("webViewLink", ""),
    }, indent=2))



def drive_share(args):
    service = build_service("drive", "v3")

    if args.type == "anyone":
        permission = {"type": "anyone", "role": args.role}
    elif args.type == "domain":
        if not args.domain:
            print("--domain is required when --type domain", file=sys.stderr)
            sys.exit(2)
        permission = {"type": "domain", "role": args.role, "domain": args.domain}
    else:
        if not args.email:
            print("--email is required when --type user", file=sys.stderr)
            sys.exit(2)
        permission = {"type": "user", "role": args.role, "emailAddress": args.email}

    result = service.permissions().create(
        fileId=args.file_id, body=permission, sendNotificationEmail=args.notify,
    ).execute()
    print(json.dumps({
        "status": "shared",
        "permissionId": result.get("id", ""),
        "fileId": args.file_id,
        "role": args.role,
        "type": args.type,
    }, indent=2))



def drive_delete(args):
    service = build_service("drive", "v3")
    if args.permanent:
        service.files().delete(fileId=args.file_id).execute()
        status = "deleted"
    else:
        service.files().update(fileId=args.file_id, body={"trashed": True}).execute()
        status = "trashed"

    print(json.dumps({
        "status": status,
        "fileId": args.file_id,
        "permanent": args.permanent,
    }, indent=2))


# =========================================================================
# Contacts
# =========================================================================


def contacts_list(args):
    service = build_service("people", "v1")
    results = service.people().connections().list(
        resourceName="people/me",
        pageSize=args.max,
        personFields="names,emailAddresses,phoneNumbers",
    ).execute()
    contacts = []
    for person in results.get("connections", []):
        names = person.get("names", [{}])
        emails = person.get("emailAddresses", [])
        phones = person.get("phoneNumbers", [])
        contacts.append({
            "name": names[0].get("displayName", "") if names else "",
            "emails": [e.get("value", "") for e in emails],
            "phones": [p.get("value", "") for p in phones],
        })
    print(json.dumps(contacts, indent=2, ensure_ascii=False))


# =========================================================================
# Sheets
# =========================================================================


def sheets_get(args):
    service = build_service("sheets", "v4")
    result = service.spreadsheets().values().get(
        spreadsheetId=args.sheet_id, range=args.range,
    ).execute()
    print(json.dumps(result.get("values", []), indent=2, ensure_ascii=False))



def sheets_update(args):
    values = json.loads(args.values)
    body = {"values": values}

    service = build_service("sheets", "v4")
    result = service.spreadsheets().values().update(
        spreadsheetId=args.sheet_id, range=args.range,
        valueInputOption="USER_ENTERED", body=body,
    ).execute()
    print(json.dumps({"updatedCells": result.get("updatedCells", 0), "updatedRange": result.get("updatedRange", "")}, indent=2))



def sheets_append(args):
    values = json.loads(args.values)
    body = {"values": values}

    service = build_service("sheets", "v4")
    result = service.spreadsheets().values().append(
        spreadsheetId=args.sheet_id, range=args.range,
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS", body=body,
    ).execute()
    print(json.dumps({"updatedCells": result.get("updates", {}).get("updatedCells", 0)}, indent=2))



def sheets_create(args):
    service = build_service("sheets", "v4")
    body = {"properties": {"title": args.title}}
    if args.sheet_name:
        body["sheets"] = [{"properties": {"title": args.sheet_name}}]

    result = service.spreadsheets().create(
        body=body, fields="spreadsheetId, properties, spreadsheetUrl",
    ).execute()
    print(json.dumps({
        "status": "created",
        "spreadsheetId": result["spreadsheetId"],
        "title": result.get("properties", {}).get("title", ""),
        "spreadsheetUrl": result.get("spreadsheetUrl", ""),
    }, indent=2))


# =========================================================================
# Docs
# =========================================================================


def docs_get(args):
    service = build_service("docs", "v1")
    doc = service.documents().get(documentId=args.doc_id).execute()
    result = {
        "title": doc.get("title", ""),
        "documentId": doc.get("documentId", ""),
        "body": _extract_doc_text(doc),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))



def docs_create(args):
    service = build_service("docs", "v1")
    result = service.documents().create(body={"title": args.title}).execute()
    doc_id = result["documentId"]

    if args.body:
        requests = [{"insertText": {"location": {"index": 1}, "text": args.body}}]
        service.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute()

    print(json.dumps({
        "status": "created",
        "documentId": doc_id,
        "title": result.get("title", args.title),
        "url": f"https://docs.google.com/document/d/{doc_id}/edit",
    }, indent=2))



def docs_append(args):
    service = build_service("docs", "v1")
    doc = service.documents().get(documentId=args.doc_id).execute()

    body_content = doc.get("body", {}).get("content", [])
    end_index = 1
    if body_content:
        end_index = max(1, body_content[-1].get("endIndex", 1) - 1)

    text = args.text
    if not text.endswith("\n"):
        text = text + "\n"

    requests = [{"insertText": {"location": {"index": end_index}, "text": text}}]
    service.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()

    print(json.dumps({
        "status": "appended",
        "documentId": args.doc_id,
        "inserted_at": end_index,
        "characters": len(text),
    }, indent=2))


# =========================================================================
# CLI parser
# =========================================================================


def main():
    parser = argparse.ArgumentParser(description="Google Workspace API for Hermes Agent")
    sub = parser.add_subparsers(dest="service", required=True)

    # --- Gmail ---
    gmail = sub.add_parser("gmail")
    gmail_sub = gmail.add_subparsers(dest="action", required=True)

    p = gmail_sub.add_parser("search")
    p.add_argument("query", help="Gmail search query (e.g. 'is:unread')")
    p.add_argument("--max", type=int, default=10)
    p.set_defaults(func=gmail_search)

    p = gmail_sub.add_parser("get")
    p.add_argument("message_id")
    p.set_defaults(func=gmail_get)

    p = gmail_sub.add_parser("send")
    p.add_argument("--to", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--body", required=True)
    p.add_argument("--cc", default="")
    p.add_argument("--from", dest="from_header", default="", help="Custom From header (e.g. '\"Agent Name\" <user@example.com>')")
    p.add_argument("--html", action="store_true", help="Send body as HTML")
    p.add_argument("--thread-id", default="", help="Thread ID for threading")
    p.set_defaults(func=gmail_send)

    p = gmail_sub.add_parser("reply")
    p.add_argument("message_id", help="Message ID to reply to")
    p.add_argument("--body", required=True)
    p.add_argument("--from", dest="from_header", default="", help="Custom From header (e.g. '\"Agent Name\" <user@example.com>')")
    p.set_defaults(func=gmail_reply)

    p = gmail_sub.add_parser("labels")
    p.set_defaults(func=gmail_labels)

    p = gmail_sub.add_parser("modify")
    p.add_argument("message_id")
    p.add_argument("--add-labels", default="", help="Comma-separated label IDs to add")
    p.add_argument("--remove-labels", default="", help="Comma-separated label IDs to remove")
    p.set_defaults(func=gmail_modify)

    # --- Calendar ---
    cal = sub.add_parser("calendar")
    cal_sub = cal.add_subparsers(dest="action", required=True)

    p = cal_sub.add_parser("list")
    p.add_argument("--start", default="", help="Start time (ISO 8601)")
    p.add_argument("--end", default="", help="End time (ISO 8601)")
    p.add_argument("--max", type=int, default=25)
    p.add_argument("--calendar", default="primary")
    p.set_defaults(func=calendar_list)

    p = cal_sub.add_parser("create")
    p.add_argument("--summary", required=True)
    p.add_argument("--start", required=True, help="Start (ISO 8601 with timezone)")
    p.add_argument("--end", required=True, help="End (ISO 8601 with timezone)")
    p.add_argument("--location", default="")
    p.add_argument("--description", default="")
    p.add_argument("--attendees", default="", help="Comma-separated email addresses")
    p.add_argument("--calendar", default="primary")
    p.set_defaults(func=calendar_create)

    p = cal_sub.add_parser("delete")
    p.add_argument("event_id")
    p.add_argument("--calendar", default="primary")
    p.set_defaults(func=calendar_delete)

    # --- Drive ---
    drv = sub.add_parser("drive")
    drv_sub = drv.add_subparsers(dest="action", required=True)

    p = drv_sub.add_parser("search")
    p.add_argument("query")
    p.add_argument("--max", type=int, default=10)
    p.add_argument("--raw-query", action="store_true", help="Use query as raw Drive API query")
    p.set_defaults(func=drive_search)

    p = drv_sub.add_parser("get")
    p.add_argument("file_id")
    p.set_defaults(func=drive_get)

    p = drv_sub.add_parser("upload")
    p.add_argument("file_path", help="Local file to upload")
    p.add_argument("--name", default="", help="Drive file name (default: basename of file_path)")
    p.add_argument("--parent", default="", help="Parent folder ID")
    p.set_defaults(func=drive_upload)

    p = drv_sub.add_parser("download")
    p.add_argument("file_id")
    p.add_argument("--output", default="", help="Local output path (default: file's name in cwd)")
    p.add_argument("--export-mime", default="", help="Override export MIME for Google-native files (e.g. text/plain)")
    p.set_defaults(func=drive_download)

    p = drv_sub.add_parser("create-folder")
    p.add_argument("name")
    p.add_argument("--parent", default="", help="Parent folder ID")
    p.set_defaults(func=drive_create_folder)

    p = drv_sub.add_parser("share")
    p.add_argument("file_id")
    p.add_argument("--email", default="", help="User email (for --type user)")
    p.add_argument("--type", dest="type", default="user", choices=["user", "anyone", "domain"])
    p.add_argument("--domain", default="", help="Domain (for --type domain)")
    p.add_argument("--role", required=True, choices=["reader", "writer", "commenter", "owner"])
    p.add_argument("--notify", action="store_true", help="Send notification email to the grantee")
    p.set_defaults(func=drive_share)

    p = drv_sub.add_parser("delete")
    p.add_argument("file_id")
    p.add_argument("--permanent", action="store_true", help="Skip trash (irreversible)")
    p.set_defaults(func=drive_delete)

    # --- Contacts ---
    con = sub.add_parser("contacts")
    con_sub = con.add_subparsers(dest="action", required=True)

    p = con_sub.add_parser("list")
    p.add_argument("--max", type=int, default=50)
    p.set_defaults(func=contacts_list)

    # --- Sheets ---
    sh = sub.add_parser("sheets")
    sh_sub = sh.add_subparsers(dest="action", required=True)

    p = sh_sub.add_parser("get")
    p.add_argument("sheet_id")
    p.add_argument("range")
    p.set_defaults(func=sheets_get)

    p = sh_sub.add_parser("create")
    p.add_argument("--title", required=True)
    p.add_argument("--sheet-name", default="", help="Name of the first sheet (default: Sheet1)")
    p.set_defaults(func=sheets_create)

    p = sh_sub.add_parser("update")
    p.add_argument("sheet_id")
    p.add_argument("range")
    p.add_argument("--values", required=True, help="JSON array of arrays")
    p.set_defaults(func=sheets_update)

    p = sh_sub.add_parser("append")
    p.add_argument("sheet_id")
    p.add_argument("range")
    p.add_argument("--values", required=True, help="JSON array of arrays")
    p.set_defaults(func=sheets_append)

    # --- Docs ---
    docs = sub.add_parser("docs")
    docs_sub = docs.add_subparsers(dest="action", required=True)

    p = docs_sub.add_parser("get")
    p.add_argument("doc_id")
    p.set_defaults(func=docs_get)

    p = docs_sub.add_parser("create")
    p.add_argument("--title", required=True)
    p.add_argument("--body", default="", help="Initial body text")
    p.set_defaults(func=docs_create)

    p = docs_sub.add_parser("append")
    p.add_argument("doc_id")
    p.add_argument("--text", required=True)
    p.set_defaults(func=docs_append)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
