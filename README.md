# `hello.nrfcloud.com/map` backend

[![GitHub Actions](https://github.com/hello-nrfcloud/map-backend/workflows/Test%20and%20Release/badge.svg)](https://github.com/hello-nrfcloud/map-backend/actions/workflows/test-and-release.yaml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

Cloud backend for
[`hello.nrfcloud.com/map`](https://github.com/hello-nrfcloud/map) developed
using [AWS CDK](https://aws.amazon.com/cdk) in
[TypeScript](https://www.typescriptlang.org/).

## Installation in your AWS account

### Setup

Provide your AWS credentials, for example using the `.envrc` (see
[the example](.envrc.example)).

### Install the dependencies

```bash
npm ci
```

### Deploy

```bash
npx cdk bootstrap # if this is the first time you use CDK in this account
npx cdk deploy --all
```

## Continuous Integration

To run continuous integration tests, deploy the CI application **in a seperate
account**:

```bash
npx cdk --app 'npx tsx --no-warnings cdk/ci.ts' deploy
```

and provide the Role ARN to GitHub Actions:

```bash
CI_ROLE=`aws cloudformation describe-stacks --stack-name ${STACK_NAME:-hello-nrfcloud-map-backend}-ci | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "ciRoleArn") | .OutputValue'`
gh secret set AWS_ROLE --env ci --body $CI_ROLE
```
