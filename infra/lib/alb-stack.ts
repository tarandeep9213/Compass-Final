import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import { Construct } from "constructs";

interface AlbStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.SecurityGroup;
  instance: ec2.Instance;
}

export class AlbStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, props);

    /* ── Application Load Balancer ─────────────────────────────────────── */
    this.alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      loadBalancerName: "compass-alb",
    });

    /* ── Target Group (EC2 instance on port 80 = nginx) ────────────────── */
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: "/",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: "200",
      },
    });
    targetGroup.addTarget(new targets.InstanceTarget(props.instance, 80));

    /* ── HTTP Listener (port 80) ──────────────────────────────────────── */
    // Serves HTTP by default. When you add a certificate (DNS stack),
    // this listener redirects to HTTPS automatically.
    this.alb.addListener("HttpListener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    /* ── Outputs ──────────────────────────────────────────────────────── */
    new cdk.CfnOutput(this, "AlbDnsName", { value: this.alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, "AlbUrl", {
      value: `http://${this.alb.loadBalancerDnsName}`,
    });
  }
}
