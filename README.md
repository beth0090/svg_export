# PATHFORM — AI 이미지 패스 추출기

이미지를 업로드하면 AI가 요소를 감지하고, 원하는 요소만 제거한 뒤 SVG 패스로 추출해주는 도구입니다.

## 기능
- 이미지 업로드 (PNG, JPG, WEBP, SVG)
- AI 요소 자동 감지 (Claude API)
- 요소 선택 제거 + Before/After 비교 슬라이더
- SVG 패스 추출 및 JPG/SVG 내보내기

## 로컬 실행

```bash
npm install
npm run dev
```

로컬에서 실행할 때는 프로젝트 루트에 `.env.local` 파일 생성:
```
ANTHROPIC_API_KEY=sk-ant-여기에_실제_키_입력
```

## Vercel 배포

1. GitHub에 push
2. [vercel.com](https://vercel.com) → GitHub 계정 로그인
3. **Add New Project** → `svg_export` 레포 선택
4. **Environment Variables** 에 `ANTHROPIC_API_KEY` 추가
5. **Deploy** 클릭 → 완료!
