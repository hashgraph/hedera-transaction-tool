export const getWidthOfElementWithText = (element: HTMLElement, text: string) => {
  const styles = getComputedStyle(element);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (context) {
    context!.font = styles.font;
    const {width} = context!.measureText(text);

    return width;
  } else {
    throw new Error('Failed to get width of element with text');
  }
};
