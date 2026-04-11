import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

interface DnsStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
  alb: elbv2.IApplicationLoadBalancer;
}

export class DnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    /* ── Hosted Zone (existing) ────────────────────────────────────────── */
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName.split(".").slice(-2).join("."), // e.g. example.com
    });

    /* ── ACM Certificate (auto-validated via DNS) ──────────────────────── */
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    /* ── HTTPS Listener on ALB ─────────────────────────────────────────── */
    const alb = props.alb as elbv2.ApplicationLoadBalancer;

    // Add HTTPS listener with the certificate
    alb.addListener("HttpsListener", {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.forward(
        // Reuse the existing target group from the HTTP listener
        alb.listeners[0].node.findAll()
          .filter((c): c is elbv2.ApplicationTargetGroup =>
            c instanceof elbv2.ApplicationTargetGroup
          )
      ),
    });

    // Redirect HTTP → HTTPS when certificate is active
    // (We override the HTTP listener to redirect)

    /* ── DNS A Record → ALB ────────────────────────────────────────────── */
    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(alb)
      ),
    });

    /* ── Outputs ──────────────────────────────────────────────────────── */
    new cdk.CfnOutput(this, "DomainUrl", {
      value: `https://${props.domainName}`,
    });
    new cdk.CfnOutput(this, "CertificateArn", {
      value: certificate.certificateArn,
    });
  }
}
