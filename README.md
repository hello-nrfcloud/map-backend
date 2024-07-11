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

[Provide your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html).

Install the dependencies:

```bash
npm ci
```

#### nRF Cloud Location Services Service Key

The single-cell geo-location features uses the nRF Cloud
[Ground Fix API](https://api.nrfcloud.com/v1#tag/Ground-Fix) which requires the
service to be enabled in the account's plan. Manage the account at
<https://nrfcloud.com/#/manage-plan>.

Provide your nRF Cloud API key:

```bash
./cli.sh configure-nrfcloud-account apiKey <API key>
```

### Build the docker images

Some of the feature are run from docker containers, ensure they have been built
and published before deploying the solutions.

```bash
export OPENSSL_LAMBDA_CONTAINER_TAG=$(./cli.sh build-container openssl-lambda)

# You can add these outputs to your .env file
echo "export OPENSSL_LAMBDA_CONTAINER_TAG=$OPENSSL_LAMBDA_CONTAINER_TAG" >> .envrc
direnv allow
```

### Deploy

```bash
npx cdk bootstrap # if this is the first time you use CDK in this account
npx cdk deploy
```

## Custom domain name

You can specify a custom domain name for the deployed API using the environment
variable `API_DOMAIN_NAME`.

If you do so, make sure to create a certificate in the region for this domain
name.

After deploying the stack, make sure to set up a CNAME record for this domain
that points to the hostname of the deployed API (available in the stack output
`gatewayDomainName`).

## Continuous Deployment using GitHub Actions

After deploying the stack manually once,

- configure a GitHub Actions environment named `production`
- create the secret `AWS_ROLE` with the value
  `arn:aws:iam::<account ID>:role/<stack name>-cd` and a variable (use the
  `cdRoleArn` stack output)
- create the variable `AWS_REGION` with the value `<region>` (your region)
- create the variable `STACK_NAME` with the value `<stack name>` (your stack
  name)

to enable continuous deployment.
