# Product demo recorder

Records a narrated, captioned product tour of the running app and stitches it into `cmi-demo.mp4` (1600×900, H.264 + AAC, ~3 minutes).

Requirements (macOS): the app running (`npm run dev`), Google Chrome, and in this folder:

```bash
cd scripts/demo
npm init -y >/dev/null && npm install playwright ffmpeg-static
CMI_SIM_PACE_MS=1400 npm --prefix ../../server run dev   # slower planner so the live run is visible on camera
node record-demo.mjs            # all scenes → demo-out/cmi-demo.mp4
node record-demo.mjs 05,09      # re-record selected scenes and re-stitch
VOICE=Daniel RATE=170 node record-demo.mjs   # change the macOS `say` narrator
```

Scenes: intro card · login & overview · creator discovery (India filter, media kit) · launching an agent · live run console · approval queue · audit trail & ledger · MCP server · creator portal (compliance preview) · outro card.
