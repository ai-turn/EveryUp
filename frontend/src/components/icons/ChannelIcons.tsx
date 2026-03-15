import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Telegram — 종이비행기 실루엣.
 * 공식 로고의 삼각형 종이비행기를 단순화한 형태.
 */
export function IconTelegram({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M9.04 15.6l-.36 4.68c.52 0 .74-.22 1.02-.48l2.44-2.32 5.06 3.68c.92.52 1.58.24 1.82-.86l3.3-15.4h.02c.28-1.32-.48-1.84-1.36-1.52L2.7 10.62c-1.28.5-1.26 1.22-.22 1.54l4.98 1.54 11.56-7.2c.54-.36 1.04-.16.64.2L9.04 15.6z" />
    </svg>
  );
}

/**
 * Discord — 게임패드 얼굴 실루엣.
 * 공식 Clyde 로고를 단순화: 둥근 머리 + 두 눈 + 양쪽 귀(헤드셋) 형태.
 */
export function IconDiscord({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.36-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z" />
    </svg>
  );
}

/**
 * Slack — 풍차 형태의 공식 로고.
 * 4개의 둥근 알약(pill)이 중심을 기준으로 풍차처럼 배치된 형태.
 * 각 pill에 동그란 점이 붙어 Slack 특유의 실루엣을 형성.
 */
export function IconSlack({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      {/* 좌상 — 세로 pill + 점 */}
      <rect x="3.5" y="7" width="3" height="7" rx="1.5" />
      <rect x="6.5" y="3.5" width="3" height="3" rx="1.5" />
      {/* 우상 — 가로 pill + 점 */}
      <rect x="14" y="3.5" width="7" height="3" rx="1.5" />
      <rect x="17.5" y="6.5" width="3" height="3" rx="1.5" />
      {/* 우하 — 세로 pill + 점 */}
      <rect x="17.5" y="10" width="3" height="7" rx="1.5" />
      <rect x="14.5" y="17.5" width="3" height="3" rx="1.5" />
      {/* 좌하 — 가로 pill + 점 */}
      <rect x="3" y="17.5" width="7" height="3" rx="1.5" />
      <rect x="3.5" y="14.5" width="3" height="3" rx="1.5" />
      {/* 중앙 교차 */}
      <rect x="6.5" y="10" width="4.5" height="3" rx="1.5" />
      <rect x="13" y="10" width="4.5" height="3" rx="1.5" />
      <rect x="9.5" y="6.5" width="3" height="4.5" rx="1.5" />
      <rect x="11.5" y="13" width="3" height="4.5" rx="1.5" />
    </svg>
  );
}

/**
 * 채널 타입에 맞는 아이콘 컴포넌트를 반환하는 헬퍼.
 */
export function ChannelIcon({ type, size = 20, className }: { type: string; size?: number; className?: string }) {
  switch (type) {
    case 'telegram':
      return <IconTelegram size={size} className={className} />;
    case 'discord':
      return <IconDiscord size={size} className={className} />;
    case 'slack':
      return <IconSlack size={size} className={className} />;
    default:
      return <IconDiscord size={size} className={className} />;
  }
}
