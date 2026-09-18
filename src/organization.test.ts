import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySubjectAndSender, extractMandateData } from './organization.js';

test('classifies mandate requests and insurer correspondence', () => {
  assert.equal(classifySubjectAndSender('Mandatsformular Anfrage', 'kunde@example.com', 'tradesource.ch'), 'Neue Mandatsanfrage');
  assert.equal(classifySubjectAndSender('Frage', 'Support <support@helvetia.ch>', 'tradesource.ch'), 'Versicherer-Korrespondenz');
});

test('extracts mandate fields', () => {
  assert.deepEqual(extractMandateData('Name: Erika Muster\nGeburtsdatum: 01.01.1980\nE-Mail: erika@example.com\nVersicherung: Helvetia'), {
    name: 'Erika Muster', birthDate: '01.01.1980', email: 'erika@example.com', insurer: 'Helvetia'
  });
});