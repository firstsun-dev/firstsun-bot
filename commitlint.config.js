export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'build', 'ci', 'perf', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      ['tracker', 'agent', 'orchestrator', 'config', 'state', 'util', 'docs', 'harness', 'deps'],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};
