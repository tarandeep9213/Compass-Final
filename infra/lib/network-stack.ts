import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    /* ── VPC ───────────────────────────────────────────────────────────── */
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    /* ── ALB Security Group ───────────────────────────────────────────── */
    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: this.vpc,
      description: "ALB — allow HTTP/HTTPS from internet",
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP");
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");

    /* ── EC2 Security Group ───────────────────────────────────────────── */
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, "Ec2Sg", {
      vpc: this.vpc,
      description: "EC2 — allow traffic from ALB + SSH",
      allowAllOutbound: true,
    });
    // Allow ALB → EC2 on port 80 (nginx)
    this.ec2SecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(80), "ALB → Nginx");
    // SSH access (restrict to your IP in production)
    this.ec2SecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "SSH");

    /* ── Outputs ──────────────────────────────────────────────────────── */
    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
