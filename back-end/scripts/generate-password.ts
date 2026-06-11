import * as argon2 from 'argon2';

function generatePassword(): string {
  const getRandomLetters = (length: number) =>
    Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');

  return `${getRandomLetters(5)}-${getRandomLetters(5)}`;
}

async function hash(data: string, usePseudoSalt = false): Promise<string> {
  let pseudoSalt: Buffer | undefined;
  if (usePseudoSalt) {
    const paddedData = data.padEnd(16, 'x');
    pseudoSalt = Buffer.from(paddedData.slice(0, 16));
  }
  return await argon2.hash(data, {
    salt: pseudoSalt,
  });
}

async function main() {
  const password = generatePassword();
  const hashed = await hash(password);

  console.log('Password:', password);
  console.log('Hash:    ', hashed);
}

main().catch(console.error);
