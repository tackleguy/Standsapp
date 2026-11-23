// Public demo Sections that anyone can browse and join with a code.
import type { Fan } from '../types';
import { FANS, ORIGINAL_FAN_COUNT } from './fans';

export interface DemoSection {
  id: string;
  name: string;
  sportId: string;
  inviteCode: string;
  ownerId: string;
  isPublic: true;
  description: string;
  memberIds: string[];
  createdAt: number;
}

function members(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => FANS[(start + i * 7) % ORIGINAL_FAN_COUNT].id);
}

const CREATED = Date.parse('2026-09-01T12:00:00Z');

export const DEMO_SECTIONS: DemoSection[] = [
  { id: 'sec_paddock', name: 'Night Owl Paddock', sportId: 'f1', inviteCode: '7F1A0C2E', ownerId: FANS[3].id, isPublic: true,
    description: 'Late-night race watchers. Strategy nerds welcome.', memberIds: members(3, 24), createdAt: CREATED },
  { id: 'sec_silly', name: 'Silly Point Society', sportId: 'cricket', inviteCode: 'C51EE7A1', ownerId: FANS[11].id, isPublic: true,
    description: 'Every ball, every over, every run chase.', memberIds: members(11, 31), createdAt: CREATED },
  { id: 'sec_frontrow', name: 'Front Row Union', sportId: 'rugby_union', inviteCode: 'F00DBA11', ownerId: FANS[17].id, isPublic: true,
    description: 'Scrums, mauls, and the occasional drop goal.', memberIds: members(17, 19), createdAt: CREATED },
  { id: 'sec_terrace', name: 'Terrace Talk', sportId: 'soccer', inviteCode: 'BEEF60A1', ownerId: FANS[25].id, isPublic: true,
    description: 'The loudest Section in the stands.', memberIds: members(25, 38), createdAt: CREATED },
  { id: 'sec_fastbreak', name: 'Fast Break Club', sportId: 'basketball', inviteCode: 'DA7ABA11', ownerId: FANS[40].id, isPublic: true,
    description: 'Buckets, blocks, and buzzer-beaters.', memberIds: members(40, 22), createdAt: CREATED },
  { id: 'sec_allsports', name: 'All Sports, All Day', sportId: 'soccer', inviteCode: 'A11DA7E5', ownerId: FANS[55].id, isPublic: true,
    description: 'If it has a score, we are watching it.', memberIds: members(55, 45), createdAt: CREATED },
];

export function demoSectionByCode(code: string): DemoSection | undefined {
  const clean = code.trim().toUpperCase();
  return DEMO_SECTIONS.find((s) => s.inviteCode === clean);
}

export function demoSectionById(id: string): DemoSection | undefined {
  return DEMO_SECTIONS.find((s) => s.id === id);
}

export function sectionFans(section: DemoSection): Fan[] {
  return section.memberIds.map((id) => FANS.find((f) => f.id === id)).filter((f): f is Fan => !!f);
}
