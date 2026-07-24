# 심사품질 AI 컨테스트 (Idea App Store)

## 상태
- 브레인스토밍용 **정적 사이트**
- 모든 카드/앱에 **AI 연결 끊김** 표시
- LLM/이미지 API 호출 없음

## 구조
- `index.html` — 앱스토어형 출품작 목록 (신규 아이디어 우선, 기존 출품 아카이브)
- `idea-entry.css` / `idea-entry.js` — 신규 아이디어 앱 공통 골격
- 신규 아이디어 앱 (8)
  - claim-decompose.html
  - rejection-sketch.html
  - priorart-radar.html
  - tm-similarity-board.html
  - design-view-notes.html
  - inventive-sparks.html
  - description-gap.html
  - office-action-coach.html
- 기존 출품 HTML (레거시 보관)

## 허브 연결
- quality.html 서비스 카드 → `/contest/`
- 카드 순서: 특실 검색 에이전트(베타) 다음
