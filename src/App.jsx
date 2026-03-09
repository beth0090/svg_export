import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const C = {
  bg: "#0a0a0f", surface: "#12121a", panel: "#1a1a26", border: "#2a2a3d",
  accent: "#7fffb2", accent2: "#ff7f7f", accent3: "#7fb2ff", accent4: "#ffdd7f",
  text: "#e8e8f0", muted: "#666688",
};

async function callClaude(messages, maxTokens = 2000) {
  const apiKey = localStorage.getItem("pf_gemini_key") || "";

  // Gemini 형식으로 변환
  const parts = [];
  for (const msg of messages) {
    const content = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
    for (const block of content) {
      if (block.type === "text") {
        parts.push({ text: block.text });
      } else if (block.type === "image") {
        parts.push({ inlineData: { mimeType: block.source.media_type, data: block.source.data } });
      }
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function resizeImage(base64, mime) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve({ b64: c.toDataURL("image/jpeg", 0.85).split(",")[1], mime: "image/jpeg" });
    };
    img.onerror = () => resolve({ b64: base64, mime });
    img.src = `data:${mime};base64,${base64}`;
  });
}

const CAT_META = {
  noise:      { label: "노이즈 / 아티팩트", order: 0, badgeColor: C.accent4 },
  artifact:   { label: "노이즈 / 아티팩트", order: 0, badgeColor: C.accent2 },
  watermark:  { label: "워터마크 / 텍스트", order: 1, badgeColor: C.accent3 },
  text:       { label: "워터마크 / 텍스트", order: 1, badgeColor: C.accent3 },
  background: { label: "배경 / 텍스처",    order: 2, badgeColor: C.muted },
  shadow:     { label: "배경 / 텍스처",    order: 2, badgeColor: C.muted },
  texture:    { label: "배경 / 텍스처",    order: 2, badgeColor: C.muted },
  object:     { label: "주요 오브젝트",    order: 3, badgeColor: C.accent },
};
const catLabel = c => (CAT_META[c] || { label: "기타" }).label;
const catOrder = c => (CAT_META[c] || { order: 9 }).order;
const catColor = c => (CAT_META[c] || { badgeColor: C.accent }).badgeColor;
const catTag = c => ({ noise: "NOISE", artifact: "ARTIFACT", text: "TEXT", watermark: "WMRK", background: "BG", shadow: "SHADOW", texture: "TEXTURE", object: "OBJECT" })[c] || c?.toUpperCase();

// ── Before/After 슬라이더
function BeforeAfterSlider({ originalSrc, previewUrl, isGenerating }) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef();
  const dragging = useRef(false);

  const calcPct = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPct(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const onMove = e => { if (dragging.current) calcPct(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [calcPct]);

  return (
    <div ref={containerRef}
      onMouseDown={e => { dragging.current = true; calcPct(e.clientX); e.preventDefault(); }}
      onTouchMove={e => calcPct(e.touches[0].clientX)}
      style={{ position: "relative", width: "100%", height: "100%", userSelect: "none", cursor: "col-resize", overflow: "hidden", borderRadius: 4, border: `1px solid ${C.border}`, background: "#111" }}>

      {/* 원본 — 전체 배경 */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        {originalSrc && <img src={originalSrc} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} alt="원본" />}
      </div>

      {/* 수정본 — 왼쪽 clip */}
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        {isGenerating ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: C.panel }}>
            <div style={{ width: 38, height: 38, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 9, color: C.accent, letterSpacing: 3 }}>미리보기 생성 중...</div>
          </div>
        ) : previewUrl ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <img
              src={previewUrl}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
              alt="수정본"
            />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: C.panel }}>
            <div style={{ fontSize: 28, opacity: 0.25 }}>◈</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 2, textAlign: "center", lineHeight: 1.8 }}>아래 👁 버튼으로<br/>미리보기 생성</div>
          </div>
        )}
      </div>

      {/* 슬라이더 라인 + 핸들 */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, transform: "translateX(-50%)", width: 2, background: C.accent, zIndex: 20, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: C.accent, border: `2px solid #0a0a0f`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0a0a0f", fontWeight: 900, boxShadow: "0 2px 16px rgba(0,0,0,0.6)", pointerEvents: "all", cursor: "col-resize" }}>⇔</div>
      </div>

      {/* 라벨 */}
      <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 9, letterSpacing: 2, padding: "3px 8px", background: "rgba(10,10,15,0.85)", color: C.accent, borderRadius: 2, border: `1px solid ${C.border}`, pointerEvents: "none", zIndex: 10 }}>수정본</div>
      <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 9, letterSpacing: 2, padding: "3px 8px", background: "rgba(10,10,15,0.85)", color: C.muted, borderRadius: 2, border: `1px solid ${C.border}`, pointerEvents: "none", zIndex: 10 }}>원본</div>
    </div>
  );
}

