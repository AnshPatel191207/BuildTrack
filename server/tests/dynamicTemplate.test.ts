import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  compileClauses,
  numberToWordsINR,
  VARIABLE_REGISTRY,
} from '../src/services/templateEngine.service';

describe('Dynamic Multi-Project Template Engine', () => {
  it('interpolates project, customer, unit, and financial variables accurately', () => {
    const template = 'Agreement for {{project_name}} by {{developer_name}}. Unit {{flat_number}} allotted to {{customer_name}} for Rs. {{total_amount}} ({{total_amount_in_words}}). RERA: {{rera_number}}.';
    const context = {
      project_name: 'Santora Luxury Enclave',
      developer_name: 'Santora Infracon LLP',
      flat_number: 'A-402',
      customer_name: 'Rajesh Patel',
      total_amount: '1,25,00,000',
      total_amount_in_words: numberToWordsINR(12500000),
      rera_number: 'PR/GJ/AHMEDABAD/2026/0014',
    };

    const rendered = renderTemplate(template, context);
    expect(rendered).toContain('Santora Luxury Enclave');
    expect(rendered).toContain('Santora Infracon LLP');
    expect(rendered).toContain('A-402');
    expect(rendered).toContain('Rajesh Patel');
    expect(rendered).toContain('Rupees One Crore Twenty Five Lakh Only');
    expect(rendered).toContain('PR/GJ/AHMEDABAD/2026/0014');
  });

  it('correctly handles conditional blocks with {{#if variable}}', () => {
    const template = 'Unit {{flat_number}}{{#if parking_slot}}, Parking: {{parking_slot}}{{/if}}{{#if clubhouse}}, Club Access Included{{/if}}.';
    const contextWithParking = { flat_number: 'B-101', parking_slot: 'Slot #12' };
    const rendered1 = renderTemplate(template, contextWithParking);
    expect(rendered1).toBe('Unit B-101, Parking: Slot #12.');

    const contextWithoutParking = { flat_number: 'B-102' };
    const rendered2 = renderTemplate(template, contextWithoutParking);
    expect(rendered2).toBe('Unit B-102.');
  });

  it('compiles ordered legal clauses with condition variables', () => {
    const clauses = [
      { id: 'c2', clauseNumber: '2', title: 'Car Parking', content: 'Allocated parking is {{parking_slot}}.', order: 2, conditionVariable: 'parking_slot' },
      { id: 'c1', clauseNumber: '1', title: 'Parties', content: 'Promoter {{developer_name}} agrees to sell to {{customer_name}}.', order: 1 },
      { id: 'c3', clauseNumber: '3', title: 'Possession', content: 'Possession date is {{possession_date}}.', order: 3 },
    ];

    const context = {
      developer_name: 'Sky Heights Realty',
      customer_name: 'Anita Desai',
      parking_slot: 'P-04',
      possession_date: 'December 2027',
    };

    const compiled = compileClauses(clauses, context);
    expect(compiled).toContain('### 1. Parties');
    expect(compiled).toContain('Sky Heights Realty agrees to sell to Anita Desai.');
    expect(compiled).toContain('### 2. Car Parking');
    expect(compiled).toContain('Allocated parking is P-04.');
    expect(compiled).toContain('### 3. Possession');
  });

  it('converts Indian currency to words properly across lakhs and crores', () => {
    expect(numberToWordsINR(500000)).toBe('Rupees Five Lakh Only');
    expect(numberToWordsINR(12500000)).toBe('Rupees One Crore Twenty Five Lakh Only');
    expect(numberToWordsINR(45000)).toBe('Rupees Forty Five Thousand Only');
  });

  it('contains comprehensive variable registry for admin UI autocomplete', () => {
    expect(VARIABLE_REGISTRY.length).toBeGreaterThanOrEqual(15);
    const keys = VARIABLE_REGISTRY.map((v) => v.key);
    expect(keys).toContain('project_name');
    expect(keys).toContain('customer_name');
    expect(keys).toContain('flat_number');
    expect(keys).toContain('booking_amount');
    expect(keys).toContain('rera_number');
  });
});
