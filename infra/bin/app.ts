#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { IamStack } from "../lib/iam-stack";
import { ComputeStack } from "../lib/compute-stack";
import { AlbStack } from "../lib/alb-stack";
import { DnsStack } from "../lib/dns-stack";

const app = new cdk.App();

/* ── Configuration ──────────────────────────────────────────────────────── */
const env: cdk.Environment = {
  account: app.node.tryGetContext("account") || process.env.CDK_DEFAULT_ACCOUNT,
  region: app.node.tryGetContext("region") || process.env.CDK_DEFAULT_REGION || "us-east-1",
};

const domainName = app.node.tryGetContext("domainName") || "";
const hostedZoneId = app.node.tryGetContext("hostedZoneId") || "";
const githubOrg = app.node.tryGetContext("githubOrg") || "";
const githubRepo = app.node.tryGetContext("githubRepo") || "";
const keyPairName = app.node.tryGetContext("keyPairName") || "compass-keypair";
const instanceType = app.node.tryGetContext("instanceType") || "t3.medium";

const tags = { Project: "Compass-CCS", ManagedBy: "CDK" };

/* ── Stacks ─────────────────────────────────────────────────────────────── */

const network = new NetworkStack(app, "Compass-Network", { env, tags });

const ecr = new EcrStack(app, "Compass-ECR", { env, tags });

const iam = new IamStack(app, "Compass-IAM", {
  env,
  tags,
  ecrArns: [ecr.frontendRepo.repositoryArn, ecr.backendRepo.repositoryArn],
  githubOrg,
  githubRepo,
});

const compute = new ComputeStack(app, "Compass-Compute", {
  env,
  tags,
  vpc: network.vpc,
  ec2SecurityGroup: network.ec2SecurityGroup,
  instanceProfile: iam.ec2InstanceProfile,
  keyPairName,
  instanceType,
  frontendRepoUri: ecr.frontendRepo.repositoryUri,
  backendRepoUri: ecr.backendRepo.repositoryUri,
});

const alb = new AlbStack(app, "Compass-ALB", {
  env,
  tags,
  vpc: network.vpc,
  albSecurityGroup: network.albSecurityGroup,
  instance: compute.instance,
});

if (domainName && hostedZoneId) {
  new DnsStack(app, "Compass-DNS", {
    env,
    tags,
    domainName,
    hostedZoneId,
    alb: alb.alb,
  });
}

app.synth();
