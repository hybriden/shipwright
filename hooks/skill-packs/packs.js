'use strict';
// Shipwright — skill-pack registry: Agent Skills from official publishers, fetched on demand
// (engine.js) only for projects that need them.
//
// `detect` and skill rules list signals, any of which matches:
//   dep:<npm package> (trailing * = prefix) · file:<name> · dir:<name> · text:<marker from detect.js>
// A skill rule of true/false always/never indexes it; unlisted skills follow `indexUnlisted`.
// Rules key on installed skill names (SKILL.md `name`), which can differ from the repo folder.

const WEB_UI = ['dep:react', 'dep:next', 'dep:vue', 'dep:nuxt', 'dep:svelte', 'dep:@sveltejs/kit', 'dep:astro', 'dep:@angular/core', 'dep:solid-js'];
const VERCEL_PROJECT = ['file:vercel.json', 'dir:.vercel', 'dep:@vercel/*'];
const AWS_IAC = ['file:cdk.json', 'dep:aws-cdk-lib', 'text:aws-cdk', 'text:cloudformation', 'file:samconfig.toml', 'file:serverless.yml', 'file:serverless.yaml', 'text:terraform-aws'];
const DYNAMODB = ['dep:@aws-sdk/client-dynamodb', 'dep:@aws-sdk/lib-dynamodb', 'dep:dynamoose', 'dep:electrodb'];

module.exports = [
  {
    id: 'cloudflare',
    publisher: 'Cloudflare',
    repo: 'https://github.com/cloudflare/skills',
    source: ['cloudflare/skills', '--skill', '*'],
    detect: ['file:wrangler.toml', 'file:wrangler.json', 'file:wrangler.jsonc', 'dep:wrangler', 'dep:@cloudflare/*', 'dep:agents', 'dep:vinext', 'dep:@opennextjs/cloudflare', 'text:terraform-cloudflare'],
    indexUnlisted: true,
    skills: {
      // Zero Trust / SASE administration, not application code.
      'cloudflare-one': false,
      'cloudflare-one-migrations': false,
      'agents-sdk': ['dep:agents'],
      'sandbox-next': ['dep:@cloudflare/sandbox'],
      'sandbox-stable': ['dep:@cloudflare/sandbox'],
      'sandbox-migrate-to-next': ['dep:@cloudflare/sandbox'],
      'nextjs-on-cloudflare': ['dep:next', 'dep:vinext', 'dep:@opennextjs/cloudflare'],
    },
  },
  {
    id: 'vercel',
    publisher: 'Vercel',
    repo: 'https://github.com/vercel-labs/agent-skills',
    source: ['vercel-labs/agent-skills', '--skill', '*'],
    detect: [...VERCEL_PROJECT, ...WEB_UI, 'dep:react-native', 'dep:expo'],
    indexUnlisted: true,
    skills: {
      'vercel-react-best-practices': ['dep:react', 'dep:next'],
      'vercel-composition-patterns': ['dep:react'],
      'vercel-react-view-transitions': ['dep:react'],
      'vercel-react-native-skills': ['dep:react-native', 'dep:expo'],
      'web-design-guidelines': WEB_UI,
      'deploy-to-vercel': VERCEL_PROJECT,
      'vercel-cli-with-tokens': VERCEL_PROJECT,
      'vercel-optimize': VERCEL_PROJECT,
      'writing-guidelines': false, // prose review, not code
    },
  },
  {
    id: 'aws',
    publisher: 'AWS',
    repo: 'https://github.com/aws/agent-toolkit-for-aws',
    source: ['aws/agent-toolkit-for-aws/skills', '--skill', '*'],
    detect: ['file:cdk.json', 'file:samconfig.toml', 'file:serverless.yml', 'file:serverless.yaml', 'file:amplify.yml', 'file:buildspec.yml', 'file:appspec.yml', 'dep:aws-cdk-lib', 'dep:aws-cdk', 'dep:@aws-sdk/*', 'dep:aws-sdk', 'dep:aws-amplify', 'dep:@aws-amplify/*', 'dep:serverless', 'dep:@aws-lambda-powertools/*', 'dep:@types/aws-lambda', 'text:aws-sdk', 'text:aws-cdk', 'text:aws-lambda', 'text:cloudformation', 'text:terraform-aws'],
    // ~100 skills: index only what the project's signals point at; `browse` tells agents how to find the rest by name.
    indexUnlisted: false,
    browse: true,
    skills: {
      'aws-cdk': ['file:cdk.json', 'dep:aws-cdk-lib', 'dep:aws-cdk', 'text:aws-cdk'],
      'aws-cloudformation': ['text:cloudformation'],
      'aws-serverless': ['file:samconfig.toml', 'file:serverless.yml', 'file:serverless.yaml', 'dep:serverless', 'dep:@types/aws-lambda', 'dep:@aws-lambda-powertools/*', 'text:aws-lambda'],
      'aws-iam': AWS_IAC,
      'aws-sdk-js-v3-usage': ['dep:@aws-sdk/*'],
      'aws-sdk-python-usage': ['text:boto3'],
      'aws-sdk-swift-usage': ['text:aws-sdk-swift'],
      'amazon-bedrock': ['dep:@aws-sdk/client-bedrock*', 'dep:@ai-sdk/amazon-bedrock'],
      'aws-auth': ['dep:aws-amplify', 'dep:@aws-amplify/*', 'dep:amazon-cognito-identity-js', 'dep:@aws-sdk/client-cognito-identity-provider'],
      'aws-amplify': ['dep:aws-amplify', 'dep:@aws-amplify/backend', 'file:amplify.yml'],
      'aws-database': [...DYNAMODB, 'dep:@aws-sdk/client-rds*'],
      'amazon-dynamodb': DYNAMODB,
      'aws-storage': ['dep:@aws-sdk/client-s3', 'dep:@aws-sdk/lib-storage'],
      'aws-messaging-and-streaming': ['dep:@aws-sdk/client-sqs', 'dep:@aws-sdk/client-sns', 'dep:@aws-sdk/client-eventbridge', 'dep:@aws-sdk/client-kinesis', 'dep:@aws-sdk/client-firehose'],
      'aws-step-functions': ['dep:@aws-sdk/client-sfn'],
      'aws-observability': ['dep:@aws-lambda-powertools/*', 'dep:aws-xray-sdk*', 'dep:@aws-sdk/client-cloudwatch*'],
      'aws-deployment': ['file:buildspec.yml', 'file:appspec.yml'],
    },
  },
  {
    id: 'oxc',
    publisher: 'Oxc',
    repo: 'https://github.com/oxc-project/oxc',
    source: ['https://github.com/oxc-project/oxc/tree/main/.agents/skills', '--skill', 'migrate-oxlint', '--skill', 'migrate-oxfmt'],
    detect: ['dep:eslint', 'dep:prettier'],
    indexUnlisted: false,
    skills: {
      'migrate-oxlint': ['dep:eslint'],
      'migrate-oxfmt': ['dep:prettier'],
    },
    hint: '[oxc] ESLint/Prettier in use — before any lint/format tooling decision, check Oxlint/Oxfmt compatibility: node "{hooks}/js/oxc-compat.js" report --project "{project}"',
  },
];
