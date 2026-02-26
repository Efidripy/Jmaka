// -------- Split3 tool (3 panels) --------

function getSplit3PanelRect(which) {
  const el = which === 'a' ? split3ThirdA : (which === 'b' ? split3ThirdB : split3ThirdC);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function split3GetPointerPosInPanel(which, e) {
  const r = getSplit3PanelRect(which);
  if (!r) return { x: 0, y: 0 };
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function split3BringToFront(which) {
  if (!split3ItemA || !split3ItemB || !split3ItemC) return;
  const z = { a: 1, b: 1, c: 1 };
  z[which] = 3;
  // keep deterministic stacking for others
  if (which === 'a') { z.b = 2; z.c = 1; }
  if (which === 'b') { z.a = 1; z.c = 2; }
  if (which === 'c') { z.a = 2; z.b = 1; }
  split3ItemA.style.zIndex = String(z.a);
  split3ItemB.style.zIndex = String(z.b);
  split3ItemC.style.zIndex = String(z.c);
}

function split3GetPanelSize(which) {
  const r = getSplit3PanelRect(which);
  if (!r) return { w: 0, h: 0 };
  return { w: r.width, h: r.height };
}

const split3State = {
  open: false,
  history: [],
  action: null,
  pickTarget: 'a',
  a: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 },
  b: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 },
  c: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 }
};

