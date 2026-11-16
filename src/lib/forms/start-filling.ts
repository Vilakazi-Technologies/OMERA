/** Voice or typed confirmation after the document briefing. */
export function isStartFillingUtterance(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /^(yes|yeah|yep|ok|okay|sure|continue|begin|go|start( filling)?|fill( in)?( the)?( form)?|let'?s (start|go|fill)|do it)([.!]*)?$/.test(
    t,
  );
}
