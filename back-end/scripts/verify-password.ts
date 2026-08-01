import * as argon2 from 'argon2';
import * as readline from 'readline';

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const password = await prompt(rl, 'Password: ');
  console.log('Enter hashes one per line, empty line when done:');

  const hashes: string[] = [];
  while (true) {
    const hash = await prompt(rl, '> ');
    if (!hash.trim()) break;
    hashes.push(hash.trim());
  }

  rl.close();

  for (const hash of hashes) {
    const match = await argon2.verify(hash, password);
    console.log(`${match ? '✓' : '✗'} ${hash}`);
  }
}

main().catch(console.error);
