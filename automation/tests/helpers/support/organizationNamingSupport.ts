export function createSequentialOrganizationNicknameResolver(
  baseLabel = 'Test Organization',
): (testTitle: string) => string {
  const organizationNicknameByTestTitle = new Map<string, string>();

  return (testTitle: string) => {
    const existingNickname = organizationNicknameByTestTitle.get(testTitle);
    if (existingNickname) {
      return existingNickname;
    }

    const nickname = `${baseLabel} ${indexToLetters(organizationNicknameByTestTitle.size)}`;
    organizationNicknameByTestTitle.set(testTitle, nickname);
    return nickname;
  };
}

function indexToLetters(index: number): string {
  let value = index;
  let letters = '';

  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return letters;
}
