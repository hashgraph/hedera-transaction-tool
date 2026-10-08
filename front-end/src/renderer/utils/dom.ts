export const getWidthOfElementWithText = (element: HTMLElement, text: string) => {
  const styles = getComputedStyle(element);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (context) {
    context.font = styles.font;
    const { width } = context.measureText(text);

    return width;
  } else {
    throw new Error('Failed to get width of element with text');
  }
};

// Renders `text` into a hidden span styled to match `input` (font, size, and
// tabular-nums, since tabular digits are wider than proportional spacing) and measures
// its rendered width. Used to size/position ghost suggestion text next to a real input.
export function measureTextWidth(text: string, input: HTMLInputElement): number {
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
  tempSpan.style.fontSize = getComputedStyle(input).fontSize;
  tempSpan.style.fontVariantNumeric = getComputedStyle(input).fontVariantNumeric;
  tempSpan.textContent = text;

  document.body.appendChild(tempSpan);
  const width = tempSpan.getBoundingClientRect().width;
  document.body.removeChild(tempSpan);

  return width;
}

// Positions `suffixEl` (a ghost-text span, e.g. a postfix suggestion or checksum
// annotation) right after `input`'s own rendered text, accounting for the input's
// padding-left (which the caller may itself have adjusted, e.g. to make room for a
// prefix suggestion).
export function positionGhostSuffix(input: HTMLInputElement, suffixEl: HTMLElement): void {
  const leftValue = parseFloat(getComputedStyle(input).paddingLeft) || 0;
  const textWidth = measureTextWidth(input.value, input);
  suffixEl.style.left = `${textWidth + leftValue + 2}px`;
}
