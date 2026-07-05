# 마피아 사회자 도우미

오프라인 라이브 마피아 게임을 한 명의 사회자가 진행할 수 있게 돕는 모바일 우선 웹앱입니다.

주요 기능:

- 방 생성, 방 코드, 참가 링크 공유
- 참가자 실시간 목록
- 인원수 기반 추천 역할 구성
- 역할 수동 수정과 총합 검증
- 랜덤 역할 배정과 전체 공개
- 플레이어별 본인 역할만 표시
- 낮/밤 상태 전환
- 낮 토론 타이머
- 밤 백색소음 재생
- 게임 초기화

## Getting Started

의존성을 설치합니다.

```bash
npm install
```

`.env.local.example`을 참고해 `.env.local`을 만듭니다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Database > Replication 또는 Realtime 설정에서 `rooms`, `players`, `game_events`가 Realtime 대상인지 확인합니다.
4. Project Settings > API에서 Project URL과 anon public key를 복사합니다.
5. `.env.local` 또는 Vercel 환경 변수에 값을 넣습니다.

## Vercel 배포

1. GitHub 저장소를 Vercel에 연결합니다.
2. Framework Preset은 Next.js를 사용합니다.
3. Environment Variables에 아래 값을 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy를 실행합니다.
5. 배포 후 여러 브라우저 탭 또는 여러 휴대폰으로 방 생성, 참가, 역할 공개, 낮/밤 전환을 테스트합니다.

## 프로젝트 구조

```txt
app/
  page.tsx
  host/page.tsx
  join/[code]/page.tsx
  player/[playerId]/page.tsx
components/
  DiscussionTimer.tsx
  HostDashboard.tsx
  PlayerList.tsx
  RoleCard.tsx
  RoleConfigEditor.tsx
  StatusBadge.tsx
  WhiteNoisePlayer.tsx
lib/
  roleDescriptions.ts
  roles.ts
  roomCode.ts
  shuffle.ts
  supabaseClient.ts
  timer.ts
supabase/
  schema.sql
types/
  database.ts
  game.ts
```

## 보안 메모

이 MVP는 오프라인 게임 진행을 빠르게 돕기 위해 anon key 기반으로 단순하게 동작합니다.

- 플레이어 화면은 현재 플레이어의 row만 조회합니다.
- 플레이어 화면은 전체 참가자 목록이나 전체 역할 목록을 조회하지 않습니다.
- 서비스 롤 키는 브라우저에 넣지 않습니다.
- 공개 서비스로 운영하기 전에는 인증 또는 room-scoped RLS 정책을 추가하는 것을 권장합니다.
