const insurerDomains = new Set(['helvetia.ch', 'axa.ch', 'zurich.ch', 'generali.ch', 'allianz-suisse.ch']);

export type Classification = 'Neue Mandatsanfrage' | 'Kundenantwort' | 'Versicherer-Korrespondenz' | 'Spam-Verdacht' | 'Sonstige';

export function classifySubjectAndSender(subject: string, from: string, ownDomain: string): Classification {
  const normalizedSubject = subject.trim();
  const addressMatch = from.match(/<([^>]+)>/) ?? from.match(/[\w.+-]+@[\w.-]+/);
  const address = addressMatch?.[1] ?? addressMatch?.[0] ?? '';
  const domain = address.split('@')[1]?.toLowerCase() ?? '';
  const displayName = from.replace(/<[^>]+>/, '').replace(/["']/g, '').trim().toLowerCase();
  if (/^re\s*:/i.test(normalizedSubject) && domain !== ownDomain.toLowerCase()) return 'Kundenantwort';
  if (/mandatsformular\s+anfrage/i.test(normalizedSubject)) return 'Neue Mandatsanfrage';
  if (insurerDomains.has(domain)) return 'Versicherer-Korrespondenz';
  const displayDomain = displayName.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})/)?.[1];
  if (displayDomain && displayDomain !== domain) return 'Spam-Verdacht';
  if ((/purchase\s+order|procurement/i.test(normalizedSubject) || /purchase\s+order|procurement/i.test(displayName)) && !insurerDomains.has(domain)) return 'Spam-Verdacht';
  return 'Sonstige';
}

export function extractMandateData(text: string) {
  const value = (label: string) => text.match(new RegExp(`^\\s*(?:${label})\\s*:\\s*(.+?)\\s*$`, 'im'))?.[1]?.trim() ?? null;
  return {
    name: value('Name'),
    birthDate: value('Geburtsdatum|Geburtsdatum\\s*\\(optional\\)'),
    email: value('E[\\s-]?Mail(?:-Adresse)?|Email(?:-Adresse)?'),
    insurer: value('Versicherung')
  };
}

export function isMandateSubject(subject: string) {
  return /mandatsformular\s+anfrage/i.test(subject);
}

export function isOwnDomain(address: string, ownDomain: string) {
  return address.toLowerCase().endsWith(`@${ownDomain.toLowerCase()}`);
}

export type MandateRecord = { uid: number; name: string | null; birthDate: string | null; date: number };

export function duplicateMandateUids(records: MandateRecord[]) {
  const groups = new Map<string, MandateRecord[]>();
  for (const record of records) {
    const key = `${record.name ?? ''}|${record.birthDate ?? ''}`.trim().toLowerCase();
    if (key === '|') continue;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const duplicates = new Set<number>();
  for (const group of groups.values()) {
    group.sort((left, right) => left.date - right.date || left.uid - right.uid);
    for (const record of group.slice(1)) duplicates.add(record.uid);
  }
  return duplicates;
}