// ════════════════════════════════════════════════
export default function PathForm() {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("pf_gemini_key") || "");
  const [keyInput, setKeyInput] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [stage, setStage] = useState(1);
  const [imageB64, setImageB64] = useState(null);
  const [imageMime, setImageMime] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [elements, setElements] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectErr, setDetectErr] = useState(null);

  // 미리보기
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [previewErr, setPreviewErr] = useState(null);
  const [viewMode, setViewMode] = useState("original"); // "original" | "compare"

  // Stage 3
  const [svg, setSvg] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [logMsg, setLogMsg] = useState("준비 완료");
  const [pathStats, setPathStats] = useState(null);
  const [detail, setDetail] = useState(3);
  const [mode, setMode] = useState("outline");
  const [color, setColor] = useState("mono");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();
  const svgRef = useRef();

  const removed = elements.filter(e => e.remove);
  const removeCount = removed.length;

  const handleFile = useCallback(file => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target.result;
      setImageDataUrl(url); setImageB64(url.split(",")[1]); setImageMime(file.type || "image/jpeg");
      setElements([]); setDetectErr(null); setSvg(null); setPathStats(null);
      setPreviewUrl(null); setPreviewErr(null); setViewMode("original");
      setStage(2);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (stage !== 2 || !imageB64) return;
    runDetect();
  }, [stage, imageB64]);

  async function runDetect() {
    setDetecting(true); setDetectErr(null); setElements([]);
    setPreviewUrl(null); setViewMode("original");
    try {
      const { b64, mime } = await resizeImage(imageB64, imageMime);
      const raw = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: `Analyze this image. List every distinct visual element (aim for 6-12 items).
Respond ONLY with a JSON array, nothing else. No markdown.
Each item: {"id":"snake_case","name":"한국어 이름","desc":"한 문장 설명","category":"background","removeRecommended":false}
category: noise|text|background|object|artifact|shadow|texture|watermark
removeRecommended: true if it's clutter/noise for SVG path tracing.
START with [ END with ]` },
        ],
      }]);
      const m = raw.replace(/```[\w]*/g, "").replace(/```/g, "").match(/\[[\s\S]*\]/);
      if (!m) throw new Error("JSON 배열을 찾을 수 없습니다");
      const parsed = JSON.parse(m[0]);
      setElements(parsed.map((el, i) => ({ id: el.id || `el_${i}`, name: el.name || `요소 ${i + 1}`, desc: el.desc || "", category: el.category || "object", remove: !!el.removeRecommended })));
    } catch (err) { setDetectErr(err.message); }
    finally { setDetecting(false); }
  }

  function toggleEl(id) {
    setElements(prev => prev.map(e => e.id === id ? { ...e, remove: !e.remove } : e));
    setPreviewUrl(null); setPreviewErr(null);
    if (viewMode === "compare") setViewMode("original");
  }

  // ── 미리보기 생성: AI로 bounding box 추출 → 캔버스에서 해당 영역만 inpainting
  async function generatePreview() {
    if (removeCount === 0) return;
    setPreviewGenerating(true); setPreviewErr(null); setViewMode("compare");
    try {
      const { b64, mime } = await resizeImage(imageB64, imageMime);
      const removeList = removed.map(e => `"${e.name}": ${e.desc}`).join("\n");

      // AI에게 각 요소의 bounding box 좌표(0~1 비율)만 요청
      const raw = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: `Locate each element in this image and return its bounding box.

Elements to find:
${removeList}

Return ONLY a JSON array, no explanation, no markdown:
[{"name":"element name","x":0.1,"y":0.05,"w":0.8,"h":0.15}]

x, y = top-left corner as fraction of image (0.0–1.0)
w, h = width and height as fraction of image (0.0–1.0)
Add a small margin (~0.02) around each element.
START with [ END with ]` },
        ],
      }], 1000);

      const m = raw.replace(/```[\w]*/g, "").replace(/```/g, "").match(/\[[\s\S]*\]/);
      if (!m) throw new Error("좌표 데이터를 받지 못했습니다");
      const boxes = JSON.parse(m[0]);

      // 원본 이미지를 캔버스에 그린 뒤 bounding box 영역만 주변색으로 채움
      const result = await inpaintBoxes(imageDataUrl, boxes);
      setPreviewUrl(result);

    } catch (err) { setPreviewErr(err.message); setViewMode("original"); }
    finally { setPreviewGenerating(false); }
  }

  // ── Canvas inpainting: box 영역을 주변 픽셀 평균색으로 채움
  function inpaintBoxes(srcDataUrl, boxes) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.width, H = img.height;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        boxes.forEach(box => {
          const bx = Math.max(0, Math.floor((box.x || 0) * W));
          const by = Math.max(0, Math.floor((box.y || 0) * H));
          const bw = Math.min(W - bx, Math.ceil((box.w || 0) * W));
          const bh = Math.min(H - by, Math.ceil((box.h || 0) * H));
          if (bw <= 0 || bh <= 0) return;

          // 전체 이미지를 덮는 경우 흰 배경
          if (bw >= W * 0.95 && bh >= H * 0.95) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, W, H);
            return;
          }

          // 주변 테두리(sampleW px) 픽셀 평균색 계산
          const sw = Math.max(8, Math.floor(Math.min(bw, bh) * 0.2));
          let rSum = 0, gSum = 0, bSum = 0, count = 0;

          const sampleRegions = [
            { sx: bx,           sy: Math.max(0, by - sw), sw: bw, sh: Math.min(sw, by) },         // 위
            { sx: bx,           sy: Math.min(H-1, by+bh), sw: bw, sh: Math.min(sw, H-by-bh) },    // 아래
            { sx: Math.max(0, bx-sw), sy: by, sw: Math.min(sw, bx), sh: bh },                      // 왼
            { sx: Math.min(W-1, bx+bw), sy: by, sw: Math.min(sw, W-bx-bw), sh: bh },              // 오른
          ];

          sampleRegions.forEach(r => {
            if (r.sw <= 0 || r.sh <= 0) return;
            try {
              const d = ctx.getImageData(r.sx, r.sy, r.sw, r.sh).data;
              for (let i = 0; i < d.length; i += 4) {
                rSum += d[i]; gSum += d[i+1]; bSum += d[i+2]; count++;
              }
            } catch(e) {}
          });

          const avgR = count > 0 ? Math.round(rSum/count) : 240;
          const avgG = count > 0 ? Math.round(gSum/count) : 240;
          const avgB = count > 0 ? Math.round(bSum/count) : 240;

          // 박스 영역을 평균색으로 채움
          ctx.fillStyle = `rgb(${avgR},${avgG},${avgB})`;
          ctx.fillRect(bx, by, bw, bh);

          // feather: 경계를 부드럽게 블렌딩
          const feather = Math.min(10, Math.floor(Math.min(bw, bh) * 0.1));
          for (let f = feather; f > 0; f--) {
            ctx.globalAlpha = (feather - f + 1) / (feather + 1) * 0.5;
            ctx.fillStyle = `rgb(${avgR},${avgG},${avgB})`;
            ctx.fillRect(bx - f, by - f, bw + f*2, bh + f*2);
          }
          ctx.globalAlpha = 1;
        });

        resolve(canvas.toDataURL("image/jpeg", 0.93));
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = srcDataUrl;
    });
  }

  async function runExtraction() {
    if (!imageB64) return;
    setExtracting(true); setSvg(null); setPathStats(null);
    const steps = ["형태 인식 중...", "윤곽 감지 중...", "패스 벡터화 중...", "노드 최적화 중...", "마무리 중..."];
    let si = 0; setLoadingMsg(steps[0]);
    const tick = setInterval(() => { si++; if (si < steps.length) setLoadingMsg(steps[si]); }, 800);
    try {
      const { b64, mime } = await resizeImage(imageB64, imageMime);
      const removeNote = removed.length ? `\n\nDo NOT draw: ${removed.map(e => e.name + ": " + e.desc).join("; ")}` : "";
      const modeDesc = { outline: "outline only, fill=none", filled: "filled colored", centerline: "centerline skeleton" }[mode];
      const raw = await callClaude([{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: `SVG vectorizer. Mode: ${modeDesc}. Color: ${{ mono: "B&W", original: "original colors", simplified: "simplified" }[color]}. Detail: ${["very simple","simple","medium","detailed","very detailed"][detail-1]} (${detail}/5). Min ${detail*3} paths.${removeNote}
Output ONLY raw SVG. viewBox="0 0 500 500" width="500" height="500". <path> in <g id="name">. ${mode==="filled"?"Use fill colors.":'stroke="#333" fill="none"'}` },
        ],
      }], 4000);
      clearInterval(tick);
      const m = raw.replace(/```[\w]*/g, "").replace(/```/g, "").match(/<svg[\s\S]*<\/svg>/i);
      if (!m) throw new Error("유효한 SVG를 받지 못했습니다");
      setSvg(m[0]);
      const tmp = document.createElement("div"); tmp.innerHTML = m[0];
      const pCount = tmp.querySelectorAll("path,circle,rect,ellipse,polygon,polyline").length;
      let nCount = 0; tmp.querySelectorAll("path").forEach(p => { nCount += (p.getAttribute("d") || "").match(/[MLHVCSQTAZ]/gi)?.length || 0; });
      setPathStats({ paths: pCount, nodes: nCount, size: (m[0].length / 1024).toFixed(1) });
      setLogMsg(`SVG 생성 완료 — ${pCount}개 패스, ${nCount}개 노드`);
    } catch (err) { clearInterval(tick); setLogMsg("오류: " + err.message); }
    finally { setExtracting(false); }
  }

  function exportSVG() {
    if (!svg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = "pathform.svg"; a.click(); setLogMsg("SVG 내보내기 완료");
  }

  function exportJPG() {
    if (!svg || !svgRef.current) return;
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1200;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1200, 1200);
    const svgEl = svgRef.current.querySelector("svg"); if (!svgEl) return;
    const str = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, 1200, 1200); const a = document.createElement("a"); a.download = "pathform.jpg"; a.href = canvas.toDataURL("image/jpeg", 0.95); a.click(); setLogMsg("JPG 내보내기 완료"); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str)));
  }

  const grouped = useMemo(() => {
    const g = {};
    elements.forEach(el => { const lbl = catLabel(el.category); if (!g[lbl]) g[lbl] = { order: catOrder(el.category), items: [] }; g[lbl].items.push(el); });
    return Object.entries(g).sort((a, b) => a[1].order - b[1].order);
  }, [elements]);

  return (
    <div style={{ fontFamily: "'Space Mono',monospace", background: C.bg, color: C.text, minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(rgba(127,255,178,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(127,255,178,0.025) 1px,transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 }} />

      {/* API KEY 모달 */}
      {showKeyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 32, width: 420, maxWidth: "90vw" }}>
            <div style={{ fontSize: 12, letterSpacing: 3, color: C.muted, textTransform: "uppercase", marginBottom: 16 }}>GEMINI API KEY 설정</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.9, marginBottom: 20 }}>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: C.accent3 }}>aistudio.google.com</a>에서 무료로 발급받으세요.<br/>
              키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
            </div>
            <input
              type="password"
              placeholder="AIza..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              style={{ width: "100%", background: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'Space Mono',monospace", fontSize: 11, padding: "10px 12px", borderRadius: 2, outline: "none", marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowKeyModal(false)}
                style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer", borderRadius: 2, fontFamily: "inherit" }}>취소</button>
              <button onClick={() => {
                const k = keyInput.trim();
                if (!k) return;
                setGeminiKey(k);
                localStorage.setItem("pf_gemini_key", k);
                setShowKeyModal(false);
              }} style={{ padding: "8px 18px", background: C.accent, color: "#0a0a0f", border: "none", fontWeight: 800, fontSize: 11, cursor: "pointer", borderRadius: 2 }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: `1px solid ${C.border}`, background: "rgba(10,10,15,0.93)", backdropFilter: "blur(12px)" }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>PATH<span style={{ color: C.accent }}>FORM</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[["1","업로드"],["2","요소 정리"],["3","패스 추출"]].map(([n, lbl], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: stage === i+1 ? C.accent : C.muted, border: `1px solid ${stage === i+1 ? C.border : "transparent"}`, background: stage === i+1 ? C.surface : "transparent", borderRadius: 2 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${stage > i+1 ? C.accent : stage === i+1 ? C.accent : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, background: stage === i+1 ? C.accent : "transparent", color: stage === i+1 ? "#0a0a0f" : stage > i+1 ? C.accent : C.muted }}>
                  {stage > i+1 ? "✓" : n}
                </div>
                {lbl}
              </div>
              {i < 2 && <span style={{ color: C.border, padding: "0 2px", fontSize: 12 }}>›</span>}
            </div>
          ))}
        </div>
        <button onClick={() => { setKeyInput(geminiKey); setShowKeyModal(true); }}
          style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${geminiKey ? C.accent : C.accent2}`, color: geminiKey ? C.accent : C.accent2, fontSize: 9, letterSpacing: 2, cursor: "pointer", borderRadius: 2, fontFamily: "inherit" }}>
          {geminiKey ? "✓ API KEY" : "⚠ API KEY 필요"}
        </button>
      </div>

      {/* ══ STAGE 1 ══ */}
      {stage === 1 && (
        <div style={{ position: "relative", zIndex: 1, minHeight: "calc(100vh - 57px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ width: "100%", maxWidth: 480, border: `1.5px dashed ${drag ? C.accent : C.border}`, borderRadius: 6, padding: "72px 56px", textAlign: "center", cursor: "pointer", background: drag ? "rgba(127,255,178,0.03)" : "transparent", transition: "all 0.3s" }}>
            <div style={{ fontSize: 48, opacity: 0.28, marginBottom: 20 }}>⬡</div>
            <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 10 }}>이미지를 드롭하거나 클릭</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 2 }}>PNG · JPG · WEBP · SVG<br />AI가 요소를 감지 → 선택 제거 → 패스 추출</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {/* ══ STAGE 2 ══ */}
      {stage === 2 && (
        <div style={{ position: "relative", zIndex: 1, display: "flex", height: "calc(100vh - 57px)" }}>

          {/* LEFT: 이미지 뷰 */}
          <div style={{ width: "57%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
            {/* 탭 헤더 */}
            <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
              <button onClick={() => setViewMode("original")}
                style={{ padding: "11px 18px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", background: "transparent", border: "none", borderBottom: `2px solid ${viewMode === "original" ? C.accent : "transparent"}`, color: viewMode === "original" ? C.accent : C.muted, cursor: "pointer", transition: "all 0.2s" }}>
                원본
              </button>
              <button onClick={() => { if (previewUrl || previewGenerating) setViewMode("compare"); else generatePreview(); }}
                style={{ padding: "11px 18px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", background: "transparent", border: "none", borderBottom: `2px solid ${viewMode === "compare" ? C.accent : "transparent"}`, color: viewMode === "compare" ? C.accent : removeCount > 0 ? C.muted : C.border, cursor: removeCount > 0 ? "pointer" : "not-allowed", transition: "all 0.2s", opacity: removeCount > 0 ? 1 : 0.4 }}>
                {previewGenerating ? "⏳ 생성 중..." : "원본 vs 수정"}
              </button>
              {previewErr && <div style={{ padding: "11px 14px", fontSize: 10, color: C.accent2, alignSelf: "center" }}>⚠ {previewErr}</div>}
              <div style={{ flex: 1 }} />
              <div style={{ padding: "11px 16px", fontSize: 9, color: C.muted, alignSelf: "center", letterSpacing: 1 }}>
                {viewMode === "compare" && !previewGenerating && previewUrl ? "← 드래그로 비교" : ""}
              </div>
            </div>

            {/* 이미지 영역 */}
            <div style={{ flex: 1, padding: 14, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
              {viewMode === "original" ? (
                imageDataUrl && <img src={imageDataUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 3, border: `1px solid ${C.border}` }} alt="원본" />
              ) : (
                <BeforeAfterSlider originalSrc={imageDataUrl} previewUrl={previewUrl} isGenerating={previewGenerating} />
              )}
            </div>
          </div>

          {/* RIGHT: 요소 리스트 */}
          <div style={{ width: "43%", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 10, letterSpacing: 3, color: C.muted, textTransform: "uppercase" }}>감지된 요소</span>
              <span style={{ fontSize: 10, color: C.muted }}>{detecting ? "분석 중..." : detectErr ? "감지 실패" : `${elements.length}개`}</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", minHeight: 0 }}>
              {detecting && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "50px 0" }}>
                  <ScanBar />
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 3 }}>AI 요소 감지 중...</div>
                </div>
              )}
              {!detecting && detectErr && (
                <div style={{ textAlign: "center", padding: "28px 12px" }}>
                  <div style={{ color: C.accent2, fontSize: 12, marginBottom: 8 }}>⚠ 감지 실패</div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 14, lineHeight: 1.7 }}>{detectErr}</div>
                  <button onClick={runDetect} style={{ background: C.accent, color: "#0a0a0f", border: "none", fontWeight: 700, padding: "8px 18px", borderRadius: 2, cursor: "pointer", fontSize: 11 }}>다시 시도</button>
                </div>
              )}
              {grouped.map(([label, g]) => (
                <div key={label}>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, textTransform: "uppercase", margin: "12px 0 7px", paddingBottom: 5, borderBottom: `1px solid ${C.border}` }}>{label}</div>
                  {g.items.map(el => (
                    <div key={el.id} onClick={() => toggleEl(el.id)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", border: `1px solid ${el.remove ? C.accent2 : C.border}`, borderRadius: 4, marginBottom: 6, background: el.remove ? "rgba(255,127,127,0.07)" : C.panel, cursor: "pointer", transition: "all 0.15s", userSelect: "none" }}>
                      <div style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 2, border: `1px solid ${el.remove ? C.accent2 : C.border}`, background: el.remove ? "rgba(255,127,127,0.25)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.accent2 }}>
                        {el.remove ? "✕" : ""}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{el.name}</div>
                        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{el.desc}</div>
                      </div>
                      <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, border: `1px solid ${catColor(el.category)}`, color: catColor(el.category), flexShrink: 0, marginTop: 1 }}>
                        {catTag(el.category)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* 액션 바 */}
            <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
              {/* 미리보기 버튼 행 */}
              {removeCount > 0 && (
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 10, color: C.muted }}>
                    <span style={{ color: C.accent2, fontWeight: 700 }}>{removeCount}개</span> 제거 선택됨
                  </div>
                  <button onClick={generatePreview} disabled={previewGenerating}
                    style={{ padding: "7px 14px", background: "transparent", border: `1.5px solid ${previewGenerating ? C.border : C.accent4}`, color: previewGenerating ? C.muted : C.accent4, fontSize: 10, letterSpacing: 1, cursor: previewGenerating ? "not-allowed" : "pointer", borderRadius: 2, fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                    {previewGenerating ? "생성 중..." : previewUrl ? "🔄 갱신" : "👁 미리보기"}
                  </button>
                </div>
              )}

              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10, color: C.muted, flex: 1 }}>
                  {removeCount === 0 ? "카드 클릭으로 제거할 요소 선택" : <><span style={{ color: C.accent2, fontWeight: 700 }}>{removeCount}개</span> 선택 · 미리보기로 확인 가능</>}
                </div>
                <button onClick={() => { setElements(p => p.map(e => ({ ...e, remove: false }))); setStage(3); }}
                  style={{ padding: "8px 13px", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer", borderRadius: 2, fontFamily: "inherit" }}>건너뛰기</button>
                <button onClick={() => setStage(3)}
                  style={{ padding: "9px 18px", background: C.accent, color: "#0a0a0f", border: "none", fontWeight: 800, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", borderRadius: 2 }}>다음 →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STAGE 3 ══ */}
      {stage === 3 && (
        <div style={{ position: "relative", zIndex: 1, display: "flex", height: "calc(100vh - 57px)" }}>
          <div style={{ width: "60%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 10, letterSpacing: 3, color: C.muted, textTransform: "uppercase" }}>SVG 패스 결과</span>
              <span style={{ fontSize: 10, color: svg ? C.accent : C.muted }}>{svg ? "완료 ✓" : extracting ? "분석 중..." : "대기중"}</span>
            </div>
            {pathStats && (
              <div style={{ display: "flex", gap: 16, padding: "7px 18px", borderBottom: `1px solid ${C.border}`, background: C.panel, fontSize: 10, color: C.muted, flexShrink: 0 }}>
                <span>패스: <span style={{ color: C.accent }}>{pathStats.paths}</span></span>
                <span>노드: <span style={{ color: C.accent }}>{pathStats.nodes}</span></span>
                <span>크기: <span style={{ color: C.accent }}>{pathStats.size}KB</span></span>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: 18, minHeight: 0 }}>
              {extracting && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,15,0.85)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 10 }}>
                  <div style={{ width: 44, height: 44, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <div style={{ fontSize: 10, color: C.accent, letterSpacing: 3 }}>{loadingMsg}</div>
                </div>
              )}
              {!svg && !extracting && <div style={{ textAlign: "center", opacity: 0.28 }}><div style={{ fontSize: 46, marginBottom: 12 }}>◈</div><div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, lineHeight: 2 }}>오른쪽에서 설정 후<br />추출을 시작하세요</div></div>}
              {svg && <div ref={svgRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(45deg,#1a1a26 25%,transparent 25%),linear-gradient(-45deg,#1a1a26 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a26 75%),linear-gradient(-45deg,transparent 75%,#1a1a26 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0", backgroundColor: C.panel, borderRadius: 4, padding: 12 }} dangerouslySetInnerHTML={{ __html: svg }} />}
            </div>
            <div style={{ padding: "7px 18px", borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,0.3)", fontSize: 10, color: C.muted, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><span style={{ color: C.accent }}>›</span>{logMsg}</div>
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setStage(2)} style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer", borderRadius: 2, fontFamily: "inherit" }}>← 돌아가기</button>
              <span style={{ flex: 1, fontSize: 10, color: C.muted, letterSpacing: 2 }}>EXPORT</span>
              <button onClick={exportSVG} disabled={!svg} style={{ padding: "8px 14px", background: "transparent", border: `1.5px solid ${C.accent3}`, color: C.accent3, fontSize: 11, cursor: svg ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: "inherit", opacity: svg ? 1 : 0.4 }}>↓ SVG</button>
              <button onClick={exportJPG} disabled={!svg} style={{ padding: "8px 14px", background: "transparent", border: `1.5px solid ${C.accent2}`, color: C.accent2, fontSize: 11, cursor: svg ? "pointer" : "not-allowed", borderRadius: 2, fontFamily: "inherit", opacity: svg ? 1 : 0.4 }}>↓ JPG</button>
            </div>
          </div>
          <div style={{ width: "40%", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}><span style={{ fontSize: 10, letterSpacing: 3, color: C.muted, textTransform: "uppercase" }}>추출 설정</span></div>
            <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0 }}>
              <div>
                <SectionLabel>제거된 요소</SectionLabel>
                {removed.length > 0 ? (
                  <div style={{ padding: "9px 12px", background: "rgba(255,127,127,0.06)", border: `1px solid rgba(255,127,127,0.25)`, borderRadius: 4, fontSize: 10, lineHeight: 1.9 }}>
                    <span style={{ fontSize: 9, letterSpacing: 2, color: C.accent2, display: "block", marginBottom: 4, textTransform: "uppercase" }}>제거 요청 ({removed.length}개)</span>
                    {removed.map(e => <div key={e.id} style={{ color: C.text }}>• {e.name}</div>)}
                  </div>
                ) : <div style={{ fontSize: 10, color: C.muted, padding: "3px 0" }}>없음 — 전체 이미지 추출</div>}
              </div>
              <div>
                <SectionLabel>패스 설정</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <CtrlRow label="DETAIL"><input type="range" min={1} max={5} value={detail} onChange={e => setDetail(+e.target.value)} style={{ flex: 1, accentColor: C.accent }} /><span style={{ fontSize: 11, color: C.accent, minWidth: 18 }}>{detail}</span></CtrlRow>
                  <CtrlRow label="MODE"><select value={mode} onChange={e => setMode(e.target.value)} style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: "inherit", fontSize: 11, padding: "5px 9px", borderRadius: 2, cursor: "pointer", outline: "none" }}><option value="outline">윤곽선</option><option value="filled">채운 패스</option><option value="centerline">중심선</option></select></CtrlRow>
                  <CtrlRow label="COLOR"><select value={color} onChange={e => setColor(e.target.value)} style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: "inherit", fontSize: 11, padding: "5px 9px", borderRadius: 2, cursor: "pointer", outline: "none" }}><option value="mono">흑백</option><option value="original">원본 색상</option><option value="simplified">단순화</option></select></CtrlRow>
                </div>
              </div>
              <button onClick={runExtraction} disabled={extracting}
                style={{ marginTop: "auto", padding: 13, background: extracting ? C.border : C.accent, color: "#0a0a0f", border: "none", fontWeight: 800, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: extracting ? "not-allowed" : "pointer", borderRadius: 2 }}>
                {extracting ? "추출 중..." : svg ? "▶ 다시 추출" : "▶ 패스 추출 시작"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanfill { 0%{width:0%} 60%{width:100%} 100%{width:100%;opacity:0} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #2a2a3d; border-radius: 2px; }
        button:hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 9, letterSpacing: 3, color: C.muted, textTransform: "uppercase", paddingBottom: 5, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>{children}</div>;
}
function CtrlRow({ label, children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 10, color: C.muted, letterSpacing: 1, minWidth: 65 }}>{label}</span>{children}</div>;
}
function ScanBar() {
  return (
    <div style={{ width: 180, height: 2, background: C.border, borderRadius: 1, overflow: "hidden" }}>
      <div style={{ height: "100%", background: C.accent, animation: "scanfill 2s ease-in-out infinite" }} />
    </div>
  );
}
