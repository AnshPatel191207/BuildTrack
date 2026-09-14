/**
 * Document Template Engine
 * Token replacement, Indian currency in words, and default legal templates
 */

export function numberToWordsINR(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return singleDigits[n];
    if (n < 20) return twoDigits[n - 10];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit !== 0 ? ' ' + singleDigits[unit] : '');
  };

  const convertThreeDigits = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred > 0) str += singleDigits[hundred] + ' Hundred';
    if (rest > 0) str += (str ? ' and ' : '') + convertTwoDigits(rest);
    return str;
  };

  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);

  // Indian numbering split: Crores, Lakhs, Thousands, Hundreds
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const remainder = whole % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(convertTwoDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertTwoDigits(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertThreeDigits(remainder));

  let res = 'Rupees ' + parts.join(' ');
  if (paise > 0) {
    res += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  return res.trim() + ' Only';
}

export interface TemplateContext {
  [key: string]: string | number | undefined | null;
}

/**
 * Replaces all occurrences of {{token}} with values from context.
 * Unmatched tokens are gracefully retained or blanked if empty.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = context[key];
    if (val === undefined || val === null) {
      return '';
    }
    return String(val);
  });
}

/** Default Banakhat (Agreement for Sale) Template */
export const DEFAULT_BANAKHAT_TEMPLATE = `
# AGREEMENT FOR SALE (BANAKHAT)

This Agreement for Sale ("Agreement") is executed on this **{{today_date}}** at **{{project_location}}**.

### BETWEEN

**{{builder_name}}** (Promoter/Developer), represented through its Authorized Signatory, having its office at **{{company_address}}**, hereinafter referred to as the **"PROMOTER"** (which expression shall unless repugnant to the context include its successors, administrators and assigns) of the **FIRST PART**;

### AND

**{{customer_name}}**, residing at **{{customer_address}}**, holding PAN **{{customer_pan}}** and Aadhaar **{{customer_aadhaar}}**, Mobile: **{{customer_phone}}**, hereinafter referred to as the **"ALLOTTEE/PURCHASER"** (which expression shall unless repugnant to the context include their legal heirs, executors, administrators) of the **SECOND PART**.

Nominee for this Allotment: **{{nominee_name}}** (Relation: **{{nominee_relation}}**, Age: **{{nominee_age}}**).

---

### WHEREAS:
1. The Promoter is developing a real estate project known as **"{{project_name}}"** situated at **{{project_location}}**, bearing RERA Registration No. **{{rera_number}}**.
2. The Allottee has applied for and has agreed to purchase the property described herein below, and the Promoter has agreed to sell the same on the terms and conditions set forth herein.

---

### SCHEDULE OF THE PROPERTY:
- **Project Name:** {{project_name}} (Project Code: {{project_code}})
- **Tower / Block:** {{tower_name}}
- **Floor:** {{floor_name}}
- **Unit Number:** {{flat_number}}
- **Unit Type / Category:** {{unit_type}}
- **Carpet Area:** {{carpet_area}} Sq. Ft.
- **Built-Up Area:** {{builtup_area}} Sq. Ft.
- **Facing Direction:** {{facing}}
- **Car Parking Space:** {{parking_slot}}

---

### CONSIDERATION & PAYMENT SCHEDULE:
1. The total agreed consideration for the scheduled unit is **₹{{total_amount}}** ({{total_amount_in_words}}), which includes Base Price of ₹{{base_price}}, Parking charges of ₹{{parking_charges}}, and applicable GST of ₹{{gst_amount}}.
2. The Allottee has paid an advance booking amount of **₹{{booking_amount}}** on **{{booking_date}}** under Booking No. **{{booking_number}}**, the receipt of which the Promoter hereby acknowledges.
3. The remaining consideration shall be payable by the Allottee in progressive installments in accordance with the stage-wise construction schedule stipulated by RERA.

---

### IN WITNESS WHEREOF
The Promoter and the Allottee have signed and executed this Agreement on the day, month, and year first written above in the presence of witnesses.

__________________________                         __________________________
**PROMOTER / DEVELOPER**                           **ALLOTTEE / PURCHASER**
For {{builder_name}}                               {{customer_name}}
`;

/** Default Dastavej (Conveyance / Sale Deed) Template */
export const DEFAULT_DASTAVEJ_TEMPLATE = `
# DEED OF CONVEYANCE (DASTAVEJ)

This Absolute Deed of Conveyance is made and executed on this **{{today_date}}** at the Sub-Registrar Office, **{{project_location}}**.

### BY AND BETWEEN:
**{{builder_name}}**, a real estate development firm having registered address at **{{company_address}}**, represented by its Authorized Signatory, hereinafter called the **"VENDOR"** of the ONE PART;

### IN FAVOUR OF:
**{{customer_name}}**, PAN: **{{customer_pan}}**, Aadhaar: **{{customer_aadhaar}}**, residing at **{{customer_address}}**, hereinafter called the **"PURCHASER"** of the OTHER PART.

---

### 1. SUBJECT MATTER OF SALE:
The Vendor hereby grants, transfers, conveys, and assigns absolutely unto the Purchaser all that residential/commercial unit:
- **Unit Number:** {{flat_number}}
- **Tower / Wing:** {{tower_name}}, Floor: {{floor_name}}
- **Project Name:** {{project_name}}
- **Carpet Area:** {{carpet_area}} Sq. Ft. (Built-Up: {{builtup_area}} Sq. Ft.)
- **Exclusive Parking:** {{parking_slot}}

### 2. FULL SATISFACTION OF CONSIDERATION:
The Vendor hereby acknowledges that the entire agreed consideration of **₹{{total_amount}}** ({{total_amount_in_words}}) has been received in full from the Purchaser through valid banking channels, and nothing remains due or payable towards the purchase price of the scheduled property.

### 3. POSSESSION AND TITLE:
The Vendor has handed over vacant, peaceful, and physical possession of the Schedule Property to the Purchaser. The title conveyed is clear, marketable, and free from all encumbrances, liens, mortgages, charges, or litigations.

__________________________                         __________________________
**VENDOR / BUILDER**                               **PURCHASER**
Authorized Signatory                               {{customer_name}}
`;
