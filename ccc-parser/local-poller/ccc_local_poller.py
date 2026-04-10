#!/usr/bin/env python3
"""
CC CCC Parser — Local Job Poller
=================================
Runs on mc-prod (M4 Mini). Polls Convex for ccc.parsePdf jobs,
downloads the PDF from GDrive, runs extraction locally (pdfplumber
first, then MLX fallback), and pushes results back to Convex.

This avoids the networking problem entirely — no tunnel needed.
Everything runs on the same machine that hosts CC's OpenClaw agent.

Usage:
  pip install requests pdfplumber google-auth google-api-python-client
  export CONVEX_URL="https://agreeable-goose-357.convex.cloud"
  export CONVEX_DEPLOY_KEY="prod:xxx"
  export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
  python ccc_local_poller.py

Or as launchd daemon:
  cp com.claimscoach.ccc-poller.plist ~/Library/LaunchAgents/
  launchctl load ~/Library/LaunchAgents/com.claimscoach.ccc-poller.plist
"""

import os
import sys
import json
import time
import base64
import io
import logging
import traceback
from typing import Optional

import requests

# Optional — pdfplumber for local Stage 1
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("⚠️ pdfplumber not installed — will skip Stage 1 regex extraction")

logger = logging.getLogger("ccc-poller")

# ============================================================
# CONFIG
# ============================================================
CONVEX_URL = os.environ.get("CONVEX_URL", "https://agreeable-goose-357.convex.cloud")
CONVEX_DEPLOY_KEY = os.environ.get("CONVEX_DEPLOY_KEY", "")
MLX_ENDPOINT = os.environ.get("MLX_ENDPOINT", "http://localhost:8090/v1/chat/completions")
MLX_MODEL = os.environ.get("MLX_MODEL", "mlx-community/Qwen2.5-7B-Instruct-4bit")
CLOUD_FUNCTION_URL = os.environ.get("CCC_PARSER_URL", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))

# ============================================================
# CONVEX CLIENT
# ============================================================

class ConvexClient:
    def __init__(self, url: str, deploy_key: str):
        self.url = url.rstrip("/")
        self.deploy_key = deploy_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Convex {deploy_key}",
            "Content-Type": "application/json",
        })

    def query(self, path: str, args: dict = None):
        """Run a Convex query function."""
        res = self.session.post(
            f"{self.url}/api/query",
            json={"path": path, "args": args or {}},
        )
        res.raise_for_status()
        data = res.json()
        if data.get("status") == "error":
            raise Exception(f"Convex query error: {data.get('errorMessage')}")
        return data.get("value")

    def mutation(self, path: str, args: dict = None):
        """Run a Convex mutation function."""
        res = self.session.post(
            f"{self.url}/api/mutation",
            json={"path": path, "args": args or {}},
        )
        res.raise_for_status()
        data = res.json()
        if data.get("status") == "error":
            raise Exception(f"Convex mutation error: {data.get('errorMessage')}")
        return data.get("value")


# ============================================================
# GOOGLE DRIVE
# ============================================================

def get_gdrive_service():
    """Build authenticated GDrive service."""
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON not set")

    creds = service_account.Credentials.from_service_account_info(
        json.loads(sa_json),
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    return build("drive", "v3", credentials=creds)


def download_pdf_from_gdrive(file_id: str) -> bytes:
    """Download a PDF file from Google Drive."""
    from googleapiclient.http import MediaIoBaseDownload

    service = get_gdrive_service()
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)
    return buffer.read()


def find_ccc_pdf_in_folder(folder_url: str) -> Optional[str]:
    """
    Search for a CCC-looking PDF in a prospect's GDrive folder.
    Returns the file ID if found.
    """
    # Extract folder ID from URL
    # https://drive.google.com/drive/folders/FOLDER_ID
    folder_id = folder_url.rstrip("/").split("/")[-1]

    service = get_gdrive_service()
    results = service.files().list(
        q=f"'{folder_id}' in parents and mimeType='application/pdf'",
        fields="files(id, name)",
        pageSize=20,
    ).execute()

    files = results.get("files", [])

    # Look for CCC-related filename
    ccc_keywords = ["ccc", "valuation", "total loss", "one", "actual cash"]
    for f in files:
        name_lower = f["name"].lower()
        if any(kw in name_lower for kw in ccc_keywords):
            return f["id"]

    # If only one PDF, assume it's the CCC
    if len(files) == 1:
        return files[0]["id"]

    # Multiple PDFs, none obviously CCC — return None
    return None


# ============================================================
# LOCAL EXTRACTION
# ============================================================

