import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { OfficeScene } from './scene/OfficeScene';
import { RENDER } from './scene/RenderController';
import { useOffice } from './store/useOffice';
import { TopBar } from './ui/TopBar';
import { Dashboard } from './ui/Dashboard';
import { CommsPanel } from './ui/CommsPanel';
import { AgentPanel } from './ui/AgentPanel';
import { ChatWindow } from './ui/ChatWindow';
import { AssignModal, ManagerModal, MeetingModal, WhiteboardModal } from './ui/Modals';
import { LifeHud, PauseMenu } from './ui/LifeHud';

export default function App() {
  const mode = useOffice((s) => s.mode);
  const selectedId = useOffice((s) => s.selectedId);
  const chatWith = useOffice((s) => s.chatWith);
  const modal = useOffice((s) => s.modal);
  const menuOpen = useOffice((s) => s.menuOpen);
  const dashboardOpen = useOffice((s) => s.dashboardOpen);
  const shot = useOffice((s) => s.shot);

  // While a camera shot plays (for recording), hide every overlay and the 3D labels; Esc stops it.
  useEffect(() => {
    const labels = document.getElementById('label-layer');
    if (labels) labels.style.visibility = shot ? 'hidden' : '';
    if (!shot) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useOffice.getState().playShot(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot]);

  // Esc closes chat / modals in Overview Mode too (Virtual Life handles its own keys).
  useEffect(() => {
    if (mode !== 'overview') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useOffice.getState();
      if (s.chatWith) s.openChat(null);
      else if (s.modal) s.openModal(null);
      else if (s.selectedId) s.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // Render mode (video frames for ep7): just the 3D scene, or with ui=life the walk-in HUD and chat as well.
  if (RENDER) {
    if (RENDER.ui !== 'life') return <OfficeScene />;
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-0"><OfficeScene /></div>
        {mode === 'life' && <LifeHud />}
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2">
          <AnimatePresence>{chatWith && <ChatWindow key={chatWith} id={chatWith} />}</AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <OfficeScene />
      </div>

      <div className={`pointer-events-none absolute inset-0 z-10 flex flex-col ${shot ? 'invisible' : ''}`}>
        <TopBar />
        <div className="flex min-h-0 flex-1 gap-3 px-4 pb-3 pt-3">
          {dashboardOpen && <Dashboard />}
          <div className="flex-1" />
          <div className="pointer-events-auto flex min-h-0 w-[360px] flex-col gap-2">
            <AnimatePresence mode="wait">
              {selectedId ? <AgentPanel key={selectedId} id={selectedId} /> : null}
            </AnimatePresence>
            {!selectedId && mode === 'overview' && <CommsPanel />}
          </div>
        </div>
      </div>

      {mode === 'life' && <LifeHud />}

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2">
        <AnimatePresence>{chatWith && <ChatWindow key={chatWith} id={chatWith} />}</AnimatePresence>
      </div>

      <AnimatePresence>
        {modal === 'whiteboard' && <WhiteboardModal key="wb" />}
        {modal === 'meeting' && <MeetingModal key="mt" />}
        {modal === 'assign' && <AssignModal key="as" />}
        {modal === 'manager' && <ManagerModal key="mg" />}
        {menuOpen && mode === 'life' && !chatWith && !modal && <PauseMenu key="pm" />}
      </AnimatePresence>
    </div>
  );
}
