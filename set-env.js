/**
 * Vercel 환경변수 설정 (프로젝트 디렉토리에서 실행)
 *
 * 사용 예:
 *   node set-env.js UPSTASH_REDIS_REST_URL "https://xxxxx.upstash.io"
 *   node set-env.js UPSTASH_REDIS_REST_TOKEN "gQAAAA..."
 *
 * 환경변수가 이미 있으면 덮어씁니다.
 */

const { execSync } = require('child_process');
const [node, script, key, value] = process.argv;

if (!key || !value) {
  console.log('사용법: node set-env.js <KEY> <VALUE>');
  console.log('예:    node set-env.js UPSTASH_REDIS_REST_URL "https://xxxxx.upstash.io"');
  process.exit(1);
}

try {
  // Vercel CLI v5+ 에서는 vercel env add 가 대화형이라 --environment 플래그가 없음.
  // 대신 stdin 으로 값 전달.ENV key name 만 인자로 주고 값은 stdin 으로.
  const envName = key;
  const envVal = value;

  // --yes 는 확인 프롬프트를 자동 승인
  const cmd = `echo "${envVal}" | vercel env add ${envName} --yes`;
  console.log(`실행: ${cmd}`);
  const out = execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });
  console.log('결과:');
  console.log(out);
} catch (e) {
  console.error('오류:');
  console.error(e.stdout || e.message);
  process.exit(1);
}
