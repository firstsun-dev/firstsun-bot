export function startupBanner(): string {
  return 'firstsun-bot starting…';
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  console.log(startupBanner());
}
