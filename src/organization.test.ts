import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySubjectAndSender, duplicateMandateUids, extractMandateData } from './organization.js';

test('classifies mandate requests and insurer correspondence', () => {
  assert.equal(classifySubjectAndSender('Mandatsformular Anfrage', 'kunde@example.com', 'tradesource.ch'), 'Neue Mandatsanfrage');
  assert.equal(classifySubjectAndSender('Frage', 'Support <support@helvetia.ch>', 'tradesource.ch'), 'Versicherer-Korrespondenz');
});

test('extracts mandate fields', () => {
  const examples = [
    ['Name: Vitor Almeida\nGeburtsdatum: 13.04.1973\nE-Mail: aiaijavou1@gmail.com\nVersicherung: AXA', 'aiaijavou1@gmail.com'],
    ['Name: Albiona\r\nGeburtsdatum : 04.09.1991\r\nE-Mail-Adresse: albiona@example.com\r\nVersicherung: Helvetia', 'albiona@example.com'],
    ['Name: Erika Muster\nGeburtsdatum: 01.01.1980\nEmail: erika@example.com\nVersicherung: Helvetia', 'erika@example.com']
  ] as const;
  for (const [text, email] of examples) assert.equal(extractMandateData(text).email, email);
  assert.deepEqual(extractMandateData(examples[0][0]), {
    name: 'Vitor Almeida', birthDate: '13.04.1973', email: 'aiaijavou1@gmail.com', insurer: 'AXA'
  });
});

test('classifies Re mandate replies as customer replies', () => {
  assert.equal(classifySubjectAndSender('Re: Branka Sincic, Neue Mandatsformular Anfrage', 'branka.sincic776@hotmail.com', 'tradesource.ch'), 'Kundenantwort');
});

test('keeps the first mandate and marks later same-name-and-birth-date messages as duplicates', () => {
  assert.deepEqual([...duplicateMandateUids([
    { uid: 5669, name: 'Lenur Kurbiddinov', birthDate: '01.08.1988', date: 1 },
    { uid: 5670, name: 'Lenur Kurbiddinov', birthDate: '01.08.1988', date: 2 },
    { uid: 5674, name: 'Albiona', birthDate: '04.09.1991', date: 3 },
    { uid: 5675, name: 'Albiona', birthDate: '04.09.1991', date: 4 }
  ])], [5670, 5675]);
});