// RT-781 lab: read a password on stdin, print its argon2id hash with the api's own library and parameters.
const argon2 = require('/app/node_modules/.pnpm/argon2@0.44.0/node_modules/argon2');
let input = '';
process.stdin.on('data', (d) => { input += d; }).on('end', async () => {
  const password = input.replace(/\r?\n$/, '');
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  if (!(await argon2.verify(hash, password))) process.exit(2);
  process.stdout.write(hash);
});
