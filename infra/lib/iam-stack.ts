import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface IamStackProps extends cdk.StackProps {
  ecrArns: string[];
  githubOrg: string;
  githubRepo: string;
}

export class IamStack extends cdk.Stack {
  public readonly ec2Role: iam.Role;
  public readonly ec2InstanceProfile: iam.CfnInstanceProfile;
  public readonly githubActionsRole!: iam.Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    /* ── EC2 Instance Role ────────────────────────────────────────────── */
    this.ec2Role = new iam.Role(this, "Ec2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Compass EC2 — pull ECR images, SSM access",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    // Allow EC2 to pull images from ECR
    this.ec2Role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetAuthorizationToken",
        ],
        resources: ["*"],
      })
    );

    this.ec2InstanceProfile = new iam.CfnInstanceProfile(this, "Ec2InstanceProfile", {
      roles: [this.ec2Role.roleName],
      instanceProfileName: "CompassEc2Profile",
    });

    /* ── GitHub Actions OIDC Role ─────────────────────────────────────── */
    if (props.githubOrg && props.githubRepo) {
      const githubProvider = new iam.OpenIdConnectProvider(this, "GithubOidc", {
        url: "https://token.actions.githubusercontent.com",
        clientIds: ["sts.amazonaws.com"],
        thumbprints: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
      });

      this.githubActionsRole = new iam.Role(this, "GithubActionsRole", {
        assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.githubOrg}/${props.githubRepo}:ref:refs/heads/main`,
          },
        }),
        description: "GitHub Actions — push to ECR and deploy",
        maxSessionDuration: cdk.Duration.hours(1),
      });

      // Allow pushing images to ECR
      this.githubActionsRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetAuthorizationToken",
            "ecr:PutImage",
            "ecr:InitiateLayerUpload",
            "ecr:UploadLayerPart",
            "ecr:CompleteLayerUpload",
          ],
          resources: props.ecrArns,
        })
      );

      // ecr:GetAuthorizationToken needs * resource
      this.githubActionsRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["ecr:GetAuthorizationToken"],
          resources: ["*"],
        })
      );

      new cdk.CfnOutput(this, "GithubActionsRoleArn", {
        value: this.githubActionsRole.roleArn,
      });
    }
  }
}
