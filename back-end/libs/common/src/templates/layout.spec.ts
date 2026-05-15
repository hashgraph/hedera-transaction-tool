import {
  emailWrapper,
  emailHeader,
  emailFooter,
  emailBody,
  emailReviewButton,
  emailWarning,
  escapeHtml,
  emailCardTable,
  emailCardRow,
  renderTransactionEmailLayout,
} from './layout';

describe('layout templates', () => {
// ─── escapeHtml ───────────────────────────────────────────────────────────────

  describe('escapeHtml', () => {
    it('escapes ampersands', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less-than and greater-than', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes all special chars together', () => {
      expect(escapeHtml(`<a href="test" data-x='1'>a & b</a>`)).toBe(
        '&lt;a href=&quot;test&quot; data-x=&#39;1&#39;&gt;a &amp; b&lt;/a&gt;'
      );
    });

    it('returns plain strings unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

// ─── emailWrapper ─────────────────────────────────────────────────────────────

  describe('emailWrapper', () => {
    it('returns a valid HTML document string', () => {
      const result = emailWrapper('<tr><td>content</td></tr>');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
    });

    it('injects the content into the inner table', () => {
      const result = emailWrapper('<tr><td>MY_CONTENT</td></tr>');
      expect(result).toContain('MY_CONTENT');
    });

    it('includes the footer', () => {
      const result = emailWrapper('');
      expect(result).toContain('automated message');
      expect(result).toContain('Copyright');
    });

    it('sets background color on body', () => {
      const result = emailWrapper('');
      expect(result).toContain('background-color:#f2f2f2');
    });
  });

// ─── emailHeader ─────────────────────────────────────────────────────────────

  describe('emailHeader', () => {
    it('renders the title', () => {
      const result = emailHeader('My Title');
      expect(result).toContain('My Title');
    });

    it('escapes the title', () => {
      const result = emailHeader('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('renders subtitle when provided', () => {
      const result = emailHeader('Title', 'My Subtitle');
      expect(result).toContain('My Subtitle');
    });

    it('escapes the subtitle', () => {
      const result = emailHeader('Title', '<b>bad</b>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('&lt;b&gt;');
    });

    it('omits subtitle element when not provided', () => {
      const result = emailHeader('Title');
      expect(result).not.toContain('letter-spacing:3px'); // subtitle-specific style
    });

    it('includes gradient background', () => {
      const result = emailHeader('Title');
      expect(result).toContain('linear-gradient');
    });
  });

// ─── emailFooter ─────────────────────────────────────────────────────────────

  describe('emailFooter', () => {
    it('contains the automated message disclaimer', () => {
      expect(emailFooter()).toContain('automated message');
    });

    it('contains a copyright notice', () => {
      const currentYear = new Date().getFullYear().toString();
      expect(emailFooter()).toContain('Copyright');
      expect(emailFooter()).toContain(currentYear);
    });

    it('returns a non-empty string', () => {
      expect(emailFooter().length).toBeGreaterThan(0);
    });
  });

// ─── emailBody ────────────────────────────────────────────────────────────────

  describe('emailBody', () => {
    it('wraps content in a table row', () => {
      const result = emailBody('<p>hello</p>');
      expect(result).toContain('<tr>');
      expect(result).toContain('<p>hello</p>');
    });

    it('applies background color', () => {
      const result = emailBody('');
      expect(result).toContain('background-color:#fafafa');
    });
  });

// ─── emailReviewButton ────────────────────────────────────────────────────────

  describe('emailReviewButton', () => {
    it('renders a link with the correct route', () => {
      const result = emailReviewButton('groups/123');
      expect(result).toContain('hedera-transaction-tool://groups/123');
    });

    it('renders "Review in App" label', () => {
      expect(emailReviewButton('some/route')).toContain('Review in App');
    });

    it('renders without a warning when no message passed', () => {
      const result = emailReviewButton('route');
      expect(result).not.toContain('⚠️');
    });

    it('renders a warning message when message is provided', () => {
      const result = emailReviewButton('route', 'Something needs attention');
      expect(result).toContain('⚠️');
      expect(result).toContain('Something needs attention');
    });

    it('escapes the warning message', () => {
      const result = emailReviewButton('route', '<b>danger</b>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('&lt;b&gt;');
    });
  });

// ─── emailWarning ─────────────────────────────────────────────────────────────

  describe('emailWarning', () => {
    it('renders the warning message', () => {
      const result = emailWarning('Watch out!');
      expect(result).toContain('Watch out!');
    });

    it('escapes the message', () => {
      const result = emailWarning('<script>xss</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('includes the warning icon', () => {
      expect(emailWarning('msg')).toContain('⚠️');
    });
  });

// ─── emailCardRow ─────────────────────────────────────────────────────────────

  describe('emailCardRow', () => {
    const cellHtml = '<td style="__ROW_STYLE__">cell</td>';

    it('wraps cells in a <tr>', () => {
      const result = emailCardRow(cellHtml, 0);
      expect(result).toContain('<tr>');
      expect(result).toContain('cell');
    });

    it('applies stripe background on even rows', () => {
      const result = emailCardRow(cellHtml, 0);
      expect(result).toContain('background-color:#f7f3ff');
    });

    it('applies white background on odd rows', () => {
      const result = emailCardRow(cellHtml, 1);
      expect(result).toContain('background-color:#ffffff');
    });

    it('applies no top border on the first row', () => {
      const result = emailCardRow(cellHtml, 0);
      expect(result).not.toContain('border-top');
    });

    it('applies top border on subsequent rows', () => {
      const result = emailCardRow(cellHtml, 1);
      expect(result).toContain('border-top:1px solid #e2d4f8');
    });

    it('disables stripe when disableStripe is true', () => {
      const result = emailCardRow(cellHtml, 0, { disableStripe: true });
      expect(result).toContain('background-color:#ffffff');
      expect(result).not.toContain('#f7f3ff');
    });

    it('replaces all __ROW_STYLE__ placeholders', () => {
      const multiCell = '<td style="__ROW_STYLE__">a</td><td style="__ROW_STYLE__">b</td>';
      const result = emailCardRow(multiCell, 0);
      expect(result).not.toContain('__ROW_STYLE__');
    });
  });

// ─── emailCardTable ───────────────────────────────────────────────────────────

  describe('emailCardTable', () => {
    it('wraps rows in a table', () => {
      const result = emailCardTable('<tr><td>row</td></tr>');
      expect(result).toContain('<table');
      expect(result).toContain('row');
      expect(result).toContain('</table>');
    });

    it('applies border style', () => {
      const result = emailCardTable('');
      expect(result).toContain('border:1px solid #e2d4f8');
    });
  });

// ─── renderTransactionEmailLayout ────────────────────────────────────────────

  describe('renderTransactionEmailLayout', () => {
    it('returns a full HTML document', () => {
      const result = renderTransactionEmailLayout('Test Title', '<p>body</p>');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('</html>');
    });

    it('includes the title in the header', () => {
      const result = renderTransactionEmailLayout('My Title', '');
      expect(result).toContain('My Title');
    });

    it('includes the subtitle "Hedera Transaction Tool"', () => {
      const result = renderTransactionEmailLayout('Title', '');
      expect(result).toContain('Hedera Transaction Tool');
    });

    it('includes the body content', () => {
      const result = renderTransactionEmailLayout('Title', '<p>BODY_CONTENT</p>');
      expect(result).toContain('BODY_CONTENT');
    });
  });
});
