// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const banGithubSdkPackages = {
  group: ['@octokit', '@octokit/*', 'octokit', '@actions/github'],
  message:
    'GitHub SDKs may only be imported inside src/providers/tracker/github/. Add the capability to TrackerProvider instead.',
};

const banGithubDeepImport = {
  group: ['**/providers/tracker/github/**'],
  message:
    'Deep-import into providers/tracker/github/ is forbidden. Import the factory from its index.ts instead.',
};

const banClaudeSpawn = {
  group: ['node:child_process', 'child_process', 'execa', '@anthropic-ai/*'],
  message:
    'Process-spawning / Claude SDKs may only be used inside src/providers/agent/claude-code/. Add the capability to AgentProvider instead.',
};

const banClaudeDeepImport = {
  group: ['**/providers/agent/claude-code/**'],
  message:
    'Deep-import into providers/agent/claude-code/ is forbidden. Import the factory from its index.ts instead.',
};

const banAnyProviderDeepImport = {
  group: ['**/providers/*/*/**'],
  message:
    'src/orchestrator/** may only depend on provider *types*, never a concrete provider implementation.',
};

const banFsAndSpawn = {
  group: ['node:child_process', 'child_process', 'node:fs', 'fs'],
  message:
    'src/orchestrator/** must stay side-effect free; no process spawning or direct filesystem access.',
};

const httpZoneBans = {
  group: [
    '**/providers/*/*/**',
    'node:child_process',
    'child_process',
    'undici',
    'node-fetch',
    '@octokit',
    '@octokit/*',
    'octokit',
    '@anthropic-ai/*',
  ],
  message:
    'src/http/** is read-only: no provider implementations, no process spawning, no HTTP client libs.',
};

const compositionAllowedGithub = {
  group: ['**/providers/tracker/github/**/*', '!**/providers/tracker/github/index'],
  message: banGithubDeepImport.message,
};

const compositionAllowedClaude = {
  group: ['**/providers/agent/claude-code/**/*', '!**/providers/agent/claude-code/index'],
  message: banClaudeDeepImport.message,
};

// Every directory below is a distinct "zone": exactly one no-restricted-imports
// block may apply per file, since flat config replaces (not merges) a rule
// setting when multiple matching configs set the same key.
const zoneDirs = [
  'src/providers/tracker/github/**',
  'src/providers/agent/claude-code/**',
  'src/orchestrator/**',
  'src/http/**',
  'src/composition/**',
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.firstsun-bot/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Default zone: everything under src/ that isn't one of the special dirs
  // below is banned from both the GitHub SDK and the Claude/spawn surface.
  {
    files: ['src/**/*.ts'],
    ignores: zoneDirs,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            banGithubSdkPackages,
            banGithubDeepImport,
            banClaudeSpawn,
            banClaudeDeepImport,
          ],
        },
      ],
    },
  },
  // GitHub tracker provider: may use the GitHub SDK, still may not touch Claude.
  {
    files: ['src/providers/tracker/github/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [banClaudeSpawn, banClaudeDeepImport] }],
    },
  },
  // Claude Code agent provider: may spawn `claude`, still may not touch GitHub.
  {
    files: ['src/providers/agent/claude-code/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [banGithubSdkPackages, banGithubDeepImport] }],
    },
  },
  // Orchestrator: no concrete provider, no fs/spawn, no process.env.
  {
    files: ['src/orchestrator/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [banAnyProviderDeepImport, banFsAndSpawn, banGithubSdkPackages, banClaudeSpawn],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            'src/orchestrator/** must not read process.env directly; config is always injected.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'src/orchestrator/** must not read process.env directly; config is always injected.',
        },
      ],
    },
  },
  // Read-only status UI (feat-013, reserved now).
  {
    files: ['src/http/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [httpZoneBans] }],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'src/http/** must not make outbound requests.' },
      ],
    },
  },
  // Composition root: the only place allowed to import a concrete provider
  // factory (its index.ts), never a deep path, never the raw SDKs.
  {
    files: ['src/composition/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            banGithubSdkPackages,
            banClaudeSpawn,
            compositionAllowedGithub,
            compositionAllowedClaude,
          ],
        },
      ],
    },
  },
);
