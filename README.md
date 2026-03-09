# PATHFORM v2.1

> AI-powered image → SVG path extractor

이미지를 업로드하면 AI가 시각적 요소를 자동 감지합니다. 제거할 요소를 선택하고 Before/After로 미리보기한 뒤, 깔끔한 SVG 패스로 추출하세요.

![PATHFORM screenshot](https://via.placeholder.com/800x450/0a0a0f/7fffb2?text=PATHFORM)

---

## Features

- **AI 요소 감지** — Claude Vision이 이미지 내 요소를 6~12개 자동 분류 (노이즈, 워터마크, 배경, 오브젝트 등)
- **선택적 제거** — 카드 클릭 한 번으로 제거할 요소 선택
- **Before/After 슬라이더** — 드래그로 원본 vs 수정본 실시간 비교
- **SVG 패스 추출** — Detail(1~5) · Mode(윤곽선/채운/중심선) · Color(흑백/원본/단순화) 설정
- **내보내기** — SVG 및 JPG 다운로드

---

## Getting Started

### 1. 패키지 설치

```bash
npm install
```

### 2. Anthropic API 키 설정

> **중요:** 이 앱은 [Anthropic Claude API](https://console.anthropic.com/)를 사용합니다.  
> API 키 없이는 AI 기능이 동작하지 않습니다.

`src/PathForm.jsx` 내 `callClaude` 함수는 브라우저에서 직접 Anthropic API를 호출합니다.  
**프로덕션 환경에서는 반드시 서버 사이드 프록시를 통해 API 키를 숨기세요.**

로컬 개발 시 `.env` 파일을 만들고 Vite 프록시를 설정하거나, `callClaude` 함수를 백엔드 엔드포인트로 교체하는 방식을 권장합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 4. 빌드

```bash
npm run build
```

---

## Project Structure

```
pathform/
├── index.html          # HTML 진입점
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx        # React 진입점
    └── PathForm.jsx    # 메인 컴포넌트 (전체 앱)
```

---

## How It Works

| 단계 | 설명 |
|------|------|
| **1. 업로드** | PNG · JPG · WEBP 이미지를 드래그&드롭 또는 클릭으로 선택 |
| **2. 요소 정리** | AI가 이미지 분석 후 요소 목록 생성. 클릭으로 제거 대상 선택 |
| **3. 패스 추출** | 설정 조정 후 AI가 SVG 패스 생성. SVG/JPG로 내보내기 |

---

## Tech Stack

- **React 18** + Vite
- **Anthropic Claude** (claude-sonnet-4) — 요소 감지 · bbox 추출 · SVG 벡터화
- **Canvas API** — 인페인팅 미리보기 (주변 픽셀 평균색 채움)
- No additional CSS frameworks — inline styles only

---

## License

MIT
