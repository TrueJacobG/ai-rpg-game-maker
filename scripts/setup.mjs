import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { newSessionSecret, passphraseProblem } from './setup-lib.mjs';

const run = (command, args, options = {}) =>
  spawnSync(command, args, { stdio: 'inherit', shell: false, ...options }).status === 0;

const ask = async (question) => {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question);
  prompt.close();
  return answer.trim();
};

const askHidden = async (question) => {
  process.stdout.write(question);
  const silent = new Writable({ write: (_chunk, _encoding, done) => done() });
  const prompt = createInterface({ input: process.stdin, output: silent, terminal: true });
  const answer = await prompt.question('');
  prompt.close();
  process.stdout.write('\n');
  return answer;
};

const confirm = async (question) => {
  const answer = (await ask(`${question} [Y/n] `)).toLowerCase();
  return answer === '' || answer === 'y' || answer === 'yes';
};

const putSecret = (name, value) =>
  run('npx', ['wrangler', 'secret', 'put', name], {
    cwd: 'apps/worker',
    input: `${value}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

const step = async (title, action) => {
  console.log(`\n== ${title}`);
  if (!(await confirm('Run this step?'))) return console.log('Skipped.');
  if (!(await action())) {
    console.log('That step failed. Fix the problem above and run `npm run setup` again.');
    process.exit(1);
  }
};

const choosePassphrase = async () => {
  const passphrase = await askHidden(
    'Master passphrase (12+ characters, you type it on /master): ',
  );
  const confirmation = await askHidden('Type it again: ');
  const problem = passphraseProblem(passphrase, confirmation);
  if (problem === null) return passphrase;
  console.log(problem);
  return choosePassphrase();
};

console.log('This guides you through putting the game on your own Cloudflare account.');
console.log('Nothing is sent anywhere except to Cloudflare through Wrangler.');

await step(
  '1. Log in to Cloudflare (opens your browser)',
  () => run('npx', ['wrangler', 'whoami']) || run('npx', ['wrangler', 'login']),
);

await step('2. Build and deploy the game', () => run('npm', ['run', 'deploy']));

await step('3. Create the database tables', () =>
  run('npm', ['run', 'migrate:remote', '-w', 'apps/worker']),
);

await step('4. Set the master passphrase and the session secret', async () => {
  const passphrase = await choosePassphrase();
  return (
    putSecret('MASTER_PASSWORD', passphrase) && putSecret('SESSION_SECRET', newSessionSecret())
  );
});

await step('5. Optional: set the Anthropic API key for the assistant', async () => {
  const key = await askHidden('API key (press Enter to skip): ');
  return key === '' ? true : putSecret('ANTHROPIC_API_KEY', key);
});

console.log('\nDone. Open the address Wrangler printed in step 2, add /master, and log in.');
console.log(
  'Next: npm run pack:check -- story, then npm run pack:import -- story --url <your address>',
);
