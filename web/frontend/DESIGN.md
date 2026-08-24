# EveryUp 프론트엔드 디자인 시스템

React 19 · Tailwind v4 · Recharts 3. 이 문서가 **디자인 규약의 SSOT**다.
값의 실제 정의는 [`src/index.css`](src/index.css)(토큰)와 각 컴포넌트 파일에 있고, 이 문서는 **무엇을 언제 쓰는가**를 정한다.

관련 문서: [`../../CLAUDE.md`](../../CLAUDE.md)(엔지니어링 규약 — 디자인 내용은 없다) · [`src/components/charts/chartTheme.ts`](src/components/charts/chartTheme.ts)(차트 스펙 코드)

---

## 1. 색

### 1.1 토큰 규약 — `dark:` 이중 작성 금지

시맨틱 토큰은 **라이트 값**을 담고, `index.css`의 `.dark` 블록에서 대응 `-dark` 값으로 **자가 재할당**된다.
따라서 컴포넌트는 클래스 하나로 양쪽 테마를 커버한다.

```tsx
// ✅
<p className="text-text-muted">

// ❌ 토큰이 이미 전환된다 — dark: 짝은 중복이자 유지보수 부채
<p className="text-slate-500 dark:text-text-muted-dark">
```

`*-dark` 접미 토큰(`--color-text-muted-dark` 등)은 **`.dark` 블록 재할당 전용**이다. 컴포넌트에서 직접 쓰지 않는다.

### 1.2 표면 · 경계

| 역할 | 클래스 | light | dark |
|------|--------|-------|------|
| 페이지 배경 | `bg-bg-main` | `#fbfcfe` | `#0d1117` |
| 카드 표면 | `bg-bg-surface` | `#ffffff` | `#161b22` |
| 헤어라인 | `border-ui-border` | `#e2e8f0` | `#30363d` |
| 내부 구분선 | `border-ui-border-soft` | `#f1f5f9` | `#30363d` |
| hover 채움 | `bg-ui-hover` | `#f1f5f9` | `#1f2937` |
| 옅은 내부 채움 | `bg-ui-hover-soft` | `#f8fafc` | `#1f2937` |
| 눌린 표면 | `bg-ui-active` | `#e2e8f0` | `#374151` |
| **떠오른 표면** | `bg-ui-raised` | `#ffffff` | `#374151` |

`ui-active`와 `ui-raised`는 **다크값이 같지만 역할이 반대다.** `ui-active`(라이트 `#e2e8f0`)는 스켈레톤·칩·hover처럼 트랙보다 **눌려** 보여야 하는 자리, `ui-raised`(라이트 흰색)는 세그먼티드 컨트롤의 선택된 칸처럼 `ui-hover` 트랙 **위로 솟아** 보여야 하는 자리다. 라이트에서 흰색이어야 하므로 `bg-bg-surface`로 대체할 수 없다 — 다크값(`#161b22`)이 트랙(`#1f2937`)보다 어두워 방향이 뒤집힌다.

다크에서 `soft` 계열은 상위 토큰과 동일하다 — **다크 모드의 명도 계층은 2단(main/surface)뿐**이고, 이는 의도된 설계다.

### 1.3 텍스트 4단 위계

| 역할 | 클래스 | light | 대비 | dark |
|------|--------|-------|------|------|
| 제목·강조 | `text-text-base` | `#0f172a` | 17.85 | `#ffffff` |
| 본문 | `text-text-secondary` | `#334155` | 10.35 | `#cbd5e1` |
| 보조 | `text-text-muted` | `#475569` | 7.58 | `#94a3b8` |
| 메타·placeholder | `text-text-dim` | `#64748b` | 4.76 | `#6b7280` |

한 화면에서 4단을 전부 쓰지 않는다. 카드 하나에는 보통 **base + muted 2단**이면 충분하다.

**4단 전부 AA(4.5)를 넘는다** — 가장 옅은 `dim`이 하한선이다. dim은 slate-400(2.56, 미달)이었고 이를 slate-500로 내리면서 muted도 slate-600으로 한 칸 밀어 위계를 유지했다. 더 옅은 등급을 추가하지 말 것.

### 1.4 브랜드 · 상태

**primary** `#3b76c9` (dark `#3F6FDB`) — 주 액션, 링크, 선택 상태, 차트 첫 시리즈

**상태색도 시맨틱 토큰이다.** `emerald-600 dark:emerald-400` 같은 primitive 직접 사용 금지 — 토큰이 `.dark`에서 자가 전환하므로 `dark:` 짝이 필요 없다.

| 상태 | 클래스 | light | dark |
|------|--------|-------|------|
| healthy · online | `text-status-healthy` | `#047857` emerald-700 | `#5eead4` teal-300 |
| warning | `text-status-warn` | `#92400e` amber-800 | `#fbbf24` amber-400 |
| error · critical · degraded | `text-status-error` | `#b91c1c` red-700 | `#f87171` red-400 |
| offline · paused · unknown | `text-status-idle` | `#475569` slate-600 | `#94a3b8` slate-400 |

두 가지가 통념과 다르니 근거를 남긴다.

- **라이트가 700~800단계다.** 600단계는 배지가 자기 `/10` 틴트 위에서 healthy 3.43 / warn 2.95 / error 4.23으로 AA(4.5) 미달이었다. 11px bold는 WCAG large text(18.66px bold)가 아니라 4.5:1이 적용된다.
- **다크 healthy만 emerald가 아니라 teal이다.** emerald-400과 red-400은 적록색각이상에서 각각 `#b2b29d`·`#aeae6a`로 **둘 다 흙빛에 수렴**해 거리 20.1까지 붙었다. 모니터링 도구에서 정상/장애를 구분 못 하는 건 기능 실패라 teal-300으로 밀어 45.5까지 벌렸다.

