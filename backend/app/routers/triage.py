import os
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/triage", tags=["triage"])


class TriageRequest(BaseModel):
    type: str   # "alert" | "incident"
    id: str


@router.post("")
async def triage_summary(req: TriageRequest, ds: DataSource = Depends(get_data_source)):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=503, detail="anthropic package not installed")

    if req.type == "alert":
        item = await ds.get_alert(req.id)
    elif req.type == "incident":
        item = await ds.get_incident(req.id)
    else:
        raise HTTPException(status_code=400, detail="type must be 'alert' or 'incident'")

    if not item:
        raise HTTPException(status_code=404, detail=f"{req.type} not found")

    prompt = f"""You are a SOC analyst. Summarize this Microsoft Defender security {req.type} in exactly 3 short bullet points:
1. What happened (one sentence)
2. What is affected / at risk (one sentence)
3. Recommended immediate action (one sentence)

Be concise and actionable. Use plain text, no markdown formatting inside bullets.

{req.type.upper()} DATA:
{json.dumps(item, indent=2)}"""

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    return {"summary": message.content[0].text}
