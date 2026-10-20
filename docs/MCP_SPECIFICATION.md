# Model Context Protocol (MCP) Tool Specification

This document details the exact JSON-RPC 2.0 tool schemas exposed by the **CMI Governed MCP Server** according to the Model Context Protocol specification (`2024-11-05`).

---

## 1. Tool: `search_creators`

### Description
Search and filter creators across platforms (Instagram, YouTube, TikTok) based on niche, follower bounds, engagement rate, platform, and maximum rate.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "niche": { "type": "string", "description": "e.g. 'Tech & Gadgets', 'Beauty & Skincare'" },
    "min_followers": { "type": "number", "description": "Minimum follower count" },
    "max_followers": { "type": "number", "description": "Maximum follower count" },
    "min_engagement": { "type": "number", "description": "Minimum engagement percentage (e.g. 3.5)" },
    "max_rate": { "type": "number", "description": "Maximum video rate in USD" },
    "platform": { "type": "string", "description": "'youtube', 'instagram', or 'tiktok'" }
  }
}
```

### Sample Response
```json
{
  "count": 1,
  "creators": [
    {
      "id": "cr_marcus",
      "name": "Marcus Vance",
      "handle": "marcus_tech",
      "primary_niche": "Tech & Gadgets",
      "platforms": ["youtube", "instagram"],
      "follower_count": 420000,
      "engagement_rate": "4.8%",
      "rate_video": 1800,
      "verified": true,
      "rating": 4.9
    }
  ]
}
```

---

## 2. Tool: `draft_campaign_brief`

### Description
Generate, store, or refine a structured creative campaign brief with target audience guidelines, deliverables, and budget parameters.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "campaign_id": { "type": "string" },
    "title": { "type": "string" },
    "brief": { "type": "string" },
    "objectives": { "type": "string" },
    "target_audience": { "type": "string" },
    "content_guidelines": { "type": "string" },
    "required_deliverables": { "type": "array", "items": { "type": "string" } },
    "budget": { "type": "number" }
  },
  "required": ["campaign_id", "brief"]
}
```

---

## 3. Tool: `send_collaboration_offer`

### Description
Propose a collaboration rate and deliverable agreement to a creator. Verifies agent budget ceiling and per-collaboration rate limits. Locks funds in escrow.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "campaign_id": { "type": "string" },
    "creator_id": { "type": "string" },
    "proposed_rate": { "type": "number" },
    "deliverables": { "type": "array", "items": { "type": "string" } },
    "deadline": { "type": "string" },
    "terms": { "type": "string" }
  },
  "required": ["campaign_id", "creator_id", "proposed_rate", "deliverables", "deadline"]
}
```

---

## 4. Tool: `track_deliverable`

### Description
Verify whether agreed creator content has been published and meets campaign brief requirements. Inspects live URL and updates deliverable status.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "collaboration_id": { "type": "string" },
    "deliverable_id": { "type": "string" },
    "content_url": { "type": "string" },
    "verification_metrics": { "type": "object" }
  },
  "required": ["collaboration_id", "deliverable_id", "content_url"]
}
```

---

## 5. Tool: `release_payment`

### Description
Release escrowed payment to a creator following approved deliverable completion. Subject to human-approval checkpoint if amount exceeds $1,000 threshold.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "collaboration_id": { "type": "string" },
    "deliverable_id": { "type": "string" },
    "amount": { "type": "number" },
    "note": { "type": "string" }
  },
  "required": ["collaboration_id", "deliverable_id", "amount"]
}
```

### High-Value Interception Response (Amount > $1,000)
```json
{
  "status": "HELD_FOR_APPROVAL",
  "result": {
    "checkpoint_id": "chk_f5927c39",
    "message": "Payment of $1800 exceeds autonomous threshold of $1000. Intercepted for human approval checkpoint #chk_f5927c39.",
    "status": "PENDING_HUMAN_APPROVAL"
  },
  "guardrail_notes": "Human Checkpoint Triggered: PAYMENT_ABOVE_THRESHOLD ($1800 > $1000)."
}
```