`info` 역할은 아직 소비처가 없어 토큰을 만들지 않았다 — Tailwind v4는 미사용 `@theme` 변수를 트리셰이킹하므로 죽은 토큰이 된다. 첫 소비처가 생길 때 추가한다.

### 1.5 로그 레벨 — 상태색과 별개 축

`AgentServiceLogsTab`의 `LEVEL_STYLE`(배지) / `LEVEL_BAR`(히스토그램)가 SSOT.

| 레벨 | 색 | 바 hex | 배지 라이트 텍스트 |
|------|-----|--------|------------------|
| error | red | `#dc2626` | `text-red-700` |
| warn | amber | `#d97706` | `text-amber-700` |
| info | **sky** | `#0284c7` | `text-sky-700` |
| debug | violet | `#7c3aed` | `text-violet-700` |
| trace | slate | `#64748b` | `text-text-muted` |

info가 sky인 이유: primary(#3b76c9)와 붙어 있으면 "선택된 항목"으로 오독된다.

바 색이 600단계인 이유: 500단계는 흰 배경에서 warn 2.15 / info 2.77 / trace 2.56으로 WCAG 1.4.11(3:1) 미달이었다. 배지 텍스트가 700단계인 이유: 600은 자기 `-100` 배경 위에서 red 3.95 / sky 3.57로 AA 미달이었다.

### 1.6 차트 시리즈 팔레트

`chartTheme.ts`의 `SERIES_HEX` + `getSeriesPalette(theme)`. **첫 슬롯은 항상 브랜드 primary.**

```
primary #3b76c9 → emerald #059669 → amber #d97706 → violet #7c3aed → red #dc2626 → teal #0d9488
```

시리즈 색 하드코딩 금지. mock 데이터도 `SERIES_HEX`를 import한다.

**600단계인 이유** — 500단계일 때 라이트 배경에서 emerald 2.54 / teal 2.49 / amber 2.15로 WCAG 1.4.11(3:1)에 미달했다. 팔레트가 Grafana를 참고하면서 다크 배경만 보고 튜닝된 결과였다. 600으로 내려 양쪽 테마 모두 3:1을 넘긴다.

**⚠ 4개를 넘는 시리즈는 색만으로 구분되지 않는다.** 적록색각이상에서 앞 3슬롯(primary/emerald/amber)은 안전하지만 4슬롯째부터는 어떤 순서로 배열해도 충돌한다(primary/violet 16.0, emerald/teal 11.8, amber/red 12.8). 6색이 (a)색각 구분 (b)라이트 3:1 (c)다크 3:1을 동시에 만족하는 조합은 존재하지 않는다 — Okabe-Ito 정통 8색조차 라이트에서 orange 2.25, skyblue 2.31로 떨어진다. 시리즈가 4개를 넘으면 **선 스타일을 병행**한다 — `getSeriesDash(i)`가 4슬롯째부터 `strokeDasharray`를 돌려준다(앞 3슬롯은 `undefined`라 실선 유지). 시리즈 개수가 데이터에 달린 차트에서 쓴다:

```tsx
<Line {...lineProps(colors[i % colors.length])} strokeDasharray={getSeriesDash(i)} />
```

시리즈가 1~3개로 고정된 차트는 넣지 않아도 된다 — 어차피 `undefined`를 받으므로 모습이 같다.

### 1.7 하드코딩이 허용되는 유일한 경우

`ChannelForm`의 텔레그램/디스코드/슬랙 **미리보기 UI**. 서드파티 브랜드 색(`#26A5E4`, `#5865F2`, `#E01E5A`, `#313338` …)을 재현하는 목적이므로 토큰화 대상이 아니다. 그 외 hex 리터럴은 전부 부채다.

---

## 2. 타이포그래피

### 2.1 폰트

- **본문** Pretendard Variable (self-hosted, dynamic-subset)
- **숫자·코드·타임스탬프** JetBrains Mono Variable → `font-mono`
- 숫자가 자리 이동하면 안 되는 곳(KPI, 차트 범례, 테이블)은 `tabular-nums`를 함께 건다

### 2.2 스케일 — `text-[Npx]` 임의값 금지

| 토큰 | px | 용도 | 실사용 |
|------|-----|------|--------|
| `text-2xs` | 11 | 배지, 메타, 타임라인 라벨, 차트 범례 | 51 |
| `text-xs` | 12 | 레이블, 칩, 테이블 헤더, 보조 액션 | 186 |
| `text-sm` | 14 | **기본 UI 텍스트** — 본문, 버튼, 폼 | 290 |
| `text-base` | 16 | 카드 제목(h3), 강조 본문 | 57 |
| `text-lg` | 18 | 서브타이틀 | 28 |
| `text-xl` | 20 | 카드 헤더(h2), 섹션 제목 | 32 |
| `text-2xl` | 24 | **페이지 h1** | 14 |
| `text-3xl`+ | 30+ | KPI 수치, 아이콘 크기 | 19 |

`text-2xs`는 Tailwind 기본이 아니라 `index.css @theme`에서 추가한 커스텀 등급이다.

### 2.3 헤딩 등급 (정본)

등급은 **담긴 컨테이너**가 정한다. 같은 `h2`라도 카드 헤더와 모달 제목은 크기가 다르다.

| 자리 | 클래스 |
|------|--------|
| 페이지 h1 | `text-2xl font-bold text-text-base` |
| 페이지 h1 (모바일 전용 뷰) | `text-xl font-bold text-text-base` |
| 카드·섹션 헤더 h2 | `text-xl font-bold text-text-base` |
| 모달 제목 h2 | `text-base font-semibold text-text-base` |
| 설정 섹션 카드 h2 | `text-sm font-bold text-text-base` |
| 카드 내 제목·차트 헤더 h3 | `text-base font-bold text-text-base` |
| 테이블 `<th>` | `text-xs font-semibold uppercase tracking-wider text-text-muted` |

클래스 순서는 **크기 → 굵기 → 색**으로 적는다. `text-text-base font-bold text-lg`처럼 뒤섞으면 같은 등급인지 눈으로 판별되지 않는다.

페이지 헤더는 [`PageHeader`](src/components/common/PageHeader.tsx)를 쓴다 — h1 등급이 여기 박혀 있다.

**예외** — `NotFoundPage`의 `text-6xl`은 "404" 디스플레이 숫자, `Header`의 `text-lg`는 페이지 제목이 아니라 로고, `EmptyState`의 `text-xl`은 빈 상태 안내다.

### 2.4 굵기

`font-bold`(제목·배지·수치) / `font-semibold`(버튼·테이블 헤더·강조 레이블) / `font-medium`(내비 항목·설정/KPI 캡션·필터 셀렉트 등 보조 레이블 — §6) / 기본(본문). 이 4단을 넘기지 않는다.

---

## 3. 레이아웃

### 3.1 카드 (정본)

```
bg-bg-surface border border-ui-border rounded-xl
```

내부 패딩은 `p-4`(조밀) 또는 `p-6`(여유). 카드 안 서브블록은 `bg-ui-hover-soft border border-ui-border rounded-xl`.

### 3.2 radius

| 값 | 용도 |
|----|------|
| `rounded-xl` | 카드, 패널, 모달, 큰 입력 |
| `rounded-lg` | 버튼, 입력, 아이콘 버튼, 드롭다운 |
| `rounded-md` | 조밀한 칩, 인라인 코드 |
| `rounded` | 배지 |
| `rounded-full` | 상태 점, pill, 아바타 |

`rounded-2xl` 이상은 쓰지 않는다.

### 3.3 본문 그리드

`MainLayout` 본문 래퍼: `p-4 sm:px-6 sm:py-5 space-y-5` — **풀블리드**(중앙 정렬·max-width 없음). 카드 간 간격은 래퍼의 `space-y-5`가 담당하므로 개별 카드에 `mb-*`를 붙이지 않는다.

### 3.4 내비게이션 셸

- `lg` 이상: 좌측 `Sidebar`(로고 → nav → Docker 수집기 상태 푸터). `Header`는 `lg:hidden`으로 모바일 전용
- `lg` 미만: `Header` + `BottomNavMobile`. 하단바 겹침은 `pb-safe-bottom` 유틸리티가 처리
- 뒤로가기 버튼은 **데스크톱에 두지 않는다** — 사이드바가 상시 내비다

### 3.5 그림자

`shadow-sm`(선택된 세그먼트) / `shadow-lg`(오버레이·툴팁)만. 카드에는 그림자를 쓰지 않는다 — 경계는 보더가 담당한다.

### 3.6 클릭 가능한 카드 hover

`.card-interactive` **하나만** 쓴다 (`index.css` 정의). 2px 들어올림 + 보더 `primary/40` + 배경 `ui-hover-soft`, 150ms. 터치 기기 제외(`hover: hover`), `:active`에서 원위치, 모션 최소화 설정에서는 들어올림 생략.

카드마다 `hover:-translate-y-*`·`hover:shadow-md`·`transition-all`을 직접 조합하지 않는다 — 메뉴별로 hover가 제각각이 된 원인이었다. 클릭 가능한 **행**(테이블·로그)은 카드가 아니므로 `hover:bg-ui-hover-soft` 채움만 쓴다.

---

## 4. 컴포넌트 카탈로그

### 4.1 `components/common/` — 공용 프리미티브

| 컴포넌트 | props | 규약 |
|----------|-------|------|
| **`Button`** | `variant` `size` + 네이티브 button | 라벨 있는 액션 버튼의 **유일한** 진입점 |
| **`Input`** | `invalid?` `warn?` `mono?` | 폼 입력 (§6) |
| **`Select`** | 네이티브만 | 폼 셀렉트 (§6) |
| **`SearchInput`** | `wrapperClassName?` | 아이콘 붙은 검색창 (§6) |
| **`StatusBadge`** | `healthy: boolean` | 정상/장애 보더칩 (§5.1) |
| **`Toggle`** | `checked` `onChange` `disabled` `title` | w-9 h-5, `role="switch"` |
| **`SegmentedControl<T>`** | `options` `value` `onChange` `size` `ariaLabel` | 2~4지 배타 선택 |
| **`TimeRangePicker`** | `value: GlobalTimeRange` `onChange` | `1h`\|`6h`\|`24h`. SegmentedControl 래퍼 |
| **`ConfirmDialog`** | `isOpen` `title` `message` `variant` `icon` … | `window.confirm()` 금지 — 항상 이것 |
| **`EmptyState`** | `icon` `title` `description?` `action?` | 빈 목록의 정본 |
| **`PageHeader`** | `title` `subtitle?` `children` | h1 등급 고정 |
| **`MaterialIcon`** | `name` `className` `style` | 로컬 정적 SVG |
| **`CopyButton`** | `onCopy` `title` `className` … | 3초 완료 피드백 |

**Button 스펙**

| variant | 용도 | 클래스 |
|---------|------|--------|
| `primary` | 주 액션 (화면당 1개) | `bg-primary text-white` |
| `secondary` | 취소·보조 | `bg-bg-surface border border-ui-border` |
| `ghost` | 배경 없는 3순위 | `text-text-muted hover:bg-ui-hover` |
| `danger` | 삭제·파괴 | `bg-red-600 text-white` |

| size | 높이 | 용도 |
|------|------|------|
| `sm` | `h-8` | 테이블 행, 조밀한 툴바 |
| `md` | `h-9` | **기본** |
| `lg` | `h-11` | 폼 제출, 모달 CTA |

크기는 **높이로 고정**한다. `px/py` 조합으로 높이를 만들지 않는다 — 나란히 놓았을 때 밑변이 어긋난다.
`p-2 rounded-lg` + 아이콘 하나짜리 **아이콘 전용 토글 버튼은 이 컴포넌트 대상이 아니다**.

**MaterialIcon 함정** — `iconMarkup` 맵에 없는 `name`은 조용히 `help_outline`(`?`)로 폴백한다. 콘솔 경고도 없다. 신규 아이콘은 반드시 [`materialIconPaths.ts`](src/components/common/materialIconPaths.ts)에 path를 추가한다. 크기는 `text-*` 스케일로 준다(`text-4xl` = EmptyState 아이콘, `text-3xl` = 인라인 스피너).

### 4.2 `components/charts/` — 차트 스펙

**팩토리를 스프레드해서 쓴다. 개별 차트에서 선 굵기·그리드·축을 다시 정의하지 않는다.**

```tsx
const theme = getChartTheme();
<CartesianGrid {...gridProps(theme)} />
<XAxis {...xAxisProps(theme)} />
<YAxis {...yAxisProps(theme)} />
<Area {...areaProps(color)} />
<Line {...lineProps(color)} />
```

| export | 역할 |
|--------|------|
| `getChartTheme()` | CSS var를 읽어 `{gridColor, tickColor, tooltipBg, tooltipBorder, primaryColor}` |
| `gridProps` `xAxisProps` `yAxisProps` `tooltipCursor` | 축·그리드 |
| `lineProps(color)` `areaProps(color)` | 시리즈 |
| `SERIES_HEX` `getSeriesPalette` | 색 |
| `chartCardClass` | 차트 카드 컨테이너 |
| `getYAxisMax` `formatAxisValue` `formatMetricValue` | 스케일·포맷 |
| `ChartTooltip` `ChartStatsLegend` `ChartLegend` | 툴팁·범례 |

**룩 (Grafana풍, 2026-07-10 확정)**
- 1.5px `monotoneX` 라인, 둥근 캡, dot 없음
- 라인 아래 **평면 10% 채움** — 그라디언트 아님
- 수평 실선 그리드만 (`vertical: false`, opacity 0.55)
- semibold 11px 눈금, 축선·틱선 없음
- **애니메이션 없음** (`isAnimationActive: false`)
- activeDot = r4 + 흰 테두리 2px

**범례**
- 트렌드 차트 → `ChartStatsLegend` (시리즈별 Last/Min/Max/Avg 테이블)
- 바 차트 헤더 → `ChartLegend` (칩)
- recharts `<Legend>` **사용 금지**

### 4.3 `components/layout/`

`MainLayout`(셸) · `Sidebar`(lg+) · `Header`(모바일) · `BottomNavMobile` · `Footer` · `SidePanel`(컨텍스트 기반 우측 슬라이드) · `CommandPalette`(⌘K/Ctrl+K) · `DemoBanner`

### 4.4 기타

`components/error/`(ErrorBoundary·ErrorFallback) · `components/feedback/NetworkStatusBanner` · `components/skeleton/Skeleton` · `components/icons/`(ChannelIcons·SidebarIcons)

---

## 5. 상태 표현 문법

### 5.1 배지 — `StatusBadge`

```tsx
<StatusBadge healthy={service.healthy} />
```

```
text-2xs font-bold px-1.5 py-0.5 rounded border
text-status-{role}  bg-status-{role}/10  border-status-{role}/20
```

`healthy` boolean 하나만 받는다. 실제로 렌더되는 상태가 정상/장애 둘뿐이라 그 이상은 지원하지 않는다 — 3단계 이상이 필요해지면 그때 union으로 넓힌다.

**틴트 배경 + 같은 색 보더 + 진한 텍스트** 3종 세트가 배지 문법이다. 커스텀 배지가 필요해도 이 비율(`/10` 배경, `/20` 보더)을 유지한다. 4개 role 전부 양쪽 테마에서 AA를 넘는 것이 검증돼 있다(4.78~9.31).

Tailwind v4는 `/10` 같은 투명도 수식자를 `oklab()` `color-mix`로 컴파일한다. 대비를 직접 잴 때 `getComputedStyle().backgroundColor`를 rgb로 가정하면 값이 어긋나니, 소스 hex와 알파로 합성해 계산할 것.

### 5.2 상태 점

```
h-2.5 w-2.5 rounded-full bg-status-{role}
```
목록 안의 조밀한 자리는 `h-1.5 w-1.5`. 진행 중인 장애는 `animate-pulse`를 더한다(`prefers-reduced-motion`에서 전역 규칙이 정지시킨다).

**점이 유일한 정보원이면 이름을 준다** — 점 옆에 같은 뜻의 텍스트(배지·라벨)가 없으면 색만으로 상태를 전달하는 것이라 WCAG 1.4.1 위반이다:
```tsx
<span role="img" aria-label={healthy ? t('정상') : t('장애')} className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
```
인접 텍스트가 이미 상태를 말하고 있으면(장애 배너, 온라인/오프라인 라벨) 점은 장식이므로 그대로 둔다.

### 5.3 색을 싣는 곳

**데이터와 액션에만 색을 싣는다. 컨테이너는 중립으로 둔다.**
배지 · 아이콘 · 텍스트 · 게이지 채움 · 차트 시리즈 = 색 OK.
카드 배경 · 카드 보더 · 섹션 헤더 = 항상 중립.

---

## 6. 폼

| 컴포넌트 | props | 용도 |
|----------|-------|------|
| **`Input`** | `invalid?` `warn?` `mono?` + 네이티브 | 폼 입력 전부 |
| **`Select`** | 네이티브만 | 폼 셀렉트 (Input과 같은 셸) |
| **`SearchInput`** | `wrapperClassName?` + 네이티브 | 아이콘 붙은 검색창 |

**클래스를 직접 쓰지 않는다.** Button과 같은 규칙이다.

셸은 `Input.tsx`가 `FIELD_SHELL`·`FIELD_HEIGHT`로 export한다 — `Select`와 텍스트영역이 같은 상수를 쓴다. **높이는 `h-10`으로 고정**한다(Button과 같은 이유, `px/py` 조합 금지): `<select>`는 `line-height`를 `normal`로 강제해 `leading-*`이 먹지 않으므로, py로 맞추면 input보다 2px 낮게 렌더된다. 높이가 자유로워야 하는 텍스트영역만 `FIELD_SHELL`에 자기 `py`를 덧붙인다.

**상태 표현**
- `invalid` — 검증 실패. 붉은 보더 + `aria-invalid`. 메시지는 필드 아래 `text-xs text-red-500`
- `warn` — 제출은 막지 않는 주의(예: 원격에서 안 통할 주소). 앰버 보더

보더 색은 컴포넌트 내부에서 결정한다. `className`으로 넘기면 base의 `border-ui-border`와 **특이도가 같아** 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.

**포커스 링** — `index.css`의 전역 `:focus-visible { outline: 2px solid var(--color-primary) }`가 처리한다. `focus:outline-none` + 개별 `focus:ring-*`으로 덮어쓰지 않는다.

> 대비를 스크립트로 잴 때 주의: Tailwind v4의 `transition-colors`는 **`outline-color`를 포함**한다. `.focus()` 직후 `getComputedStyle`을 읽으면 트랜지션 첫 프레임(`currentColor`)이 잡혀 링이 검게 보인다. `transitionProperty='none'`으로 끄고 재야 실제 값이 나온다.

**툴바 필터 셀렉트는 `Select` 대상이 아니다.** 폼 필드와 크기·목적이 다르고 5곳이 이미 동일하다:
```
px-2 py-1.5 rounded-md border border-ui-border bg-bg-surface
text-sm font-medium text-text-secondary cursor-pointer
```

**텍스트영역**은 아직 공용 컴포넌트가 없다 — `AlertRuleForm`의 `textareaCls` 하나를 2곳이 공유한다. 세 번째 사용처가 생기면 `Textarea`로 뽑는다.

---

## 7. 오버레이

| 종류 | 용도 | 구현 |
|------|------|------|
| **ConfirmDialog** | 파괴적 확인 | `components/common/ConfirmDialog` |
| **모달** | 짧은 단일 작업 (API 키, 서비스 추가) | `features/services/*Modal` |
| **사이드 패널** | 긴 폼·상세 (알림 규칙, 트레이스) | `FormSidePanel` / `SidePanel` / `TracePanel` |

**공통 규약** — z-index `z-50`(SidePanel만 `z-40`), 배경 클릭 닫기.

**ESC 닫기는 [`useOverlay(open, onClose)`](src/hooks/useOverlay.ts)를 쓴다.** 직접 `keydown` 리스너를 달지 않는다 — 이전엔 4곳이 같은 effect를 복사해 두고 2곳은 아예 빠져 있었다.

**배경(scrim)은 상수를 쓴다.** 같은 파일이 export한다.

| 상수 | 값 | 쓰는 곳 |
|------|-----|--------|
| `SCRIM_MODAL` | `bg-slate-900/60 backdrop-blur-sm` | 모달·다이얼로그 |
| `SCRIM_PANEL` | `bg-slate-900/40 backdrop-blur-sm` | 사이드패널·팔레트 |
| `SCRIM_MODAL_DIALOG` | 위와 같은 값의 `backdrop:` 형태 | 네이티브 `<dialog>`의 `::backdrop` |

**농도가 두 단인 이유** — 모달은 배경과 무관한 작업이라 맥락을 끊고, 사이드패널은 배경 목록을 보면서 상세를 확인하는 맥락이라 옅게 둔다.

**Material Design 3(32%)이나 shadcn(80%)과 다른 이유는 blur를 같이 걸기 때문이다.** scrim만 쓰는 시스템은 배경 판독을 막으려 60~80%가 필요하지만, `backdrop-blur`가 이미 판독을 막으므로 scrim은 명도만 낮추면 된다 — 그 구간이 30~40%다.

`bg-black`이 아니라 `slate-900`인 것도 의도다. 다크 배경(`#0d1117`) 위에서 순수 검정은 대비가 생기지 않아 구멍처럼 보이고, 앱 팔레트가 slate 계열이라 정합도 맞다.

`SCRIM_MODAL_DIALOG`가 따로 있는 이유는 `backdrop:` 접두가 유틸리티마다 필요한데 Tailwind JIT가 런타임 조합을 못 읽기 때문이다. **값을 바꿀 때 둘을 함께 고칠 것.**

스크롤 잠금은 넣지 않았다. 이 앱은 `body`가 아니라 `MainLayout` 내부 컨테이너가 스크롤하는 구조라 `body` overflow를 잠가도 효과가 없고, 브라우저에서 실제 스크롤 누출이 재현되지 않았다. 누출이 확인되면 그때 잠글 대상을 정한다.

---

## 8. 접근성

- **전역 포커스 링** `:focus-visible` 2px primary + 2px offset. 개별 컴포넌트에서 재정의 금지
- **Skip link** `MainLayout`의 `#main-content` 스킵 링크
- **아이콘 전용 버튼**은 `aria-label` 필수 — `MaterialIcon`이 `aria-hidden="true"`라 아이콘만으로는 스크린리더에 아무것도 읽히지 않는다. `title`은 툴팁일 뿐 대체 텍스트가 아니므로 **둘 다** 준다. `<span className="sr-only">`로 라벨을 넣는 것도 동등하게 유효하다
- **색만으로 정보를 전달하지 않는다** (WCAG 1.4.1) — 상태 점은 §5.2, 4개 초과 차트 시리즈는 §1.6 참조
- **클릭되는 것은 키보드로도 되어야 한다** — `<div onClick>`은 탭으로 도달할 수 없다. 네이티브 `<button>`/`<a>`로 바꿀 수 없는 자리(카드 안에 버튼이 중첩)는 [`activatable()`](src/utils/a11y.ts). **`<tr>`·`<th>`에는 쓰지 말 것** — `role="button"`이 테이블 시맨틱을 덮어써 행·열 관계를 잃는다. 정렬 헤더는 `<th>` 안에 `<button>` + `aria-sort`, 선택 가능한 행은 `tabIndex` + 키핸들러만.
- **폼 컨트롤에는 접근 가능한 이름을 준다** — 라벨이 붙는 자리는 `<label htmlFor>`, 툴바 필터 셀렉트처럼 시각 라벨이 없는 자리는 `aria-label`. `Field`는 `htmlFor`를 줄 때만 `<label>`로 렌더한다(§6) — 자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버리므로 `<span>` 캡션 + 그룹에 `role="group"`이 맞다.
- **렌더 중 부작용 금지** — 렌더 본문에서 `navigate()`를 부르거나 ref를 갱신하지 않는다. React가 렌더를 버릴 수 있어 커밋되지 않은 상태가 샌다. 리다이렉트는 `<Navigate>`, ref 갱신은 effect에서.
- **Toggle** `role="switch"` + `aria-checked`
- **`prefers-reduced-motion`** 전역 처리됨 (모든 애니메이션 0.01ms)
- **대비** `text-text-dim`의 다크 값이 `#6b7280`인 것은 WCAG AA 충족을 위한 조정 결과다. 더 어둡게 내리지 않는다

---

## 9. 금지 사항

사용자 피드백에서 확정된 규칙이다. 근거까지 함께 적는다.

1. **카드 좌측 상태 보더 금지** — warn/crit 3px 세로 컬러 라인. *"AI 생성 디자인 같다."* 상태는 배지·아이콘·텍스트 색으로만.
2. **danger zone 스타일 금지** — 붉은 카드 보더, 붉은 섹션 제목, 앰버 경고 박스. 파괴적 액션은 **중립 카드 + `text-xs font-semibold text-red-600` 텍스트 링크**. 주의문은 앰버 박스 대신 muted 본문.
3. **파스텔 틴트 박스 금지** — `bg-emerald-50` / `bg-amber-50` / `bg-red-50` 계열 공지 박스. `bg-ui-hover-soft + border-ui-border` + 상태색 아이콘 악센트로 대체. (배지·게이지 채움·hover는 데이터 시맨틱이라 예외)
4. **`dark:` 이중 작성 금지** (§1.1) — `text-slate-500 dark:text-text-muted-dark` → `text-text-muted`
5. **상태색 primitive 직접 사용 금지** — `text-emerald-600 dark:text-emerald-400` → `text-status-healthy` (§1.4). 대비·색각 조정이 index.css 한 곳에서 끝나야 한다
6. **`text-[Npx]` 임의값 금지** (§2.2) — 스케일 토큰만
7. **버튼 클래스 직접 작성 금지** — `<button className="px-4 py-2 bg-primary …">` → `<Button>` (§4.1). 높이·radius·굵기가 화면마다 어긋나는 것을 막는다
8. **`window.confirm()` 금지** → `ConfirmDialog`
9. **recharts `<Legend>` 금지** → `ChartStatsLegend` / `ChartLegend`
10. **차트 시리즈 색 하드코딩 금지** → `SERIES_HEX`
11. **텍스트 위계에 5단째(더 옅은 등급) 추가 금지** — `dim`이 AA 하한선이다 (§1.3)

1~3은 같은 취향의 계열이다: **색은 데이터와 액션에만, 컨테이너는 중립.**

---

## 10. 알려진 부채

2026-07-26 전수 스캔(`src/**/*.tsx` 76개). 규약 대비 이탈 목록.

### A. 토큰 규약 이탈

| 항목 | 건수 | 조치 |
|------|------|------|
| 시맨틱 토큰 + `dark:` 짝 | 10 | `dark:` 제거 |
| `*-dark` 접미 토큰 직접 사용 | 37 | 사이트별 확인 후 치환 |
| `bg-white` / `slate-*` 하드코딩 | 109 | 상태색 목적이 아니면 토큰으로 |

**대부분은 색 문제가 아니라 다른 문제의 증상이었다.** 2026-07-27에 225건을 분류해 다섯 덩어리를 걷어냈다.

| 원인 | 해소 |
|------|------|
| 토큰이 이미 전환하는데 `dark:` 짝을 덧붙임 | 5 |
| `FormStep`·`Field` 중복 정의 | 6 (64줄) |
| 이름 없는 "떠오른 표면" 역할 | 8 → `ui-raised` 신설 |
| 카드 정본과 등가인 하드코딩 | 3 |
| 헤더 스트립 = `ui-hover-soft`의 투명도 변형 | 7 |
| 크롬 표면이 Sidebar와 불일치 | 4 → `bg-bg-surface`로 정합 |

**남은 것은 1회성이고 시각 변화가 따른다.** 반복되는 역할은 다 걷어냈으므로, 이제부터는 한 곳씩 열어 "이 색이 의도인가"를 판단해야 한다 — 자동화할 수 있는 구간은 끝났다.

새 이탈을 발견하면 색을 치환하기 전에 **역할에 이름이 없는지, 컴포넌트가 중복인지**부터 의심할 것.
| emerald/amber/red/sky primitive | 214 | **대부분 정상** — 아래 경계 참조 |

**기계적 일괄 치환이 안 되는 이유** — 라이트/다크 클래스가 문자열 안에서 인접해 있지 않고(`bg-white … dark:bg-ui-active-dark`), 값이 토큰과 정확히 같지도 않다. 예를 들어 `bg-white dark:bg-ui-active-dark`는 라이트 `#fff`·다크 `#374151`인데 이런 토큰 쌍은 없다. 토큰과 값이 정확히 일치하는 쌍(6파일)은 2026-07-26에 이미 치환했고, 남은 것은 **사이트별로 의도를 확인해야** 한다.

`ChartElements.tsx:77`은 **공용 컴포넌트인데도** `dark:` 이탈 상태라 우선순위가 높다.

**상태색 primitive 214건은 일괄 치환 대상이 아니다.** 2026-07-26에 374건을 전수 분류해 상태에 해당하는 160건만 `status-*` 토큰으로 옮겼고, 남은 214건은 의도적으로 primitive다. 경계:

| 축 | 예 | 토큰 |
|----|-----|------|
| **대상의 건강 상태** | 서비스 정상/장애, 체크 결과, HTTP 2xx/4xx/5xx, 게이지 임계, 알림 전송 성공/실패, 진단 ok/issue | **`status-*` ✓** |
| 액션 의미 | `danger` 버튼, 삭제 링크, 복사 완료 피드백 | primitive |
| 카테고리 분류 | HTTP 메서드, span kind(SERVER/CLIENT), 이벤트 타입 | primitive |
| 별도 축 | 로그 레벨(§1.5), 알림 severity(critical/warning/info) | primitive |
| 폼 | 필수 표시 `*`, 검증 경고, 로그인 에러 | primitive |
| 3rd-party 재현 | `ChannelForm`의 Slack/Discord/Telegram 미리보기 | 리터럴 hex |

새 코드에서 판단이 서지 않으면 **"이 색이 사라지면 사용자가 대상의 건강을 오판하는가?"** 로 가른다. 그렇다면 `status-*`다.

### C. `Field` htmlFor 배선 — 완료 (2026-08-05)

`AlertRuleForm`의 단일 입력 Field들(규칙명·연산자·임계값·지속시간·쿨다운 등)까지 `htmlFor` + `id` 배선을 마쳤다. raw Field 라벨 잔여 0건.

버튼 그리드 Field(카테고리·프리셋·심각도)는 `<label>` 대상이 아니다. 그룹 자체에 `role="group"` + `aria-label`을 다는 것이 맞고, 이건 `Field`가 아니라 호출부 마크업 변경이라 별도 판단이 필요하다.

### 배지 크기 — 정리하지 않기로 함

읽기 전용 배지가 `text-2xs`(상태칩·테이블)와 `text-xs`(로그 레벨·span kind) 두 계열이다. 크기 차이가 밀도(테이블 셀 vs 목록 스캔) 때문이라 강제로 맞추면 로그 레벨 배지가 작아지는 손해만 확실하다.

> 이전에 "같은 severity 배지가 폼과 테이블에서 등급이 다르다"고 적었던 것은 **오진이었다.** 폼 쪽은 배지가 아니라 알림이 어떻게 보일지 보여주는 미리보기 카드(틴트 배경 + 점 + 보더)로, 목적과 형태가 다른 물건이다. 실제 중복이던 `SEVERITY_BADGE` 상수는 `SeverityBadge` 컴포넌트로 통합했다.

### 해결됨 (2026-08-05) — 기술 감사 후속

- ~~토스트 아이콘 색이 제거된 토큰(`--color-success`/`--color-error`)을 읽어 하드코딩 hex로 폴백~~ → `var(--color-status-healthy/error)`로 교체(테마 반응). `main.tsx`의 죽은 `getComputedStyle` 스냅샷 3줄 제거
- ~~모달 컨테이너 3곳이 `rounded-2xl`(§3.2 위반)~~ → `rounded-xl` (`ApiKeyModal`·`AddServiceModal`·`ConfirmDialog`)
- ~~알림 전송 성공/실패 색이 primitive + `dark:` 짝(§10.B 건강 축 오분류)~~ → `AlertsMobileView`를 `text-status-healthy/error`로 토큰화
- ~~카드·상세 헤더 아이콘 버튼 터치 타깃 28~36px~~ → `h-10 w-10`(40px)로 확대, 컨테이너 gap 조정 (`ServiceGridPage`·`PendingServiceCard`·`ProjectDetailPage`). WCAG 2.5.8 AA(24px)는 이전에도 충족, 밀도 유지 위해 44px 대신 40px
- ~~전역 reduced-motion `0.01ms` 킬이 `DemoBanner` 마퀴를 잘라 안내가 잘림~~ → `motion-reduce:`에서 마퀴 정지 + 줄바꿈 + 중복 사본 숨김

### 해결됨 (2026-07-26)

- ~~색 접근성 — `text-dim` 라이트 2.56, 상태 배지 3종, 차트 시리즈 3색, 로그 레벨 3색이 WCAG 미달~~ → 전부 AA/1.4.11 통과. 브라우저에서 8/8 실측 확인
- ~~상태색 시맨틱 레이어 부재~~ → `--color-status-*` 4종 신설. 374건 전수 분류 후 상태 표현 **160건**을 20개 파일에서 토큰으로 이관 (`dark:` 짝 동반 제거)
- ~~죽은 토큰 5종 (`primary-hover`, `chart-surface`, `chart-hover`, `text-chart-dim`, `success`/`warning`/`error`)~~ → 제거
- ~~`chart-bg`와 `bg-surface-dark`가 대비 1.02로 중복~~ → `bg-bg-surface`로 통합 (`dark:` 위반 9건 동반 해소)
- ~~`CLAUDE.md`와 내용 중복~~ → 분리 완료, CLAUDE.md는 포인터만
- ~~`bg-bg-base/35` — 존재하지 않는 토큰이라 배경이 투명하게 렌더~~ → `bg-ui-hover-soft`
- ~~폼 프리미티브 부재 (입력 클래스 10종, 포커스 링 5종, radius 3종, 세로패딩 5종)~~ → `Input`/`Select`/`SearchInput` 신설, 27개 호출부 이관. raw 폼 `<input>` 0건
- ~~아이콘 전용 버튼에 접근 가능한 이름 없음~~ → **20건** 전부 `aria-label` 부여(14건은 기존 `title` 미러링, 6건은 신규). 잔여 0건
- ~~색만으로 상태를 전달하는 점~~ → 인접 텍스트가 없는 **4곳**에 `role="img" aria-label`. 나머지는 텍스트가 이미 상태를 말하므로 장식으로 유지
- ~~죽은 CSS `.status-pulse` + `@keyframes pulse-ring`~~ → 제거(사용처 0곳). §5.2를 실제 패턴으로 정정
- ~~오버레이 4곳이 ESC 핸들러를 복사, 2곳은 ESC 없음~~ → `useOverlay` 훅으로 통합, 6곳 전부 ESC 동작(브라우저 검증)
- ~~헤딩 등급 흔들림~~ → h1/h3 이탈 8건 정리. §2.3을 **컨테이너별 등급표**로 정정 — h2가 카드/모달/섹션에서 다른 것은 이탈이 아니라 정당한 차이였다
- ~~`MainLayout` 주석이 `slate-50 canvas`라고 하나 실제는 `bg-bg-main`~~ → 주석 정정
- ~~렌더 중 부작용 2건 (useDataFetch의 ref 갱신, LoginPage의 navigate)~~ → effect로 이동 / `<Navigate>`로 교체
- ~~카드·행이 `<div onClick>`이라 키보드로 진입 불가~~ → `activatable()` 4곳. Enter/Space 진입 실측
- ~~필터 셀렉트 5개·토글 1개에 접근 가능한 이름 없음~~ → `aria-label`, 토글은 `role="switch"`
- ~~테이블 정렬·행 선택이 키보드로 불가~~ → `<th>` 안 `<button>` + `aria-sort`, 행은 `tabIndex`+키핸들러
- ~~차트 시리즈 4개 초과 시 색만으로 구분~~ → `getSeriesDash(i)` 신설, `AgentServiceMetricsTab`에 적용. 앞 3슬롯은 실선 유지라 1~3시리즈 차트의 모습은 그대로
- ~~`SEVERITY_BADGE` 상수가 두 파일에 md5 동일하게 중복~~ → `SeverityBadge` 컴포넌트로 통합
- ~~오버레이 배경이 6곳 제각각(black/40·slate-900/60·slate-900/40·없음)~~ → `SCRIM_MODAL`/`SCRIM_PANEL` 2역할로 통일. TracePanel은 scrim이 아예 없어 신규 추가
- ~~공용 `StatusBadge`가 미사용이고 `AgentHealthCheckDetailView`의 로컬 중복이 렌더됨~~ → 실제 쓰이던 구현을 공용으로 승격(56→26줄), 로컬 삭제. 쓰이지 않던 10상태 매핑과 그 전용 i18n 키 9개×2언어도 함께 제거

### 권장 순서

1. **A** — 사이트별 확인이 필요해 자동화가 안 된다. 파일 단위로 나눠 처리
