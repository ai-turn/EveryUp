// 서비스·체크의 정상/장애 배지.
//
// 이전 구현은 10개 상태를 문자열 key로 매핑하고 react-i18next `common.*`를 썼지만
// 렌더되는 상태는 정상/장애 둘뿐이었고, 그 키 9개는 이 파일 밖에서 쓰인 적이 없다.
// 앱이 Tolgee(source-as-key)로 이전 중이라 i18n 스택도 혼자 어긋나 있었다.
// 실제로 화면을 그리던 구현을 그대로 승격했다.
//
// 배지 문법은 DESIGN.md §5.1 — 틴트 배경 + 같은 색 보더 + 진한 텍스트.
// 색은 status 시맨틱 토큰이 담당하므로 `dark:` 짝이 필요 없다.


export function StatusBadge({ healthy }: { healthy: boolean }) {

  return (
    <span
      className={`text-2xs font-bold px-1.5 py-0.5 rounded border ${
        healthy
          ? 'text-status-healthy bg-status-healthy/10 border-status-healthy/20'
          : 'text-status-error bg-status-error/10 border-status-error/20'
      }`}
    >
      {healthy ? '정상' : '장애'}
    </span>
  );
}
