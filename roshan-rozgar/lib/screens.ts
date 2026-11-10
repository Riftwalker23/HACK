/**
 * The 18 boards, in the canvas's own order. Used by the stage chrome to jump
 * between screens; the in-screen links are the prototype flow from the design.
 */

export type Board = { href: string; short: string; title: string; group: 'worker' | 'customer' | 'system' };

export const BOARDS: Board[] = [
  { href: '/', short: 'W0', title: 'Splash / loading', group: 'worker' },
  { href: '/start', short: 'W1', title: 'Role choice', group: 'worker' },
  { href: '/worker/voice', short: 'W2', title: 'Voice onboarding 1/4', group: 'worker' },
  { href: '/worker/trade', short: 'W3', title: 'Confirm trade 2/4', group: 'worker' },
  { href: '/worker/skills', short: 'W4', title: 'Skills 3/4', group: 'worker' },
  { href: '/worker/proof', short: 'W5', title: 'Proof photos 4/4', group: 'worker' },
  { href: '/worker/home', short: 'W6', title: 'Worker home', group: 'worker' },
  { href: '/worker/request', short: 'W7', title: 'Incoming request', group: 'worker' },
  { href: '/worker/chat', short: 'W8', title: 'Job chat + price', group: 'worker' },
  { href: '/worker/done', short: 'W9', title: 'Job complete', group: 'worker' },
  { href: '/customer/describe', short: 'C1', title: 'Describe the problem', group: 'customer' },
  { href: '/customer/results', short: 'C2', title: 'Results', group: 'customer' },
  { href: '/customer/profile', short: 'C3', title: 'Worker profile', group: 'customer' },
  { href: '/customer/booking', short: 'C4', title: 'Booking confirm', group: 'customer' },
  { href: '/customer/live', short: 'C5', title: 'Live job status', group: 'customer' },
  { href: '/customer/review', short: 'C6', title: 'Review', group: 'customer' },
  { href: '/customer/states', short: 'C7', title: 'Empty / error states', group: 'customer' },
  { href: '/system', short: 'DS', title: 'Design system', group: 'system' },
];
