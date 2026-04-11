import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export class EcrStack extends cdk.Stack {
  public readonly frontendRepo: ecr.Repository;
  public readonly backendRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.frontendRepo = new ecr.Repository(this, "FrontendRepo", {
      repositoryName: "compass/frontend",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 10, description: "Keep last 10 images" }],
      imageScanOnPush: true,
    });

    this.backendRepo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: "compass/backend",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 10, description: "Keep last 10 images" }],
      imageScanOnPush: true,
    });

    new cdk.CfnOutput(this, "FrontendRepoUri", { value: this.frontendRepo.repositoryUri });
    new cdk.CfnOutput(this, "BackendRepoUri", { value: this.backendRepo.repositoryUri });
  }
}
