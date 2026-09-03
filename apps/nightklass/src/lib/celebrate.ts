import confetti from 'canvas-confetti'

/** Fires a short, tasteful confetti burst — used for quiz wins, streak milestones, and plan completion. */
export function celebrate() {
  const colors = ['#2563eb', '#06b6d4', '#84cc16', '#f97316']
  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors,
    disableForReducedMotion: true,
  })
}
