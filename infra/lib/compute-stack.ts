import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.SecurityGroup;
  instanceProfile: iam.CfnInstanceProfile;
  keyPairName: string;
  instanceType: string;
  frontendRepoUri: string;
  backendRepoUri: string;
}

export class ComputeStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly eip: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    /* ── User Data — bootstrap Docker + Docker Compose ────────────────── */
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "set -euxo pipefail",

      // System updates
      "apt-get update -y",
      "apt-get upgrade -y",

      // Install Docker
      "apt-get install -y ca-certificates curl gnupg",
      "install -m 0755 -d /etc/apt/keyrings",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
      "chmod a+r /etc/apt/keyrings/docker.gpg",
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null',
      "apt-get update -y",
      "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",

      // Start Docker
      "systemctl enable docker",
      "systemctl start docker",
      "usermod -aG docker ubuntu",

      // Install AWS CLI
      "apt-get install -y awscli",

      // Create app directory
      "mkdir -p /opt/compass",
      "chown ubuntu:ubuntu /opt/compass",

      // Create .env.prod
      `cat > /opt/compass/.env.prod << 'ENVEOF'`,
      `DATABASE_URL=postgresql://cashroom:CHANGE_ME_SECURE_PG_PASSWORD@db:5432/cashroom`,
      `POSTGRES_PASSWORD=CHANGE_ME_SECURE_PG_PASSWORD`,
      `SECRET_KEY=CHANGE_ME_TO_A_SECURE_RANDOM_STRING`,
      `CORS_ORIGINS=["*"]`,
      `EMAIL_ENABLED=false`,
      `DEBUG=false`,
      `ENVEOF`,

      // Create docker-compose.prod.yml
      `cat > /opt/compass/docker-compose.prod.yml << 'COMPEOF'`,
      `services:`,
      `  db:`,
      `    image: postgres:16-alpine`,
      `    container_name: compass-db`,
      `    restart: unless-stopped`,
      `    environment:`,
      `      POSTGRES_DB: cashroom`,
      `      POSTGRES_USER: cashroom`,
      `      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}`,
      `    volumes:`,
      `      - pg_data:/var/lib/postgresql/data`,
      `    healthcheck:`,
      `      test: ["CMD-SHELL", "pg_isready -U cashroom"]`,
      `      interval: 10s`,
      `      timeout: 5s`,
      `      retries: 5`,
      ``,
      `  backend:`,
      `    image: ${props.backendRepoUri}:latest`,
      `    container_name: compass-backend`,
      `    restart: unless-stopped`,
      `    ports:`,
      `      - "8000:8000"`,
      `    env_file: .env.prod`,
      `    depends_on:`,
      `      db:`,
      `        condition: service_healthy`,
      `    healthcheck:`,
      `      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]`,
      `      interval: 30s`,
      `      timeout: 5s`,
      `      retries: 3`,
      `      start_period: 30s`,
      ``,
      `  frontend:`,
      `    image: ${props.frontendRepoUri}:latest`,
      `    container_name: compass-frontend`,
      `    restart: unless-stopped`,
      `    ports:`,
      `      - "80:80"`,
      `    depends_on:`,
      `      backend:`,
      `        condition: service_healthy`,
      ``,
      `volumes:`,
      `  pg_data:`,
      `COMPEOF`,

      // Create deploy script
      `cat > /opt/compass/deploy.sh << 'DEPLOYEOF'`,
      `#!/bin/bash`,
      `set -euo pipefail`,
      `REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)`,
      `aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${account}.dkr.ecr.${region}.amazonaws.com`,
      `cd /opt/compass`,
      `docker compose -f docker-compose.prod.yml pull`,
      `docker compose -f docker-compose.prod.yml up -d`,
      `docker image prune -f`,
      `echo "Deploy complete at $(date)"`,
      `DEPLOYEOF`,
      "chmod +x /opt/compass/deploy.sh",

      // First deploy (will fail gracefully if images not pushed yet)
      `su - ubuntu -c "/opt/compass/deploy.sh" || echo "Initial deploy skipped — push images first"`,
    );

    /* ── EC2 Instance ─────────────────────────────────────────────────── */
    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.lookup({
        name: "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*",
        owners: ["099720109477"], // Canonical
      }),
      securityGroup: props.ec2SecurityGroup,
      keyPair: ec2.KeyPair.fromKeyPairName(this, "KeyPair", props.keyPairName),
      userData,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // Attach instance profile for ECR access
    const cfnInstance = this.instance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.iamInstanceProfile = props.instanceProfile.instanceProfileName;

    /* ── Elastic IP ───────────────────────────────────────────────────── */
    this.eip = new ec2.CfnEIP(this, "Eip", {
      instanceId: this.instance.instanceId,
      tags: [{ key: "Name", value: "Compass-EC2" }],
    });

    /* ── Outputs ──────────────────────────────────────────────────────── */
    new cdk.CfnOutput(this, "InstanceId", { value: this.instance.instanceId });
    new cdk.CfnOutput(this, "PublicIp", { value: this.eip.attrPublicIp });
    new cdk.CfnOutput(this, "SshCommand", {
      value: `ssh -i ${props.keyPairName}.pem ubuntu@${this.eip.attrPublicIp}`,
    });
  }
}
