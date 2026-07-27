import { useEffect } from 'react';

// 오버레이(모달·사이드패널·팔레트)의 ESC 닫기.
// 이전엔 SidePanel/FormSidePanel/TracePanel/CommandPalette가 각자 같은 effect를 복사해 두고
// ApiKeyModal·InstrumentationOverrideModal은 아예 빠져 있었다.
//
// ponytail: 스크롤 잠금은 넣지 않았다. 이 앱은 body가 아니라 MainLayout 내부 컨테이너가
// 스크롤하는 구조라 body overflow를 잠가도 효과가 없고, 실제 스크롤 누출은 재현되지 않았다.
// 누출이 확인되면 그때 잠글 대상(내부 스크롤러)을 정해서 추가할 것.
export function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}