# Import the regex patterns from the Cloud Function
# (duplicated here for standalone operation)

import re

VIN_PATTERN = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")
DOLLAR_PATTERN = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")
MILEAGE_PATTERN = re.compile(r"(?:odometer|mileage|miles?)[\s:]*?([\d,]+)", re.IGNORECASE)
YMM_PATTERN = re.compile(r"(20\d{2}|19\d{2})\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+([A-Z][A-Za-z0-9\- ]+)", re.IGNORECASE)

ACV_PATTERNS = [
    re.compile(r"(?:actual\s*cash\s*value|acv|total\s*value|adjusted\s*value)[\s:]*\$\s?([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
    re.compile(r"(?:total|net)\s*(?:value|acv)[\s:]*\$\s?([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
    re.compile(r"(?:insurer|carrier|ccc)\s*(?:offer|opinion|value)[\s:]*\$\s?([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
]


def parse_dollar(s: str) -> Optional[float]:
    if not s:
        return None
    try:
        return float(s.replace(",", "").replace("$", "").strip())
    except ValueError:
        return None


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text using pdfplumber."""
    if not HAS_PDFPLUMBER:
        return ""

    parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
            for table in page.extract_tables():
                for row in table:
                    if row:
                        parts.append(" | ".join(str(c or "") for c in row))
    return "\n".join(parts)


def regex_extract(full_text: str) -> dict:
    """Stage 1: Regex-based extraction from raw text."""
    result = {
        "success": False,
        "method": "pdfplumber_regex_local",
        "error": None,
        "vehicle": {"year": None, "make": None, "model": None, "trim": None,
                     "vin": None, "mileage": None, "condition": None, "color": None},
        "valuation": {"baseValue": None, "adjustments": [], "projectedSoldAdjustment": None,
                       "totalAcv": None, "effectiveDate": None, "marketArea": None},
        "comparables": [],
        "conditionNotes": [],
        "rawText": full_text[:8000],
    }

    if not full_text or len(full_text.strip()) < 50:
        result["error"] = "PDF text too short or empty"
        return result

    # VIN
    vin_m = VIN_PATTERN.search(full_text)
    if vin_m:
        result["vehicle"]["vin"] = vin_m.group(1)

    # YMM
    ymm_m = YMM_PATTERN.search(full_text)
    if ymm_m:
        result["vehicle"]["year"] = ymm_m.group(1)
        result["vehicle"]["make"] = ymm_m.group(2).strip()
        result["vehicle"]["model"] = ymm_m.group(3).strip()

    # Mileage
    mil_m = MILEAGE_PATTERN.search(full_text)
    if mil_m:
        result["vehicle"]["mileage"] = int(mil_m.group(1).replace(",", ""))

    # ACV
    for pat in ACV_PATTERNS:
        m = pat.search(full_text)
        if m:
            result["valuation"]["totalAcv"] = parse_dollar(m.group(1))
            break

    has_acv = result["valuation"]["totalAcv"] is not None
    has_vehicle = result["vehicle"]["vin"] is not None or result["vehicle"]["year"] is not None
    result["success"] = has_acv and has_vehicle

    if not result["success"]:
        missing = []
        if not has_acv: missing.append("totalAcv")
        if not has_vehicle: missing.append("vehicle info")
        result["error"] = f"Partial extraction — missing: {', '.join(missing)}"

    return result


LLM_SYSTEM_PROMPT = """You are a CCC One valuation PDF data extractor. Extract into JSON with this structure. If a field cannot be found, use null. Never fabricate values. Return ONLY valid JSON, no markdown fences.

{
  "vehicle": {"year": null, "make": null, "model": null, "trim": null, "vin": null, "mileage": null, "condition": null, "color": null},
  "valuation": {"baseValue": null, "adjustments": [{"label": "string", "amount": 0}], "projectedSoldAdjustment": null, "totalAcv": null, "effectiveDate": null, "marketArea": null},
  "comparables": [{"compNumber": 1, "vin": null, "year": null, "make": null, "model": null, "trim": null, "mileage": null, "askingPrice": null, "adjustedValue": null, "location": null}],
  "conditionNotes": []
}"""


def llm_extract(raw_text: str) -> Optional[dict]:
    """Stage 2: LLM-based extraction via local MLX endpoint."""
    try:
        truncated = raw_text[:6000]
        res = requests.post(
            MLX_ENDPOINT,
            json={
                "model": MLX_MODEL,
                "messages": [
                    {"role": "system", "content": LLM_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Extract all data from this CCC One valuation PDF:\n\n{truncated}"},
                ],
                "temperature": 0.0,
                "max_tokens": 2000,
            },
            timeout=60,
        )
        if not res.ok:
            logger.error(f"MLX returned {res.status_code}")
            return None

        content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "")

        # Parse JSON
        cleaned = content.replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            return None

        parsed = json.loads(cleaned[start:end + 1])

        return {
            "success": parsed.get("valuation", {}).get("totalAcv") is not None,
            "method": "mlx_llm_local",
            "error": None if parsed.get("valuation", {}).get("totalAcv") is not None else "LLM extraction incomplete",
            "vehicle": parsed.get("vehicle", {}),
            "valuation": parsed.get("valuation", {}),
            "comparables": parsed.get("comparables", []),
            "conditionNotes": parsed.get("conditionNotes", []),
            "rawText": truncated,
        }
    except Exception as e:
        logger.error(f"LLM extraction error: {e}")
        return None


def merge_results(primary: dict, fallback: dict) -> dict:
    """Merge partial results — primary values win."""
    merged = json.loads(json.dumps(primary))

    for key in merged.get("vehicle", {}):
        if merged["vehicle"].get(key) is None and fallback.get("vehicle", {}).get(key) is not None:
            merged["vehicle"][key] = fallback["vehicle"][key]

    for key in ["baseValue", "totalAcv", "projectedSoldAdjustment", "effectiveDate", "marketArea"]:
        if merged.get("valuation", {}).get(key) is None and fallback.get("valuation", {}).get(key) is not None:
            merged["valuation"][key] = fallback["valuation"][key]

    if not merged.get("valuation", {}).get("adjustments") and fallback.get("valuation", {}).get("adjustments"):
        merged["valuation"]["adjustments"] = fallback["valuation"]["adjustments"]

    if len(merged.get("comparables", [])) < len(fallback.get("comparables", [])):
        merged["comparables"] = fallback["comparables"]

    notes = set(merged.get("conditionNotes", []) + fallback.get("conditionNotes", []))
    merged["conditionNotes"] = list(notes)

    merged["success"] = merged.get("valuation", {}).get("totalAcv") is not None
    merged["method"] = f"{primary.get('method')}+{fallback.get('method')}"

    return merged


# ============================================================
# MAIN POLLING LOOP
# ============================================================

def process_ccc_job(convex: ConvexClient, job: dict):
    """Process a single ccc.parsePdf job."""
    job_id = job["_id"]
    parent_id = job["parentId"]
    payload = json.loads(job["payloadJson"])

    logger.info(f"Processing CCC parse job for {parent_id}")

    # ---- Get prospect record ----
    prospect = convex.query("functions/prospects:getByProspectId", {"prospectId": parent_id})
    if not prospect:
        convex.mutation("functions/jobDispatcher:failJobMutation", {
            "jobId": job_id,
            "error": f"Prospect not found: {parent_id}",
        })
        return

    # ---- Find and download PDF ----
    pdf_bytes = None
    gdrive_file_id = payload.get("gdriveFileId")

    if not gdrive_file_id:
        # Try to find CCC PDF in prospect's GDrive folder
        # Check if integration has synced
        int_status = prospect.get("integrationStatus", {})
        if int_status.get("gdrive") != "SYNCED":
            logger.info(f"GDrive not synced yet for {parent_id}, will retry")
            convex.mutation("functions/jobDispatcher:failJobMutation", {
                "jobId": job_id,
                "error": "GDrive folder not synced yet. Will retry.",
            })
            return

        # Search for PDF in the prospect folder
        # This requires the folder URL — which should be on the prospect record
        # For now, use a convention-based search
        logger.warning(f"No gdriveFileId in payload for {parent_id}")
        convex.mutation("functions/jobDispatcher:failJobMutation", {
            "jobId": job_id,
            "error": "No gdriveFileId provided. Upload CCC PDF and retry.",
        })
        return

    try:
        pdf_bytes = download_pdf_from_gdrive(gdrive_file_id)
        logger.info(f"Downloaded PDF: {len(pdf_bytes)} bytes")
    except Exception as e:
        convex.mutation("functions/jobDispatcher:failJobMutation", {
            "jobId": job_id,
            "error": f"Failed to download PDF from GDrive: {e}",
        })
        return

    # ---- Stage 1: pdfplumber regex ----
    result = None
    raw_text = ""

    if HAS_PDFPLUMBER:
        try:
            raw_text = extract_text_from_pdf(pdf_bytes)
            result = regex_extract(raw_text)
            logger.info(f"Stage 1 result: success={result['success']}, method={result['method']}")
        except Exception as e:
            logger.error(f"Stage 1 error: {e}")

    # Also try Cloud Function if available
    if not result or not result.get("success"):
        if CLOUD_FUNCTION_URL:
            try:
                b64 = base64.b64encode(pdf_bytes).decode()
                cf_res = requests.post(
                    CLOUD_FUNCTION_URL,
                    json={"base64Pdf": b64},
                    timeout=30,
                )
                if cf_res.ok:
                    cf_result = cf_res.json()
                    if cf_result.get("success"):
                        result = cf_result
                        raw_text = cf_result.get("rawText", raw_text)
                        logger.info("Cloud Function succeeded")
                    elif result:
                        result = merge_results(result, cf_result)
                    else:
                        result = cf_result
                        raw_text = cf_result.get("rawText", "")
            except Exception as e:
                logger.error(f"Cloud Function error: {e}")

    # ---- Stage 2: MLX LLM fallback ----
    if not result or not result.get("success"):
        if not raw_text:
            # No text from pdfplumber — try basic extraction for LLM
            raw_text = "[Binary PDF — pdfplumber unavailable]"

        llm_result = llm_extract(raw_text)

        if llm_result:
            if result:
                result = merge_results(result, llm_result)
            else:
                result = llm_result
            logger.info(f"Stage 2 result: success={result['success']}, method={result['method']}")

    # ---- No result at all ----
    if not result:
        result = {
            "success": False,
            "method": "none",
            "error": "All extraction methods failed. Manual extraction required.",
            "vehicle": {}, "valuation": {}, "comparables": [], "conditionNotes": [],
            "rawText": raw_text[:5000] if raw_text else None,
        }

    # ---- Save to Convex ----
    try:
        convex.mutation("functions/cccParser:saveCccExtraction", {
            "prospectId": parent_id,
            "extraction": json.dumps(result),
        })
        logger.info(f"Saved extraction to Convex for {parent_id}")
    except Exception as e:
        convex.mutation("functions/jobDispatcher:failJobMutation", {
            "jobId": job_id,
            "error": f"Failed to save extraction: {e}",
        })
        return

    # ---- Complete the job ----
    convex.mutation("functions/jobDispatcher:completeJobMutation", {"jobId": job_id})

    # ---- Telegram notification ----
    try:
        acv = result.get("valuation", {}).get("totalAcv")
        vin = result.get("vehicle", {}).get("vin")
        comps = len(result.get("comparables", []))

        if result["success"]:
            send_telegram(
                f"✅ *CCC PDF PARSED*\n"
                f"Prospect: `{parent_id}`\n"
                f"Method: {result['method']}\n"
                f"Insurer ACV: ${acv:,.0f}\n"
                f"VIN: {vin or 'not found'}\n"
                f"CCC Comps: {comps}"
            )
        else:
            send_telegram(
                f"⚠️ *CCC PDF — PARTIAL EXTRACTION*\n"
                f"Prospect: `{parent_id}`\n"
                f"Method: {result.get('method', 'none')}\n"
                f"Error: {result.get('error', 'unknown')}\n"
                f"Manual review needed."
            )
    except Exception as e:
        logger.error(f"Telegram notification failed: {e}")

    logger.info(f"✅ Job complete for {parent_id}: success={result['success']}")


def send_telegram(text: str):
    """Send a Telegram message to Johnny."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning("Telegram not configured, skipping notification")
        return

    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
        timeout=10,
    )


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if not CONVEX_DEPLOY_KEY:
        logger.error("CONVEX_DEPLOY_KEY not set")
        sys.exit(1)

    convex = ConvexClient(CONVEX_URL, CONVEX_DEPLOY_KEY)
    logger.info(f"CCC Local Poller started — polling every {POLL_INTERVAL}s")
    logger.info(f"Convex: {CONVEX_URL}")
    logger.info(f"MLX: {MLX_ENDPOINT}")
    logger.info(f"pdfplumber: {'available' if HAS_PDFPLUMBER else 'NOT installed'}")

    while True:
        try:
            # Claim a ccc.parsePdf job
            job = convex.mutation("functions/jobDispatcher:claimJob", {
                "jobType": "ccc.parsePdf",
            })

            if job:
                try:
                    process_ccc_job(convex, job)
                except Exception as e:
                    logger.error(f"Job processing error: {e}")
                    logger.error(traceback.format_exc())
                    try:
                        convex.mutation("functions/jobDispatcher:failJobMutation", {
                            "jobId": job["_id"],
                            "error": str(e),
                        })
                    except Exception:
                        pass
            else:
                # No jobs — sleep
                time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down")
            break
        except Exception as e:
            logger.error(f"Polling error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
